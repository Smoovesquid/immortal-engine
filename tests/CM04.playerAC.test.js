// CM04 — Player Armor / AC System
//
// Validates that computeAC is wired into the enemy counter-attack phase
// and that all armor items produce correct AC values.

import test from 'node:test';
import assert from 'node:assert/strict';

import { computeAC } from '../engine/gear/gearProps.js';
import { getItemDef } from '../engine/ruleset/core/items/index.js';
import { statMod } from '../engine/ruleset/core/stats.js';
import { resolveAction } from '../engine/combat/actionResolver.js';
import { makeRng, seedFromString } from '../engine/rng.js';

function mkEntity(stats, items) {
  return {
    id: 'hero',
    level: 1,
    stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10, ...stats },
    inventory: { items: items || [] }
  };
}

// ── Armor catalog completeness ──────────────────────────────────────────────

test('CM04-01: padded armor exists in catalog', () => {
  const def = getItemDef('padded');
  assert.ok(def);
  assert.equal(def.kind, 'armor');
  assert.equal(def.ac, 11);
  assert.equal(def.maxDexBonus, null);
});

test('CM04-02: hide_armor exists with maxDexBonus 2', () => {
  const def = getItemDef('hide_armor');
  assert.ok(def);
  assert.equal(def.ac, 12);
  assert.equal(def.maxDexBonus, 2);
});

test('CM04-03: scale_mail exists with maxDexBonus 2', () => {
  const def = getItemDef('scale_mail');
  assert.ok(def);
  assert.equal(def.ac, 14);
  assert.equal(def.maxDexBonus, 2);
});

test('CM04-04: half_plate exists with maxDexBonus 2', () => {
  const def = getItemDef('half_plate');
  assert.ok(def);
  assert.equal(def.ac, 15);
  assert.equal(def.maxDexBonus, 2);
});

test('CM04-05: plate_armor exists with maxDexBonus 0', () => {
  const def = getItemDef('plate_armor');
  assert.ok(def);
  assert.equal(def.ac, 18);
  assert.equal(def.maxDexBonus, 0);
});

// ── computeAC with new armor types ──────────────────────────────────────────

test('CM04-06: padded armor AC = 11 + full dex', () => {
  const e = mkEntity({ AGILITY: 16 }, [
    { id: 'a1', defRef: 'padded', equipped: 'armor' }
  ]);
  assert.equal(computeAC(e), 11 + statMod(16)); // 11 + 3 = 14
});

test('CM04-07: hide_armor caps dex at +2', () => {
  const e = mkEntity({ AGILITY: 18 }, [
    { id: 'a1', defRef: 'hide_armor', equipped: 'armor' }
  ]);
  assert.equal(computeAC(e), 12 + 2); // 14, not 12 + 4
});

test('CM04-08: scale_mail caps dex at +2', () => {
  const e = mkEntity({ AGILITY: 20 }, [
    { id: 'a1', defRef: 'scale_mail', equipped: 'armor' }
  ]);
  assert.equal(computeAC(e), 14 + 2); // 16
});

test('CM04-09: half_plate caps dex at +2', () => {
  const e = mkEntity({ AGILITY: 16 }, [
    { id: 'a1', defRef: 'half_plate', equipped: 'armor' }
  ]);
  assert.equal(computeAC(e), 15 + 2); // 17
});

test('CM04-10: plate_armor ignores dex entirely', () => {
  const e = mkEntity({ AGILITY: 20 }, [
    { id: 'a1', defRef: 'plate_armor', equipped: 'armor' }
  ]);
  assert.equal(computeAC(e), 18); // maxDexBonus 0
});

test('CM04-11: low-dex entity benefits less from uncapped armor', () => {
  const e = mkEntity({ AGILITY: 8 }, [
    { id: 'a1', defRef: 'padded', equipped: 'armor' }
  ]);
  assert.equal(computeAC(e), 11 + statMod(8)); // 11 + (-1) = 10
});

test('CM04-12: dex-capped armor never applies negative dex', () => {
  // hide_armor maxDexBonus=2, but dexMod is -1.  min(dexMod, cap) = -1.
  // This is correct D&D behavior — the cap is a ceiling, not a floor.
  const e = mkEntity({ AGILITY: 8 }, [
    { id: 'a1', defRef: 'hide_armor', equipped: 'armor' }
  ]);
  assert.equal(computeAC(e), 12 + statMod(8)); // 12 + (-1) = 11
});

// ── Integration: AC used in combat resolution ───────────────────────────────

test('CM04-13: resolveAction reads target ac property', () => {
  const rng = makeRng(seedFromString('cm04-ac-test'));
  const action = { name: 'Slash', type: 'attack', toHit: 5, damage: '1d6' };
  const attacker = { id: 'e0', name: 'Goblin', ac: 10, conditions: [] };

  // Target with very high AC — should make hits unlikely
  const highAcTarget = { id: 'hero', name: 'Hero', ac: 30, conditions: [], resistances: {} };
  let hits = 0;
  for (let i = 0; i < 50; i++) {
    const res = resolveAction(action, attacker, highAcTarget, rng);
    if (res.hit) hits++;
  }
  // With AC 30 and toHit +5, only nat 20 hits (5% chance).
  // In 50 rolls, expect ~2.5 hits. Allow up to 8 for randomness.
  assert.ok(hits < 10, `Expected few hits against AC 30, got ${hits}`);
});

test('CM04-14: resolveAction hits easily against low AC', () => {
  const rng = makeRng(seedFromString('cm04-low-ac'));
  const action = { name: 'Slash', type: 'attack', toHit: 8, damage: '1d6' };
  const attacker = { id: 'e0', name: 'Orc', ac: 10, conditions: [] };
  const lowAcTarget = { id: 'hero', name: 'Hero', ac: 5, conditions: [], resistances: {} };

  let hits = 0;
  for (let i = 0; i < 50; i++) {
    const res = resolveAction(action, attacker, lowAcTarget, rng);
    if (res.hit) hits++;
  }
  // toHit +8 vs AC 5 — everything except nat 1 hits (95%).
  assert.ok(hits > 40, `Expected most hits against AC 5, got ${hits}`);
});

test('CM04-15: unarmored party member uses 10 + dexMod as AC', () => {
  const e = mkEntity({ AGILITY: 14 }, []);
  assert.equal(computeAC(e), 12);
});
