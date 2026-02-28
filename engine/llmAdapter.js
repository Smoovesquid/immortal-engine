// Optional AI narration augmentation (SAFE MODE).
// Engine must work offline without this.
// Read-only: LLM never mutates world; output is validated and may be discarded.

import { ensureWorld } from './state.js';

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

export async function augmentNarration({
  world,
  outcome,
  baseNarration,
  lastNarration = '',
  motifs = [],
  facts = [],
  styleProfile = {},
  enabled = false,
  apiKey = '',
  endpoint = 'https://api.openai.com/v1/chat/completions',
  model = 'gpt-4o-mini',
  fetchImpl = globalThis.fetch
} = {}) {
  const base = String(baseNarration ?? '').trim();
  if (!enabled) return base;
  if (!apiKey) return base;
  if (typeof fetchImpl !== 'function') return base;

  const input = llmInputFromWorld(world, { outcome, motifs, lastNarration });

  let candidate = '';
  try {
    candidate = await callLLM({ input, baseNarration: base, apiKey, endpoint, model, fetchImpl, facts, styleProfile });
  } catch {
    return base;
  }

  const ok = validateNarrationCandidate(ensureWorld(world), candidate, {
    facts,
    styleProfile,
    baseNarration: base,
    motifs
  });
  return ok ? candidate : base;
}

export async function callLLM({ input, baseNarration, apiKey, endpoint, model, fetchImpl, facts = [], styleProfile = {} }) {
  // This is OPTIONAL. If it fails, caller must fall back silently.
  // Keep prompt minimal and constrained.
  const sys = `You are a Dungeon Master. Rewrite the given narration into ONE sentence.\nRules:\n- Do NOT change location or objective.\n- Do NOT introduce new facts.\n- Do NOT use brackets.\n- Do NOT use the words: actually, turns out.\n- Keep wizard voice.`;
  const user = {
    styleProfile,
    factsYouMayNotChange: facts,
    input,
    baseNarration
  };

  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: JSON.stringify(user) }
      ],
      temperature: 0.2
    })
  });

  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

export function validateNarrationCandidate(world, narrationCandidate, { facts = [], styleProfile = {}, baseNarration = '', motifs = [] } = {}) {
  const cand = String(narrationCandidate ?? '').trim();
  if (!cand) return false;

  // Forbidden tokens.
  if (/\b(actually|turns\s+out)\b/i.test(cand)) return false;

  // Must be exactly one sentence (loosely): reject if contains brackets or multiple terminal punctuation.
  if (/[\[\]]/.test(cand)) return false;
  const terminals = (cand.match(/[\.!\?]/g) || []).length;
  if (terminals > 1) return false;

  // Location lock: must include current location token.
  const loc = String(world.scene?.location ?? '').trim();
  if (loc && !containsInsensitive(cand, loc)) return false;

  // Objective lock: if objective exists, narration must not claim a different explicit objective.
  const obj = String(world.scene?.objective ?? '').trim();
  if (obj && /objective\s*:/i.test(cand) && !containsInsensitive(cand, obj)) return false;

  // Contradiction guard: provided "FACTS YOU MAY NOT CHANGE" + any local "not X" facts.
  for (const t0 of facts) {
    const t = String(t0 ?? '').trim();
    if (!t.toLowerCase().startsWith('not ')) continue;
    const denied = t.slice(4).trim();
    if (denied && containsInsensitive(cand, denied)) return false;
  }
  const ledgerFacts = Array.isArray(world.ledger?.facts) ? world.ledger.facts : [];
  for (const f of ledgerFacts) {
    const t = String(f?.text ?? '').trim();
    if (!t.toLowerCase().startsWith('not ')) continue;
    const denied = t.slice(4).trim();
    if (denied && containsInsensitive(cand, denied)) return false;
  }

  // New-noun heuristic: reject if candidate introduces too many tokens not in allowed vocab.
  const allowed = buildAllowedVocab({ baseNarration, styleProfile, facts, motifs, world });
  const tokens = tokenize(cand);
  let unknownNounish = 0;
  for (const tok of tokens) {
    if (allowed.has(tok)) continue;
    if (looksNounish(tok)) unknownNounish++;
    if (unknownNounish >= 3) return false;
  }

  return true;
}

function buildAllowedVocab({ baseNarration, styleProfile, facts, motifs, world }) {
  const parts = [
    baseNarration,
    JSON.stringify(styleProfile ?? {}),
    ...(facts || []),
    ...(motifs || []),
    world.scene?.location || '',
    world.scene?.objective || ''
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
  // crude: longer words are treated as potential nouns.
  if (!tok) return false;
  if (tok.length < 6) return false;
  if (/^(wizard|objective|because|towards|without|between)$/i.test(tok)) return false;
  return true;
}

function containsInsensitive(hay, needle) {
  return String(hay).toLowerCase().includes(String(needle).toLowerCase());
}
