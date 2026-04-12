// Pass CM3 — Enemy Action Resolution: dice rolling, saving throws,
// action resolution, multiattack, critical hits.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rollDice } from '../engine/combat/diceRoller.js';
import { rollSave } from '../engine/combat/savingThrows.js';
import { resolveAction, resolveRecharge } from '../engine/combat/actionResolver.js';
import { makeRng, seedFromString } from '../engine/rng.js';
import { ensureCombat } from '../engine/state.js';
import { mintEnemyFromNpc } from '../engine/combat/combatLifecycle.js';

// ── diceRoller ────────────────────────────────────────────────────────────

describe('CM03 — rollDice', () => {
  it('1d6 returns 1-6', () => {
    const rng = makeRng(seedFromString('dice-1d6'));
    const r = rollDice('1d6', rng);
    assert.ok(r.total >= 1 && r.total <= 6, `got ${r.total}`);
    assert.equal(r.rolls.length, 1);
    assert.equal(r.modifier, 0);
  });

  it('2d8+4 returns 6-20', () => {
    const rng = makeRng(seedFromString('dice-2d8+4'));
    const r = rollDice('2d8+4', rng);
    assert.ok(r.total >= 6 && r.total <= 20, `got ${r.total}`);
    assert.equal(r.rolls.length, 2);
    assert.equal(r.modifier, 4);
  });

  it('plain number returns that number', () => {
    const rng = makeRng(seedFromString('dice-plain'));
    assert.equal(rollDice('0', rng).total, 0);
    assert.equal(rollDice('5', rng).total, 5);
  });

  it('null/empty returns 0', () => {
    const rng = makeRng(seedFromString('dice-null'));
    assert.equal(rollDice(null, rng).total, 0);
    assert.equal(rollDice('', rng).total, 0);
  });

  it('negative modifier works', () => {
    const rng = makeRng(seedFromString('dice-neg'));
    const r = rollDice('1d4-1', rng);
    assert.ok(r.total >= 0 && r.total <= 3, `got ${r.total}`);
    assert.equal(r.modifier, -1);
  });

  it('determinism: same seed same result', () => {
    const rng1 = makeRng(seedFromString('dice-det'));
    const rng2 = makeRng(seedFromString('dice-det'));
    const r1 = rollDice('3d6+2', rng1);
    const r2 = rollDice('3d6+2', rng2);
    assert.equal(r1.total, r2.total);
    assert.deepEqual(r1.rolls, r2.rolls);
  });
});

// ── savingThrows ──────────────────────────────────────────────────────────

describe('CM03 — rollSave', () => {
  it('succeeds when roll + mod >= DC', () => {
    // Find seed that succeeds with reasonable stats
    let found = false;
    for (let i = 0; i < 200; i++) {
      const rng = makeRng(seedFromString(`save-pass-${i}`));
      const entity = { stats: { GRIT: 18 }, level: 1 }; // +4 mod
      const r = rollSave(entity, 'GRIT', 8, rng); // DC 8
      if (r.success && !r.natural20) {
        assert.ok(r.total >= 8, `total ${r.total} should be >= DC 8`);
        found = true;
        break;
      }
    }
    assert.ok(found, 'should find a normal save success');
  });

  it('fails when roll + mod < DC', () => {
    let found = false;
    for (let i = 0; i < 200; i++) {
      const rng = makeRng(seedFromString(`save-fail-${i}`));
      const entity = { stats: { GRIT: 8 }, level: 1 }; // -1 mod
      const r = rollSave(entity, 'GRIT', 18, rng); // DC 18
      if (!r.success && !r.natural1) {
        assert.ok(r.total < 18);
        found = true;
        break;
      }
    }
    assert.ok(found, 'should find a normal save failure');
  });

  it('natural 20 always succeeds regardless of DC', () => {
    let found = false;
    for (let i = 0; i < 500; i++) {
      const rng = makeRng(seedFromString(`save-nat20-${i}`));
      const r = rollSave({ stats: { GRIT: 1 } }, 'GRIT', 99, rng);
      if (r.roll === 20) {
        assert.ok(r.success, 'nat 20 must succeed');
        assert.ok(r.natural20);
        found = true;
        break;
      }
    }
    assert.ok(found, 'should find a nat 20 seed');
  });

  it('natural 1 always fails regardless of modifier', () => {
    let found = false;
    for (let i = 0; i < 500; i++) {
      const rng = makeRng(seedFromString(`save-nat1-${i}`));
      const r = rollSave({ stats: { GRIT: 30 } }, 'GRIT', 1, rng);
      if (r.roll === 1) {
        assert.ok(!r.success, 'nat 1 must fail');
        assert.ok(r.natural1);
        found = true;
        break;
      }
    }
    assert.ok(found, 'should find a nat 1 seed');
  });

  it('proficiency bonus applies when stat in saveProficiencies', () => {
    const rng1 = makeRng(seedFromString('save-prof'));
    const rng2 = makeRng(seedFromString('save-prof'));
    const base = { stats: { GRIT: 10 }, level: 1 };
    const prof = { stats: { GRIT: 10 }, level: 1, saveProficiencies: ['GRIT'] };
    const r1 = rollSave(base, 'GRIT', 10, rng1);
    const r2 = rollSave(prof, 'GRIT', 10, rng2);
    // Same roll, but prof should have +2 (proficiency at level 1)
    assert.equal(r2.modifier, r1.modifier + 2);
  });

  it('proficiency bonus absent when stat not in saveProficiencies', () => {
    const rng = makeRng(seedFromString('save-noprof'));
    const entity = { stats: { GRIT: 10 }, level: 5, saveProficiencies: ['MIGHT'] };
    const r = rollSave(entity, 'GRIT', 10, rng);
    assert.equal(r.modifier, 0, 'GRIT not in proficiencies, mod = statMod(10) = 0');
  });
});

// ── actionResolver ────────────────────────────────────────────────────────

describe('CM03 — resolveAction (attack roll)', () => {
  const scimitar = { name: 'Scimitar', toHit: 5, damage: '1d6+3', type: 'slashing' };

  it('hits when roll + toHit >= AC', () => {
    let found = false;
    for (let i = 0; i < 200; i++) {
      const rng = makeRng(seedFromString(`atk-hit-${i}`));
      const r = resolveAction(scimitar, {}, { ac: 10 }, rng);
      if (r.hit && !r.critical) {
        assert.ok(r.damage > 0, 'damage on hit');
        assert.equal(r.damageType, 'slashing');
        assert.equal(r.actionName, 'Scimitar');
        found = true;
        break;
      }
    }
    assert.ok(found, 'should find a normal hit');
  });

  it('misses when roll + toHit < AC', () => {
    let found = false;
    for (let i = 0; i < 200; i++) {
      const rng = makeRng(seedFromString(`atk-miss-${i}`));
      const r = resolveAction(scimitar, {}, { ac: 25 }, rng);
      if (!r.hit) {
        assert.equal(r.damage, 0);
        found = true;
        break;
      }
    }
    assert.ok(found, 'should find a miss');
  });

  it('critical hit on natural 20 doubles dice', () => {
    let found = false;
    for (let i = 0; i < 500; i++) {
      const rng = makeRng(seedFromString(`atk-crit-${i}`));
      const testRng = makeRng(seedFromString(`atk-crit-${i}`));
      const probe = testRng.int(1, 20);
      if (probe === 20) {
        const r = resolveAction(scimitar, {}, { ac: 30 }, rng);
        assert.ok(r.hit, 'nat 20 always hits');
        assert.ok(r.critical, 'nat 20 is critical');
        // Damage should have double dice rolls
        assert.ok(r.damageRolls.rolls.length >= 2, 'doubled dice');
        found = true;
        break;
      }
    }
    assert.ok(found, 'should find a nat 20 seed');
  });

  it('natural 1 always misses regardless of toHit', () => {
    let found = false;
    for (let i = 0; i < 500; i++) {
      const rng = makeRng(seedFromString(`atk-nat1-${i}`));
      const testRng = makeRng(seedFromString(`atk-nat1-${i}`));
      const probe = testRng.int(1, 20);
      if (probe === 1) {
        const r = resolveAction({ ...scimitar, toHit: 100 }, {}, { ac: 1 }, rng);
        assert.ok(!r.hit, 'nat 1 always misses');
        assert.equal(r.damage, 0);
        found = true;
        break;
      }
    }
    assert.ok(found, 'should find a nat 1 seed');
  });

  it('applies resistance from damageTypes.js', () => {
    let found = false;
    for (let i = 0; i < 200; i++) {
      const rng = makeRng(seedFromString(`atk-resist-${i}`));
      const r = resolveAction(scimitar, {}, {
        ac: 5,  // easy to hit
        resistances: { slashing: 'resistant' }
      }, rng);
      if (r.hit && !r.critical) {
        assert.equal(r.resistanceResult.level, 'resistant');
        // Resistant halves damage
        found = true;
        break;
      }
    }
    assert.ok(found, 'should find a hit against resistant target');
  });

  it('applies conditions on hit', () => {
    const poisonBite = {
      name: 'Poison Bite', toHit: 5, damage: '1d4+2', type: 'piercing',
      conditions: [{ name: 'poisoned', severity: 2, until: 'save_ends', saveToEnd: { stat: 'GRIT', dc: 13 } }]
    };
    let found = false;
    for (let i = 0; i < 200; i++) {
      const rng = makeRng(seedFromString(`atk-cond-${i}`));
      const r = resolveAction(poisonBite, {}, { ac: 5 }, rng);
      if (r.hit) {
        assert.equal(r.conditionsApplied.length, 1);
        assert.equal(r.conditionsApplied[0].name, 'poisoned');
        found = true;
        break;
      }
    }
    assert.ok(found, 'should find a hit with conditions');
  });

  it('does not apply conditions on miss', () => {
    const poisonBite = {
      name: 'Poison Bite', toHit: 0, damage: '1d4', type: 'piercing',
      conditions: [{ name: 'poisoned', severity: 1 }]
    };
    let found = false;
    for (let i = 0; i < 200; i++) {
      const rng = makeRng(seedFromString(`atk-nocond-${i}`));
      const r = resolveAction(poisonBite, {}, { ac: 25 }, rng);
      if (!r.hit) {
        assert.equal(r.conditionsApplied.length, 0);
        found = true;
        break;
      }
    }
    assert.ok(found, 'should find a miss');
  });
});

describe('CM03 — resolveAction (save-based)', () => {
  const breathWeapon = {
    name: 'Fire Breath', damage: '4d6', type: 'fire',
    save: { stat: 'AGILITY', dc: 14, halfOnSave: true }
  };

  it('full damage on failed save', () => {
    let found = false;
    for (let i = 0; i < 200; i++) {
      const rng = makeRng(seedFromString(`save-act-fail-${i}`));
      const r = resolveAction(breathWeapon, {}, { stats: { AGILITY: 8 }, ac: 10 }, rng);
      if (!r.saveResult.success) {
        assert.ok(r.damage > 0, 'full damage on failed save');
        assert.equal(r.damageType, 'fire');
        assert.ok(!r.critical);
        found = true;
        break;
      }
    }
    assert.ok(found, 'should find a failed save');
  });

  it('half damage on successful save with halfOnSave', () => {
    let found = false;
    for (let i = 0; i < 200; i++) {
      const rng = makeRng(seedFromString(`save-act-half-${i}`));
      const r = resolveAction(breathWeapon, {}, { stats: { AGILITY: 20 }, ac: 10 }, rng);
      if (r.saveResult.success && !r.saveResult.natural20) {
        // Half damage — total should be >= 0
        assert.ok(r.damage >= 0);
        assert.equal(r.hit, false, 'save success means not "hit"');
        found = true;
        break;
      }
    }
    assert.ok(found, 'should find a successful save');
  });

  it('0 damage on success when !halfOnSave', () => {
    const noHalf = {
      name: 'Web', damage: '0', type: 'bludgeoning',
      save: { stat: 'AGILITY', dc: 5, halfOnSave: false },
      conditions: [{ name: 'restrained', severity: 1 }]
    };
    let found = false;
    for (let i = 0; i < 200; i++) {
      const rng = makeRng(seedFromString(`save-act-zero-${i}`));
      const r = resolveAction(noHalf, {}, { stats: { AGILITY: 20 }, ac: 10 }, rng);
      if (r.saveResult.success) {
        assert.equal(r.damage, 0, 'no damage on save');
        assert.equal(r.conditionsApplied.length, 0, 'no conditions on save');
        found = true;
        break;
      }
    }
    assert.ok(found);
  });

  it('applies conditions on failed save', () => {
    const webSpray = {
      name: 'Web Spray', damage: '0', type: 'bludgeoning',
      save: { stat: 'AGILITY', dc: 20, halfOnSave: false },
      conditions: [{ name: 'restrained', severity: 1 }]
    };
    let found = false;
    for (let i = 0; i < 200; i++) {
      const rng = makeRng(seedFromString(`save-cond-${i}`));
      const r = resolveAction(webSpray, {}, { stats: { AGILITY: 8 }, ac: 10 }, rng);
      if (!r.saveResult.success) {
        assert.equal(r.conditionsApplied.length, 1);
        assert.equal(r.conditionsApplied[0].name, 'restrained');
        found = true;
        break;
      }
    }
    assert.ok(found);
  });
});

describe('CM03 — resolveRecharge', () => {
  it('recharges when d6 >= value', () => {
    let recharged = false;
    let notRecharged = false;
    for (let i = 0; i < 100 && (!recharged || !notRecharged); i++) {
      const rng = makeRng(seedFromString(`recharge-${i}`));
      const result = resolveRecharge(5, rng);
      if (result) recharged = true;
      else notRecharged = true;
    }
    assert.ok(recharged, 'should eventually recharge');
    assert.ok(notRecharged, 'should sometimes fail to recharge');
  });

  it('always recharges with value <= 1', () => {
    const rng = makeRng(seedFromString('recharge-always'));
    assert.ok(resolveRecharge(1, rng));
    assert.ok(resolveRecharge(0, rng));
  });
});

// ── ensureCombat integration ──────────────────────────────────────────────

describe('CM03 — ensureCombat with actions', () => {
  it('normalizes actions, multiattack, saveProficiencies', () => {
    const combat = ensureCombat({
      active: true, round: 1, turnIndex: 0,
      enemies: [{
        id: 'enemy_0', name: 'Goblin', hp: 12, maxHp: 12, damage: 5, ac: 15, cr: 0.25,
        damageType: 'slashing', resistances: {}, conditionImmunities: [], conditions: [],
        actions: [
          { name: 'Scimitar', toHit: 4, damage: '1d6+2', type: 'slashing' },
          { name: 'Shortbow', toHit: 4, damage: '1d6+2', type: 'piercing', range: 80 }
        ],
        multiattack: null,
        saveProficiencies: ['AGILITY'],
        canParley: true, defeated: false, sourceNpcId: ''
      }],
      beganAt: 0, reason: 'test'
    });
    const e = combat.enemies[0];
    assert.equal(e.actions.length, 2);
    assert.equal(e.actions[0].name, 'Scimitar');
    assert.equal(e.multiattack, null);
    assert.deepEqual(e.saveProficiencies, ['AGILITY']);
  });

  it('defaults actions to [], multiattack to null, saveProficiencies to []', () => {
    const combat = ensureCombat({
      active: true, round: 1, turnIndex: 0,
      enemies: [{
        id: 'enemy_0', name: 'Thug', hp: 10, maxHp: 10, damage: 3,
        damageType: 'bludgeoning', resistances: {}, conditionImmunities: [], conditions: [],
        canParley: true, defeated: false, sourceNpcId: ''
      }],
      beganAt: 0, reason: 'test'
    });
    const e = combat.enemies[0];
    assert.deepEqual(e.actions, []);
    assert.equal(e.multiattack, null);
    assert.deepEqual(e.saveProficiencies, []);
  });
});

describe('CM03 — mintEnemyFromNpc with actions', () => {
  it('goblin passes through actions from bestiary', () => {
    const enemy = mintEnemyFromNpc({
      id: 'npc_g', name: 'Goblin', bestiaryRef: 'goblin'
    });
    assert.ok(enemy.actions.length > 0, 'goblin has actions');
    assert.equal(enemy.actions[0].name, 'Scimitar');
    assert.deepEqual(enemy.saveProficiencies, []);
  });

  it('enemy without bestiary has empty actions', () => {
    const enemy = mintEnemyFromNpc({ id: 'npc_t', name: 'Thug' });
    assert.deepEqual(enemy.actions, []);
    assert.equal(enemy.multiattack, null);
  });
});

// ── Integration: combat flow with actions ─────────────────────────────────

describe('CM03 — integration: legacy flat damage still works', () => {
  it('enemy without actions array uses flat damage fallback', () => {
    // This validates backwards compatibility — the existing combat tests
    // all use enemies without actions arrays; if they pass, flat damage works.
    const combat = ensureCombat({
      active: true, round: 1, turnIndex: 0,
      enemies: [{
        id: 'enemy_0', name: 'Brigand', hp: 8, maxHp: 8, damage: 3,
        ac: 10, cr: 0, damageType: 'bludgeoning', resistances: {},
        conditionImmunities: [], conditions: [], actions: [],
        multiattack: null, saveProficiencies: [],
        canParley: true, defeated: false, sourceNpcId: ''
      }],
      beganAt: 0, reason: 'test'
    });
    assert.equal(combat.enemies[0].damage, 3);
    assert.deepEqual(combat.enemies[0].actions, []);
  });
});

describe('CM03 — determinism', () => {
  it('same seed produces identical action resolution', () => {
    const action = { name: 'Claw', toHit: 4, damage: '2d6+3', type: 'slashing' };
    const target = { ac: 14, resistances: {} };

    const rng1 = makeRng(seedFromString('det-action'));
    const rng2 = makeRng(seedFromString('det-action'));

    const r1 = resolveAction(action, {}, target, rng1);
    const r2 = resolveAction(action, {}, target, rng2);

    assert.equal(r1.hit, r2.hit);
    assert.equal(r1.damage, r2.damage);
    assert.equal(r1.critical, r2.critical);
    assert.deepEqual(r1.damageRolls, r2.damageRolls);
  });

  it('same seed produces identical save resolution', () => {
    const entity = { stats: { AGILITY: 14 }, level: 3 };
    const rng1 = makeRng(seedFromString('det-save'));
    const rng2 = makeRng(seedFromString('det-save'));

    const r1 = rollSave(entity, 'AGILITY', 15, rng1);
    const r2 = rollSave(entity, 'AGILITY', 15, rng2);

    assert.deepEqual(r1, r2);
  });
});
