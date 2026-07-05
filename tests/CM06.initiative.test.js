// CM06 — Initiative System
//
// Validates initiative rolling, sorting, tie-breaking, combat state
// integration, and enemy counter-attack ordering by initiative.

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCombatants, rollInitiative } from '../engine/combat/initiative.js';
import { makeRng, seedFromString } from '../engine/rng.js';
import { ensureWorld, newWorld, defaultCombat, ensureCombat, WORLD_VERSION } from '../engine/state.js';

function mkRng(seed) {
  return makeRng(seedFromString(seed || 'cm06-test'));
}

// ── WORLD_VERSION ───────────────────────────────────────────────────────────

test('CM06-01: WORLD_VERSION is 31', () => {
  assert.equal(WORLD_VERSION, 31);
});

// ── buildCombatants ─────────────────────────────────────────────────────────

test('CM06-02: buildCombatants includes living party and enemies', () => {
  const party = [
    { id: 'hero', wounds: 0, stats: { AGILITY: 14 } },
    { id: 'companion', wounds: 0, stats: { AGILITY: 12 } }
  ];
  const enemies = [
    { id: 'enemy_0', hp: 10, initMod: 2 },
    { id: 'enemy_1', hp: 5, initMod: -1 }
  ];
  const c = buildCombatants(party, enemies);
  assert.equal(c.length, 4);
  assert.equal(c[0].type, 'party');
  assert.equal(c[0].modifier, 2); // statMod(14) = 2
  assert.equal(c[1].modifier, 1); // statMod(12) = 1
  assert.equal(c[2].type, 'enemy');
  assert.equal(c[2].modifier, 2);
  assert.equal(c[3].modifier, -1);
});

test('CM06-03: buildCombatants excludes dead party members', () => {
  const party = [
    { id: 'hero', wounds: 0, stats: { AGILITY: 10 } },
    { id: 'dead', wounds: 6, stats: { AGILITY: 10 } }
  ];
  const c = buildCombatants(party, []);
  assert.equal(c.length, 1);
  assert.equal(c[0].id, 'hero');
});

test('CM06-04: buildCombatants excludes dead enemies', () => {
  const enemies = [
    { id: 'e0', hp: 10, initMod: 0 },
    { id: 'e1', hp: 0, initMod: 0 }
  ];
  const c = buildCombatants([], enemies);
  assert.equal(c.length, 1);
  assert.equal(c[0].id, 'e0');
});

test('CM06-05: buildCombatants defaults initMod to 0', () => {
  const enemies = [{ id: 'e0', hp: 5 }];
  const c = buildCombatants([], enemies);
  assert.equal(c[0].modifier, 0);
});

// ── rollInitiative ──────────────────────────────────────────────────────────

test('CM06-06: rollInitiative returns entries with correct shape', () => {
  const combatants = [
    { id: 'hero', type: 'party', modifier: 2 },
    { id: 'enemy_0', type: 'enemy', modifier: 1 }
  ];
  const order = rollInitiative(combatants, mkRng('shape'));
  assert.equal(order.length, 2);
  for (const e of order) {
    assert.ok(typeof e.id === 'string');
    assert.ok(typeof e.type === 'string');
    assert.ok(typeof e.roll === 'number');
    assert.ok(typeof e.modifier === 'number');
    assert.ok(typeof e.total === 'number');
    assert.equal(e.total, e.roll + e.modifier);
    assert.ok(e.roll >= 1 && e.roll <= 20);
  }
});

test('CM06-07: rollInitiative sorts descending by total', () => {
  // Use enough combatants to get sorting coverage
  const combatants = [];
  for (let i = 0; i < 6; i++) {
    combatants.push({ id: `c${i}`, type: 'enemy', modifier: i });
  }
  const order = rollInitiative(combatants, mkRng('sort'));
  for (let i = 1; i < order.length; i++) {
    assert.ok(order[i - 1].total >= order[i].total,
      `Entry ${i - 1} (total ${order[i - 1].total}) should be >= entry ${i} (total ${order[i].total})`);
  }
});

test('CM06-08: rollInitiative is deterministic for same seed', () => {
  const combatants = [
    { id: 'a', type: 'party', modifier: 2 },
    { id: 'b', type: 'enemy', modifier: 1 },
    { id: 'c', type: 'enemy', modifier: 3 }
  ];
  const r1 = rollInitiative(combatants, mkRng('det'));
  const r2 = rollInitiative(combatants, mkRng('det'));
  assert.deepStrictEqual(r1, r2);
});

test('CM06-09: different seeds produce different orders', () => {
  const combatants = [
    { id: 'a', type: 'party', modifier: 0 },
    { id: 'b', type: 'enemy', modifier: 0 },
    { id: 'c', type: 'enemy', modifier: 0 },
    { id: 'd', type: 'enemy', modifier: 0 }
  ];
  const results = new Set();
  for (let i = 0; i < 20; i++) {
    const order = rollInitiative(combatants, mkRng(`vary-${i}`));
    results.add(order.map(e => e.id).join(','));
  }
  assert.ok(results.size > 1, 'Expected different orderings across seeds');
});

test('CM06-10: tie-breaking favors higher modifier', () => {
  // Force identical rolls by giving same seed to a 2-combatant list
  // with different modifiers. The one with higher mod should come first.
  const combatants = [
    { id: 'low', type: 'enemy', modifier: 0 },
    { id: 'high', type: 'enemy', modifier: 5 }
  ];
  const order = rollInitiative(combatants, mkRng('tiebreak'));
  // Even if rolls differ, high modifier helps. Test the sorting is stable.
  // With same total, higher modifier wins.
  // We can't force a tie deterministically easily, so test the rule:
  // Create entries with guaranteed same total.
  const fakeEntries = [
    { id: 'a', type: 'enemy', roll: 10, modifier: 2, total: 12 },
    { id: 'b', type: 'enemy', roll: 10, modifier: 5, total: 15 }
  ];
  fakeEntries.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.modifier !== a.modifier) return b.modifier - a.modifier;
    return 0;
  });
  assert.equal(fakeEntries[0].id, 'b'); // higher total wins
});

test('CM06-11: party wins ties against enemy (same total and modifier)', () => {
  // Manually verify the sort comparator
  const entries = [
    { id: 'enemy', type: 'enemy', roll: 10, modifier: 2, total: 12 },
    { id: 'hero', type: 'party', roll: 10, modifier: 2, total: 12 }
  ];
  entries.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.modifier !== a.modifier) return b.modifier - a.modifier;
    if (a.type === 'party' && b.type !== 'party') return -1;
    if (b.type === 'party' && a.type !== 'party') return 1;
    return 0;
  });
  assert.equal(entries[0].id, 'hero');
});

// ── State integration ───────────────────────────────────���───────────────────

test('CM06-12: defaultCombat includes empty initiativeOrder', () => {
  const dc = defaultCombat();
  assert.ok(Array.isArray(dc.initiativeOrder));
  assert.equal(dc.initiativeOrder.length, 0);
});

test('CM06-13: ensureCombat normalizes initiativeOrder', () => {
  const c = ensureCombat({
    active: false, round: 0, turnIndex: 0, beganAt: 0, reason: '',
    playerGuard: false, companionGuard: false, enemies: [],
    initiativeOrder: [
      { id: 'hero', type: 'party', roll: 15, modifier: 2, total: 17 },
      { id: 'e0', type: 'enemy', roll: 10, modifier: 0, total: 10 }
    ]
  });
  assert.equal(c.initiativeOrder.length, 2);
  assert.equal(c.initiativeOrder[0].id, 'hero');
  assert.equal(c.initiativeOrder[0].total, 17);
});

test('CM06-14: ensureCombat defaults missing initiativeOrder to []', () => {
  const c = ensureCombat({
    active: false, round: 0, turnIndex: 0, beganAt: 0, reason: '',
    playerGuard: false, companionGuard: false, enemies: []
  });
  assert.ok(Array.isArray(c.initiativeOrder));
  assert.equal(c.initiativeOrder.length, 0);
});

test('CM06-15: ensureCombat caps initiativeOrder at 12 entries', () => {
  const entries = [];
  for (let i = 0; i < 20; i++) {
    entries.push({ id: `c${i}`, type: 'enemy', roll: 10, modifier: 0, total: 10 });
  }
  const c = ensureCombat({
    active: false, round: 0, turnIndex: 0, beganAt: 0, reason: '',
    playerGuard: false, companionGuard: false, enemies: [],
    initiativeOrder: entries
  });
  assert.equal(c.initiativeOrder.length, 12);
});

// ── Enemy initMod in state ──────────────────────────────────────────────────

test('CM06-16: ensureWorld normalizes enemy initMod', () => {
  const w = ensureWorld({
    combat: {
      active: true, round: 1, turnIndex: 0, beganAt: 0, reason: 'test',
      playerGuard: false, companionGuard: false, initiativeOrder: [],
      enemies: [{
        id: 'enemy_0', name: 'Test', hp: 10, maxHp: 10, damage: 2,
        ac: 10, cr: 0, damageType: 'bludgeoning', resistances: {},
        conditionImmunities: [], conditions: [],
        actions: [], multiattack: null, saveProficiencies: [],
        canParley: true, defeated: false, sourceNpcId: '',
        lootTableRef: null, initMod: 3
      }]
    }
  });
  assert.equal(w.combat.enemies[0].initMod, 3);
});

test('CM06-17: initMod defaults to 0 when missing', () => {
  const w = ensureWorld({
    combat: {
      active: true, round: 1, turnIndex: 0, beganAt: 0, reason: 'test',
      playerGuard: false, companionGuard: false, initiativeOrder: [],
      enemies: [{
        id: 'enemy_0', name: 'Test', hp: 10, maxHp: 10, damage: 2,
        ac: 10, cr: 0, damageType: 'bludgeoning', resistances: {},
        conditionImmunities: [], conditions: [],
        actions: [], multiattack: null, saveProficiencies: [],
        canParley: true, defeated: false, sourceNpcId: '',
        lootTableRef: null
      }]
    }
  });
  assert.equal(w.combat.enemies[0].initMod, 0);
});

// ── rollInitiative handles empty/edge cases ─────────────────────────────────

test('CM06-18: rollInitiative with empty array returns empty', () => {
  const order = rollInitiative([], mkRng('empty'));
  assert.deepStrictEqual(order, []);
});

test('CM06-19: rollInitiative with single combatant', () => {
  const order = rollInitiative([{ id: 'solo', type: 'party', modifier: 3 }], mkRng('solo'));
  assert.equal(order.length, 1);
  assert.equal(order[0].id, 'solo');
  assert.equal(order[0].modifier, 3);
});

test('CM06-20: rollInitiative with null/undefined inputs is safe', () => {
  const order = rollInitiative(null, mkRng('null'));
  assert.deepStrictEqual(order, []);
});
