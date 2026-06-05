import test from 'node:test';
import assert from 'node:assert/strict';

import { roomAdjacency, reachableRooms, pathBetween } from '../engine/movement/interiorMovement.js';

// entry-hall(1) — kitchen(2) — larder(3)
//      |                \
//   great(4) — cells(5)  shrine(6) — vault(7)
const topo = {
  kind: 'rooms',
  rooms: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }, { id: '6' }, { id: '7' }],
  edges: [
    { a: '1', b: '2' }, { a: '1', b: '4' }, { a: '2', b: '3' },
    { a: '2', b: '6' }, { a: '4', b: '5' }, { a: '6', b: '7' }
  ]
};

test('U92: roomAdjacency lists sorted neighbors', () => {
  const adj = roomAdjacency(topo);
  assert.deepEqual(adj.get('2'), ['1', '3', '6']);
  assert.deepEqual(adj.get('5'), ['4']);
});

test('U92: reachableRooms BFS distances from entry', () => {
  const { dist } = reachableRooms(topo, '1');
  assert.equal(dist.get('1'), 0);
  assert.equal(dist.get('2'), 1); // adjacent — careful step
  assert.equal(dist.get('4'), 1);
  assert.equal(dist.get('3'), 2); // dash
  assert.equal(dist.get('5'), 2);
  assert.equal(dist.get('6'), 2);
  assert.equal(dist.get('7'), 3);
});

test('U92: pathBetween reconstructs a route', () => {
  assert.deepEqual(pathBetween(topo, '1', '7'), ['1', '2', '6', '7']);
  assert.deepEqual(pathBetween(topo, '1', '5'), ['1', '4', '5']);
  assert.deepEqual(pathBetween(topo, '1', '1'), ['1']);
});

test('U92: deterministic + unreachable handling', () => {
  const a = reachableRooms(topo, '1');
  const b = reachableRooms(topo, '1');
  assert.deepEqual([...a.dist.entries()].sort(), [...b.dist.entries()].sort());
  const island = { kind: 'rooms', rooms: [{ id: 'x' }, { id: 'y' }], edges: [] };
  assert.deepEqual(pathBetween(island, 'x', 'y'), []);
});
