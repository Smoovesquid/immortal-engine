// Pass CM2 — Condition Framework.

import { describe, it, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCondition,
  tickConditions,
  removeCondition,
  removeAllConditions,
  hasCondition,
  getCondition,
  normalizeCondition
} from '../engine/combat/conditions.js';
import { getConditionModifiers } from '../engine/combat/conditionEffects.js';
import { makeRng, seedFromString } from '../engine/rng.js';
import { ensureCombat } from '../engine/state.js';

// ── normalizeCondition ────────────────────────────────────────────────────

describe('CM02 — normalizeCondition', () => {
  it('sets defaults and clamps severity', () => {
    const c = normalizeCondition({ name: 'poisoned' });
    assert.equal(c.name, 'poisoned');
    assert.equal(c.until, 'save_ends');
    assert.equal(c.source, '');
    assert.equal(c.severity, 1);
    assert.equal(c.saveToEnd, null);
    assert.equal(c.onTick, null);
    assert.equal(c.stackBehavior, 'replace');
  });

  it('clamps severity to 1-10', () => {
    assert.equal(normalizeCondition({ name: 'a', severity: 0 }).severity, 1);
    assert.equal(normalizeCondition({ name: 'a', severity: 15 }).severity, 10);
    assert.equal(normalizeCondition({ name: 'a', severity: 5 }).severity, 5);
  });

  it('returns null for missing name', () => {
    assert.equal(normalizeCondition({}), null);
    assert.equal(normalizeCondition({ name: '' }), null);
    assert.equal(normalizeCondition(null), null);
  });

  it('normalizes saveToEnd', () => {
    const c = normalizeCondition({ name: 'poisoned', saveToEnd: { stat: 'GRIT', dc: 14 } });
    assert.deepEqual(c.saveToEnd, { stat: 'GRIT', dc: 14 });
  });

  it('accepts valid stackBehaviors', () => {
    assert.equal(normalizeCondition({ name: 'a', stackBehavior: 'stack' }).stackBehavior, 'stack');
    assert.equal(normalizeCondition({ name: 'a', stackBehavior: 'extend' }).stackBehavior, 'extend');
    assert.equal(normalizeCondition({ name: 'a', stackBehavior: 'highest' }).stackBehavior, 'highest');
    assert.equal(normalizeCondition({ name: 'a', stackBehavior: 'invalid' }).stackBehavior, 'replace');
  });
});

// ── applyCondition ────────────────────────────────────────────────────────

describe('CM02 — applyCondition', () => {
  const base = { name: 'poisoned', until: 'save_ends', source: 'spider', severity: 2,
    saveToEnd: { stat: 'GRIT', dc: 12 }, onTick: 'poison', stackBehavior: 'replace' };

  it('basic apply adds to array', () => {
    const result = applyCondition([], base, []);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'poisoned');
  });

  it('immunity blocks application', () => {
    const result = applyCondition([], base, ['poisoned']);
    assert.equal(result.length, 0);
  });

  it('replace removes old, adds new', () => {
    const existing = [normalizeCondition({ name: 'poisoned', severity: 1, stackBehavior: 'replace' })];
    const newer = { name: 'poisoned', severity: 3, stackBehavior: 'replace' };
    const result = applyCondition(existing, newer, []);
    assert.equal(result.length, 1);
    assert.equal(result[0].severity, 3);
  });

  it('stack adds severities', () => {
    const existing = [normalizeCondition({ name: 'poisoned', severity: 2, stackBehavior: 'stack' })];
    const newer = { name: 'poisoned', severity: 3, stackBehavior: 'stack' };
    const result = applyCondition(existing, newer, []);
    assert.equal(result.length, 1);
    assert.equal(result[0].severity, 5);
  });

  it('extend takes longer duration', () => {
    const existing = [normalizeCondition({ name: 'burning', until: 3, stackBehavior: 'extend' })];
    const newer = { name: 'burning', until: 7, stackBehavior: 'extend' };
    const result = applyCondition(existing, newer, []);
    assert.equal(result.length, 1);
    assert.equal(result[0].until, 7);
  });

  it('highest keeps higher severity', () => {
    const existing = [normalizeCondition({ name: 'poisoned', severity: 5, stackBehavior: 'highest' })];
    const lower = { name: 'poisoned', severity: 2, stackBehavior: 'highest' };
    const result = applyCondition(existing, lower, []);
    assert.equal(result[0].severity, 5, 'keeps existing higher severity');

    const higher = { name: 'poisoned', severity: 8, stackBehavior: 'highest' };
    const result2 = applyCondition(existing, higher, []);
    assert.equal(result2[0].severity, 8, 'replaces with higher severity');
  });

  it('cap at 12', () => {
    const full = Array.from({ length: 12 }, (_, i) =>
      normalizeCondition({ name: `cond_${i}` })
    );
    const result = applyCondition(full, { name: 'extra' }, []);
    assert.equal(result.length, 12, 'does not exceed cap');
  });
});

// ── tickConditions ────────────────────────────────────────────────────────

describe('CM02 — tickConditions', () => {
  it('onTick deals damage of correct type and severity', () => {
    const conds = [normalizeCondition({
      name: 'poisoned', severity: 3, onTick: 'poison', until: 'save_ends',
      saveToEnd: { stat: 'GRIT', dc: 99 } // DC 99 so it won't save
    })];
    const entity = { stats: { GRIT: 10 } };
    const rng = makeRng(seedFromString('tick-test'));
    const { tickResults } = tickConditions(conds, entity, 1, rng);
    assert.equal(tickResults[0].damage, 3);
    assert.equal(tickResults[0].damageType, 'poison');
  });

  it('save-to-end rolls save, removes on success', () => {
    // Use a seed that will produce a high roll
    // We'll try multiple seeds until we find one that passes
    let saved = false;
    for (let i = 0; i < 100; i++) {
      const conds = [normalizeCondition({
        name: 'poisoned', severity: 1, until: 'save_ends',
        saveToEnd: { stat: 'GRIT', dc: 5 } // Low DC = easy save
      })];
      const entity = { stats: { GRIT: 18 } }; // +4 mod, DC 5, should pass easily
      const rng = makeRng(seedFromString(`save-test-${i}`));
      const { conditions, tickResults } = tickConditions(conds, entity, 1, rng);
      if (tickResults[0].saved) {
        assert.equal(conditions.length, 0, 'condition removed on save');
        saved = true;
        break;
      }
    }
    assert.ok(saved, 'should eventually save with +4 mod vs DC 5');
  });

  it('natural 20 always saves', () => {
    // Natural 20 always succeeds regardless of DC
    // Find a seed that rolls 20
    let found = false;
    for (let i = 0; i < 500; i++) {
      const rng = makeRng(seedFromString(`nat20-${i}`));
      const roll = rng.int(1, 20);
      if (roll === 20) {
        // Re-create rng for actual test
        const testRng = makeRng(seedFromString(`nat20-${i}`));
        const conds = [normalizeCondition({
          name: 'cursed', severity: 1, until: 'save_ends',
          saveToEnd: { stat: 'GRIT', dc: 99 } // impossible DC
        })];
        const entity = { stats: { GRIT: 1 } }; // -5 mod
        const { conditions, tickResults } = tickConditions(conds, entity, 1, testRng);
        assert.ok(tickResults[0].saved, 'nat 20 always saves');
        assert.equal(conditions.length, 0);
        found = true;
        break;
      }
    }
    assert.ok(found, 'should find a nat-20 seed within 500 tries');
  });

  it('expired conditions removed', () => {
    const conds = [normalizeCondition({ name: 'stunned', until: 3 })];
    const { conditions } = tickConditions(conds, {}, 5, null);
    assert.equal(conditions.length, 0, 'expired at turn 5 when until=3');
  });

  it('end_of_next_turn converts to turn number on first tick', () => {
    const conds = [normalizeCondition({ name: 'frightened', until: 'end_of_next_turn' })];
    const { conditions } = tickConditions(conds, {}, 2, null);
    assert.equal(conditions.length, 1, 'still active on first tick');
    assert.equal(conditions[0].until, 3, 'converted to turn 3');

    // Second tick at turn 3 should remove it
    const { conditions: c2 } = tickConditions(conditions, {}, 3, null);
    assert.equal(c2.length, 0, 'removed after expiring');
  });

  it('permanent conditions are never removed by tick', () => {
    const conds = [normalizeCondition({ name: 'cursed', until: 'permanent' })];
    const { conditions } = tickConditions(conds, {}, 100, null);
    assert.equal(conditions.length, 1);
  });
});

// ── removeCondition / hasCondition / getCondition ─────────────────────────

describe('CM02 — remove/has/get', () => {
  const conds = [
    normalizeCondition({ name: 'poisoned', severity: 2 }),
    normalizeCondition({ name: 'burning', severity: 1 }),
    normalizeCondition({ name: 'poisoned', severity: 3 })
  ];

  it('removeCondition removes first match only', () => {
    const result = removeCondition(conds, 'poisoned');
    assert.equal(result.length, 2);
    assert.equal(result[0].name, 'burning');
    assert.equal(result[1].name, 'poisoned');
    assert.equal(result[1].severity, 3);
  });

  it('removeAllConditions removes all matches', () => {
    const result = removeAllConditions(conds, 'poisoned');
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'burning');
  });

  it('hasCondition returns correct boolean', () => {
    assert.ok(hasCondition(conds, 'poisoned'));
    assert.ok(hasCondition(conds, 'burning'));
    assert.ok(!hasCondition(conds, 'stunned'));
  });

  it('getCondition returns first match or null', () => {
    const p = getCondition(conds, 'poisoned');
    assert.equal(p.severity, 2, 'first match');
    assert.equal(getCondition(conds, 'stunned'), null);
  });
});

// ── getConditionModifiers ─────────────────────────────────────────────────

describe('CM02 — getConditionModifiers', () => {
  it('poisoned adds +2 DC', () => {
    const mods = getConditionModifiers([normalizeCondition({ name: 'poisoned' })]);
    assert.equal(mods.dcModifier, 2);
  });

  it('stunned sets skipTurn and acModifier', () => {
    const mods = getConditionModifiers([normalizeCondition({ name: 'stunned' })]);
    assert.equal(mods.skipTurn, true);
    assert.equal(mods.acModifier, -3);
  });

  it('paralyzed sets skipTurn, autoHit, meleeCrit', () => {
    const mods = getConditionModifiers([normalizeCondition({ name: 'paralyzed' })]);
    assert.equal(mods.skipTurn, true);
    assert.equal(mods.autoHit, true);
    assert.equal(mods.meleeCrit, true);
  });

  it('multiple conditions stack modifiers', () => {
    const conds = [
      normalizeCondition({ name: 'poisoned' }),
      normalizeCondition({ name: 'frightened' }),
      normalizeCondition({ name: 'restrained' })
    ];
    const mods = getConditionModifiers(conds);
    assert.equal(mods.dcModifier, 6, '2+2+2');
    assert.equal(mods.acModifier, -2, 'restrained');
  });

  it('hasted gives extra action and +2 AC', () => {
    const mods = getConditionModifiers([normalizeCondition({ name: 'hasted' })]);
    assert.equal(mods.extraAction, true);
    assert.equal(mods.acModifier, 2);
  });

  it('invisible gives -3 DC and +5 attacks against DC', () => {
    const mods = getConditionModifiers([normalizeCondition({ name: 'invisible' })]);
    assert.equal(mods.dcModifier, -3);
    assert.equal(mods.attacksAgainstDC, 5);
  });

  it('despair blocks heart', () => {
    const mods = getConditionModifiers([normalizeCondition({ name: 'despair' })]);
    assert.equal(mods.cantUseHeart, true);
  });

  it('slowed blocks zone advance', () => {
    const mods = getConditionModifiers([normalizeCondition({ name: 'slowed' })]);
    assert.equal(mods.cantAdvanceZone, true);
    assert.equal(mods.dcModifier, 1);
  });

  it('empty conditions returns zero modifiers', () => {
    const mods = getConditionModifiers([]);
    assert.equal(mods.dcModifier, 0);
    assert.equal(mods.acModifier, 0);
    assert.equal(mods.skipTurn, false);
  });
});

// ── ensureCombat integration ──────────────────────────────────────────────

describe('CM02 — ensureCombat with conditions', () => {
  it('normalizes conditions on enemies', () => {
    const combat = ensureCombat({
      active: true, round: 1, turnIndex: 0,
      enemies: [{
        id: 'enemy_0', name: 'Goblin', hp: 7, maxHp: 7, damage: 3,
        damageType: 'slashing', resistances: {}, conditionImmunities: [],
        conditions: [{ name: 'poisoned', severity: 2, onTick: 'poison' }],
        canParley: true, defeated: false, sourceNpcId: ''
      }],
      beganAt: 0, reason: 'test'
    });
    const e = combat.enemies[0];
    assert.equal(e.conditions.length, 1);
    assert.equal(e.conditions[0].name, 'poisoned');
    assert.equal(e.conditions[0].severity, 2);
    assert.equal(e.conditions[0].stackBehavior, 'replace');
  });

  it('defaults conditions to empty array', () => {
    const combat = ensureCombat({
      active: true, round: 1, turnIndex: 0,
      enemies: [{
        id: 'enemy_0', name: 'Thug', hp: 10, maxHp: 10, damage: 3,
        damageType: 'bludgeoning', resistances: {}, conditionImmunities: [],
        canParley: true, defeated: false, sourceNpcId: ''
      }],
      beganAt: 0, reason: 'test'
    });
    assert.deepEqual(combat.enemies[0].conditions, []);
  });

  it('strips invalid conditions', () => {
    const combat = ensureCombat({
      active: true, round: 1, turnIndex: 0,
      enemies: [{
        id: 'enemy_0', name: 'Bug', hp: 5, maxHp: 5, damage: 1,
        damageType: 'bludgeoning', resistances: {}, conditionImmunities: [],
        conditions: [{ name: '' }, null, { name: 'valid' }],
        canParley: false, defeated: false, sourceNpcId: ''
      }],
      beganAt: 0, reason: 'test'
    });
    assert.equal(combat.enemies[0].conditions.length, 1);
    assert.equal(combat.enemies[0].conditions[0].name, 'valid');
  });
});

// ── Determinism ───────────────────────────────────────────────────────────

describe('CM02 — determinism', () => {
  it('same seed produces same save results', () => {
    const conds = [normalizeCondition({
      name: 'poisoned', severity: 2, until: 'save_ends',
      saveToEnd: { stat: 'GRIT', dc: 12 }, onTick: 'poison'
    })];
    const entity = { stats: { GRIT: 14 } };

    const rng1 = makeRng(seedFromString('det-test'));
    const r1 = tickConditions(conds, entity, 1, rng1);

    const rng2 = makeRng(seedFromString('det-test'));
    const r2 = tickConditions(conds, entity, 1, rng2);

    assert.deepEqual(r1.tickResults, r2.tickResults);
    assert.equal(r1.conditions.length, r2.conditions.length);
  });
});
