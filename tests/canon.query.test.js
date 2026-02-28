import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNarrationContext } from '../canon/query.js';
import { newWorld } from '../engine/state.js';

function isSortedById(arr) {
  if (!Array.isArray(arr)) return false;
  for (let i = 1; i < arr.length; i++) {
    const a = String(arr[i - 1]?.id ?? '');
    const b = String(arr[i]?.id ?? '');
    if (a.localeCompare(b) > 0) return false;
  }
  return true;
}

test('canon query: deterministic output', () => {
  const world = newWorld({ seed: 'test-seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  world.scene.promptSeed = 'p';

  const contextA = buildNarrationContext(world);
  const contextB = buildNarrationContext(world);

  assert.deepEqual(contextA, contextB);
});

test('canon query: no leakage of world internals', () => {
  const world = newWorld({ seed: 'test-seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  world.scene.promptSeed = 'p';

  const ctx = buildNarrationContext(world);

  assert.ok(ctx && typeof ctx === 'object');
  assert.ok(Object.prototype.hasOwnProperty.call(ctx, 'currentNodeId'));
  assert.ok(Object.prototype.hasOwnProperty.call(ctx, 'activeThreads'));
  assert.ok(Object.prototype.hasOwnProperty.call(ctx, 'scars'));

  assert.ok(!Object.prototype.hasOwnProperty.call(ctx, 'ecology'));
  assert.ok(!Object.prototype.hasOwnProperty.call(ctx, 'factions'));
  assert.ok(!Object.prototype.hasOwnProperty.call(ctx, 'ledger'));
  assert.ok(!Object.prototype.hasOwnProperty.call(ctx, 'timeline'));
  assert.ok(!Object.prototype.hasOwnProperty.call(ctx, 'instrument'));
  assert.ok(!Object.prototype.hasOwnProperty.call(ctx, 'map'));
});

test('canon query: stable ordering of threads and scars', () => {
  const world = newWorld({ seed: 'test-seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  world.scene.promptSeed = 'p';

  const ctx = buildNarrationContext(world);

  assert.ok(Array.isArray(ctx.activeThreads));
  assert.ok(Array.isArray(ctx.scars));
  assert.ok(isSortedById(ctx.activeThreads));
  assert.ok(isSortedById(ctx.scars));
});

test('canon query: no prose payloads in fields', () => {
  const world = newWorld({ seed: 'test-seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  world.scene.promptSeed = 'p';

  const ctx = buildNarrationContext(world);

  // Guard: no long freeform strings anywhere in the context.
  const stack = [ctx];
  while (stack.length) {
    const v = stack.pop();
    if (v == null) continue;

    if (typeof v === 'string') {
      assert.ok(v.length <= 40);
      continue;
    }

    if (Array.isArray(v)) {
      for (const x of v) stack.push(x);
      continue;
    }

    if (typeof v === 'object') {
      for (const k of Object.keys(v)) stack.push(v[k]);
    }
  }
});
