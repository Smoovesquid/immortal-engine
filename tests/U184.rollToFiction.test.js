import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove, infoExtractionOutcome } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// H-22/H-23 (Rung-1 gate 2026-06-18) — a successful info-extraction roll MUST
// deliver a concrete identifier (name, title, date) in the narration, not just
// atmospheric prose. A failed roll may be atmospheric; combat rolls are unaffected.
//
// Root cause: the compose() narrator generates approach-keyed atmosphere only
// ("the pattern unknots in your head"). nonObjectSkillOutcome() didn't cover
// info-extraction verbs. The LLM system prompt explicitly banned inventing proper
// names. So "name me one steward" on a success produced atmosphere with no fact.
//
// Fix (Option B+C): infoExtractionOutcome() detects explicit info-request patterns
// and injects a deterministic proper noun on success. LLM prompts now include an
// exception directive for successful knowledge rolls.

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

// Proper-noun pattern: "Firstname Lastname", "Name the Epithet", or "Name of the X"
// Used to verify that grounded info narration contains a real name, not just atmosphere.
const PROPER_NOUN_RE = /[A-Z][a-z]+\s+[A-Z][a-z]+|[A-Z][a-z]+\s+the\s+[A-Z][a-z]+|[A-Z][a-z]+\s+of\s+the/;

// ── a) Successful info-extraction roll → concrete identifier ─────────────────

test('U184-01: infoExtractionOutcome returns narration on success for "name me" intent', () => {
  const w = world();
  const narr = infoExtractionOutcome(w, 'name me one steward from before the era of reform — the ledger is right there', 'success');
  assert.ok(narr, 'must produce non-null narration on info success');
  assert.match(narr, /Wizard:/, 'output must be a Wizard: line');
  assert.match(narr, PROPER_NOUN_RE, `narration must contain a proper-noun identifier, got: "${narr}"`);
});

test('U184-02: infoExtractionOutcome returns narration on success for "who was the" intent', () => {
  const w = world();
  const narr = infoExtractionOutcome(w, 'The name, Corwin — say it. Who was the last steward?', 'success');
  assert.ok(narr, 'must produce non-null narration for second-turn demand');
  assert.match(narr, PROPER_NOUN_RE, `second-turn demand must still yield a proper noun, got: "${narr}"`);
});

test('U184-03: same topic key in same world yields the same name on both turns', () => {
  // Both H-22 and H-23 query about "steward" — the DM should name the same person.
  const w = world();
  const t1 = infoExtractionOutcome(w, 'name me one steward from before the era of reform', 'success');
  const t2 = infoExtractionOutcome(w, 'who was the last steward — say it', 'success');
  assert.ok(t1 && t2, 'both turns must produce narration');
  // Both contain the same name (topic key "steward" → deterministic pick).
  // Extract the proper noun from each and compare.
  const m1 = t1.match(PROPER_NOUN_RE);
  const m2 = t2.match(PROPER_NOUN_RE);
  assert.ok(m1 && m2, 'both narrations must contain a proper noun');
  assert.equal(m1[0], m2[0], 'both turns with the same topic must name the same person');
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

test('U184-12: infoExtractionOutcome returns null for generic focus intent (no name-request)', () => {
  const w = world();
  // A focus roll that doesn't explicitly ask for a name
  assert.equal(
    infoExtractionOutcome(w, 'I study the room carefully', 'success'),
    null,
    'generic focus roll must not trigger info-extraction guard'
  );
});

// ── d) Control: failed info-extraction roll → no concrete fact required ──────

test('U184-20: infoExtractionOutcome returns null on failure (atmospheric acceptable)', () => {
  const w = world();
  assert.equal(
    infoExtractionOutcome(w, 'name me one steward from before the era of reform', 'failure'),
    null,
    'failed info roll must not inject a concrete fact — null means normal narration wins'
  );
});

test('U184-21: infoExtractionOutcome returns null on mixed outcome', () => {
  const w = world();
  assert.equal(
    infoExtractionOutcome(w, 'name me one steward from before the era of reform', 'mixed'),
    null,
    'mixed outcome must not inject a concrete fact'
  );
});

// ── Integration: playerMove uses the guard when the roll succeeds ─────────────

test('U184-30: playerMove narration contains proper noun when info-extraction roll succeeds', () => {
  const byId = packs();
  const w = world();
  const { output } = playerMove(w, byId, 'name me one steward from before the era of reform');
  const mechs = String(output?.mechanics || '');
  const narr = String(output?.narration || '');
  // Only assert fact-delivery when the roll actually succeeded
  if (!mechs.includes('success')) return;
  assert.match(narr, PROPER_NOUN_RE, `successful info-roll narration must contain a proper noun, got: "${narr}"`);
});

test('U184-31: playerMove narration on a FAILED info-extraction roll is not required to contain a proper noun', () => {
  const byId = packs();
  const w = world();
  const { output } = playerMove(w, byId, 'name me one steward from before the era of reform');
  const mechs = String(output?.mechanics || '');
  // On failure, just confirm no crash and there is some narration
  if (mechs.includes('success')) return; // success case handled by U184-30
  const narr = String(output?.narration || '');
  assert.ok(narr.length > 0, 'failed roll must still produce some narration');
});

// ── Determinism: infoExtractionOutcome is replay-stable ─────────────────────

test('U184-40: infoExtractionOutcome is deterministic — same world + text → same result', () => {
  const w = world('replay-seed');
  const text = 'name me one steward from before the era of reform';
  const r1 = infoExtractionOutcome(w, text, 'success');
  const r2 = infoExtractionOutcome(w, text, 'success');
  assert.equal(r1, r2, 'same world + same text must produce identical narration every time');
});
