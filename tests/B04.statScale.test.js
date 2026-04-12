// Pass B2 — Stat Scale Overhaul: widen HP/damage clamps, add ac/cr to enemy state.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ensureCombat } from '../engine/state.js';
import { mintEnemyFromNpc } from '../engine/combat/combatLifecycle.js';

describe('B04 — stat scale overhaul', () => {
  it('bandit captain (65 HP, 10 damage) survives ensureCombat without clamp', () => {
    const combat = ensureCombat({
      active: true,
      round: 1,
      turnIndex: 0,
      enemies: [{
        id: 'enemy_0',
        name: 'Bandit Captain',
        hp: 65,
        maxHp: 65,
        damage: 10,
        ac: 15,
        cr: 2,
        canParley: true,
        defeated: false,
        sourceNpcId: ''
      }],
      beganAt: 0,
      reason: 'test'
    });
    const e = combat.enemies[0];
    assert.equal(e.maxHp, 65);
    assert.equal(e.hp, 65);
    assert.equal(e.damage, 10);
    assert.equal(e.ac, 15);
    assert.equal(e.cr, 2);
  });

  it('rat-tier enemy (1 HP, 1 damage) normalizes correctly', () => {
    const combat = ensureCombat({
      active: true,
      round: 1,
      turnIndex: 0,
      enemies: [{
        id: 'enemy_0',
        name: 'Rat',
        hp: 1,
        maxHp: 1,
        damage: 1,
        ac: 5,
        cr: 0,
        canParley: false,
        defeated: false,
        sourceNpcId: ''
      }],
      beganAt: 0,
      reason: 'test'
    });
    const e = combat.enemies[0];
    assert.equal(e.maxHp, 1);
    assert.equal(e.hp, 1);
    assert.equal(e.damage, 1);
    assert.equal(e.ac, 5);
    assert.equal(e.cr, 0);
  });

  it('god-tier enemy (600 HP, 50 damage, ac 25, cr 30) normalizes correctly', () => {
    const combat = ensureCombat({
      active: true,
      round: 1,
      turnIndex: 0,
      enemies: [{
        id: 'enemy_0',
        name: 'Elder God',
        hp: 600,
        maxHp: 600,
        damage: 50,
        ac: 25,
        cr: 30,
        canParley: false,
        defeated: false,
        sourceNpcId: ''
      }],
      beganAt: 0,
      reason: 'test'
    });
    const e = combat.enemies[0];
    assert.equal(e.maxHp, 600);
    assert.equal(e.hp, 600);
    assert.equal(e.damage, 50);
    assert.equal(e.ac, 25);
    assert.equal(e.cr, 30);
  });

  it('ac defaults to 10 and cr defaults to 0 when missing', () => {
    const combat = ensureCombat({
      active: true,
      round: 1,
      turnIndex: 0,
      enemies: [{
        id: 'enemy_0',
        name: 'Goblin',
        hp: 7,
        maxHp: 7,
        damage: 3,
        canParley: true,
        defeated: false,
        sourceNpcId: ''
      }],
      beganAt: 0,
      reason: 'test'
    });
    const e = combat.enemies[0];
    assert.equal(e.ac, 10);
    assert.equal(e.cr, 0);
  });

  it('negative/invalid values clamp to minimums', () => {
    const combat = ensureCombat({
      active: true,
      round: 1,
      turnIndex: 0,
      enemies: [{
        id: 'enemy_0',
        name: 'Broken',
        hp: -5,
        maxHp: -10,
        damage: -3,
        ac: -1,
        cr: -5,
        canParley: true,
        defeated: false,
        sourceNpcId: ''
      }],
      beganAt: 0,
      reason: 'test'
    });
    const e = combat.enemies[0];
    assert.equal(e.maxHp, 1, 'maxHp clamps to 1');
    assert.equal(e.hp, 0, 'hp clamps to 0 (min)');
    assert.equal(e.damage, 1, 'damage clamps to 1');
    assert.equal(e.ac, 0, 'ac clamps to 0');
    assert.equal(e.cr, 0, 'cr clamps to 0');
  });

  it('ac clamps at 30 ceiling', () => {
    const combat = ensureCombat({
      active: true,
      round: 1,
      turnIndex: 0,
      enemies: [{
        id: 'enemy_0',
        name: 'Fortress',
        hp: 100,
        maxHp: 100,
        damage: 5,
        ac: 99,
        canParley: false,
        defeated: false,
        sourceNpcId: ''
      }],
      beganAt: 0,
      reason: 'test'
    });
    assert.equal(combat.enemies[0].ac, 30);
  });

  it('mintEnemyFromNpc passes cr from bestiary', () => {
    const enemy = mintEnemyFromNpc({
      id: 'npc_1',
      name: 'Captain',
      bestiaryRef: 'bandit_captain'
    });
    assert.equal(enemy.maxHp, 65);
    assert.equal(enemy.damage, 10);
    assert.equal(enemy.ac, 15);
    assert.equal(enemy.cr, 2);
  });

  it('mintEnemyFromNpc defaults cr to 0 without bestiary', () => {
    const enemy = mintEnemyFromNpc({
      id: 'npc_2',
      name: 'Thug'
    });
    assert.equal(enemy.cr, 0);
    assert.equal(enemy.ac, 10);
  });
});
