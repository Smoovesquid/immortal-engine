// U558 — MP-2: the escalation-tier truth table (docs/MORAL_PHYSICS.md §4).
//
// `escalationTier(deed, actor, ctx)` is the ONE deterministic core: a pure function
// grading a moral act 0..4 on the act itself PLUS the actor's accumulation. This test
// walks every boundary edge of §4's ladder — a pure-function contract, no world.
//
//   tier = 0
//   if severity >= HEAVY or kind == 'forbidden':   tier = max(tier, 1)  // the world recoils
//   if tier >= 1 and witnessReach >= 1:            tier = max(tier, 2)  // reputation travels
//   if heat >= HUNT_HEAT:                          tier = max(tier, 3)  // the hunt
//   if corruption >= PACT_CORRUPTION:              tier = max(tier, 4)  // the gift unbidden

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escalationTier,
  DEED_SEV,
  HUNT_HEAT,
  PACT_CORRUPTION,
} from '../engine/morality/escalation.js';
import { darkGiftThresholds } from '../engine/magic/forbiddenGates.js';

// A calm actor: nothing accumulated. Isolates the per-act rungs (T1/T2) from T3/T4.
const CALM = { corruption: 0, heat: 0 };

test('U558-01: constants are calibrated to their sources (no forked magnitudes)', () => {
  assert.equal(DEED_SEV.HEAVY, 20, 'Tier-1 threshold lockstepped to DEED_SEV.HEAVY (playloop.js)');
  assert.equal(HUNT_HEAT, 40, 'HUNT_HEAT starting calibration ≈40 (§4)');
  // PACT_CORRUPTION is READ from forbiddenGates — the lowest dark-gift threshold — never forked.
  assert.equal(PACT_CORRUPTION, Math.min(...darkGiftThresholds()),
    'PACT_CORRUPTION = min(forbiddenGates thresholds); do not fork the number');
});

test('U558-02: Tier 0 — an unremarkable act, no accumulation, is below the gods\' notice', () => {
  assert.equal(escalationTier({ severity: DEED_SEV.LIGHT, kind: 'cruelty' }, CALM, { witnessReach: 3 }), 0);
  assert.equal(escalationTier({ severity: DEED_SEV.MOD, kind: 'cruelty' }, CALM, { witnessReach: 8 }), 0);
  // Even a MOD deed with a full room of witnesses is Tier 0 — witnessReach only lifts an
  // act that ALREADY recoiled (tier >= 1). A light act stays local.
  assert.equal(escalationTier({ severity: 19, kind: 'aid' }, CALM, { witnessReach: 5 }), 0,
    'severity just UNDER HEAVY does not recoil');
});

test('U558-03: Tier 1 — severity AT HEAVY recoils; just under does not (the boundary)', () => {
  assert.equal(escalationTier({ severity: DEED_SEV.HEAVY, kind: 'cruelty' }, CALM, { witnessReach: 0 }), 1,
    'severity == HEAVY with no witnesses → the world recoils (T1), reputation does not travel');
  assert.equal(escalationTier({ severity: DEED_SEV.HEAVY - 1, kind: 'cruelty' }, CALM, { witnessReach: 0 }), 0,
    'severity == HEAVY-1 → below recoil');
  // The wild seam (§6): a HEAVY deed with no settlement witnesses is T1 (an omen), not T2.
  assert.equal(escalationTier({ severity: DEED_SEV.HEAVY, kind: 'cruelty' }, CALM, { wild: true }), 1);
});

test('U558-04: Tier 1 — a forbidden source ALWAYS recoils, at any severity', () => {
  assert.equal(escalationTier({ severity: DEED_SEV.LIGHT, kind: 'forbidden' }, CALM, { witnessReach: 0 }), 1,
    'forbidden at LIGHT severity still hits Tier 1 (kind == forbidden)');
  assert.equal(escalationTier({ severity: 1, kind: 'forbidden' }, CALM, { witnessReach: 0 }), 1);
  assert.equal(escalationTier({ severity: 0, kind: 'forbidden' }, CALM, { wild: true }), 1);
});

test('U558-05: Tier 2 — reputation travels only when a recoil-worthy act is WITNESSED', () => {
  // witnessReach 0 vs 1 at the tier-2 boundary.
  assert.equal(escalationTier({ severity: DEED_SEV.HEAVY, kind: 'cruelty' }, CALM, { witnessReach: 0 }), 1,
    'HEAVY, unseen → T1 (recoils, but no one carries it)');
  assert.equal(escalationTier({ severity: DEED_SEV.HEAVY, kind: 'cruelty' }, CALM, { witnessReach: 1 }), 2,
    'HEAVY, one witness → T2 (reputation travels)');
  // A forbidden act witnessed also travels.
  assert.equal(escalationTier({ severity: DEED_SEV.LIGHT, kind: 'forbidden' }, CALM, { witnessReach: 1 }), 2);
  // But witnesses on a NON-recoiling act do NOT reach T2 (the tier>=1 guard).
  assert.equal(escalationTier({ severity: DEED_SEV.MOD, kind: 'cruelty' }, CALM, { witnessReach: 5 }), 0);
});

test('U558-06: the wild mints T2 NEVER from zero witnesses (§6 asymmetry is structural)', () => {
  // wild forces reach to 0 even if a caller passes a positive witnessReach — "getting away
  // with it" is physics, not a caller convention.
  assert.equal(escalationTier({ severity: DEED_SEV.HEAVY, kind: 'cruelty' }, CALM, { wild: true, witnessReach: 9 }), 1,
    'wild pins reach to 0 → never T2, regardless of the passed witnessReach');
  assert.equal(escalationTier({ severity: DEED_SEV.HEAVY, kind: 'forbidden' }, CALM, { wild: true, witnessReach: 4 }), 1);
});

test('U558-07: Tier 3 — the hunt fires at/over HUNT_HEAT, not under (heat boundary)', () => {
  const heavy = { severity: DEED_SEV.HEAVY, kind: 'cruelty' };
  assert.equal(escalationTier(heavy, { corruption: 0, heat: HUNT_HEAT - 1 }, { witnessReach: 1 }), 2,
    'heat just under HUNT_HEAT → no hunt (stays at the T2 it earned)');
  assert.equal(escalationTier(heavy, { corruption: 0, heat: HUNT_HEAT }, { witnessReach: 1 }), 3,
    'heat == HUNT_HEAT → the hunt (T3)');
  // Heat lifts the tier independently of witnessReach: a hunted actor's UNSEEN heavy deed is
  // still T3 (heat is accumulated, not per-act).
  assert.equal(escalationTier(heavy, { corruption: 0, heat: HUNT_HEAT + 100 }, { witnessReach: 0 }), 3);
});

test('U558-08: Tier 4 — the gift unbidden fires at/over PACT_CORRUPTION, not under', () => {
  const heavy = { severity: DEED_SEV.HEAVY, kind: 'cruelty' };
  assert.equal(escalationTier(heavy, { corruption: PACT_CORRUPTION - 1, heat: 0 }, { witnessReach: 0 }), 1,
    'corruption just under PACT_CORRUPTION → no gift');
  assert.equal(escalationTier(heavy, { corruption: PACT_CORRUPTION, heat: 0 }, { witnessReach: 0 }), 4,
    'corruption == PACT_CORRUPTION → the gift (T4), even with no witnesses');
  // T4 is the ceiling: max corruption + max heat + witnessed → still 4.
  assert.equal(escalationTier(heavy, { corruption: 100, heat: 999 }, { witnessReach: 8 }), 4);
});

test('U558-09: the ladder is monotone — no rung ever LOWERS the tier', () => {
  // A fully-accumulated actor doing a trivial aid act: T4 (corruption owns it) despite a
  // Tier-0 act — accumulation dominates. Proves max() semantics, not overwrite.
  assert.equal(escalationTier({ severity: DEED_SEV.LIGHT, kind: 'aid' }, { corruption: 100, heat: 0 }, { witnessReach: 0 }), 4);
  assert.equal(escalationTier({ severity: 0, kind: 'mercy' }, { corruption: 0, heat: HUNT_HEAT }, { witnessReach: 0 }), 3);
});

test('U558-10: defensive — malformed inputs never throw, default to Tier 0', () => {
  assert.equal(escalationTier(null, null, null), 0);
  assert.equal(escalationTier(undefined, undefined), 0);
  assert.equal(escalationTier({}, {}, {}), 0);
  assert.equal(escalationTier({ severity: NaN, kind: 42 }, { corruption: 'x', heat: undefined }, { witnessReach: -3 }), 0,
    'garbage in → Tier 0, no throw');
  // A negative witnessReach clamps to 0 (never negative reach).
  assert.equal(escalationTier({ severity: DEED_SEV.HEAVY, kind: 'cruelty' }, CALM, { witnessReach: -5 }), 1);
});

test('U558-11: purity — the same inputs give the same tier every call (no state)', () => {
  const deed = { severity: DEED_SEV.HEAVY, kind: 'cruelty' };
  const actor = { corruption: 10, heat: 5 };
  const ctx = { witnessReach: 2 };
  const first = escalationTier(deed, actor, ctx);
  for (let i = 0; i < 100; i++) {
    assert.equal(escalationTier(deed, actor, ctx), first, 'pure: identical inputs → identical output');
  }
  // Inputs are not mutated.
  assert.deepEqual(deed, { severity: DEED_SEV.HEAVY, kind: 'cruelty' });
  assert.deepEqual(actor, { corruption: 10, heat: 5 });
  assert.deepEqual(ctx, { witnessReach: 2 });
});
