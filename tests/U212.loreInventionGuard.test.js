// U212 — H-49 lore-invention guard, extending llmAdapter.js's
// findInventedFactClaim (the H-29 Rule 5b helper) to catch two invented-
// specific shapes recurring across Opus gates (CANON_HALLUCINATION):
//
//   (a) a confident tenure/duration claim using a unit findInventedFactClaim
//       didn't know about — "led ... for eleven winters/seasons" (it already
//       caught the bare "years" unit; this widens the vocabulary).
//   (b) an invented relationship/rivalry/event claim between two named
//       parties — "Tove and the elder have a history of competing for the
//       same supply routes" — asserted with no such claim in the grounded
//       base narration.
//
// Both reuse the same negation/hypothetical exemption the lineage-phrase
// guard (H-36a R3, see U197-23) already established: a denial ("no record
// of how long") or an "if ..." framing is not a confident claim and must
// pass unchanged. Each catch case is paired with a false-positive guard,
// mirroring this repo's standing discipline for every grounding rule.

import test from 'node:test';
import assert from 'node:assert/strict';

import { findInventedFactClaim } from '../engine/llmAdapter.js';

// ── (a) tenure/duration — widened unit vocabulary ─────────────────────────

test('U212-01: REJECT — invented tenure claim using "winters" not present in the grounded base', () => {
  const base = "Kael has watched over Pilgrim's Rest Village for as long as anyone can recall; no one names a number.";
  const cand = "Kael says he has led Pilgrim's Rest Village for eleven winters.";
  assert.ok(findInventedFactClaim(cand, base), 'an invented winters-tenure with no canon backing must be flagged');
});

test('U212-02: REJECT — invented tenure claim using "seasons" not present in the grounded base', () => {
  const base = "The healer tends her garden at Pilgrim's Rest Village, humming an old tune.";
  const cand = 'She has tended this garden for eleven seasons, or so the story goes.';
  assert.ok(findInventedFactClaim(cand, base), 'an invented seasons-tenure with no canon backing must be flagged');
});

test('U212-03: PASS — a tenure claim that IS present in the grounded base (false-positive guard)', () => {
  const base = "Kael says it himself: he has led Pilgrim's Rest Village for eleven winters.";
  const cand = "Kael says it himself: he has led Pilgrim's Rest Village for eleven winters.";
  assert.equal(findInventedFactClaim(cand, base), null, 'a grounded tenure duration that matches the base must pass');
});

test('U212-04: PASS — a negated/hypothetical tenure framing is not a confident claim (false-positive guard)', () => {
  const base = 'Kael stands watch at the gate, same as ever.';
  const cand = 'If he led for eleven winters, the gate would look different — no one really knows.';
  assert.equal(findInventedFactClaim(cand, base), null, 'an "if ..." tenure framing must not be flagged as a confident claim');
});

// ── (b) relationship/rivalry/event between named parties ──────────────────

test('U212-05: REJECT — invented relationship/rivalry claim between named parties not present in the grounded base', () => {
  const base = "Corwin counts coins at his stall, eyes flicking toward the elder's house.";
  const cand = 'Tove and the elder have a history of competing for the same supply routes, Corwin mutters.';
  assert.ok(findInventedFactClaim(cand, base), 'an invented relationship claim with no canon backing must be flagged');

  const base2 = 'The two merchants nod to each other outside the market gate.';
  const cand2 = 'Brennan and Halsey feuded over grazing rights long before the truce.';
  assert.ok(findInventedFactClaim(cand2, base2), 'a "feuded over" relationship claim with no canon backing must also be flagged');
});

test('U212-06: PASS — a relationship claim that IS present in the grounded base (false-positive guard)', () => {
  const base = 'Tove and the elder have a history of competing for the same supply routes — everyone here knows it.';
  const cand = 'Tove and the elder have a history of competing for the same supply routes, Corwin says with a shrug.';
  assert.equal(findInventedFactClaim(cand, base), null, 'a grounded relationship claim that matches the base must pass');
});

test('U212-07: PASS — a negated/hypothetical relationship framing is not a confident claim (false-positive guard)', () => {
  const base = "Tove restocks her cart while the elder watches from his porch.";
  const cand = 'If Tove and the elder had ever competed for the same supply routes, no one here would say so.';
  assert.equal(findInventedFactClaim(cand, base), null, 'an "if ..." relationship framing must not be flagged as a confident claim');
});

// ── general false-positive guard + null-safety ─────────────────────────────

test('U212-08: PASS — an ordinary grounded line with no tenure or relationship claim at all', () => {
  const base = "Corwin counts coins at his stall, eyes flicking toward the elder's house.";
  const cand = "Corwin counts coins at his stall, eyes flicking toward the elder's house.";
  assert.equal(findInventedFactClaim(cand, base), null, 'plain narration with no invented claim must pass');
});

test('U212-09: findInventedFactClaim never throws on bad input', () => {
  assert.doesNotThrow(() => findInventedFactClaim(null, undefined));
  assert.equal(findInventedFactClaim(null, undefined), null);
});
