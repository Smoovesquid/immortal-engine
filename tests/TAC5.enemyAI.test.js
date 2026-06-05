import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGrid } from '../engine/tactical/visibility.js';
import { enemyTurn } from '../engine/tactical/enemyAI.js';

test('TAC5: attacks when it can see the player in range', () => {
  const g = makeGrid(15, 5);
  const r = enemyTurn({ enemy: { id: 'wolf', x: 5, y: 2, sight: 8, attackRange: 1.6 }, player: { id: 'pc', x: 6, y: 2 }, opacity: g });
  assert.equal(r.action.type, 'attack');
  assert.deepEqual(r.enemy.lastSeen, { x: 6, y: 2 });
});

test('TAC5: closes in when it sees the player but is too far', () => {
  const g = makeGrid(20, 5);
  const r = enemyTurn({ enemy: { id: 'wolf', x: 2, y: 2, sight: 12, move: 5, attackRange: 1.6 }, player: { id: 'pc', x: 12, y: 2 }, opacity: g });
  assert.equal(r.action.type, 'move');
  assert.ok(r.enemy.x > 2, 'moved toward the player');
  assert.deepEqual(r.enemy.lastSeen, { x: 12, y: 2 });
});

test('TAC5: hunts the last-seen position when sight is lost', () => {
  const g = makeGrid(20, 6); for (let y = 0; y < 6; y++) g.set(8, y, 1); // wall hides the player
  const r = enemyTurn({ enemy: { id: 'wolf', x: 2, y: 2, sight: 12, move: 4, attackRange: 1.6, lastSeen: { x: 6, y: 2 } }, player: { id: 'pc', x: 14, y: 2 }, opacity: g });
  assert.equal(r.action.type, 'hunt');
  assert.ok(r.enemy.x > 2, 'moves toward last-seen, not the unseen player');
});

test('TAC5: patrols waypoints when idle, advancing on arrival', () => {
  const g = makeGrid(12, 6);
  let e = { id: 'guard', x: 1, y: 1, sight: 6, move: 10, patrol: [{ x: 5, y: 1 }, { x: 1, y: 1 }], patrolIdx: 0 };
  const r1 = enemyTurn({ enemy: e, player: { x: 11, y: 5 }, opacity: g }); // player far + unseen
  assert.equal(r1.action.type, 'patrol');
  assert.deepEqual({ x: r1.enemy.x, y: r1.enemy.y }, { x: 5, y: 1 }, 'reached first waypoint');
  assert.equal(r1.enemy.patrolIdx, 1, 'advanced to next waypoint');
});

test('TAC5: deterministic', () => {
  const g = makeGrid(20, 6);
  const args = { enemy: { id: 'wolf', x: 2, y: 2, sight: 12, move: 5 }, player: { x: 12, y: 3 }, opacity: g };
  assert.deepEqual(enemyTurn(args), enemyTurn(args));
});
