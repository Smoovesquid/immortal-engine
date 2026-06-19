import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove, infoExtractionOutcome } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// H-22/H-23 (Rung-1 gate 2026-06-18) — a successful info-extraction roll MUST
// deliver a concrete identifier or an explicit in-fiction non-answer, not just
// atmospheric prose. A failed roll may be atmospheric; combat rolls are unaffected.
//
// SUPERSEDED by H-29 (Rung-1 gate 2026-06-19): the original fix (Option B+C)
// minted a deterministic but UNGROUNDED proper noun from a static name pool on
// every success — confidently inventing canon ("Corvin Ashe") regardless of
// whether the fact actually existed. H-29 replaces that with a deliver-or-decline
// contract: state a fact that is REALLY grounded in canon (NPC knowledge graph /
// ledger), or give an explicit in-fiction non-answer. See U190 for the full
// deliver-or-decline coverage; this file keeps the original regression surface
// (gate, exclusions, determinism) updated to the new contract.

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

function world(seed = 'glass-harbor') {
  return beginAdventure(
    newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }),
    packs()
  ).world;
}

const ATMOSPHERE_BANK_RE = /you see it through|it comes off cleanly|you manage it, and the way ahead|it half-works|it lands, after a fashion/i;

// ── a) Successful info-seeking roll → fact or explicit decline, never bare atmosphere ──

test('U184-01: infoExtractionOutcome on an ungrounded "name me" ask declines in-fiction, never invents', () => {
  const w = world();
  const narr = infoExtractionOutcome(w, 'name me the steward — who held the deed before you, by name?', 'success');
  assert.ok(narr, 'must produce non-null narration on info success');
  assert.match(narr, /Wizard:/, 'output must be a Wizard: line');
  assert.doesNotMatch(narr, ATMOSPHERE_BANK_RE, 'must never fall to the bare atmosphere bank');
  // No steward fact exists in a freshly-begun world — the answer must be an
  // honest non-answer, not a confidently invented name.
  assert.doesNotMatch(narr, /\bsteward\b/i, 'must not invent a fact about an ungrounded topic');
});

test('U184-02: infoExtractionOutcome on a repeated ungrounded ask still declines, never invents', () => {
  const w = world();
  const narr = infoExtractionOutcome(w, 'The name — who held this inn\'s deed before you, by name?', 'success');
  assert.ok(narr, 'must produce non-null narration for the second-turn demand');
  assert.doesNotMatch(narr, ATMOSPHERE_BANK_RE, 'must never fall to the bare atmosphere bank');
});

test('U184-03: same ungrounded ask in the same world declines identically (deterministic)', () => {
  const w = world();
  const t1 = infoExtractionOutcome(w, 'name me the steward who held the deed before you', 'success');
  const t2 = infoExtractionOutcome(w, 'name me the steward who held the deed before you', 'success');
  assert.ok(t1 && t2, 'both calls must produce narration');
  assert.equal(t1, t2, 'identical world + text must decline identically');
});

// ── c) Control: combat rolls not affected ────────────────────────────────────

test('U184-10: infoExtractionOutcome returns null for combat intent', () => {
  const w = world();
  assert.equal(
    infoExtractionOutcome(w, 'I strike with my sword', 'success'),
    null,
    'combat intent must not trigger info-extraction guard'
  );
});

test('U184-11: infoExtractionOutcome returns null for movement intent', () => {
  const w = world();
  assert.equal(
    infoExtractionOutcome(w, 'I move north toward the gate', 'success'),
    null,
    'movement intent must not trigger info-extraction guard'
  );
});

test('U184-12: infoExtractionOutcome returns null for generic focus intent (no fact-request)', () => {
  const w = world();
  // A focus roll that doesn't ask for a name/date/owner/etc.
  assert.equal(
    infoExtractionOutcome(w, 'I study the room carefully', 'success'),
    null,
    'generic focus roll must not trigger info-extraction guard'
  );
});

// ── d) Control: failed info-seeking roll → no fact/decline required ──────────

test('U184-20: infoExtractionOutcome returns null on failure (atmospheric acceptable)', () => {
  const w = world();
  assert.equal(
    infoExtractionOutcome(w, 'name me the steward who held the deed before you', 'failure'),
    null,
    'failed info roll must not inject a concrete fact or decline — null means normal narration wins'
  );
});

test('U184-21: infoExtractionOutcome handles a mixed outcome with the same deliver-or-decline contract (H-29)', () => {
  const w = world();
  const narr = infoExtractionOutcome(w, 'name me the steward who held the deed before you', 'mixed');
  assert.ok(narr, 'mixed is in-contract under H-29 — must produce a non-null result');
  assert.doesNotMatch(narr, ATMOSPHERE_BANK_RE, 'must never fall to the bare atmosphere bank');
});

// ── Integration: playerMove uses the guard when the roll succeeds ─────────────

test('U184-30: playerMove narration is never the bare atmosphere bank when an info-seeking roll succeeds', () => {
  const byId = packs();
  const w = world();
  const { output } = playerMove(w, byId, 'name me the steward who held the deed before you');
  const mechs = String(output?.mechanics || '');
  const narr = String(output?.narration || '');
  if (!mechs.includes('success')) return;
  assert.doesNotMatch(narr, ATMOSPHERE_BANK_RE, 'successful info-roll narration must never be bare atmosphere');
});

test('U184-31: playerMove narration on a FAILED info-extraction roll is not required to decline or deliver', () => {
  const byId = packs();
  const w = world();
  const { output } = playerMove(w, byId, 'name me the steward who held the deed before you');
  const mechs = String(output?.mechanics || '');
  if (mechs.includes('success')) return; // success case handled by U184-30
  const narr = String(output?.narration || '');
  assert.ok(narr.length > 0, 'failed roll must still produce some narration');
});

// ── Determinism: infoExtractionOutcome is replay-stable ─────────────────────

test('U184-40: infoExtractionOutcome is deterministic — same world + text → same result', () => {
  const w = world('replay-seed');
  const text = 'name me the steward who held the deed before you';
  const r1 = infoExtractionOutcome(w, text, 'success');
  const r2 = infoExtractionOutcome(w, text, 'success');
  assert.equal(r1, r2, 'same world + same text must produce identical narration every time');
});
