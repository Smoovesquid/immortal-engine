// U245 — combat lane: the fled-foe kill-claim narration guard. The escape model
// lets a WOUNDED foe break and RUN (morale; "driven off counts") — a legitimate
// outcome, so the state is defeated:false because it FLED, not died, and the base
// narration says "breaks and runs". The LLM polish must NOT overwrite that flee with
// a KILL — the gate's combat CRUNCH_INCONSISTENCY (gate-19 #5 "slit the throat …
// defeated:false"; gate-REF #10 "elbow … breaks and bolts"). validateNarrationCandidate
// now rejects a kill-claim candidate when the base reports a flight, falling back to
// the honest base. Combat STATE is untouched (this is a words-only guard).
//
// Deterministic, LLM-off. See docs/THE_REF.md + escapeCombat.js flee logic (~:1787).

import test from 'node:test';
import assert from 'node:assert/strict';

import { validateNarrationCandidate } from '../engine/llmAdapter.js';

const FLED_BASE = 'The Lingerer has had enough — it breaks and runs. Last you saw, it ducked into the open country.';
const v = (cand, base = FLED_BASE) => validateNarrationCandidate(null, cand, { baseNarration: base });

test('U245: a kill-claim is REJECTED when the base reports a flee', () => {
  assert.equal(v('You cut the Lingerer down, dead at your feet.'), false);
  assert.equal(v('Your blade opens the Lingerer\'s throat and it drops dead.'), false);
  assert.equal(v('You run the Lingerer through; it lies dead in the dust.'), false);
  assert.equal(v('You finish it off, leaving a lifeless corpse.'), false);
});

test('U245: a FAITHFUL flee narration is ACCEPTED', () => {
  assert.equal(v('The Lingerer breaks off and bolts into the open, clutching its side.'), true);
  assert.equal(v('Wounded and rattled, the Lingerer turns and runs from you.'), true);
});

test('U245: a genuine kill is NOT falsely rejected when the base is a kill (no flee)', () => {
  const killBase = 'You run the Lingerer through; it drops where it stands.';
  assert.equal(validateNarrationCandidate(null, 'You cut the Lingerer down, dead at your feet.', { baseNarration: killBase }), true);
});

test('U245: the guard does not fire on non-combat narration', () => {
  const calmBase = 'You step into the market square; the stalls are busy this morning.';
  assert.equal(validateNarrationCandidate(null, 'You wander past the dead-end alley and into the square.', { baseNarration: calmBase }), true);
});

test('U245: "driven off" / "broke and ran" phrasings also trip the guard', () => {
  assert.equal(v('You kill the bandit on the spot.', 'The bandit is driven off, vanishing down the lane.'), false);
  assert.equal(v('You slay it where it stands.', 'The wolf broke and ran into the trees.'), false);
});
