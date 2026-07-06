/**
 * llmIntent — server-side LLM proposal for the IntentPacket.
 *
 * INT-2. SERVER-ONLY. This module must NEVER be imported by engine/playloop.js
 * or anything else reachable from public/v1.js's import graph — it imports
 * server/llmProvider.js (chatCompletion) and server/localLlmProvider.js
 * (queryLocal), both of which read process.env.ANTHROPIC_API_KEY. If this
 * module's import graph ever reaches the browser bundle, the key-check logic
 * (or worse, a real key) leaks to the client. See CLAUDE.md Purity Rule 9 and
 * docs/briefs/INT-2-llm-translator-sonnet.md "THE HARD CONSTRAINT".
 *
 * Only server.js's /api/move handler calls proposeIntentViaLlm, grounds the
 * result via groundPacket.js, and passes it into playerMove's optional 4th
 * parameter. The LLM never decides an outcome, rolls a die, or mutates state —
 * it only proposes packet FIELDS, which grounding then validates against the
 * real scene bundle before anything downstream can use them.
 *
 * NEVER THROWS. Any failure (no key, no Ollama, timeout, malformed JSON) is a
 * silent miss — the caller falls back to the deterministic packet.
 */

import { chatCompletion } from '../../server/llmProvider.js';
import { queryLocal } from '../../server/localLlmProvider.js';
import { buildParseCtx } from './assemblePacket.js';
import { VERBS, APPROACHES, STAKES, STATS } from './intentSchema.js';

// Below this confidence, the deterministic floor (parseIntent, via
// assemblePacket) is considered unclassified/low-confidence and worth asking
// the LLM to take a swing at. Reuses parseIntent's own 0-1 scale — its
// "verb:'ask'" fallback paths emit 0.2 (empty/unparseable text) and 0.4 (no
// recognized verb token); anything at or below that band is exactly the
// "the regex gave up" case this packet targets. No new scale is invented.
export const LOW_CONFIDENCE_THRESHOLD = 0.4;

// Short budget so a slow/hung provider can never stall a turn. Reuses the
// AbortController pattern already established in server/localLlmProvider.js.
// INT-2R — measured live against a real warm llama3.1:8b (2026-07-03):
// proposeIntentViaLlm called IN-PROCESS costs ~2.4-3.7s for the full
// production prompt; the SAME call through the real /api/intent-packet HTTP
// route costs ~5.9s (Express/HTTP-stack overhead on top of the model call
// itself — reproducible, not a fluke: measured directly). The old 4000ms
// default was silently missing in the realistic (HTTP-routed) path. Widened
// with real headroom above the measured worst case; still bounded — a miss
// here always falls back to the deterministic parser, and the CLIENT's own
// /api/intent-packet fetch carries its own separate, tighter budget in
// public/v1.js so a slow server never stalls the player either way.
const DEFAULT_TIMEOUT_MS = 8000;

// The ears' Anthropic model is its OWN setting, separate from LLM_MODEL, so
// intent-translation runs the fast/cheap tier while narration keeps its richer
// default. Tim's ruling 2026-07-03 (evening — supersedes the morning's
// Ollama-primary): Haiku primary. claude-haiku-4-5 round-trips this small
// JSON job in ~1-2s at ~$0.0016/turn.
export function intentModel() {
  return (process.env.INTENT_LLM_MODEL || '').trim() || 'claude-haiku-4-5';
}

export function isLowConfidencePacket(packet) {
  if (!packet || typeof packet !== 'object') return true;
  const c = Number(packet.confidence);
  if (!Number.isFinite(c)) return true;
  return c <= LOW_CONFIDENCE_THRESHOLD;
}

// Compact scene bundle for the prompt — same candidate universe assemblePacket
// already gathers via buildParseCtx, reused rather than re-derived.
function sceneBundleFor(world) {
  return buildParseCtx(world);
}

function schemaHint() {
  return {
    verb: VERBS,
    target: 'string|null — an id/name from candidateEntities, or null',
    targets: 'string[] — subset of candidateEntities ids/names',
    objects: 'string[] — subset of candidateObjects (abilities/spells/items/entities)',
    with: 'string|null — an instrument from candidateObjects, or null',
    approach: APPROACHES,
    stat: [...STATS, null],
    stake: STAKES,
    ambiguity: ['target', 'object', 'goal', 'referent', null],
    kind: ['npc-addressed', 'rules', 'referent-followup', 'place', null]
  };
}

// INT-2R — a small, fixed few-shot set covering one example per verb family
// (attack/talk/search/use/take/flee/wait/cast/move/ask-fallback). Deliberately
// generic (not scene-specific) so it teaches the VOCABULARY and JSON shape
// without ever suggesting a real id the model might echo into an unrelated
// scene. llama3.1:8b's failure mode (benchmarked 2026-07-03) was fluent
// non-canonical verbs ("stab" instead of "attack") — these pairs pin the
// exact string the schema requires.
//
// The "I ask <name>, is there a name on it?" / "who did X, Elske?" pairs
// below are load-bearing: the 2026-07-03 hardened-prompt benchmark showed
// BOTH Anthropic and Ollama misreading the ENGLISH word "ask" in a player's
// sentence as a signal to emit the schema's verb:'ask' token — but 'ask' in
// this schema means "no mechanical verb applies, hand to free narration"
// (intentSchema.js), NOT "the player used the word ask/asked." Addressing an
// NPC (even by literally saying "I ask <name>...") is verb:'talk'. The
// clarifying instruction line below plus a second disambiguating example
// (a WH-question-shaped address, matching the failing corpus rows' shape)
// fixes this without inventing a second vocabulary.
const FEW_SHOT = [
  { text: 'I stab the goblin', out: { verb: 'attack', target: 'goblin', with: null, kind: null } },
  { text: 'I ask the innkeeper about the well', out: { verb: 'talk', target: 'innkeeper', with: null, kind: 'npc-addressed' } },
  { text: 'who lit that lantern, Elske?', out: { verb: 'talk', target: 'Elske', with: null, kind: 'npc-addressed' } },
  { text: 'I look around the room', out: { verb: 'search', target: null, with: null, kind: null } },
  { text: 'I light the torch', out: { verb: 'use', target: 'torch', with: null, kind: null } },
  { text: 'I run from the fight', out: { verb: 'flee', target: null, with: null, kind: null } },
  { text: 'I pry the hatch open — set the DC and I\'ll roll Strength', out: { verb: 'use', target: null, with: null, stat: 'MIGHT', kind: null } }
];

function buildPrompt(text, bundle) {
  // Prompt diet — cap the candidate lists: a full room can list dozens of
  // entities/items, and prompt-eval time is the bulk of a small model's
  // latency. The nearest/salient candidates come first in buildParseCtx.
  const candidateEntities = (bundle.entities || []).map(e => e.name || e.id).filter(Boolean).slice(0, 12);
  const candidateObjects = [
    ...(bundle.abilities || []),
    ...(bundle.spells || []),
    ...(bundle.items || [])
  ].filter(Boolean).slice(0, 14);

  const examples = FEW_SHOT.map(ex => `Player said: ${JSON.stringify(ex.text)}\nJSON: ${JSON.stringify(ex.out)}`).join('\n\n');

  return [
    'You translate a player\'s free-text D&D action into a strict JSON intent packet.',
    `The "verb" field MUST be exactly one of these ${VERBS.length} strings — never a synonym, never a variant: ${JSON.stringify(VERBS)}.`,
    '"talk" is for ANY address to a person present — greeting, questioning, persuading, demanding, even a sentence that literally contains the English word "ask" or "asked". "ask" (the verb value) means something different: NO mechanical verb applies at all — pure free narration with no action and no addressee (e.g. "I admire the sunset", "what do I smell?"). Do not pick "ask" just because the player\'s SENTENCE contains that word.',
    '"kind" is null unless the player is ASKING A QUESTION; a question gets exactly one of: npc-addressed | rules | referent-followup | place. An action ("Smash the window", "go outside") is always kind:null.',
    '"stat" is null UNLESS the player explicitly names an ability to roll ("I\'ll roll Strength", "a Dexterity check", "using my WITS") — then set it to that ability as one of MIGHT | AGILITY | GRIT | CHARM | WITS (Strength=MIGHT, Dexterity=AGILITY, Constitution=GRIT, Intelligence/Wisdom=WITS, Charisma=CHARM). Never guess a stat from the action alone; a plain action leaves stat:null.',
    'You NEVER invent an id — only use ids/names that appear in the candidate lists below.',
    'If nothing in the scene matches, use null / an empty array rather than guessing.',
    'Reply with ONLY strict JSON matching the schema — no prose, no markdown fences, no acknowledgement. Your ENTIRE reply is the one JSON object for the final "Player said" line.',
    '',
    'Examples (generic — do not reuse these names in your answer):',
    examples,
    '',
    `Player said: ${JSON.stringify(String(text || ''))}`,
    `Candidate entities (targets): ${JSON.stringify(candidateEntities)}`,
    `Candidate objects (abilities/spells/items): ${JSON.stringify(candidateObjects)}`,
    `Schema: ${JSON.stringify(schemaHint())}`,
    'JSON:'
  ].join('\n');
}

function parseJsonCandidate(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  // Defensive: strip a stray markdown fence if the model ignored the instruction.
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) s = fenced[1].trim();
  try {
    const parsed = JSON.parse(s);
    return (parsed && typeof parsed === 'object') ? parsed : null;
  } catch {
    return null;
  }
}

async function tryAnthropic(prompt, { fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const wrappedFetch = (url, opts) => (fetchImpl || globalThis.fetch)(url, { ...opts, signal: controller.signal });
    const { content } = await chatCompletion({
      model: intentModel(),
      messages: [
        { role: 'system', content: 'You are a precise, literal JSON-only intent translator. Never invent facts.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0,
      max_tokens: 400,
      fetchImpl: wrappedFetch
    });
    const parsed = parseJsonCandidate(content);
    if (!parsed && process.env.INTENT_DEBUG === '1') {
      console.error('[intent-ear] unparseable anthropic reply:', String(content ?? '(empty)').slice(0, 400));
    }
    return parsed;
  } catch (e) {
    // Silent fallback is the LAW (the game must never stall on the ear), but
    // invisible failures made the 07-03 diagnosis slow — INTENT_DEBUG=1 gives
    // the server console the reason without changing any behavior.
    if (process.env.INTENT_DEBUG === '1') console.error('[intent-ear] anthropic leg failed:', e?.message || e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function tryOllama(prompt, { fetchImpl, timeoutMs }) {
  try {
    // INT-2R — greedy decoding (temperature 0) for a literal-translation task,
    // and a short reply cap (this packet's JSON is a handful of fields) so a
    // warm call lands comfortably inside the timeout budget.
    const res = await queryLocal({ prompt, timeout: timeoutMs, maxTokens: 160, temperature: 0, fetchImpl });
    if (res && res.ok && res.result && typeof res.result === 'object') return res.result;
    return null;
  } catch {
    return null;
  }
}

// Provider order (Tim's rulings, 2026-07-03 — the evening Haiku-primary
// ruling superseded the morning's Ollama-primary): the Anthropic fast tier
// (intentModel(), default claude-haiku-4-5) reads FIRST — ~1-2s, no cold
// start, and the sharper ear on the benchmark — with the local Ollama model
// as the free/offline fallback; the deterministic parseIntent floor catches
// everything upstream in the caller. `INTENT_LLM` selects:
//   'off'      — no provider is ever consulted (U377's zero-outbound guarantee).
//   'ollama'   — Ollama only, no Anthropic fallback.
//   'anthropic'— Anthropic only, no Ollama fallback.
//   'auto' | '' | unset — Anthropic first, Ollama on an Anthropic miss (default).
function providerMode() {
  const v = String(process.env.INTENT_LLM || '').trim().toLowerCase();
  if (v === 'off' || v === 'ollama' || v === 'anthropic') return v;
  return 'auto';
}

/**
 * proposeIntentViaLlm(world, text, bundle) -> Promise<object|null>
 *
 * `bundle` is optional — if omitted, it is built from `world` via the same
 * buildParseCtx assemblePacket.js uses. Returns the RAW proposed packet fields
 * (unvalidated) or null. Grounding (groundPacket.js) happens separately so the
 * validation logic is unit-testable with no network call.
 *
 * NEVER THROWS.
 */
export async function proposeIntentViaLlm(world, text, bundle, opts = {}) {
  try {
    const mode = providerMode();
    if (mode === 'off') return null;

    const scene = bundle || sceneBundleFor(world);
    const prompt = buildPrompt(text, scene);
    // opts.timeoutMs is the TOTAL budget for the whole chain, not per leg —
    // two sequential full-budget legs was the 07-03 "13.7s route" bug.
    const totalMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
    const t0 = Date.now();
    const remaining = () => Math.max(250, totalMs - (Date.now() - t0));

    if (mode === 'ollama') {
      const viaOllama = await tryOllama(prompt, { fetchImpl: opts.fetchImpl, timeoutMs: remaining() });
      return viaOllama ? { ...viaOllama, text: String(text || '') } : null;
    }

    // Anthropic (Haiku-class) first — mode 'anthropic' or the 'auto' default.
    // In 'auto' the leg is capped so a hung cloud call still leaves the local
    // fallback a real share of the budget; a fast-fail (no key/401) costs
    // near-zero and hands Ollama nearly the whole budget (the offline case).
    const anthropicMs = mode === 'anthropic' ? remaining() : Math.min(3000, remaining());
    const viaAnthropic = await tryAnthropic(prompt, { fetchImpl: opts.fetchImpl, timeoutMs: anthropicMs });
    if (viaAnthropic) return { ...viaAnthropic, text: String(text || '') };
    if (mode === 'anthropic') return null; // no Ollama fallback in this mode

    const viaOllama = await tryOllama(prompt, { fetchImpl: opts.fetchImpl, timeoutMs: remaining() });
    if (viaOllama) return { ...viaOllama, text: String(text || '') };

    return null;
  } catch (e) {
    if (process.env.INTENT_DEBUG === '1') console.error('[intent-ear] proposal failed:', e?.message || e);
    return null;
  }
}
