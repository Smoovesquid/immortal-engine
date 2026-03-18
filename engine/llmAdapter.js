// Optional AI narration augmentation (SAFE MODE).
// Engine must work offline without this.
// Read-only: LLM never mutates world; output is validated and may be discarded.

import { ensureWorld } from './state.js';
import { buildNarratorContext } from './ai/narratorContext.js';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

// ── N3: Grounded system prompt ────────────────────────────────────────────────

const NODE_TYPE_DESCRIPTIONS = {
  settlement:       'a settlement — it has roads, buildings, and people',
  wilderness:       'wilderness — open terrain, no roads, no buildings',
  landmark:         'a landmark — one significant structure stands here, no road grid',
  dungeon_entrance: 'a dungeon entrance — a descent into darkness; no open sky here'
};

const NODE_TYPE_FORBIDDEN = {
  settlement:       [],
  wilderness:       ['road', 'roads', 'building', 'buildings', 'shop', 'inn', 'tavern'],
  landmark:         ['road', 'roads', 'market', 'town'],
  dungeon_entrance: ['open sky', 'sunshine', 'sunlight', 'horizon', 'field', 'meadow']
};

// N5: tone word injection
const TONE_GUIDANCE = {
  blood:       'The tone is brutal and desperate. Life is cheap. Describe with visceral honesty.',
  grim:        'The tone is cold and weary. Hope exists but costs something. Describe with tension.',
  cooperative: 'The tone is warm but not naive. Allies exist. Describe with grounded optimism.'
};

/**
 * N3: buildSystemPrompt(ctx) → string
 * Constructs a grounded system prompt from the narrator context.
 * Pure function — no API calls.
 */
export function buildSystemPrompt(ctx) {
  const typeDesc = NODE_TYPE_DESCRIPTIONS[ctx.nodeType] ?? 'a place';
  const tone     = TONE_GUIDANCE[ctx.tone] ?? TONE_GUIDANCE.grim;

  const inside = ctx.interior
    ? `The player is inside a structure (room: ${ctx.interior.roomId}).`
    : `The player is outside.`;

  const structures = ctx.structuresHere.length
    ? `Structures here: ${ctx.structuresHere.map(s => `${s.kind} #${s.index}`).join(', ')}.`
    : 'No structures are present here.';

  return [
    `You are a Dungeon Master narrator. Describe what the player experiences in ONE sentence.`,
    ``,
    `CANONICAL FACTS — you must not contradict these:`,
    `- Location: "${ctx.placeName}"`,
    `- Place type: ${typeDesc}`,
    `- ${inside}`,
    `- ${structures}`,
    ``,
    `RULES:`,
    `- Do NOT invent topology, place names, or structures not listed above.`,
    `- Do NOT use the words: actually, turns out.`,
    `- Do NOT use brackets or parentheses.`,
    `- Write exactly ONE sentence.`,
    `- Reference the location name "${ctx.placeName}" in your narration.`,
    ``,
    tone
  ].join('\n');
}

// ── N2: Anthropic API call ────────────────────────────────────────────────────

export async function callLLM({
  ctx,
  baseNarration,
  apiKey,
  model = DEFAULT_MODEL,
  fetchImpl = globalThis.fetch
}) {
  const sys  = buildSystemPrompt(ctx);
  const user = JSON.stringify({
    playerAction: ctx.actionText || '(no action)',
    baseNarration,
    mechanics: ctx.mechanicsText || ''
  });

  const res = await fetchImpl(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'content-type':    'application/json',
      'x-api-key':       apiKey,
      'anthropic-version': ANTHROPIC_VERSION
    },
    body: JSON.stringify({
      model,
      max_tokens: 120,
      system: sys,
      messages: [{ role: 'user', content: user }]
    })
  });

  if (!res.ok) throw new Error(`Anthropic API HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.content?.[0]?.text;
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

// ── N4: Extended grounding validator ─────────────────────────────────────────

export function validateNarrationCandidate(world, narrationCandidate, {
  facts = [],
  styleProfile = {},
  baseNarration = '',
  motifs = [],
  ctx = null
} = {}) {
  const cand = String(narrationCandidate ?? '').trim();
  if (!cand) return false;

  // Forbidden tokens.
  if (/\b(actually|turns\s+out)\b/i.test(cand)) return false;

  // Must be exactly one sentence (loosely): reject if contains brackets or multiple terminal punctuation.
  if (/[\[\]]/.test(cand)) return false;
  const terminals = (cand.match(/[.!?]/g) || []).length;
  if (terminals > 1) return false;

  // Location lock: must include current location token.
  const w = world ? ensureWorld(world) : null;
  const loc = String(w?.scene?.location ?? ctx?.placeName ?? '').trim();
  if (loc && !containsInsensitive(cand, loc)) return false;

  // Objective lock: if objective exists, narration must not claim a different explicit objective.
  const obj = String(w?.scene?.objective ?? '').trim();
  if (obj && /objective\s*:/i.test(cand) && !containsInsensitive(cand, obj)) return false;

  // N4: Node-type violation guard — check forbidden words for this nodeType.
  const nodeType = ctx?.nodeType ?? w?.map?.nodes?.find(n => n.id === w?.map?.currentNodeId)?.nodeType ?? '';
  const forbidden = NODE_TYPE_FORBIDDEN[nodeType] ?? [];
  const candLower = cand.toLowerCase();
  for (const word of forbidden) {
    if (candLower.includes(word)) return false;
  }

  // Contradiction guard: provided "FACTS YOU MAY NOT CHANGE" + any local "not X" facts.
  for (const t0 of facts) {
    const t = String(t0 ?? '').trim();
    if (!t.toLowerCase().startsWith('not ')) continue;
    const denied = t.slice(4).trim();
    if (denied && containsInsensitive(cand, denied)) return false;
  }
  const ledgerFacts = Array.isArray(w?.ledger?.facts) ? w.ledger.facts : [];
  for (const f of ledgerFacts) {
    const t = String(f?.text ?? '').trim();
    if (!t.toLowerCase().startsWith('not ')) continue;
    const denied = t.slice(4).trim();
    if (denied && containsInsensitive(cand, denied)) return false;
  }

  // New-noun heuristic: reject if candidate introduces too many tokens not in allowed vocab.
  const allowed = buildAllowedVocab({ baseNarration, styleProfile, facts, motifs, world: w, ctx });
  const tokens = tokenize(cand);
  let unknownNounish = 0;
  for (const tok of tokens) {
    if (allowed.has(tok)) continue;
    if (looksNounish(tok)) unknownNounish++;
    if (unknownNounish >= 3) return false;
  }

  return true;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function augmentNarration({
  world,
  outcome,
  baseNarration,
  enabled = false,
  apiKey = '',
  model = DEFAULT_MODEL,
  fetchImpl = globalThis.fetch
} = {}) {
  const base = String(baseNarration ?? '').trim();
  if (!enabled) return base;
  if (!apiKey)  return base;
  if (typeof fetchImpl !== 'function') return base;

  const ctx = buildNarratorContext(world, outcome);

  let candidate = '';
  try {
    candidate = await callLLM({ ctx, baseNarration: base, apiKey, model, fetchImpl });
  } catch {
    return base;
  }

  const ok = validateNarrationCandidate(ensureWorld(world), candidate, {
    baseNarration: base,
    ctx
  });
  return ok ? candidate : base;
}

// ── Legacy compatibility shim ─────────────────────────────────────────────────
// Tests that import llmInputFromWorld directly still work.
export function llmInputFromWorld(world, { outcome, motifs = [], lastNarration = '' } = {}) {
  const w = ensureWorld(world);
  return {
    scene: w.scene,
    outcome,
    fate: w.meta.fate,
    clocks: w.clocks,
    motifs,
    lastNarration
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildAllowedVocab({ baseNarration, styleProfile, facts, motifs, world, ctx }) {
  const parts = [
    baseNarration,
    ctx?.placeName ?? '',
    ctx?.nodeType  ?? '',
    JSON.stringify(styleProfile ?? {}),
    ...(facts  || []),
    ...(motifs || []),
    world?.scene?.location  ?? '',
    world?.scene?.objective ?? ''
  ].map(String);
  const vocab = new Set();
  for (const p of parts) {
    for (const t of tokenize(p)) vocab.add(t);
  }
  return vocab;
}

function tokenize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function looksNounish(tok) {
  if (!tok) return false;
  if (tok.length < 6) return false;
  if (/^(wizard|objective|because|towards|without|between)$/i.test(tok)) return false;
  return true;
}

function containsInsensitive(hay, needle) {
  return String(hay).toLowerCase().includes(String(needle).toLowerCase());
}
