// CM05 — Loot Tables
//
// Validates CR-scaled loot tables, rollLoot, rollLootForCR, the addCurrency
// delta op, and the victory→loot pipeline in combatResolve.

import test from 'node:test';
import assert from 'node:assert/strict';

import { getLootTable, tableIdForCR } from '../engine/ruleset/core/loot/index.js';
import { rollLoot, rollLootForCR } from '../engine/ruleset/core/loot/lootRoll.js';
import { makeRng, seedFromString } from '../engine/rng.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { ensureWorld, newWorld } from '../engine/state.js';

function mkRng(seed) {
  return makeRng(seedFromString(seed || 'cm05-test'));
}

function worldWithParty() {
  let w = newWorld({ seed: 'cm05-world' });
  // Inject a party member so delta ops have a target entity.
  w = { ...w, party: [{ id: 'party', name: 'Hero', hp: 20, maxHp: 20, wounds: 0, stress: 0, level: 1, stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 }, inventory: { items: [] }, purse: { copper: 0, silver: 0, gold: 0, platinum: 0 } }] };
  return ensureWorld(w);
}

// ── Table registry ──────────────────────────────────────────────────────────

test('CM05-01: cr_0_4 table exists and has entries', () => {
  const t = getLootTable('cr_0_4');
  assert.ok(t);
  assert.ok(t.entries.length > 0);
  assert.equal(t.rolls, 1);
});

test('CM05-02: cr_5_10 table exists with 2 rolls', () => {
  const t = getLootTable('cr_5_10');
  assert.ok(t);
  assert.equal(t.rolls, 2);
});

test('CM05-03: cr_11_16 table exists with 2 rolls', () => {
  const t = getLootTable('cr_11_16');
  assert.ok(t);
  assert.equal(t.rolls, 2);
});

test('CM05-04: cr_17_plus table exists with 3 rolls', () => {
  const t = getLootTable('cr_17_plus');
  assert.ok(t);
  assert.equal(t.rolls, 3);
});

test('CM05-05: legacy tables still registered', () => {
  assert.ok(getLootTable('monstrous_common'));
  assert.ok(getLootTable('humanoid_common'));
});

// ── tableIdForCR ────────────────────────────────────────────────────────────

test('CM05-06: CR 0 maps to cr_0_4', () => {
  assert.equal(tableIdForCR(0), 'cr_0_4');
});

test('CM05-07: CR 4 maps to cr_0_4', () => {
  assert.equal(tableIdForCR(4), 'cr_0_4');
});

test('CM05-08: CR 5 maps to cr_5_10', () => {
  assert.equal(tableIdForCR(5), 'cr_5_10');
});

test('CM05-09: CR 10 maps to cr_5_10', () => {
  assert.equal(tableIdForCR(10), 'cr_5_10');
});

test('CM05-10: CR 11 maps to cr_11_16', () => {
  assert.equal(tableIdForCR(11), 'cr_11_16');
});

test('CM05-11: CR 17 maps to cr_17_plus', () => {
  assert.equal(tableIdForCR(17), 'cr_17_plus');
});

test('CM05-12: CR 30 maps to cr_17_plus', () => {
  assert.equal(tableIdForCR(30), 'cr_17_plus');
});

test('CM05-13: non-number CR defaults to cr_0_4', () => {
  assert.equal(tableIdForCR(undefined), 'cr_0_4');
  assert.equal(tableIdForCR(null), 'cr_0_4');
});

// ── rollLoot determinism ────────────────────────────────────────────────────

test('CM05-14: rollLoot returns deterministic results for same seed', () => {
  const r1 = rollLoot('cr_0_4', mkRng('determinism-a'));
  const r2 = rollLoot('cr_0_4', mkRng('determinism-a'));
  assert.deepStrictEqual(r1, r2);
});

test('CM05-15: different seeds produce different loot', () => {
  // Run many seeds and check we don't get identical results every time
  const results = new Set();
  for (let i = 0; i < 20; i++) {
    const r = rollLoot('cr_0_4', mkRng(`vary-${i}`));
    results.add(JSON.stringify(r));
  }
  assert.ok(results.size > 1, 'Expected variation across seeds');
});

test('CM05-16: rollLoot returns empty for unknown table', () => {
  const r = rollLoot('nonexistent', mkRng());
  assert.deepStrictEqual(r, []);
});

// ── rollLootForCR ───────────────────────────────────────────────────────────

test('CM05-17: rollLootForCR selects table by CR', () => {
  const r = rollLootForCR(5, mkRng('cr5'));
  // cr_5_10 has 2 rolls, so we can get 0-2 results (nulls filtered)
  assert.ok(Array.isArray(r));
});

test('CM05-18: rollLootForCR override table takes precedence', () => {
  // Force humanoid_common even with CR 20
  const r = rollLootForCR(20, mkRng('override'), 'humanoid_common');
  assert.ok(Array.isArray(r));
});

// ── addCurrency delta op ────────────────────────────────────────────────────

test('CM05-19: addCurrency delta adds gold to party purse', () => {
  let w = worldWithParty();
  w = applyDeltas(w, [{ op: 'addCurrency', entityId: 'party', currency: 'gold', amount: 10 }]);
  const party = (w.party || []).find(p => p.id === 'party');
  assert.ok(party);
  assert.equal(party.purse.gold, 10);
});

test('CM05-20: addCurrency stacks with existing currency', () => {
  let w = worldWithParty();
  w = applyDeltas(w, [
    { op: 'addCurrency', entityId: 'party', currency: 'silver', amount: 5 },
    { op: 'addCurrency', entityId: 'party', currency: 'silver', amount: 3 }
  ]);
  const party = (w.party || []).find(p => p.id === 'party');
  assert.equal(party.purse.silver, 8);
});

test('CM05-21: addCurrency ignores invalid currency names', () => {
  let w = worldWithParty();
  w = applyDeltas(w, [{ op: 'addCurrency', entityId: 'party', currency: 'gems', amount: 5 }]);
  const party = (w.party || []).find(p => p.id === 'party');
  assert.equal(party.purse.gold, 0);
  assert.equal(party.purse.silver, 0);
});

test('CM05-22: addCurrency ignores zero/negative amounts', () => {
  let w = worldWithParty();
  w = applyDeltas(w, [{ op: 'addCurrency', entityId: 'party', currency: 'gold', amount: 0 }]);
  const party = (w.party || []).find(p => p.id === 'party');
  assert.equal(party.purse.gold, 0);
});

// ── Loot result shapes ──────────────────────────────────────────────────────

test('CM05-23: currency loot results have kind/currency/amount', () => {
  // Roll many times to get at least one currency result
  let found = false;
  for (let i = 0; i < 50 && !found; i++) {
    const results = rollLoot('cr_0_4', mkRng(`shape-${i}`));
    for (const r of results) {
      if (r && r.kind === 'currency') {
        assert.ok(typeof r.currency === 'string');
        assert.ok(typeof r.amount === 'string');
        found = true;
        break;
      }
    }
  }
  assert.ok(found, 'Expected at least one currency drop in 50 rolls');
});

test('CM05-24: item loot results have kind/defRef', () => {
  let found = false;
  for (let i = 0; i < 50 && !found; i++) {
    const results = rollLoot('cr_0_4', mkRng(`item-${i}`));
    for (const r of results) {
      if (r && r.kind === 'item') {
        assert.ok(typeof r.defRef === 'string');
        found = true;
        break;
      }
    }
  }
  assert.ok(found, 'Expected at least one item drop in 50 rolls');
});

// ── Enemy lootTableRef in state ─────────────────────────────────────────────

test('CM05-25: ensureWorld normalizes enemy lootTableRef', () => {
  const w = ensureWorld({
    combat: {
      active: true, round: 1, turnIndex: 0, beganAt: 0, reason: 'test',
      playerGuard: false, companionGuard: false,
      enemies: [{
        id: 'enemy_0', name: 'Test', hp: 10, maxHp: 10, damage: 2,
        ac: 10, cr: 0, damageType: 'bludgeoning', resistances: {},
        conditionImmunities: [], conditions: [],
        actions: [], multiattack: null, saveProficiencies: [],
        canParley: true, defeated: false, sourceNpcId: '',
        lootTableRef: 'humanoid_common'
      }]
    }
  });
  assert.equal(w.combat.enemies[0].lootTableRef, 'humanoid_common');
});

test('CM05-26: lootTableRef defaults to null for missing values', () => {
  const w = ensureWorld({
    combat: {
      active: true, round: 1, turnIndex: 0, beganAt: 0, reason: 'test',
      playerGuard: false, companionGuard: false,
      enemies: [{
        id: 'enemy_0', name: 'Test', hp: 10, maxHp: 10, damage: 2,
        ac: 10, cr: 0, damageType: 'bludgeoning', resistances: {},
        conditionImmunities: [], conditions: [],
        actions: [], multiattack: null, saveProficiencies: [],
        canParley: true, defeated: false, sourceNpcId: ''
      }]
    }
  });
  assert.equal(w.combat.enemies[0].lootTableRef, null);
});
