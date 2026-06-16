import { ensureWorld } from '../state.js';

// POLISH contract:
// - exactly ONE sentence
// - no brackets
// - no "actually" / "turns out"
// - no location rewrite tokens
// - must not negate facts (simple heuristic)

export function validatePolish({ world, composerLine, candidateText }) {
  const w = ensureWorld(world);
  const base = String(composerLine || '').trim();
  const out = String(candidateText || '').trim();

  if (!out) return { ok: false, reason: 'empty' };
  if (out.includes('[') || out.includes(']')) return { ok: false, reason: 'brackets' };
  if (/(^|[^a-z0-9])(actually|turns out)([^a-z0-9]|$)/i.test(out.toLowerCase())) return { ok: false, reason: 'forbidden_token' };
  if (!isOneSentence(out)) return { ok: false, reason: 'multi_sentence' };
  if (looksGarbled(out)) return { ok: false, reason: 'garbled' };

  // No new explicit location claims.
  if (/\b(we are in|we're in|the location is|location:)\b/i.test(out)) return { ok: false, reason: 'location_claim' };

  // Simple contradiction guard: do not output direct negations of known facts.
  const facts = (w.ledger?.facts || []).map(f => String(f.text || '')).slice(0, 10);
  for (const f of facts) {
    const n = normalize(f);
    if (!n) continue;
    const neg = `not ${n}`;
    if (normalize(out).includes(neg)) return { ok: false, reason: 'negates_fact' };
  }

  return { ok: true, text: out };
}

// Detect grammatically-broken narration that a weak model produces when it
// echoes a stripped fragment of the player's input. An article (a/an/the)
// immediately followed by a pronoun or function word ("the it", "the to",
// "a of") is virtually never valid English — the signature of "...take it to
// a bank" collapsing into "The it to bank is yours now." Conservative: only
// flags article+function-word bigrams real prose never contains.
export function looksGarbled(text) {
  const x = String(text || '').toLowerCase();
  return /\b(?:a|an|the)\s+(?:it|its|it's|they|them|their|theirs|to|of|and|or|but|is|are|was|were)\b/.test(x);
}

function isOneSentence(s) {
  const x = String(s).trim();
  // allow a single terminal punctuation.
  const parts = x.split(/(?<=[.!?])\s+/g).filter(Boolean);
  if (parts.length !== 1) return false;
  // reject if contains multiple sentence enders.
  const enders = (x.match(/[.!?]/g) || []).length;
  return enders <= 1;
}

function tokenSet(s) {
  const x = String(s).toLowerCase();
  const toks = x.split(/[^a-z0-9']+/g).map(t => t.trim()).filter(t => t.length >= 4);
  return new Set(toks.slice(0, 32));
}

function normalize(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}
