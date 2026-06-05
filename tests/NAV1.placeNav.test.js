import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlaceGrid, walkable, walkTo } from '../public/map/placeNav.js';

// One building: a 4x4 room centered at (5,5) → walls on the ring x∈{3,7}/y∈{3,7},
// with a doorway carved in the south wall at (5,7). Open ground all around.
const place = {
  buildings: [{ ox: 0, oy: 0, plan: {
    rooms: [{ id: 'r', shape: 'rect', cx: 5, cy: 5, w: 4, h: 4 }],
    doors: [{ x: 5, y: 7, orient: 'h' }]
  } }],
  terrain: { paths: [{ pts: [[0, 10], [12, 10]] }] },
  tokens: []
};
const grid = buildPlaceGrid(place);

test('NAV1: open ground is walkable', () => {
  assert.equal(walkable(grid, 5, 10), true);   // on the road
  assert.equal(walkable(grid, 5, 5), true);     // inside the room (floor)
});

test('NAV1: walls are not walkable, the doorway is', () => {
  assert.equal(walkable(grid, 2.5, 5), false, 'west wall blocks');
  assert.equal(walkable(grid, 7.5, 5), false, 'east wall blocks');
  assert.equal(walkable(grid, 5, 7), true, 'south doorway is open');
});

test('NAV1: walking into a wall stops at it (no passing through)', () => {
  // From the road, head straight up into the WEST part of the south wall (x=3.5),
  // which has no door — should stop outside the room.
  const end = walkTo(grid, 3.5, 10, 3.5, 5);
  assert.ok(end.uy > 7 - 0.6, `should stop south of the wall, got uy=${end.uy.toFixed(2)}`);
});

test('NAV1: walking through the doorway puts you inside', () => {
  // From the road below the door, walk up through (5,7) into the room.
  const end = walkTo(grid, 5, 10, 5, 5);
  assert.ok(end.uy < 6.5 && Math.abs(end.ux - 5) < 1, `should be inside the room, got (${end.ux.toFixed(2)}, ${end.uy.toFixed(2)})`);
});

test('NAV1: walkTo is deterministic and respects maxStep (speed cap)', () => {
  const a = walkTo(grid, 5, 10, 5, 0, { maxStep: 2 });
  const b = walkTo(grid, 5, 10, 5, 0, { maxStep: 2 });
  assert.deepEqual(a, b);
  assert.ok(Math.hypot(a.ux - 5, a.uy - 10) <= 2.01, 'moved no further than maxStep');
});

test('NAV1: standing still returns the same point', () => {
  assert.deepEqual(walkTo(grid, 4, 4, 4, 4), { ux: 4, uy: 4 });
});
