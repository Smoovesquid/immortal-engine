// U241 — THE REF: the spend/rate guard. Bounds the Ref's API cost so it can never
// run away: ≤1 judge + ≤1 regen per turn, and an optional per-session (process)
// cap on total judge calls. Over budget → the caller skips → base narration
// (Invariant 3: silent fallback).
//
// Deterministic, LLM-off. See docs/THE_REF.md (gated hard on cost/latency).

import test from 'node:test';
import assert from 'node:assert/strict';

import { createRefBudget } from '../engine/ref/budget.js';

test('U241: one turn allows at most one judge and one regen by default', () => {
  const budget = createRefBudget();
  const t = budget.turn();
  assert.equal(t.canJudge(), true);
  t.useJudge();
  assert.equal(t.canJudge(), false, 'second judge in the same turn is denied');

  assert.equal(t.canRegen(), true);
  t.useRegen();
  assert.equal(t.canRegen(), false, 'second regen in the same turn is denied');
});

test('U241: a fresh turn resets the per-turn judge/regen allowance', () => {
  const budget = createRefBudget({ maxJudgePerSession: Infinity });
  const t1 = budget.turn();
  t1.useJudge();
  assert.equal(t1.canJudge(), false);

  const t2 = budget.turn();
  assert.equal(t2.canJudge(), true, 'a new turn gets a fresh per-turn allowance');
});

test('U241: the session cap stops judging across turns', () => {
  const budget = createRefBudget({ maxJudgePerSession: 2 });
  const t1 = budget.turn();
  assert.equal(t1.canJudge(), true); t1.useJudge();
  const t2 = budget.turn();
  assert.equal(t2.canJudge(), true); t2.useJudge();
  const t3 = budget.turn();
  assert.equal(t3.canJudge(), false, 'session cap of 2 reached → no more judge calls');
  assert.equal(budget.stats().sessionJudge, 2);
});

test('U241: counts() reflects per-turn usage', () => {
  const budget = createRefBudget();
  const t = budget.turn();
  t.useJudge(); t.useRegen();
  assert.deepEqual(t.counts(), { judge: 1, regen: 1 });
});

test('U241: _reset clears the session counter (test hook)', () => {
  const budget = createRefBudget({ maxJudgePerSession: 1 });
  const t1 = budget.turn(); t1.useJudge();
  assert.equal(budget.turn().canJudge(), false);
  budget._reset();
  assert.equal(budget.turn().canJudge(), true);
});
