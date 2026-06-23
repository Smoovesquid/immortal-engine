// ─────────────────────────────────────────────────────────────────────────────
// server/refJudge.js — THE REF's live judge + regenerate adapter (Tier 2).
//
// Built per-request in /api/narrate and INJECTED into augmentNarration (engine/ref
// stays pure; this is where the model call lives, beside the other LLM calls). Per
// Tim's Open-Decision-A call: SAME-FAMILY Haiku judge with Vol-14 mitigations
// (atomic yes/no atoms, NO chain-of-thought) — works on the existing Anthropic key,
// cheapest per call, and Haiku-judging-Sonnet is a different capability tier (the
// independence we can get without a second vendor key). Trivial to swap to a
// cross-family OpenAI judge later (set REF_JUDGE_PROVIDER + the client).
//
//   judge      → claude-haiku-4-5 (atomic; REF_JUDGE_MODEL overrides)
//   regenerate → the narrator family (sonnet; REF_REGEN_MODEL overrides), handed the
//                engine's grounded BASE as the exact content to convey, then run
//                back through the Tier-1 validator (never ship an unvalidated regen).
//
// Never throws to the caller — the orchestration treats a throw/empty as a fallback.
// ─────────────────────────────────────────────────────────────────────────────

import { chatCompletion } from './llmProvider.js';
import { validateNarrationCandidate } from '../engine/llmAdapter.js';
import { REF_JUDGE_SYSTEM, buildRefJudgeUser, REF_VERDICTS } from '../engine/ref/rubric.js';

const JUDGE_MODEL = (process.env.REF_JUDGE_MODEL || 'claude-haiku-4-5-20251001').trim();
const REGEN_MODEL = (process.env.REF_REGEN_MODEL || 'claude-sonnet-4-20250514').trim();

function firstJsonObject(text) {
  const s = String(text || '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

// Map the atomic judge JSON → the reviewNarration verdict shape. Robust to a model
// that omits `verdict`: derive it from the atoms (any failed atom → REGENERATE).
// Unknown/garbage → PASS (guardrail 1: bias HARD toward answering).
export function parseRefVerdict(text) {
  const obj = firstJsonObject(text);
  if (!obj || typeof obj !== 'object') return { verdict: REF_VERDICTS.PASS };

  const failure_class = typeof obj.failure_class === 'string' ? obj.failure_class : 'NONE';
  let v = String(obj.verdict || '').toUpperCase();

  if (!Object.values(REF_VERDICTS).includes(v)) {
    // Derive from atoms when the explicit verdict is missing/garbage.
    const anyFalse = [obj.answers_the_question, obj.grounded, obj.honest_on_unknown]
      .some(x => x === false);
    v = anyFalse ? REF_VERDICTS.REGENERATE : REF_VERDICTS.PASS;
  }
  return { verdict: v, failure_class, atoms: {
    answers_the_question: obj.answers_the_question,
    grounded: obj.grounded,
    honest_on_unknown: obj.honest_on_unknown,
    in_voice: obj.in_voice,
  } };
}

const FAILURE_NOTE = {
  ATMOSPHERE_DODGE: 'it dodged the question with mood/atmosphere instead of an answer or an honest "I couldn\'t say"',
  QUESTION_MISROUTE: 'it answered a different question than the one asked',
  FABRICATION: 'it asserted a specific (a count, a name, a date, or a who-did-what) that canon does not support',
  EMPTY_SUCCESS: 'it reported a success but delivered no actual content',
  MACHINE_DUMP: 'it dumped a list/stat block instead of speaking as a DM',
  NONE: 'it did not properly answer',
};

export function buildRegenSystem(failureClass) {
  const why = FAILURE_NOTE[failureClass] || FAILURE_NOTE.NONE;
  return [
    'You are re-voicing ONE line of Dungeon Master / NPC dialogue that was rejected because',
    `${why}.`,
    'Re-voice it to convey EXACTLY the grounded content given below — answer the question the',
    'player actually asked. If that content is an honest "I do not know", keep it an honest,',
    'in-character "I couldn\'t say" and invent NOTHING: no names of people or places, no numbers,',
    'counts, dates, titles, or history that are not already in the content.',
    'Reply with EXACTLY ONE sentence of in-character speech — no stage directions, no brackets,',
    'no lists, no preamble.',
  ].join(' ');
}

export function buildRegenUser({ input, mechanics, base, canon }) {
  return `PLAYER ASKED: ${input || '(none)'}
MECHANICS: ${mechanics || '(none)'}
GROUNDED CONTENT TO CONVEY (do not add to it): ${base || '(none)'}

CANON (only facts here are real; cite nothing beyond it):
${JSON.stringify(canon || {}, null, 0)}`;
}

/**
 * buildRefAdapter({ world, apiKey, fetchImpl }) -> { judge, regenerate }
 *   world     — the current world (for the Tier-1 validation of a regen).
 *   fetchImpl — injectable fetch (for tests / a custom transport).
 *
 * Both fns resolve to the reviewNarration contract: judge -> verdict object;
 * regenerate -> a validated one-line string, or null (→ orchestration falls back
 * to the engine's honest base).
 */
export function buildRefAdapter({ world = null, fetchImpl = globalThis.fetch } = {}) {
  const judge = async ({ input, mechanics, candidate, canon }) => {
    const out = await chatCompletion({
      model: JUDGE_MODEL,
      temperature: 0,
      max_tokens: 160,
      messages: [
        { role: 'system', content: REF_JUDGE_SYSTEM },
        { role: 'user', content: buildRefJudgeUser({ input, mechanics, candidate, canon }) },
      ],
      fetchImpl,
    });
    return parseRefVerdict(out?.content);
  };

  const regenerate = async ({ input, mechanics, base, canon, failureClass }) => {
    const out = await chatCompletion({
      model: REGEN_MODEL,
      temperature: 0.2,
      max_tokens: 160,
      messages: [
        { role: 'system', content: buildRegenSystem(failureClass) },
        { role: 'user', content: buildRegenUser({ input, mechanics, base, canon }) },
      ],
      fetchImpl,
    });
    const line = String(out?.content || '')
      .split('\n')[0].trim()
      .replace(/^["'“]+|["'”]+$/g, '').trim();
    if (!line) return null;
    // Never ship an unvalidated regen — run it through the SAME Tier-1 guard the
    // narrator's polish passes (invented proper nouns, contradictions, brackets,
    // multi-sentence, etc.). On failure → null → orchestration uses the honest base.
    try {
      const ok = validateNarrationCandidate(world || {}, line, { baseNarration: base || '' });
      return ok ? line : null;
    } catch {
      return line; // validator unavailable → trust the strict regen prompt
    }
  };

  return { judge, regenerate };
}
