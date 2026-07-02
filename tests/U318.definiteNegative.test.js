// U318 — DS-1a: a successful/mixed sense-for-the-dead check over empty canon
// renders the DEFINITE NEGATIVE ("nothing dead within reach"), never the
// gen-bank atmosphere filler ("it goes your way" / "after a fashion" / "see
// it through"). Mirrors the object-presence precedent at playloop.js:1683-1705
// generalized to an enumerable presence-domain (second-order diagnosis §4a).
//
// A grounded "nothing there" is an answer; fog is not (THE_DM_TEST/THE_TABLE_TEST).

import test from 'node:test';
import assert from 'node:assert/strict';
import { genericGroundedOutcome } from '../engine/playloop.js';
import { FIXTURES } from '../scripts/convergence/fixtures.mjs';

const GEN_BANK_RE = /goes your way|after a fashion|see it through/i;

// ── (a) empty canon → the definite negative, never the gen bank ─────────────

test('U318-a: a death-sense success over empty canon states the definite negative', () => {
  const world = FIXTURES.village_baker();
  for (const text of [
    'I use my death-sense to detect for the dead nearby',
    'I reach out with my death-sense',
    'I sense for anything dead within reach',
  ]) {
    const narr = genericGroundedOutcome(world, text, 'success');
    assert.match(narr, /nothing dead within reach|finds nothing dead|nothing within reach has died/i, `must state the negative: ${text}`);
    assert.doesNotMatch(narr, GEN_BANK_RE, `must not fall to the gen bank: ${text}`);
  }
});

test('U318-a: a MIXED death-sense also renders the negative, not the gen bank', () => {
  const world = FIXTURES.village_baker();
  const narr = genericGroundedOutcome(world, 'I scan for anything dead in range', 'mixed');
  assert.match(narr, /nothing dead|nothing within reach has died/i);
  assert.doesNotMatch(narr, GEN_BANK_RE);
});

test('U318-a: determinism — same seed/fixture/text yields the same negative', () => {
  const n1 = genericGroundedOutcome(FIXTURES.village_baker(), 'I use my death-sense', 'success');
  const n2 = genericGroundedOutcome(FIXTURES.village_baker(), 'I use my death-sense', 'success');
  assert.equal(n1, n2);
});

// ── (b) canon actually holds a corpse → the grounded positive, named ────────

test('U318-b: a death-sense over a node WITH a defeated NPC finds them, not a false negative', () => {
  const world = FIXTURES.defeated_npc();
  const narr = genericGroundedOutcome(world, 'I use my death-sense to detect for the dead nearby', 'success');
  assert.match(narr, /Mira Hearth/, 'names the actual corpse');
  assert.doesNotMatch(narr, /nothing dead within reach/i, 'must not false-negative over a real corpse');
  assert.doesNotMatch(narr, GEN_BANK_RE);
});

// ── (c) diverge guards ───────────────────────────────────────────────────────

test('U318-c: a FAILED sense check is untouched — falls through to the normal failure floor, not the negative', () => {
  const world = FIXTURES.village_baker();
  const narr = genericGroundedOutcome(world, 'I use my death-sense to detect for the dead nearby', 'failure');
  assert.doesNotMatch(narr, /nothing dead within reach/i, 'the definite-negative is a SUCCESS/MIXED payload, not a failure result');
});

test('U318-c: an epistemic-gap question (canon never minted it) still hedges/declines, unchanged', () => {
  const world = FIXTURES.village_baker();
  const narr = genericGroundedOutcome(world, "who was the last traveler who slept here?", 'success');
  assert.doesNotMatch(narr, /nothing dead within reach/i, 'not a presence-domain scan — must not be swallowed by DS-1a');
});

test('U318-c: an unrelated action success is untouched — still gets the normal grounded outcome', () => {
  const world = FIXTURES.village_baker();
  const narr = genericGroundedOutcome(world, 'I take the lantern', 'success');
  assert.doesNotMatch(narr, /nothing dead within reach/i);
});
