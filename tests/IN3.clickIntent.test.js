import test from 'node:test';
import assert from 'node:assert/strict';
import { intentFromClick } from '../engine/intent/intentFromClick.js';

const ctx = { spells: ['fireball', 'fire_bolt'], abilities: ['sword', 'shortbow'] };

test('IN3: click a foe with a weapon armed → attack', () => {
  const i = intentFromClick({ kind: 'enemy', target: 'e1', x: 9, y: 3, ability: 'sword' }, ctx);
  assert.equal(i.verb, 'attack');
  assert.equal(i.target, 'e1');
  assert.equal(i.with, 'sword');
  assert.equal(i.source, 'click');
  assert.equal(i.confidence, 1);
});

test('IN3: click a foe with a spell armed → cast', () => {
  const i = intentFromClick({ kind: 'enemy', target: 'e2', x: 11, y: 6, ability: 'fireball' }, ctx);
  assert.equal(i.verb, 'cast');
  assert.equal(i.with, 'fireball');
});

test('IN3: click empty ground with a spell armed → blind-fire cast at the tile', () => {
  const i = intentFromClick({ kind: 'tile', x: 7, y: 5, ability: 'fireball' }, ctx);
  assert.equal(i.verb, 'cast');
  assert.deepEqual(i.at, { x: 7, y: 5 });
});

test('IN3: click empty ground with a weapon armed → move', () => {
  const i = intentFromClick({ kind: 'tile', x: 4, y: 2, ability: 'sword' }, ctx);
  assert.equal(i.verb, 'move');
  assert.deepEqual(i.at, { x: 4, y: 2 });
});

test('IN3: click a person → talk', () => {
  const i = intentFromClick({ kind: 'npc', target: 'guard' }, ctx);
  assert.equal(i.verb, 'talk');
  assert.equal(i.target, 'guard');
});

test('IN3: click loot → take', () => {
  assert.equal(intentFromClick({ kind: 'item', target: 'torch' }, ctx).verb, 'take');
});
