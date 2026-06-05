import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent } from '../engine/intent/parseIntent.js';

const ctx = {
  entities: [
    { id: 'e1', ref: 'dire_wolf_alpha', name: 'Dire Wolf Alpha', faction: 'enemy' },
    { id: 'e2', ref: 'yuan_ti', name: 'Yuan-Ti Abomination', faction: 'enemy' },
    { id: 'g1', ref: 'guard', name: 'the town guard', faction: 'neutral' }
  ],
  abilities: ['sword', 'shortbow'],
  spells: ['fireball', 'fire_bolt'],
  items: ['torch', 'rope']
};

test('IN2: "I charge the wolf and cut it down" → attack the wolf, force', () => {
  const i = parseIntent('I charge the wolf and cut it down', ctx);
  assert.equal(i.verb, 'attack');
  assert.equal(i.target, 'e1');
  assert.equal(i.approach, 'force');
  assert.ok(i.confidence >= 0.8);
});

test('IN2: "shoot the wolf with my shortbow" → attack, finesse, instrument', () => {
  const i = parseIntent('shoot the wolf with my shortbow', ctx);
  assert.equal(i.verb, 'attack');
  assert.equal(i.with, 'shortbow');
  assert.equal(i.approach, 'finesse');
});

test('IN2: "cast fireball at the yuan-ti" → cast, spell, target', () => {
  const i = parseIntent('cast fireball at the yuan-ti', ctx);
  assert.equal(i.verb, 'cast');
  assert.equal(i.with, 'fireball');
  assert.equal(i.target, 'e2');
  assert.equal(i.approach, 'focus');
});

test('IN2: "persuade the guard to let us pass" → talk, heart', () => {
  const i = parseIntent('persuade the guard to let us pass', ctx);
  assert.equal(i.verb, 'talk');
  assert.equal(i.target, 'g1');
  assert.equal(i.approach, 'heart');
});

test('IN2: "sneak past and search the altar" → first verb wins (flee? no) — search/sneak finesse hint', () => {
  const i = parseIntent('quietly search the room', ctx);
  assert.equal(i.verb, 'search');
  assert.equal(i.approach, 'finesse', 'the "quietly" hint overrides the default focus');
});

test('IN2: free narration with no verb → ask (handed to the DM)', () => {
  const i = parseIntent('the firelight reminds me of home', ctx);
  assert.equal(i.verb, 'ask');
  assert.ok(i.text.length > 0, 'raw text preserved for the DM');
});

test('IN2: bare "attack" with nothing named → low confidence, needs a click', () => {
  const i = parseIntent('attack!', ctx);
  assert.equal(i.verb, 'attack');
  assert.equal(i.target, null);
  assert.ok(i.confidence < 0.8, 'ambiguous — UI should ask which target or accept a click');
});

test('IN2: longest-name match wins (yuan-ti abomination over a stray word)', () => {
  const i = parseIntent('strike the abomination', ctx);
  assert.equal(i.target, 'e2');
});

test('IN2: "hurl fire into the dark" resolves the fireball spell (players say "fire")', () => {
  const i = parseIntent('hurl fire into the dark', ctx);
  assert.equal(i.with, 'fireball');
});

test('IN2: "shoot it with my bow" resolves shortbow (short-hand)', () => {
  const i = parseIntent('shoot it with my bow', ctx);
  assert.equal(i.with, 'shortbow');
});

test('IN2: "I run for it" is a flee, not a move', () => {
  assert.equal(parseIntent('I run for it', ctx).verb, 'flee');
  assert.equal(parseIntent('flee!', ctx).verb, 'flee');
});

test('IN2: deterministic', () => {
  assert.deepEqual(parseIntent('cast fireball at the wolf', ctx), parseIntent('cast fireball at the wolf', ctx));
});
