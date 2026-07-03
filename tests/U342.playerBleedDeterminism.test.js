// U342 — the player-side bleed tick is deterministic under replay.
//
// The new player tick reuses the existing condition-tick RNG (seeded
// `condtick|turn|round`) for any save_ends roll, draws AFTER every enemy's
// tick (a fixed order), and writes back through the new `partyConditions`
// replace-op. None of that introduces a new randomness source or a
// state-shape change, so replaying the same seed + move sequence through a
// fight where the PLAYER is bleeding must produce a bit-identical worldHash.
//
// Player conditions already live in the world hash image (crunchHashProjection
// spreads the whole party member), so no WORLD_VERSION bump is involved — this
// test is the proof.
//
// LLM-off.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { resolveCombatTurn } from '../engine/combat/combatResolve.js';
import { makeBleed } from '../engine/combat/bleed.js';
import { worldHash } from '../engine/worldHash.js';

function mkPlayerWorld(seedKey) {
  let w = newWorld({ seed: seedKey, fate: 0.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = ensureWorld({
    ...w,
    party: [{
      id: 'party', name: 'Adventurer', vibe: 'steady', archetype: 'wanderer',
      wounds: 0, stress: 0, resources: { Supply: 5 }, level: 5,
      stats: { MIGHT: 16, AGILITY: 14, WITS: 12, GRIT: 12, CHARM: 10 },
      inventory: { items: [] }, conditions: [],
    }],
    scene: { location: 'test', objective: 'slay', time: 'start', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });
  return w;
}

// A real foe so the fight has genuine enemy ticks + strikes interleaved with the
// player's own bleed tick (stresses the shared condtick RNG ordering).
function mkFoe() {
  return {
    id: 'enemy_0', name: 'Test Troll', hp: 80, maxHp: 80, damage: 5, ac: 12, cr: 5, stats: { GRIT: 10 },
    damageType: 'slashing', resistances: {}, conditionImmunities: [], conditions: [],
    actions: [{ name: 'Claw', toHit: 8, damage: '2d6+3', type: 'slashing', range: null, save: null, conditions: [], recharge: null }],
    multiattack: null, saveProficiencies: [], canParley: false, defeated: false,
    sourceNpcId: 'npc_troll', lootTableRef: null, initMod: 0
  };
}

const STANDARD_INIT = [
  { id: 'party', type: 'party', roll: 16, modifier: 2, total: 18 },
  { id: 'enemy_0', type: 'enemy', roll: 12, modifier: 3, total: 15 }
];

// Run a fight in which the player is carrying a `deep` bleed (save_ends → the
// player's save RNG is exercised each round through the new tick).
function runBleedingPlayerFight(seedKey, tier = 'deep') {
  let w = mkPlayerWorld(seedKey);
  w = applyDeltas(w, [{
    op: 'combatState',
    set: { active: true, round: 1, turnIndex: 0, enemies: [mkFoe()], beganAt: 0, reason: 'test', playerGuard: false, companionGuard: false, initiativeOrder: STANDARD_INIT }
  }]);
  w = applyDeltas(w, [{ op: 'condition', entityId: 'party', cond: makeBleed(tier, 'claw') }]);
  const moves = ['force', 'endure', 'force', 'finesse', 'endure'];
  for (const approachTag of moves) {
    w = resolveCombatTurn(w, { approachTag }).world;
  }
  return w;
}

test('U342: identical seed + moves through a fight where the PLAYER is bleeding → identical worldHash', () => {
  const w1 = runBleedingPlayerFight('u342-determinism-seed');
  const w2 = runBleedingPlayerFight('u342-determinism-seed');
  assert.equal(worldHash(w1), worldHash(w2),
    'replaying the same seed + moves with a player bleed must be bit-identical (reused RNG, no new source)');
});

test('U342: a different seed diverges (sanity: the hash actually senses the player-bleed path)', () => {
  const w1 = runBleedingPlayerFight('u342-seed-a');
  const w2 = runBleedingPlayerFight('u342-seed-b');
  assert.notEqual(worldHash(w1), worldHash(w2), 'different seeds should diverge');
});

test('U342: the arterial variant is also replay-stable (permanent bleed, no save RNG, pure severity)', () => {
  const w1 = runBleedingPlayerFight('u342-arterial-seed', 'arterial');
  const w2 = runBleedingPlayerFight('u342-arterial-seed', 'arterial');
  assert.equal(worldHash(w1), worldHash(w2), 'arterial (deterministic severity, no save draw) replays identically');
});
