import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureStructures } from '../engine/structures/structuresState.js';

test('U59/S1: kinds normalize deterministically', () => {
  const a = ensureStructures({ byId: {
    x: { id: 'x', kind: 'ROAD', nodeId: 'n0', anchors: { nodeId: 'n0' }, topology: null, surfaces: {}, tags: [] },
    y: { id: 'y', kind: '', nodeId: 'n0', anchors: { nodeId: 'n0' }, topology: null, surfaces: {}, tags: ['kind:tower'] }
  }, nextId: 1 });
  const b = ensureStructures({ byId: {
    y: { id: 'y', kind: '', nodeId: 'n0', anchors: { nodeId: 'n0' }, topology: null, surfaces: {}, tags: ['kind:tower'] },
    x: { id: 'x', kind: 'ROAD', nodeId: 'n0', anchors: { nodeId: 'n0' }, topology: null, surfaces: {}, tags: [] }
  }, nextId: 1 });

  assert.equal(a.byId.x.kind, 'road');
  assert.equal(a.byId.y.kind, 'tower');
  assert.deepEqual(a, b);
});

test('U59/S2: unknown kind normalizes to building', () => {
  const s = ensureStructures({ byId: {
    z: { id: 'z', kind: 'castle', nodeId: 'n0', anchors: { nodeId: 'n0' }, topology: null, surfaces: {}, tags: [] }
  }, nextId: 1 });
  assert.equal(s.byId.z.kind, 'building');
});
