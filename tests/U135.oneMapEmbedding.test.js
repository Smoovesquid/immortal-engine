// U135 — ONE MAP world-space embedding (docs/ONE_MAP.md, the load-bearing 20%).
// These pure functions are the coordinate contract M4 (position unification)
// will build on, so they get locked here: deterministic, centered, monotone.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NODE_WU, PLACE_WU,
  nodeToWu, placeFrame, placeUnitToWu, worldBounds, fadeIn, discoveryTiers
} from '../public/map/worldSpace.js';

test('U135-01: nodes embed on the lattice at NODE_WU spacing', () => {
  assert.deepEqual(nodeToWu({ x: 0, y: 0 }), { x: 0, y: 0 });
  assert.deepEqual(nodeToWu({ x: 3, y: -2 }), { x: 3 * NODE_WU, y: -2 * NODE_WU });
  // adjacent nodes sit one NODE_WU apart (≈ 1 km at 1 wu ≈ 1 m)
  const a = nodeToWu({ x: 4, y: 7 }), b = nodeToWu({ x: 5, y: 7 });
  assert.equal(b.x - a.x, NODE_WU);
});

test('U135-02: placeFrame finds the layout midpoint; placeUnitToWu centers it on the node', () => {
  // a tiny synthetic place: two rooms spanning place-units 10..30 in x, 10..20 in y
  const place = {
    buildings: [
      { ox: 0, oy: 0, plan: { rooms: [{ cx: 15, cy: 15, w: 10, h: 10 }] } },
      { ox: 0, oy: 0, plan: { rooms: [{ cx: 25, cy: 15, w: 10, h: 10 }] } }
    ]
  };
  const frame = placeFrame(place);
  assert.equal(frame.minX, 10); assert.equal(frame.maxX, 30);
  assert.equal(frame.cx, 20); assert.equal(frame.cy, 15);

  const node = { x: 2, y: -1 };
  // the layout's own midpoint must land exactly on the node's wu position
  const mid = placeUnitToWu(node, frame, frame.cx, frame.cy);
  assert.deepEqual(mid, nodeToWu(node));
  // a point one place-unit east of midpoint is PLACE_WU east in world units
  const east = placeUnitToWu(node, frame, frame.cx + 1, frame.cy);
  assert.equal(east.x - mid.x, PLACE_WU);
});

test('U135-03: placeFrame is robust to round rooms, groves, paths, and empties', () => {
  const place = {
    buildings: [{ ox: 5, oy: 5, plan: { rooms: [{ shape: 'round', cx: 10, cy: 10, r: 3 }] } }],
    terrain: { groves: [{ cx: 0, cy: 0, r: 2 }], paths: [{ pts: [[-4, -4], [40, 2]] }] }
  };
  const f = placeFrame(place);
  assert.equal(f.minX, -4);          // the path's western point
  assert.equal(f.maxX, 40);          // the path's eastern point
  assert.ok(Number.isFinite(f.cx) && Number.isFinite(f.cy));
  // a place with nothing drawable degrades to a unit box, never NaN
  const empty = placeFrame({ buildings: [], terrain: {} });
  assert.ok(Number.isFinite(empty.cx) && Number.isFinite(empty.cy));
});

test('U135-04: fadeIn is a clamped 0→1 ramp (band transitions never pop)', () => {
  assert.equal(fadeIn(1, 2, 4), 0);    // below the band
  assert.equal(fadeIn(3, 2, 4), 0.5);  // halfway
  assert.equal(fadeIn(9, 2, 4), 1);    // above the band
  // monotone non-decreasing
  let prev = -1;
  for (let z = 0; z <= 6; z += 0.5) { const v = fadeIn(z, 2, 4); assert.ok(v >= prev); prev = v; }
});

test('U135-05: worldBounds covers every node with a margin', () => {
  const nodes = [{ x: -3, y: 1 }, { x: 5, y: -4 }, { x: 0, y: 0 }];
  const b = worldBounds(nodes, NODE_WU);
  assert.ok(b.minX <= -3 * NODE_WU && b.maxX >= 5 * NODE_WU);
  assert.ok(b.minY <= -4 * NODE_WU && b.maxY >= 1 * NODE_WU);
  // empty world still yields a finite box
  const e = worldBounds([], NODE_WU);
  assert.ok(Number.isFinite(e.minX) && Number.isFinite(e.maxX));
});

test('U135-06: discoveryTiers — known, rumor (adjacent to known), dark', () => {
  const map = {
    currentNodeId: 'a',
    discovered: ['a', 'b'],
    edges: [{ a: 'b', b: 'c' }, { a: 'c', b: 'd' }]
  };
  const { known, rumor } = discoveryTiers(map);
  assert.ok(known.has('a') && known.has('b'));
  assert.ok(rumor.has('c'), 'c is adjacent to known b → rumored');
  assert.ok(!rumor.has('d') && !known.has('d'), 'd is two hops out → dark');
  // the current node is always known even if absent from discovered[]
  const { known: k2 } = discoveryTiers({ currentNodeId: 'z', discovered: [], edges: [] });
  assert.ok(k2.has('z'));
});
