import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGrid } from '../engine/tactical/visibility.js';
import { makeBattle, moveActor, attack, endPlayerTurn, visibleEnemies, reachableForActor, checkOver } from '../engine/tactical/battle.js';

function arena() {
  const g = makeGrid(20, 12);
  return makeBattle({
    seed: 'fight', grid: g, actors: [
      { id: 'pc', faction: 'player', x: 2, y: 6, hp: 30, maxHp: 30, ac: 14, move: 5, aim: 80, abilities: ['sword', 'shortbow', 'fireball'], damage: '1d8', agility: 3 },
      { id: 'wolf', faction: 'enemy', name: 'Wolf', x: 3, y: 6, hp: 8, maxHp: 8, ac: 12, move: 6, aim: 55, damage: '1d6', agility: 2 },
      { id: 'goblin', faction: 'enemy', name: 'Goblin', x: 15, y: 6, hp: 7, maxHp: 7, ac: 13, move: 5, aim: 50, damage: '1d6', agility: 1 }
    ]
  });
}

test('TAC11: an adjacent attack damages and can kill', () => {
  let b = arena();
  for (let i = 0; i < 6 && b.actors.wolf.hp > 0; i++) b = attack(b, 'pc', 'wolf', 'sword');
  assert.ok(b.actors.wolf.hp <= 0, 'the adjacent wolf eventually falls');
});

test('TAC11: fog hides the distant enemy until seen', () => {
  const g = makeGrid(20, 12); for (let y = 0; y < 12; y++) g.set(9, y, 1);
  const b = makeBattle({ seed: 'f', grid: g, actors: [
    { id: 'pc', faction: 'player', x: 2, y: 6, hp: 30, sight: 9 },
    { id: 'goblin', faction: 'enemy', name: 'Goblin', x: 15, y: 6, hp: 7 }
  ]});
  assert.equal(visibleEnemies(b).length, 0, 'a wall hides the goblin');
});

test('TAC11: reachable tiles respect the move budget', () => {
  const r = reachableForActor(arena(), 'pc');
  assert.ok(r.tiles.has('7,6') && !r.tiles.has('8,6'), 'move 5 reaches 5 east, not 6');
});

test('TAC11: enemy phase acts — the adjacent wolf bites', () => {
  let b = arena();
  const hp0 = b.actors.pc.hp;
  b = endPlayerTurn(b);
  assert.ok(b.actors.pc.hp < hp0 || b.over === 'lose', 'the wolf in melee range strikes the player');
});

test('TAC11: blind-fire fireball hits through fog (AoE, no LoS needed)', () => {
  let b = arena();
  b = moveActor(b, 'pc', 7, 6);            // close to within fireball range of the goblin
  const before = b.actors.goblin.hp;
  b = attack(b, 'pc', 'goblin', 'fireball'); // dist 8 <= range 9; AoE catches it
  assert.ok(b.actors.goblin.hp < before, 'the blast lands on the goblin');
});

test('TAC11: win when all enemies fall; deterministic exchange', () => {
  let b = arena();
  b.actors.goblin.x = 2; b.actors.goblin.y = 5;      // both enemies adjacent
  for (let i = 0; i < 8 && b.actors.wolf.hp > 0; i++) b = attack(b, 'pc', 'wolf', 'sword');
  for (let i = 0; i < 8 && b.actors.goblin.hp > 0; i++) b = attack(b, 'pc', 'goblin', 'sword');
  assert.equal(checkOver(b).over, 'win');
  assert.equal(attack(arena(), 'pc', 'wolf', 'sword').actors.wolf.hp, attack(arena(), 'pc', 'wolf', 'sword').actors.wolf.hp);
});
