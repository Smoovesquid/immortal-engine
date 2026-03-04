import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureStructures } from '../engine/structures/structuresState.js';

test('U49: ensureStructures normalizes anchors/topology/tags deterministically', () => {
  const input = {
    nextId: 7.9,
    byId: {
      s1: {
        id: 's1',
        kind: 'building',
        nodeId: 'node-1',
        anchors: { nodeId: 'node-1' }, // default kind => node
        topology: {
          kind: 'rooms',
          rooms: [{ id: 'b' }, { id: 'a' }, { id: 'a' }],
          edges: [{ a: 'b', b: 'a' }, { a: 'a', b: 'b' }, { a: 'a', b: 'a' }]
        },
        tags: ['z', 'a', 'a', 123, '']
      },
      s2: {
        // fallback id path should be preserved
        kind: 'road',
        nodeId: 'node-2',
        anchors: { kind: 'edge', aNodeId: 'z', bNodeId: 'a' }, // should canonicalize => a|z
        topology: { kind: 'nope' },
        tags: ['road', 'road', '']
      },
      s3: {
        id: 's3',
        nodeId: 'node-3',
        anchors: { kind: 'coord', nodeId: 'node-3', x: 999999999, y: -999999999 }, // clamp
        topology: null,
        tags: null
      }
    }
  };

  const out = ensureStructures(input);

  assert.equal(out.nextId, 7);
  assert.ok(out.byId.s1);
  assert.ok(out.byId.s2);
  assert.ok(out.byId.s3);

  // anchors normalized
  assert.deepEqual(out.byId.s1.anchors, { kind: 'node', nodeId: 'node-1' });
  assert.deepEqual(out.byId.s2.anchors, { kind: 'edge', aNodeId: 'a', bNodeId: 'z' });
  assert.deepEqual(out.byId.s3.anchors, { kind: 'coord', nodeId: 'node-3', x: 1000000, y: -1000000 });

  // topology normalized (sorted rooms + canonical edge)
  assert.deepEqual(out.byId.s1.topology, {
    kind: 'rooms',
    rooms: [{ id: 'a', tags: [] }, { id: 'b', tags: [] }],
    edges: [{ a: 'a', b: 'b' }]
  });
  assert.equal(out.byId.s2.topology, null);

  // tags uniq + string + sorted
  assert.deepEqual(out.byId.s1.tags, ['123', 'a', 'z']);
  assert.deepEqual(out.byId.s2.tags, ['road']);
  assert.deepEqual(out.byId.s3.tags, []);
});
