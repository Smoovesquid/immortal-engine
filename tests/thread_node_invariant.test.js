import test from 'node:test';
import assert from 'node:assert/strict';
import { assertWorldInvariants } from '../engine/invariants.js';

test('active thread cannot reference missing node', () => {
  const world = {
    timeline: [],
    map: {
      nodes: [{ id: 'a' }],
      edges: [],
      currentNodeId: 'a',
      discovered: ['a']
    },
    threads: [
      { id: 't1', active: true, nodeId: 'missing' }
    ]
  };

  assert.throws(() => {
    assertWorldInvariants(world);
  });
});
