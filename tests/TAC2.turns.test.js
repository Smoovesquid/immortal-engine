import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGrid } from '../engine/tactical/visibility.js';
import { reachableTiles, reachable, pathTo, rollInitiative, makeTurnQueue } from '../engine/tactical/turns.js';

test('TAC2: reachability respects budget and walls', () => {
  const g = makeGrid(11, 11);
  const r = reachableTiles(g, 5, 5, 3);
  assert.ok(r.has('5,5'));
  assert.ok(r.has('8,5'), '3 orthogonal east reachable');
  assert.ok(!r.has('9,5'), '4 east is beyond budget 3');
  // wall it off
  const g2 = makeGrid(11, 11); for (let y = 0; y < 11; y++) g2.set(6, y, 1);
  const r2 = reachableTiles(g2, 5, 5, 6);
  assert.ok(!r2.has('8,5'), 'cannot pass the wall column');
});

test('TAC2: bold dash doubles the reachable range', () => {
  const g = makeGrid(21, 1);
  const careful = reachable(g, 0, 0, 5, 'careful');
  const dash = reachable(g, 0, 0, 5, 'bold');
  assert.ok(careful.tiles.has('5,0') && !careful.tiles.has('6,0'));
  assert.ok(dash.tiles.has('10,0'), 'dash reaches twice as far');
  assert.equal(dash.mode, 'bold');
});

test('TAC2: pathTo reconstructs a walkable route', () => {
  const g = makeGrid(11, 11);
  const r = reachable(g, 1, 1, 8);
  const p = pathTo(r, 4, 1);
  assert.deepEqual(p[0], [1, 1]);
  assert.deepEqual(p[p.length - 1], [4, 1]);
});

test('TAC2: no diagonal corner-cutting between two walls', () => {
  const g = makeGrid(5, 5); g.set(2, 1, 1); g.set(1, 2, 1); // walls forming an inner corner at (2,2) vs (1,1)
  const r = reachableTiles(g, 1, 1, 2);
  assert.ok(!r.has('2,2'), 'cannot squeeze diagonally between two walls');
});

test('TAC2: initiative is seeded + deterministic; turn queue cycles rounds', () => {
  const actors = [{ id: 'pc', agility: 3 }, { id: 'wolf', agility: 2 }, { id: 'bandit', agility: 1 }];
  const a = rollInitiative(actors, 's1'); const b = rollInitiative(actors, 's1');
  assert.deepEqual(a, b);
  assert.equal(a.length, 3);
  const q = makeTurnQueue(a);
  assert.equal(q.current(), a[0]);
  q.advance(); q.advance(); assert.equal(q.round(), 1);
  q.advance(); assert.equal(q.round(), 2, 'wraps to a new round');
});
