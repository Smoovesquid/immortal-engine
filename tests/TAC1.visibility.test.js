import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGrid, losClear, computeVisibility, canSee } from '../engine/tactical/visibility.js';

test('TAC1: a wall blocks line of sight', () => {
  const g = makeGrid(7, 1);
  g.set(3, 0, 1); // wall in the middle
  assert.equal(losClear(g, 0, 0, 2, 0), true, 'clear up to the wall');
  assert.equal(losClear(g, 0, 0, 3, 0), true, 'you can see the wall itself (endpoint)');
  assert.equal(losClear(g, 0, 0, 6, 0), false, 'cannot see past the wall');
});

test('TAC1: a doorway gap lets sight through', () => {
  const g = makeGrid(7, 3);
  for (let y = 0; y < 3; y++) g.set(3, y, 1); // wall column
  g.set(3, 1, 0);                              // door gap at y=1
  assert.equal(losClear(g, 0, 1, 6, 1), true, 'see through the door row');
  assert.equal(losClear(g, 0, 0, 6, 0), false, 'blocked on the walled row');
});

test('TAC1: visibility respects radius and walls', () => {
  const g = makeGrid(11, 11);
  const vis = computeVisibility(g, 5, 5, 3);
  assert.ok(vis.has('5,5'));
  assert.ok(vis.has('5,8'));        // within radius
  assert.ok(!vis.has('5,9'));       // outside radius 3
  // add a wall and confirm it shadows
  const g2 = makeGrid(11, 11);
  g2.set(5, 6, 1);
  const vis2 = computeVisibility(g2, 5, 5, 5);
  assert.ok(vis2.has('5,6'), 'sees the wall');
  assert.ok(!vis2.has('5,9'), 'wall shadows the cells directly behind it');
});

test('TAC1: canSee = range + clear line; deterministic', () => {
  const g = makeGrid(9, 9); g.set(4, 4, 1);
  assert.equal(canSee(g, 4, 2, 4, 6, 8), false, 'wall between blocks');
  assert.equal(canSee(g, 0, 0, 8, 8, 3), false, 'out of range');
  const a = [...computeVisibility(g, 1, 1, 5)].sort();
  const b = [...computeVisibility(g, 1, 1, 5)].sort();
  assert.deepEqual(a, b);
});
