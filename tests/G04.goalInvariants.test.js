import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';

function freshWorld() {
  return newWorld({ seed: 'g04', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
}

function makeGoal(over = {}) {
  return {
    id: 'goal_0',
    kind: 'reach',
    targetRef: 'n1',
    label: 'Reach n1',
    status: 'active',
    createdAt: 0,
    completedAt: null,
    ...over
  };
}

test('G04: more than 12 goals throws from assertWorldInvariants', () => {
  const w = freshWorld();
  const tooMany = Array.from({ length: 13 }, (_, i) => makeGoal({ id: `goal_${i}` }));
  // Bypass ensureWorld's truncation by mutating directly.
  w.goals = tooMany;
  assert.throws(() => assertWorldInvariants(w), /goals\.length/);
});

test('G04: invalid goal kind throws', () => {
  const w = freshWorld();
  w.goals = [makeGoal({ kind: 'eat' })];
  assert.throws(() => assertWorldInvariants(w), /invalid goal kind/);
});

test('G04: invalid goal status throws', () => {
  const w = freshWorld();
  w.goals = [makeGoal({ status: 'pending' })];
  assert.throws(() => assertWorldInvariants(w), /invalid goal status/);
});

test('G04: completedAt is preserved across ensureWorld (cannot be silently dropped)', () => {
  const w = freshWorld();
  w.goals = [makeGoal({ status: 'completed', completedAt: 5 })];
  assertWorldInvariants(w);

  // ensureWorld preserves completedAt as-is when present and valid.
  const after = ensureWorld(JSON.parse(JSON.stringify(w)));
  assert.equal(after.goals[0].completedAt, 5);
  assert.equal(after.goals[0].status, 'completed');
});

test('G04: completed goal must have completedAt', () => {
  const w = freshWorld();
  w.goals = [makeGoal({ status: 'completed', completedAt: null })];
  assert.throws(() => assertWorldInvariants(w), /completedAt/);
});

test('G04: duplicate goal ids throw', () => {
  const w = freshWorld();
  w.goals = [makeGoal({ id: 'goal_0' }), makeGoal({ id: 'goal_0', targetRef: 'n2' })];
  assert.throws(() => assertWorldInvariants(w), /duplicate goal id/);
});
