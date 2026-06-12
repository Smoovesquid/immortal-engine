// R05 — Attack roll: gear props compute correct attack bonus from equipped weapon.
//
// Validates computeAttack for unarmed, standard weapons, finesse weapons,
// ranged weapons, and magic weapons.

import test from 'node:test';
import assert from 'node:assert/strict';

import { computeAttack, computeAC } from '../engine/gear/gearProps.js';
import { statMod } from '../engine/ruleset/core/stats.js';
import { profBonusFor } from '../engine/ruleset/core/levelTable.js';

function mkEntity(stats, items, level = 1) {
  return {
    id: 'party',
    level,
    stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10, ...stats },
    inventory: { items: items || [] }
  };
}

test('R05-01: unarmed attack uses MIGHT mod only', () => {
  const e = mkEntity({ MIGHT: 16 }, []);
  const atk = computeAttack(e);
  assert.equal(atk.attackBonus, statMod(16)); // +3
  assert.equal(atk.damageBonus, statMod(16));
  assert.equal(atk.damageDice, '1');
  assert.equal(atk.damageType, 'bludgeoning');
});

test('R05-02: longsword uses MIGHT + proficiency', () => {
  const e = mkEntity({ MIGHT: 14 }, [
    { id: 'w1', defRef: 'longsword', equipped: 'main_hand' }
  ], 1);
  const atk = computeAttack(e);
  const expectedAttack = statMod(14) + profBonusFor(1); // 2 + 2 = 4
  assert.equal(atk.attackBonus, expectedAttack);
  assert.equal(atk.damageBonus, statMod(14)); // 2
  assert.equal(atk.damageDice, '1d8');
  assert.equal(atk.damageType, 'slashing');
});

test('R05-03: shortsword (finesse) uses AGILITY when higher', () => {
  const e = mkEntity({ MIGHT: 10, AGILITY: 16 }, [
    { id: 'w1', defRef: 'shortsword', equipped: 'main_hand' }
  ], 1);
  const atk = computeAttack(e);
  // Finesse weapon uses AGILITY
  const expectedAttack = statMod(16) + profBonusFor(1); // 3 + 2 = 5
  assert.equal(atk.attackBonus, expectedAttack);
  assert.equal(atk.damageBonus, statMod(16)); // 3
});

test('R05-04: longbow uses AGILITY (stat override)', () => {
  const e = mkEntity({ MIGHT: 10, AGILITY: 18 }, [
    { id: 'w1', defRef: 'longbow', equipped: 'main_hand' }
  ], 5);
  const atk = computeAttack(e);
  const expectedAttack = statMod(18) + profBonusFor(5); // 4 + 3 = 7
  assert.equal(atk.attackBonus, expectedAttack);
  assert.equal(atk.damageDice, '1d8');
  assert.equal(atk.damageType, 'piercing');
});

test('R05-05: magic weapon adds bonus to attack and damage', () => {
  const e = mkEntity({ MIGHT: 14 }, [
    { id: 'w1', defRef: 'longsword_magic_1', equipped: 'main_hand' }
  ], 1);
  const atk = computeAttack(e);
  // +1 magic bonus on top
  const expectedAttack = statMod(14) + profBonusFor(1) + 1; // 2 + 2 + 1 = 5
  assert.equal(atk.attackBonus, expectedAttack);
  assert.equal(atk.damageBonus, statMod(14) + 1); // 2 + 1 = 3
});

test('R05-06: unequipped weapon is ignored (unarmed fallback)', () => {
  const e = mkEntity({ MIGHT: 12 }, [
    { id: 'w1', defRef: 'longsword', equipped: null }
  ]);
  const atk = computeAttack(e);
  assert.equal(atk.attackBonus, statMod(12)); // unarmed: +1
  assert.equal(atk.damageDice, '1');
});

test('R05-07: proficiency scales with level', () => {
  const e = mkEntity({ MIGHT: 10 }, [
    { id: 'w1', defRef: 'longsword', equipped: 'main_hand' }
  ], 9);
  const atk = computeAttack(e);
  // Level 9 = profBonus +4
  assert.equal(atk.attackBonus, statMod(10) + profBonusFor(9)); // 0 + 4 = 4
});

// ── AC tests ──────────────────────────────────────────────────────────────

test('R05-08: unarmored AC = 10 + dexMod', () => {
  const e = mkEntity({ AGILITY: 14 }, []);
  assert.equal(computeAC(e), 10 + statMod(14)); // 10 + 2 = 12
});

test('R05-09: leather armor AC = 11 + dexMod (no cap)', () => {
  const e = mkEntity({ AGILITY: 16 }, [
    { id: 'a1', defRef: 'leather_armor', equipped: 'armor' }
  ]);
  assert.equal(computeAC(e), 11 + statMod(16)); // 11 + 3 = 14
});

test('R05-10: chain mail AC = 16 + 0 (maxDexBonus: 0)', () => {
  const e = mkEntity({ AGILITY: 18 }, [
    { id: 'a1', defRef: 'chain_mail', equipped: 'armor' }
  ]);
  assert.equal(computeAC(e), 16); // maxDexBonus 0 → no dex contrib
});

test('R05-11: ring of protection adds +1 AC', () => {
  const e = mkEntity({ AGILITY: 14 }, [
    { id: 'a1', defRef: 'leather_armor', equipped: 'armor' },
    { id: 'r1', defRef: 'ring_of_protection', equipped: 'ring', attuned: true } // P-77: the ring protects only its bonded bearer
  ]);
  assert.equal(computeAC(e), 11 + statMod(14) + 1); // 11 + 2 + 1 = 14
});

test('R05-12: unequipped armor is ignored', () => {
  const e = mkEntity({ AGILITY: 14 }, [
    { id: 'a1', defRef: 'chain_mail', equipped: null }
  ]);
  assert.equal(computeAC(e), 10 + statMod(14)); // unarmored: 12
});
