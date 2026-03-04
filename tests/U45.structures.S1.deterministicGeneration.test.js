import test from 'node:test';
import assert from 'node:assert/strict';
import { generateStructuresForNode } from '../engine/structures/generateStructures.js';
import { WORLD_VERSION } from '../engine/state.js';

test('U45: S1 structures generator deterministic for same inputs', () => {
  const inp = {
    seed: 'U45-seed',
    nodeId: 'node-7',
    engineVersion: WORLD_VERSION,
    nodeTags: ['a', 'b', 'structure:demo']
  };

  const a = generateStructuresForNode(inp);
  const b = generateStructuresForNode(inp);

  assert.deepEqual(a, b);
});

test('U45: S1 structures generator diverges when nodeId changes', () => {
  const base = {
    seed: 'U45-seed',
    engineVersion: WORLD_VERSION,
    nodeTags: ['structure:demo']
  };

  const a = generateStructuresForNode({ ...base, nodeId: 'node-1' });
  const b = generateStructuresForNode({ ...base, nodeId: 'node-2' });

  // Either different ids or different presence; both acceptable for divergence.
  assert.notDeepEqual(a, b);
});

test('U45: S1 structures generator returns stable empty when no trigger', () => {
  const out = generateStructuresForNode({
    seed: 'U45-seed',
    nodeId: 'node-7',
    engineVersion: WORLD_VERSION,
    nodeTags: ['nope']
  });

  assert.deepEqual(out, []);
});
