// U244 — THE REF (Tier 1 ext): the generic-filler bank tags its narration as a SOFT
// source so the Ref reviews it. The gen:s/m/f "you see it through / it goes your way"
// fallback is the lowest-content base — exactly what the LLM polish inflates into a
// fabrication (gate-REF #11: a WITS roll → "the representative was his father"). It now
// rides out as output.narrationSource='generic-resolve'; grounded/specific banks do NOT
// set it (the Ref stays cheap — it skips them).
//
// Deterministic, LLM-off. See docs/THE_REF.md + the gate-REF flag-on report.

import test from 'node:test';
import assert from 'node:assert/strict';

import { playerMove, genericGroundedOutcome } from '../engine/playloop.js';
import { classifyNarrationSource } from '../engine/ref/narrationSource.js';
import { PACKS, villageBakerWorld, emptyRoomWorld } from '../scripts/convergence/fixtures.mjs';

const GEN_INPUT = 'I do my best to manage it'; // matches no verb/question/confrontation → the gen bank

test('U244: genericGroundedOutcome tags meta.source for the gen bank (all 3 outcomes)', () => {
  for (const outcome of ['success', 'mixed', 'failure']) {
    const meta = {};
    const narr = genericGroundedOutcome(villageBakerWorld(), GEN_INPUT, outcome, meta);
    assert.equal(meta.source, 'generic-resolve', `${outcome} gen-bank line should be tagged`);
    assert.ok(narr && narr.startsWith('Wizard:'), 'still returns the narration string');
  }
});

test('U244: grounded/specific paths do NOT tag (info-seek decline, take-verb)', () => {
  const m1 = {};
  genericGroundedOutcome(villageBakerWorld(), 'tell me about the war', 'success', m1);
  assert.equal(m1.source, undefined, 'an info-seek decline is not the gen bank');

  const m2 = {};
  genericGroundedOutcome(villageBakerWorld(), 'take the cup and stow it', 'success', m2);
  assert.equal(m2.source, undefined, 'a take-verb resolve is not the gen bank');
});

test('U244: meta is optional — genericGroundedOutcome still works without it (back-compat)', () => {
  const narr = genericGroundedOutcome(villageBakerWorld(), GEN_INPUT, 'success');
  assert.ok(narr && narr.startsWith('Wizard:'), 'no 4th arg → no throw, string returned');
});

test('U244: playerMove surfaces output.narrationSource for a gen-bank turn', () => {
  const { output } = playerMove(emptyRoomWorld(), PACKS, GEN_INPUT);
  assert.equal(output.narrationSource, 'generic-resolve');
  // …and the Ref classifier reads it as soft (so the live judge will review it).
  assert.equal(classifyNarrationSource(output).soft, true);
});

test('U244: a grounded info-decline carries NO explicit narrationSource — but is now SOFT by tag (REF-D1)', () => {
  // An info ask is handled grounded (decline) before the gen bank is ever reached, so
  // genericGroundedOutcome is not called and no explicit source is set. Since REF-D1,
  // its mechanics tag ([info-check → no-record]) classifies SOFT anyway: the no-record
  // decline is exactly where the postfamily-gate glue bug and the dodge class live, and
  // the good decline shape is false-positive-swept PASS. See U326 + THE_REF_CONTRACT §4.1.
  const { output } = playerMove(villageBakerWorld(), PACKS, 'tell me about the war');
  assert.equal(output.narrationSource, undefined);
  assert.equal(output.mechanics.startsWith('[info-check'), true);
  assert.deepEqual(classifyNarrationSource(output), { soft: true, source: 'info-check:no-record' });
});

test('U244: a physical grounded resolve stays HARD (Ref skips it — no cost)', () => {
  const { output } = playerMove(villageBakerWorld(), PACKS, 'take the cup and stow it');
  assert.equal(output.narrationSource, undefined);
  assert.equal(classifyNarrationSource(output).soft, false);
});
