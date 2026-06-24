// scripts/saturation.test.js — the run-to-saturation math + stopping rule (Part B).
// Hermetic: chao1 is a pure estimator, and runToSaturation takes an INJECTED
// nextRun, so the whole "boringly predictable" decision is exercised on a FAKE
// discovery stream with ZERO model calls. Proves the curve flattens, Chao1 detects
// full re-coverage, and every hard cap (max-runs / budget / stream-end) trips.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chao1, runToSaturation, seamKeyOf } from './playtest-harness.mjs';

// A fake stream: nextRun(i) yields the i-th run's seamKeys, or null past the end.
const streamOf = (runs) => async (i) => (i < runs.length ? { seamKeys: runs[i] } : null);

// ── seamKeyOf — the discovery unit (oracleId + leading kebab slug of the note) ──
test('seamKeyOf keys a finding by oracle + the note\'s leading slug', () => {
  assert.equal(seamKeyOf({ oracleId: 'object-interaction', note: 'acquired-nothing — phantom acquisition' }), 'object-interaction::acquired-nothing');
  assert.equal(seamKeyOf({ oracleId: 'free-action', note: 'rolled-a-free-action (intent-routing seam)' }), 'free-action::rolled-a-free-action');
  assert.equal(seamKeyOf({ oracleId: 'soft-lock', note: '' }), 'soft-lock::unknown');
});

// ── chao1 — Chao (1987) richness estimate against hand-computed fixtures ────────
test('chao1: estimate = Sobs + f1²/(2·f2) when f2 > 0', () => {
  const e = chao1([1, 1, 1, 2, 2, 3]); // Sobs 6, f1 3, f2 2 → 6 + 9/4 = 8.25
  assert.equal(e.sObs, 6);
  assert.equal(e.f1, 3);
  assert.equal(e.f2, 2);
  assert.equal(e.estimate, 8.25);
  assert.equal(e.remaining, 2.25);
  assert.ok(e.ciLow >= e.sObs && e.ciHigh >= Math.ceil(e.estimate), 'CI brackets the estimate above Sobs');
});

test('chao1: bias-corrected form (f2 = 0) stays finite', () => {
  const e = chao1([1, 1, 3, 3]); // Sobs 4, f1 2, f2 0 → 4 + 2·1/2 = 5
  assert.equal(e.estimate, 5);
  assert.equal(e.remaining, 1);
});

test('chao1: no singletons (f1 = 0) ⇒ nothing remains', () => {
  const e = chao1([2, 3, 4]); // Sobs 3, f1 0 → estimate 3, remaining 0
  assert.equal(e.estimate, 3);
  assert.equal(e.remaining, 0);
  assert.equal(e.ciLow, 3);
  assert.equal(e.ciHigh, 3);
});

test('chao1: an empty sample is all zeros', () => {
  const e = chao1([]);
  assert.deepEqual([e.sObs, e.f1, e.f2, e.estimate, e.remaining], [0, 0, 0, 0, 0]);
});

// ── runToSaturation — the stopping rule on a fake stream ───────────────────────
test('saturation: stops on a FLAT curve after k runs with no new seam', async () => {
  const sat = await runToSaturation({ nextRun: streamOf([['A'], ['B'], ['C'], [], [], [], []]), k: 4 });
  assert.equal(sat.stopReason, 'flat-curve');
  assert.equal(sat.uniqueSeams, 3);
  assert.equal(sat.runs, 7);                       // 3 discovering + 4 flat
  assert.deepEqual(sat.curve, [1, 2, 3, 3, 3, 3, 3]);
});

test('saturation: stops via Chao1 once every seam has been re-seen (f1 = 0)', async () => {
  const sat = await runToSaturation({ nextRun: streamOf([['A'], ['A', 'B'], ['A', 'B'], ['A', 'B']]), k: 8 });
  assert.equal(sat.stopReason, 'chao1-saturated');
  assert.equal(sat.uniqueSeams, 2);
  assert.equal(sat.runs, 3);                       // A&B both seen ≥2 by run 3
  assert.equal(sat.estimate.remaining, 0);
});

test('saturation: a stream that never repeats stops at the max-runs cap', async () => {
  const sat = await runToSaturation({ nextRun: async (i) => ({ seamKeys: [`S${i}`] }), k: 8, maxRuns: 5 });
  assert.equal(sat.stopReason, 'max-runs');
  assert.equal(sat.runs, 5);
  assert.equal(sat.uniqueSeams, 5);
});

test('saturation: the budget cap stops the loop mid-stream', async () => {
  let checks = 0;
  const sat = await runToSaturation({
    nextRun: async (i) => ({ seamKeys: [`S${i}`] }), k: 8, maxRuns: 50,
    isOverBudget: () => checks++ >= 2, // false, false, then true (checked before each run)
  });
  assert.equal(sat.stopReason, 'budget');
  assert.equal(sat.runs, 2);
});

test('saturation: an exhausted stream stops cleanly (stream-end)', async () => {
  const sat = await runToSaturation({ nextRun: streamOf([['A'], ['B']]), k: 8, maxRuns: 50 });
  assert.equal(sat.stopReason, 'stream-end');
  assert.equal(sat.runs, 2);
  assert.equal(sat.uniqueSeams, 2);
});

test('saturation: a totally clean engine (zero findings) saturates by flat curve', async () => {
  const sat = await runToSaturation({ nextRun: streamOf([[], [], [], [], []]), k: 4 });
  assert.equal(sat.stopReason, 'flat-curve');
  assert.equal(sat.uniqueSeams, 0);
  assert.equal(sat.runs, 4);
});
