import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTopology, adjacentRooms } from '../engine/structures/topology.js';

test('U47: S3 topology normalize rooms + edges deterministically', () => {
  const topo = normalizeTopology({
    kind: 'rooms',
    rooms: [{ id: 'b' }, { id: 'a', tags: ['x', 'x', 'y'] }, { id: 'a' }],
    edges: [{ a: 'a', b: 'b' }, { a: 'b', b: 'a' }, { a: 'a', b: 'a' }, { a: 'a', b: 'c' }]
  });

  assert.deepEqual(topo, {
    kind: 'rooms',
    rooms: [{ id: 'a', tags: ['x', 'y'] }, { id: 'b', tags: [] }],
    edges: [{ a: 'a', b: 'b' }]
  });
});

test('U47: S3 adjacency is stable and sorted', () => {
  const topo = {
    kind: 'rooms',
    rooms: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    edges: [{ a: 'a', b: 'c' }, { a: 'b', b: 'a' }]
  };

  assert.deepEqual(adjacentRooms(topo, 'a'), ['b', 'c']);
  assert.deepEqual(adjacentRooms(topo, 'b'), ['a']);
  assert.deepEqual(adjacentRooms(topo, 'z'), []);
});
