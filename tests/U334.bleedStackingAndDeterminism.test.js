// U334 — bleed's stackBehavior:'highest' (a worse cut replaces a lesser one,
// nicks don't pile up to death) + determinism: same seed + same move
// sequence produces an identical worldHash.
//
// LLM-off.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { applyCondition } from '../engine/combat/conditions.js';
import { resolveCombatTurn } from '../engine/combat/combatResolve.js';
import { makeBleed, BLEED_TIERS } from '../engine/combat/bleed.js';
import { worldHash } from '../engine/worldHash.js';

// ── stackBehavior:'highest' — pure, no engine round-trip needed ──────────

test('U334: a worse bleed (higher severity) replaces a lesser one already present', () => {
  let conditions = applyCondition([], makeBleed('shallow'), []);
  assert.equal(conditions[0].bleedTier, 'shallow');

  conditions = applyCondition(conditions, makeBleed('severe'), []);
  assert.equal(conditions.length, 1, 'still exactly one bleeding condition, not stacked');
  assert.equal(conditions[0].bleedTier, 'severe', 'severe (higher severity) should replace shallow');
  assert.equal(conditions[0].severity, BLEED_TIERS.severe.severity);
});

test('U334: a lesser bleed (lower severity) does NOT downgrade an existing worse one', () => {
  let conditions = applyCondition([], makeBleed('arterial'), []);
  conditions = applyCondition(conditions, makeBleed('papercut'), []);
  assert.equal(conditions.length, 1);
  assert.equal(conditions[0].bleedTier, 'arterial', 'arterial should NOT be downgraded by a later papercut hit');
});

test('U334: an equal-tier re-application does not change the stored condition (no-op, not a reset)', () => {
  let conditions = applyCondition([], makeBleed('deep'), []);
  const first = conditions[0];
  conditions = applyCondition(conditions, makeBleed('deep'), []);
  assert.equal(conditions.length, 1);
  assert.equal(conditions[0], first, 'same-severity re-add should be a true no-op (same object), not a fresh replace');
});

// ── determinism ────────────────────────────────────────────────────────

function mkPlayerWorld(seedKey) {
  let w = newWorld({ seed: seedKey, fate: 0.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = ensureWorld({
    ...w,
    party: [{
      id: 'party', name: 'Adventurer', vibe: 'steady', archetype: 'wanderer',
      wounds: 0, stress: 0, resources: { Supply: 5 }, level: 5,
      stats: { MIGHT: 18, AGILITY: 14, WITS: 12, GRIT: 12, CHARM: 10 },
      inventory: { items: [] },
    }],
    scene: { location: 'test', objective: 'slay', time: 'start', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });
  return w;
}

function mkBleedEnemy() {
  return {
    id: 'enemy_0', name: 'Test Troll', hp: 60, maxHp: 60, damage: 5, ac: 10, cr: 5, stats: { GRIT: 10 },
    damageType: 'slashing', resistances: {}, conditionImmunities: [], conditions: [],
    actions: [{ name: 'Claw', toHit: 10, damage: '2d8+4', type: 'slashing', range: null, save: null, conditions: [makeBleed('deep')], recharge: null }],
    multiattack: null, saveProficiencies: [], canParley: false, defeated: false,
    sourceNpcId: 'npc_troll', lootTableRef: null, initMod: 0
  };
}

const STANDARD_INIT = [
  { id: 'party', type: 'party', roll: 16, modifier: 2, total: 18 },
  { id: 'enemy_0', type: 'enemy', roll: 12, modifier: 3, total: 15 }
];

function runFight(seedKey) {
  let w = mkPlayerWorld(seedKey);
  w = applyDeltas(w, [{
    op: 'combatState',
    set: { active: true, round: 1, turnIndex: 0, enemies: [mkBleedEnemy()], beganAt: 0, reason: 'test', playerGuard: false, companionGuard: false, initiativeOrder: STANDARD_INIT }
  }]);
  const moves = ['force', 'force', 'endure', 'finesse', 'force'];
  for (const approachTag of moves) {
    const res = resolveCombatTurn(w, { approachTag });
    w = res.world;
  }
  return w;
}

test('U334: identical seed + identical move sequence through a bleed-tagged fight produces an identical worldHash', () => {
  const w1 = runFight('u334-determinism-seed');
  const w2 = runFight('u334-determinism-seed');
  assert.equal(worldHash(w1), worldHash(w2), 'replaying the same seed + moves should be bit-identical');
});

test('U334: a bleed-tagged fight under a DIFFERENT seed produces a different worldHash (sanity: hash is not constant)', () => {
  const w1 = runFight('u334-seed-a');
  const w2 = runFight('u334-seed-b');
  assert.notEqual(worldHash(w1), worldHash(w2), 'different seeds should diverge — otherwise the hash isn\'t sensing anything');
});
