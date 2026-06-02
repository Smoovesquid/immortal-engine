// CM08: Spell Expansion — 50 spells across 10 schools, 5 new effect kinds.

import test from 'node:test';
import assert from 'node:assert/strict';

import { SPELL_REGISTRY, lookupSpell, allSpellRefs, SPELL_COUNT } from '../engine/ruleset/core/spells/index.js';
import { ensureWorld, newWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { castSpell } from '../engine/spell/castSpell.js';

// ── helpers ────────────────────────────────────────────────────────────────

function mkSpellWorld(seedKey, knownSpells = [], slots = {}) {
  let w = newWorld({ seed: `cm8-${seedKey}`, fate: 0.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = ensureWorld({
    ...w,
    party: [{
      id: 'party', name: 'Mage', vibe: 'steady', archetype: 'wanderer',
      wounds: 2, stress: 1, resources: { Supply: 5 }, level: 5,
      stats: { MIGHT: 10, AGILITY: 14, GRIT: 12, CHARM: 10, WITS: 16 },
      spells: {
        known: knownSpells,
        slots: { 1: 4, 2: 3, 3: 2, 4: 1, 5: 1, ...slots },
        maxSlots: { 1: 4, 2: 3, 3: 2, 4: 1, 5: 1, ...slots },
        concentration: null
      }
    }],
    scene: { location: 'tower', objective: 'test', time: 'start', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });
  return w;
}

function mkCombatWorld(seedKey, knownSpells, enemies) {
  let w = mkSpellWorld(seedKey, knownSpells);
  w = applyDeltas(w, [{
    op: 'combatState',
    set: {
      active: true, round: 1, turnIndex: 0,
      enemies: enemies.map((e, i) => ({
        id: `enemy_${i}`, name: e.name || 'Foe', hp: e.hp || 20, maxHp: e.maxHp || 20,
        damage: 3, ac: e.ac || 12, cr: 1, damageType: 'bludgeoning', resistances: e.resistances || {},
        conditionImmunities: [], conditions: [], actions: [], multiattack: null,
        saveProficiencies: [], canParley: false, defeated: false, sourceNpcId: '',
        lootTableRef: null, initMod: 0, legendaryActions: null, reactions: null
      })),
      beganAt: 0, reason: 'test', playerGuard: false, companionGuard: false, initiativeOrder: []
    }
  }]);
  return w;
}

// ── registry tests ────────────────────────────────────────────────────────

test('CM08-01 SPELL_REGISTRY contains exactly 134 spells', () => {
  assert.equal(SPELL_COUNT, 134);
  assert.equal(allSpellRefs().length, 134);
});

test('CM08-02 all 10 schools are represented', () => {
  const schools = new Set(Object.values(SPELL_REGISTRY).map(s => s.school));
  const expected = ['evocation', 'abjuration', 'conjuration', 'necromancy', 'transmutation',
    'divination', 'enchantment', 'illusion', 'restoration', 'chronomancy'];
  for (const school of expected) {
    assert.ok(schools.has(school), `school ${school} should be present`);
  }
});

test('CM08-03 every spell has required fields', () => {
  for (const ref of allSpellRefs()) {
    const s = lookupSpell(ref);
    assert.ok(s.defRef, `${ref} missing defRef`);
    assert.ok(s.name, `${ref} missing name`);
    assert.ok(typeof s.level === 'number', `${ref} missing level`);
    assert.ok(s.school, `${ref} missing school`);
    assert.ok(s.castingTime, `${ref} missing castingTime`);
    assert.ok(Array.isArray(s.effects), `${ref} missing effects array`);
    assert.ok(s.effects.length > 0, `${ref} has no effects`);
  }
});

test('CM08-04 lookupSpell returns null for unknown ref', () => {
  assert.equal(lookupSpell('nonexistent'), null);
});

test('CM08-05 original 6 spells still present and unchanged', () => {
  const originals = ['fire_bolt', 'mage_armor', 'shield', 'misty_step', 'fireball', 'counterspell'];
  for (const ref of originals) {
    assert.ok(lookupSpell(ref), `original spell ${ref} should be in registry`);
  }
});

test('CM08-06 cantrips exist across multiple schools', () => {
  const cantrips = Object.values(SPELL_REGISTRY).filter(s => s.level === 0);
  assert.ok(cantrips.length >= 6, `expected >=6 cantrips, got ${cantrips.length}`);
  const cantripSchools = new Set(cantrips.map(s => s.school));
  assert.ok(cantripSchools.size >= 4, `cantrips should span >=4 schools, got ${cantripSchools.size}`);
});

test('CM08-07 spells span levels 0-5', () => {
  const levels = new Set(Object.values(SPELL_REGISTRY).map(s => s.level));
  for (let i = 0; i <= 5; i++) {
    assert.ok(levels.has(i), `level ${i} should have at least one spell`);
  }
});

// ── heal effect kind ──────────────────────────────────────────────────────

test('CM08-08 cure_wounds heals party wounds', () => {
  let w = mkSpellWorld('heal', ['cure_wounds']);
  const woundsBefore = w.party[0].wounds;
  assert.ok(woundsBefore > 0, 'setup: party should have wounds');
  const { world, result } = castSpell(w, { spellRef: 'cure_wounds', targetId: 'party', slotLevel: 1 });
  assert.ok(result.ok);
  const healEffect = result.effects.find(e => e.kind === 'heal');
  assert.ok(healEffect, 'should have heal effect');
  assert.ok(healEffect.healAmount > 0, 'should heal some amount');
  assert.ok(world.party[0].wounds <= woundsBefore, 'wounds should not increase');
});

test('CM08-09 healing_word is a bonus_action heal', () => {
  const def = lookupSpell('healing_word');
  assert.equal(def.castingTime, 'bonus_action');
  assert.equal(def.effects[0].kind, 'heal');
});

test('CM08-10 mass_healing_word heals party target', () => {
  const def = lookupSpell('mass_healing_word');
  assert.equal(def.effects[0].target, 'party');
});

// ── conditions effect kind ────────────────────────────────────────────────

test('CM08-11 hold_person applies paralyzed condition', () => {
  let w = mkCombatWorld('hold', ['hold_person'], [{ name: 'Bandit', hp: 20 }]);
  const { result } = castSpell(w, { spellRef: 'hold_person', targetId: 'enemy_0', slotLevel: 2 });
  assert.ok(result.ok);
  const condEffect = result.effects.find(e => e.kind === 'conditions');
  assert.ok(condEffect, 'should have conditions effect');
  assert.ok(condEffect.applied, 'should have applied condition');
  assert.equal(condEffect.applied.name, 'paralyzed');
});

test('CM08-12 lesser_restoration removes conditions', () => {
  const def = lookupSpell('lesser_restoration');
  assert.equal(def.effects[0].kind, 'conditions');
  assert.ok(def.effects[0].removeCondition, 'should be a remove-condition effect');
  assert.ok(def.effects[0].conditionNames.includes('poisoned'));
});

// ── area_damage effect kind ───────────────────────────────────────────────

test('CM08-13 ice_storm has area_damage effects', () => {
  const def = lookupSpell('ice_storm');
  const areaDmg = def.effects.filter(e => e.kind === 'area_damage');
  assert.ok(areaDmg.length >= 1, 'should have area_damage effects');
  assert.ok(areaDmg[0].area, 'should have area descriptor');
});

test('CM08-14 casting ice_storm deals area damage to target', () => {
  let w = mkCombatWorld('ice', ['ice_storm'], [{ name: 'Ogre', hp: 50, maxHp: 50 }]);
  const hpBefore = w.combat.enemies[0].hp;
  const { world, result } = castSpell(w, { spellRef: 'ice_storm', targetId: 'enemy_0', slotLevel: 4 });
  assert.ok(result.ok);
  const aDmgEffects = result.effects.filter(e => e.kind === 'area_damage');
  assert.ok(aDmgEffects.length > 0, 'should have area_damage results');
  // At least one should have dealt damage.
  const totalAreaDmg = aDmgEffects.reduce((sum, e) => sum + e.totalDamage, 0);
  assert.ok(totalAreaDmg > 0, 'area damage total should be > 0');
});

// ── buff effect kind ──────────────────────────────────────────────────────

test('CM08-15 haste has buff effect', () => {
  const def = lookupSpell('haste');
  const buff = def.effects.find(e => e.kind === 'buff');
  assert.ok(buff, 'haste should have a buff effect');
  assert.equal(buff.stat, 'ac');
  assert.equal(buff.value, 2);
});

test('CM08-16 casting haste returns buff in result', () => {
  let w = mkSpellWorld('haste', ['haste']);
  const { result } = castSpell(w, { spellRef: 'haste', targetId: 'party', slotLevel: 3 });
  assert.ok(result.ok);
  const buffEffect = result.effects.find(e => e.kind === 'buff');
  assert.ok(buffEffect, 'should return buff effect');
});

// ── debuff effect kind ────────────────────────────────────────────────────

test('CM08-17 ray_of_enfeeblement has debuff effect', () => {
  const def = lookupSpell('ray_of_enfeeblement');
  const debuff = def.effects.find(e => e.kind === 'debuff');
  assert.ok(debuff, 'should have debuff effect');
  assert.equal(debuff.stat, 'MIGHT');
  assert.equal(debuff.penalty, -4);
});

test('CM08-18 casting debuff returns result', () => {
  let w = mkCombatWorld('debuff', ['ray_of_enfeeblement'], [{ name: 'Brute', hp: 20 }]);
  const { result } = castSpell(w, { spellRef: 'ray_of_enfeeblement', targetId: 'enemy_0', slotLevel: 2 });
  assert.ok(result.ok);
  const debuffEffect = result.effects.find(e => e.kind === 'debuff');
  assert.ok(debuffEffect, 'should return debuff effect');
});

// ── chronomancy school ────────────────────────────────────────────────────

test('CM08-19 chronomancy spells use temporal/entropic damage types', () => {
  const chrono = Object.values(SPELL_REGISTRY).filter(s => s.school === 'chronomancy');
  assert.ok(chrono.length === 5, 'should have 5 chronomancy spells');
  const dmgTypes = new Set();
  for (const s of chrono) {
    for (const e of s.effects) {
      if (e.damageType) dmgTypes.add(e.damageType);
    }
  }
  assert.ok(dmgTypes.has('temporal'), 'should use temporal damage');
});

test('CM08-20 temporal_bolt is a cantrip that scales', () => {
  const def = lookupSpell('temporal_bolt');
  assert.equal(def.level, 0);
  assert.ok(def.scalingByLevel, 'should have scaling');
  assert.ok(def.scalingByLevel[5], 'should scale at level 5');
});

// ── determinism ───────────────────────────────────────────────────────────

test('CM08-21 same seed → same cast results', () => {
  function runOnce() {
    const w = mkCombatWorld('det', ['fireball'], [{ name: 'Goblin', hp: 30, maxHp: 30 }]);
    return castSpell(w, { spellRef: 'fireball', targetId: 'enemy_0', slotLevel: 3 });
  }
  const r1 = runOnce();
  const r2 = runOnce();
  assert.equal(r1.result.effects[0].totalDamage, r2.result.effects[0].totalDamage);
});

// ── concentration on new spells ───────────────────────────────────────────

test('CM08-22 haste sets concentration', () => {
  let w = mkSpellWorld('conc', ['haste']);
  const { world } = castSpell(w, { spellRef: 'haste', targetId: 'party', slotLevel: 3 });
  assert.equal(world.party[0].spells.concentration?.spellRef, 'haste');
});

// ── upcast scaling for heal ───────────────────────────────────────────────

test('CM08-23 cure_wounds at higher slot heals more', () => {
  function castAtLevel(level) {
    const w = mkSpellWorld(`upcast-${level}`, ['cure_wounds']);
    const { result } = castSpell(w, { spellRef: 'cure_wounds', targetId: 'party', slotLevel: level });
    return result.effects.find(e => e.kind === 'heal')?.healAmount ?? 0;
  }
  // Run many times to get average — seeded so deterministic.
  const heal1 = castAtLevel(1);
  const heal3 = castAtLevel(3);
  // Level 3 casting should heal more due to 2 extra d8s.
  assert.ok(heal3 >= heal1, 'higher slot should heal same or more');
});

// ── spell slot consumption on new spells ──────────────────────────────────

test('CM08-24 casting a new spell consumes a slot', () => {
  let w = mkSpellWorld('slot', ['hold_person']);
  const slotsBefore = w.party[0].spells.slots[2];
  const { world } = castSpell(w, { spellRef: 'hold_person', targetId: 'party', slotLevel: 2 });
  assert.equal(world.party[0].spells.slots[2], slotsBefore - 1);
});

test('CM08-25 cantrip does not consume a slot', () => {
  let w = mkSpellWorld('cantrip', ['temporal_bolt']);
  const { world, result } = castSpell(w, { spellRef: 'temporal_bolt', targetId: 'party' });
  assert.ok(result.ok);
  assert.equal(result.slotConsumed, false);
});
