import test from 'node:test';
import assert from 'node:assert/strict';

import { parseHazard, resolveHazard, HAZARD_TUNABLES } from '../engine/combat/hazard.js';

// Environmental hazards (design 2026-06-16: SRD first, real-world analog else).
// "kick the support beam, roof comes down on us" / "leap into the fire" / "out
// the window" were narrated with ZERO mechanical effect. Now they deal SRD damage.

const pc = { stats: { AGILITY: 10 } }; // +0
const LOW = { int: (a) => a };       // min of each range → failed save, min damage
const HIGH = { int: (a, b) => b };   // max of each range → d20=20 (save), max dice

test('U158: parseHazard recognizes collapse / fire / fall self-endangerment', () => {
  assert.equal(parseHazard('I kick the support beam until the whole roof comes down on us'), 'collapse');
  assert.equal(parseHazard('I bring the ceiling down on everyone'), 'collapse');
  assert.equal(parseHazard('I leap into the fire'), 'fire');
  assert.equal(parseHazard('I throw myself out the window'), 'fall');
  assert.equal(parseHazard('I walk to the elder'), null);
  assert.equal(parseHazard('I swing my sword'), null);
});

test('U158: a collapse deals bludgeoning to the PC and area enemies', () => {
  const enemies = [{ id: 'e0', name: 'Bandit', hp: 8, maxHp: 8, defeated: false }];
  const r = resolveHazard({ kind: 'collapse', pc, escapeHp: 20, escMax: 20, enemies, rng: LOW });
  assert.ok(r.hp < 20, 'PC took damage');
  assert.ok(enemies[0].hp < 8, 'enemy caught in the collapse');
  assert.match(r.mechanicsLine, /hazard:collapse/);
});

test('U158: a fire hazard burns the PC', () => {
  const r = resolveHazard({ kind: 'fire', pc, escapeHp: 13, escMax: 13, enemies: [], rng: LOW });
  assert.equal(r.hp, 13 - HAZARD_TUNABLES.FIRE_DICE.n * 1, '2d6 min = 2'); // LOW → each die 1
  assert.match(r.mechanicsLine, /hazard:fire/);
});

test('U158: a fall deals 1d6 per 10ft', () => {
  const r = resolveHazard({ kind: 'fall', pc, escapeHp: 13, escMax: 13, enemies: [], rng: LOW });
  const dice = Math.round(HAZARD_TUNABLES.FALL_FEET / 10);
  assert.equal(r.hp, 13 - dice * 1, 'min fall damage');
});

test('U158: a save halves the collapse damage (high AGILITY save)', () => {
  const agilePc = { stats: { AGILITY: 20 } };
  const r = resolveHazard({ kind: 'collapse', pc: agilePc, escapeHp: 30, escMax: 30, enemies: [], rng: HIGH });
  // HIGH → 4d6 of 6 = 24 full; save (20+5 ≥ 15) → half = 12
  assert.equal(r.hp, 30 - 12, 'half on a successful save');
  assert.match(r.mechanicsLine, /saved/);
});
