// Pass CM1 — Damage Types & Resistance Matrix.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAMAGE_TYPES,
  RESISTANCE_LEVELS,
  applyResistance,
  normalizeResistances,
  isValidDamageType
} from '../engine/combat/damageTypes.js';
import { ensureCombat } from '../engine/state.js';
import { mintEnemyFromNpc } from '../engine/combat/combatLifecycle.js';

describe('CM01 — damage types module', () => {
  it('exports exactly 15 damage types', () => {
    assert.equal(DAMAGE_TYPES.length, 15);
    const unique = new Set(DAMAGE_TYPES);
    assert.equal(unique.size, 15, 'all damage types are unique');
  });

  it('all damage types are recognized by isValidDamageType', () => {
    for (const t of DAMAGE_TYPES) {
      assert.ok(isValidDamageType(t), `${t} should be valid`);
    }
    assert.ok(!isValidDamageType('banana'), 'banana is not a damage type');
    assert.ok(!isValidDamageType(''), 'empty string is not a damage type');
  });

  it('exports 5 resistance levels', () => {
    const levels = Object.keys(RESISTANCE_LEVELS);
    assert.equal(levels.length, 5);
    assert.deepEqual(levels.sort(), ['absorb', 'immune', 'normal', 'resistant', 'vulnerable']);
  });
});

describe('CM01 — applyResistance', () => {
  it('normal (unlisted) type deals full damage', () => {
    const r = applyResistance(10, 'fire', {});
    assert.equal(r.final, 10);
    assert.equal(r.level, 'normal');
    assert.equal(r.heals, false);
  });

  it('immune deals 0 damage', () => {
    const r = applyResistance(10, 'fire', { fire: 'immune' });
    assert.equal(r.final, 0);
    assert.equal(r.level, 'immune');
    assert.equal(r.heals, false);
  });

  it('resistant halves damage (floor)', () => {
    const r = applyResistance(7, 'cold', { cold: 'resistant' });
    assert.equal(r.final, 3); // floor(7/2) = 3
    assert.equal(r.level, 'resistant');
    assert.equal(r.heals, false);
  });

  it('resistant on 1 damage yields 0', () => {
    const r = applyResistance(1, 'fire', { fire: 'resistant' });
    assert.equal(r.final, 0);
  });

  it('vulnerable doubles damage', () => {
    const r = applyResistance(5, 'lightning', { lightning: 'vulnerable' });
    assert.equal(r.final, 10);
    assert.equal(r.level, 'vulnerable');
    assert.equal(r.heals, false);
  });

  it('absorb returns heals=true with full magnitude', () => {
    const r = applyResistance(8, 'fire', { fire: 'absorb' });
    assert.equal(r.final, 8);
    assert.equal(r.level, 'absorb');
    assert.equal(r.heals, true);
  });

  it('0 damage stays 0 regardless of resistance', () => {
    for (const level of ['immune', 'resistant', 'normal', 'vulnerable', 'absorb']) {
      const r = applyResistance(0, 'fire', { fire: level });
      assert.equal(r.final, 0, `0 damage with ${level}`);
    }
  });

  it('negative/NaN damage clamps to 0', () => {
    assert.equal(applyResistance(-5, 'fire', {}).final, 0);
    assert.equal(applyResistance(NaN, 'fire', {}).final, 0);
    assert.equal(applyResistance(undefined, 'fire', {}).final, 0);
  });

  it('mismatched type ignores resistance', () => {
    const r = applyResistance(10, 'cold', { fire: 'immune' });
    assert.equal(r.final, 10);
    assert.equal(r.level, 'normal');
  });
});

describe('CM01 — normalizeResistances', () => {
  it('passes through valid entries', () => {
    const res = normalizeResistances({ fire: 'immune', cold: 'resistant' });
    assert.deepEqual(res, { fire: 'immune', cold: 'resistant' });
  });

  it('strips unknown types', () => {
    const res = normalizeResistances({ banana: 'immune', fire: 'vulnerable' });
    assert.deepEqual(res, { fire: 'vulnerable' });
  });

  it('strips invalid levels', () => {
    const res = normalizeResistances({ fire: 'superimmune', cold: 'resistant' });
    assert.deepEqual(res, { cold: 'resistant' });
  });

  it('omits normal entries (implicit default)', () => {
    const res = normalizeResistances({ fire: 'normal', cold: 'immune' });
    assert.deepEqual(res, { cold: 'immune' });
  });

  it('handles conditional shape (extracts level)', () => {
    const res = normalizeResistances({
      fire: { level: 'resistant', condition: 'while_submerged' }
    });
    assert.deepEqual(res, { fire: 'resistant' });
  });

  it('returns empty object for null/undefined', () => {
    assert.deepEqual(normalizeResistances(null), {});
    assert.deepEqual(normalizeResistances(undefined), {});
    assert.deepEqual(normalizeResistances(42), {});
  });
});

describe('CM01 — ensureCombat with resistances', () => {
  it('normalizes resistances on enemies', () => {
    const combat = ensureCombat({
      active: true, round: 1, turnIndex: 0,
      enemies: [{
        id: 'enemy_0', name: 'Fireborn', hp: 20, maxHp: 20, damage: 5,
        resistances: { fire: 'absorb', cold: 'vulnerable', banana: 'immune' },
        conditionImmunities: ['poisoned', 'frightened'],
        damageType: 'fire',
        canParley: false, defeated: false, sourceNpcId: ''
      }],
      beganAt: 0, reason: 'test'
    });
    const e = combat.enemies[0];
    assert.deepEqual(e.resistances, { fire: 'absorb', cold: 'vulnerable' });
    assert.deepEqual(e.conditionImmunities, ['poisoned', 'frightened']);
    assert.equal(e.damageType, 'fire');
  });

  it('defaults damageType to bludgeoning, resistances to {}, conditionImmunities to []', () => {
    const combat = ensureCombat({
      active: true, round: 1, turnIndex: 0,
      enemies: [{
        id: 'enemy_0', name: 'Thug', hp: 10, maxHp: 10, damage: 3,
        canParley: true, defeated: false, sourceNpcId: ''
      }],
      beganAt: 0, reason: 'test'
    });
    const e = combat.enemies[0];
    assert.equal(e.damageType, 'bludgeoning');
    assert.deepEqual(e.resistances, {});
    assert.deepEqual(e.conditionImmunities, []);
  });

  it('rejects invalid damageType, falls back to bludgeoning', () => {
    const combat = ensureCombat({
      active: true, round: 1, turnIndex: 0,
      enemies: [{
        id: 'enemy_0', name: 'Bug', hp: 5, maxHp: 5, damage: 1,
        damageType: 'banana',
        canParley: false, defeated: false, sourceNpcId: ''
      }],
      beganAt: 0, reason: 'test'
    });
    assert.equal(combat.enemies[0].damageType, 'bludgeoning');
  });
});

describe('CM01 — mintEnemyFromNpc with bestiary', () => {
  it('goblin gets slashing damageType from first action', () => {
    const enemy = mintEnemyFromNpc({
      id: 'npc_g', name: 'Goblin', bestiaryRef: 'goblin'
    });
    assert.equal(enemy.damageType, 'slashing');
    assert.deepEqual(enemy.resistances, {});
    assert.deepEqual(enemy.conditionImmunities, []);
  });

  it('enemy without bestiary defaults to bludgeoning', () => {
    const enemy = mintEnemyFromNpc({ id: 'npc_t', name: 'Thug' });
    assert.equal(enemy.damageType, 'bludgeoning');
    assert.deepEqual(enemy.resistances, {});
    assert.deepEqual(enemy.conditionImmunities, []);
  });
});
