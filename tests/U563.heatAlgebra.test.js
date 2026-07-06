// U563 — MP-3: HEAT ALGEBRA (docs/MORAL_PHYSICS.md §4).
//
// The accumulator is a PURE function (heatAccrual) plus a PURE decay (heatDecay), living in
// the ONE moral-magnitude home (engine/morality/escalation.js). This test pins the algebra at
// every boundary the constitution names:
//   - accrual RISES with severity and with witness count;
//   - accrual FALLS with concealment (WITS);
//   - the WILD accrues SLOWLY (the "getting away with it" asymmetry, decision #7);
//   - only cruelty/forbidden accrue — mercy/aid/atonement (and, structurally, every fair
//     kill, which records no cruelty deed at all — U556) add ZERO;
//   - decay bleeds heat over ticks and floors at 0;
//   - the functions are pure (no rng/Date/mutation): same inputs → same output, always.
//
// No numbers here are asserted against the LLM — the model never sees or sets any of them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  heatAccrual,
  heatDecay,
  HEAT_DECAY_PER_TICK,
  HEAT_DECAY_INTERVAL,
  HUNT_HEAT,
} from '../engine/morality/escalation.js';

// A convenient actor with a chosen WITS score (concealment lever). WITS 10 → statMod 0 (no
// cover); WITS 16 → +3 (cover 6); WITS 20 → +5 (cover 10).
const actor = (wits = 10) => ({ stats: { WITS: wits } });

test('U563-01: accrual RISES with severity (a heavier act burns hotter)', () => {
  const light = heatAccrual({ severity: 5, kind: 'cruelty' }, actor(10), { witnessReach: 1 });
  const mod = heatAccrual({ severity: 12, kind: 'cruelty' }, actor(10), { witnessReach: 1 });
  const heavy = heatAccrual({ severity: 20, kind: 'cruelty' }, actor(10), { witnessReach: 1 });
  assert.ok(light < mod, `light(${light}) < mod(${mod})`);
  assert.ok(mod < heavy, `mod(${mod}) < heavy(${heavy})`);
  assert.ok(light >= 1, 'even a light accruing act adds at least the floor');
});

test('U563-02: accrual RISES with witnesses (more eyes, louder crime)', () => {
  const none = heatAccrual({ severity: 20, kind: 'cruelty' }, actor(10), { witnessReach: 0 });
  const one = heatAccrual({ severity: 20, kind: 'cruelty' }, actor(10), { witnessReach: 1 });
  const three = heatAccrual({ severity: 20, kind: 'cruelty' }, actor(10), { witnessReach: 3 });
  assert.ok(none < one, `0 witnesses(${none}) < 1(${one})`);
  assert.ok(one < three, `1 witness(${one}) < 3(${three})`);
});

test('U563-03: the witness contribution SATURATES (a mob cannot spike the pact tier)', () => {
  // More witnesses accrue more heat, but only up to the saturation cap: two counts BOTH at or
  // above the cap accrue the same, and a below-cap count accrues strictly less than an
  // above-cap one.
  const belowCap = heatAccrual({ severity: 20, kind: 'cruelty' }, actor(10), { witnessReach: 1 });
  const atCapA = heatAccrual({ severity: 20, kind: 'cruelty' }, actor(10), { witnessReach: 12 });
  const atCapB = heatAccrual({ severity: 20, kind: 'cruelty' }, actor(10), { witnessReach: 30 });
  assert.ok(belowCap < atCapA, `below-cap(${belowCap}) < at-cap(${atCapA})`);
  assert.equal(atCapA, atCapB, 'witness contribution is capped (12 and 30 witnesses accrue the same)');
});

test('U563-04: accrual FALLS with concealment (WITS/deception covers tracks)', () => {
  const dull = heatAccrual({ severity: 20, kind: 'cruelty' }, actor(10), { witnessReach: 2 });
  const clever = heatAccrual({ severity: 20, kind: 'cruelty' }, actor(16), { witnessReach: 2 });
  const cunning = heatAccrual({ severity: 20, kind: 'cruelty' }, actor(20), { witnessReach: 2 });
  assert.ok(clever < dull, `WITS16(${clever}) < WITS10(${dull})`);
  assert.ok(cunning < clever, `WITS20(${cunning}) < WITS16(${clever})`);
});

test('U563-05: concealment can DAMPEN but never LAUNDER a grave act to zero (floor holds)', () => {
  // Maximum cover (WITS 20 → -10) against a small forbidden act — must still leave the floor.
  const h = heatAccrual({ severity: 3, kind: 'forbidden' }, actor(20), { witnessReach: 0 });
  assert.ok(h >= 1, `a grave (accruing) act never launders below the floor (got ${h})`);
});

test('U563-06: the WILD accrues SLOWLY and never from witnesses (getting away with it)', () => {
  const seen = heatAccrual({ severity: 20, kind: 'cruelty' }, actor(10), { witnessReach: 3, wild: false });
  const wild = heatAccrual({ severity: 20, kind: 'cruelty' }, actor(10), { witnessReach: 3, wild: true });
  // Wild forces witnessReach → 0 structurally AND applies the slow factor: strictly less.
  assert.ok(wild < seen, `wild(${wild}) < witnessed(${seen})`);
  assert.ok(wild >= 1, 'a wild grave act still leaves a slow trace on the doer');
  // A wild act with a caller-passed witness count accrues the SAME as one with none — the
  // wild has no settlement eyes by definition (§6), the asymmetry is structural.
  const wildNoWit = heatAccrual({ severity: 20, kind: 'cruelty' }, actor(10), { witnessReach: 0, wild: true });
  assert.equal(wild, wildNoWit, 'wild ignores any passed witnessReach (no settlement eyes)');
});

test('U563-07: only cruelty/forbidden accrue — mercy/aid/atonement add ZERO', () => {
  for (const kind of ['mercy', 'aid', 'atonement', '', 'unknown']) {
    const h = heatAccrual({ severity: 20, kind }, actor(10), { witnessReach: 3 });
    assert.equal(h, 0, `kind '${kind}' accrues no heat`);
  }
  // The gate is on KIND, not severity: cruelty at any accruing severity adds > 0.
  assert.ok(heatAccrual({ severity: 5, kind: 'cruelty' }, actor(10), { witnessReach: 0 }) > 0);
  assert.ok(heatAccrual({ severity: 1, kind: 'forbidden' }, actor(10), { witnessReach: 0 }) > 0);
});

test('U563-08: heatDecay bleeds heat GENTLY over elapsed ticks and FLOORS at 0', () => {
  const start = 30;
  // Gentle rate: one point per HEAT_DECAY_INTERVAL ticks of elapsed time.
  assert.equal(heatDecay(start, HEAT_DECAY_INTERVAL - 1), start, 'below one interval → no decay yet');
  assert.equal(heatDecay(start, HEAT_DECAY_INTERVAL), start - HEAT_DECAY_PER_TICK, 'one full interval sheds one step');
  assert.equal(heatDecay(start, 3 * HEAT_DECAY_INTERVAL), start - 3 * HEAT_DECAY_PER_TICK, 'three intervals shed 3×');
  const few = heatDecay(start, HEAT_DECAY_INTERVAL);
  const many = heatDecay(start, 4 * HEAT_DECAY_INTERVAL);
  assert.ok(many < few, 'more elapsed → less heat');
  // A grave, witnessed atrocity must SURVIVE a max-length (≤30-tick) multi-day build — the
  // decay is gentle enough that investigation pressure lingers past the downtime.
  assert.ok(heatDecay(24, 30) > 0, 'a HEAVY witnessed atrocity survives a 30-tick build (heat lingers)');
  // Cannot go negative.
  assert.equal(heatDecay(2, 1000), 0, 'decay floors at 0');
  assert.equal(heatDecay(0, 5 * HEAT_DECAY_INTERVAL), 0, 'already-cold stays 0');
  // Zero elapsed is a no-op.
  assert.equal(heatDecay(15, 0), 15, 'zero elapsed does not change heat');
});

test('U563-09: PURITY — same inputs → same output; malformed inputs never throw', () => {
  const d = { severity: 20, kind: 'cruelty' };
  const a = actor(10);
  const c = { witnessReach: 2, wild: false };
  assert.equal(heatAccrual(d, a, c), heatAccrual(d, a, c), 'accrual is a pure function');
  assert.equal(heatDecay(17, 2), heatDecay(17, 2), 'decay is a pure function');
  // Garbage in → defined, non-negative, integer out (no throw).
  for (const bad of [null, undefined, {}, { severity: 'x', kind: 42 }, []]) {
    const h = heatAccrual(bad, null, null);
    assert.ok(Number.isInteger(h) && h >= 0, `malformed deed → non-negative integer (got ${h})`);
    const hd = heatDecay(bad, bad);
    assert.ok(Number.isInteger(hd) && hd >= 0, `malformed decay → non-negative integer (got ${hd})`);
  }
});

test('U563-10: calibration sanity — a HANDFUL of witnessed atrocities crosses HUNT_HEAT, one does not', () => {
  const perAtrocity = heatAccrual({ severity: 20, kind: 'cruelty' }, actor(10), { witnessReach: 2 });
  assert.ok(perAtrocity < HUNT_HEAT, `a single witnessed HEAVY (${perAtrocity}) is below HUNT_HEAT (${HUNT_HEAT}) — the ladder must be climbed`);
  // Accumulate additively (the effectsCore chokepoint adds gained to live heat each deed).
  let heat = 0, n = 0;
  while (heat < HUNT_HEAT && n < 20) { heat += perAtrocity; n++; }
  assert.ok(n >= 2 && n <= 6, `a handful (2–6) of witnessed atrocities crosses the line (took ${n})`);
});
