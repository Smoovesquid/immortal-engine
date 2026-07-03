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
import { VERBS, APPROACHES, STAKES } from './intentSchema.js';

// Below this confidence, the deterministic floor (parseIntent, via
// assemblePacket) is considered unclassified/low-confidence and worth asking
// the LLM to take a swing at. Reuses parseIntent's own 0-1 scale — its
// "verb:'ask'" fallback paths emit 0.2 (empty/unparseable text) and 0.4 (no
// recognized verb token); anything at or below that band is exactly the
// "the regex gave up" case this packet targets. No new scale is invented.
export const LOW_CONFIDENCE_THRESHOLD = 0.4;

// Short budget so a slow/hung provider can never stall a turn. Reuses the
// AbortController pattern already established in server/localLlmProvider.js.
const DEFAULT_TIMEOUT_MS = 4000;

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
    stake: STAKES,
    ambiguity: ['target', 'object', 'goal', 'referent', null],
    kind: 'string|null'
  };
}

function buildPrompt(text, bundle) {
  const candidateEntities = (bundle.entities || []).map(e => e.name || e.id).filter(Boolean);
  const candidateObjects = [
    ...(bundle.abilities || []),
    ...(bundle.spells || []),
    ...(bundle.items || [])
  ].filter(Boolean);

  return [
    'You translate a player\'s free-text D&D action into a strict JSON intent packet.',
    'You NEVER invent an id — only use ids/names that appear in the candidate lists below.',
    'If nothing in the scene matches, use null / an empty array rather than guessing.',
    'Reply with ONLY strict JSON matching the schema — no prose, no markdown fences.',
    '',
    `Player said: ${JSON.stringify(String(text || ''))}`,
    `Candidate entities (targets): ${JSON.stringify(candidateEntities)}`,
    `Candidate objects (abilities/spells/items): ${JSON.stringify(candidateObjects)}`,
    `Schema: ${JSON.stringify(schemaHint())}`
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
      messages: [
        { role: 'system', content: 'You are a precise, literal JSON-only intent translator. Never invent facts.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0,
      max_tokens: 400,
      fetchImpl: wrappedFetch
    });
    return parseJsonCandidate(content);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function tryOllama(prompt, { fetchImpl, timeoutMs }) {
  try {
    const res = await queryLocal({ prompt, timeout: timeoutMs, maxTokens: 300, fetchImpl });
    if (res && res.ok && res.result && typeof res.result === 'object') return res.result;
    return null;
  } catch {
    return null;
  }
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
    const scene = bundle || sceneBundleFor(world);
    const prompt = buildPrompt(text, scene);
    const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;

    // Anthropic first.
    const viaAnthropic = await tryAnthropic(prompt, { fetchImpl: opts.fetchImpl, timeoutMs });
    if (viaAnthropic) return { ...viaAnthropic, text: String(text || '') };

    // Ollama on failure/absent key.
    const viaOllama = await tryOllama(prompt, { fetchImpl: opts.fetchImpl, timeoutMs });
    if (viaOllama) return { ...viaOllama, text: String(text || '') };

    return null;
  } catch {
    return null;
  }
}
