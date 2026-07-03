// U341 — the PLAYER bleed EXPIRES per its `until`, and the partyConditions
// writeback op that makes that possible.
//
// The whole point of this lane: before it, a bleed on the player could tick but
// never stop (the party `condition` op was additive-only). combat/bleed.js
// (frozen) sets each tier's lifetime:
//   shallow  — until:2         → stings and closes on its own (~2 rounds)
//   deep     — save_ends (GRIT dc 11) → ends when the player makes the save
//   severe   — save_ends (GRIT dc 13)
//   arterial — permanent       → never self-expires (lethal if ignored)
//
// This exercises the lifecycle through the REAL resolveCombatTurn path (reading
// the deterministic conditions array, which enemy damage cannot perturb), plus
// a direct unit test of the new `partyConditions` op in effectsCore.js.
//
// LLM-off. Pure engine/rng.js seeded randomness.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { resolveCombatTurn } from '../engine/combat/combatResolve.js';
import { makeBleed } from '../engine/combat/bleed.js';

function mkPlayerWorld(seedKey, gritScore = 10) {
  let w = newWorld({ seed: `u341-${seedKey}`, fate: 0.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = ensureWorld({
    ...w,
    party: [{
      id: 'party', name: 'Adventurer', vibe: 'steady', archetype: 'wanderer',
      wounds: 0, stress: 0, resources: { Supply: 5 }, level: 5,
      stats: { MIGHT: 12, AGILITY: 12, WITS: 12, GRIT: gritScore, CHARM: 10 },
      inventory: { items: [] }, conditions: [],
    }],
    scene: { location: 'test', objective: 'x', time: 'start', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });
  return w;
}

function mkEnemy() {
  return {
    id: 'enemy_0', name: 'Statue', hp: 999, maxHp: 999, damage: 1, ac: 30, cr: 1,
    stats: { GRIT: 10 }, damageType: 'slashing', resistances: {}, conditionImmunities: [], conditions: [],
    actions: [], multiattack: null, saveProficiencies: [], canParley: false, defeated: false,
    sourceNpcId: 'npc_test', lootTableRef: null, initMod: 0
  };
}

const STANDARD_INIT = [
  { id: 'party', type: 'party', roll: 16, modifier: 2, total: 18 },
  { id: 'enemy_0', type: 'enemy', roll: 12, modifier: 3, total: 15 }
];

function mkCombat(seedKey, round = 1, gritScore = 10) {
  let w = mkPlayerWorld(seedKey, gritScore);
  w = applyDeltas(w, [{
    op: 'combatState',
    set: { active: true, round, turnIndex: 0, enemies: [mkEnemy()], beganAt: 0, reason: 'test', playerGuard: false, companionGuard: false, initiativeOrder: STANDARD_INIT }
  }]);
  return w;
}

const isBleeding = (w) => w.party[0].conditions.some(c => c.name === 'bleeding');

// ── lifecycle through the real engine ────────────────────────────────────

test('U341: a shallow player-bleed clears on its own within a couple of rounds', () => {
  let w = mkCombat('shallow-clears');
  w = applyDeltas(w, [{ op: 'condition', entityId: 'party', cond: makeBleed('shallow') }]);
  assert.ok(isBleeding(w), 'bleeding after the cut lands');
  // Tick it forward; a shallow (until:2) must be gone within a few rounds.
  let cleared = false;
  for (let i = 0; i < 4 && !cleared; i++) {
    w = resolveCombatTurn(w, { approachTag: 'endure' }).world;
    if (!isBleeding(w)) cleared = true;
  }
  assert.ok(cleared, 'a shallow bleed should stop on its own — it must NOT bleed forever');
});

test('U341: an arterial player-bleed never self-expires (until:permanent)', () => {
  let w = mkCombat('arterial-permanent');
  w = applyDeltas(w, [{ op: 'condition', entityId: 'party', cond: makeBleed('arterial') }]);
  for (let i = 0; i < 6; i++) {
    w = resolveCombatTurn(w, { approachTag: 'endure' }).world;
  }
  assert.ok(isBleeding(w), 'arterial bleed persists — it only stops when tended');
});

test('U341: a deep player-bleed ends when the player makes the GRIT save (high GRIT saves promptly)', () => {
  // GRIT 30 (mod +10) beats dc 11 on any roll → the save lands on the first
  // tick and the deep bleed is gone the following round.
  let w = mkCombat('deep-saves', 1, 30);
  w = applyDeltas(w, [{ op: 'condition', entityId: 'party', cond: makeBleed('deep') }]);
  assert.ok(isBleeding(w), 'deep bleed present');
  w = resolveCombatTurn(w, { approachTag: 'endure' }).world; // save rolls here
  assert.ok(!isBleeding(w), 'a made GRIT save ends the deep bleed');
});

test('U341: a deep player-bleed with a hopeless save (very low GRIT) persists until saved', () => {
  // GRIT 1 (mod -5) cannot beat dc 11 short of a natural 20; across a couple of
  // seeded rounds it should still be bleeding (proves save_ends actually gates
  // removal — it does not clear on a duration timer).
  let w = mkCombat('deep-no-save', 1, 1);
  w = applyDeltas(w, [{ op: 'condition', entityId: 'party', cond: makeBleed('deep') }]);
  // With this seed the low-GRIT saves fail for at least the first two ticks.
  w = resolveCombatTurn(w, { approachTag: 'endure' }).world;
  w = resolveCombatTurn(w, { approachTag: 'endure' }).world;
  assert.ok(isBleeding(w), 'a deep bleed the player keeps failing to save against does not self-clear');
});

// ── the partyConditions op directly ──────────────────────────────────────

test('U341: partyConditions op REPLACES the player conditions array wholesale (expiry/decrement path)', () => {
  let w = mkPlayerWorld('op-replace');
  // Seed two conditions on the player.
  w = applyDeltas(w, [{ op: 'condition', entityId: 'party', cond: makeBleed('deep') }]);
  assert.equal(w.party[0].conditions.length, 1);
  // Now write a DIFFERENT array back (as the tick would after decrement/expiry):
  const replacement = [{ name: 'prone', until: 'end_of_next_turn', severity: 1 }];
  w = applyDeltas(w, [{ op: 'partyConditions', set: [{ id: 'party', conditions: replacement }] }]);
  assert.deepEqual(w.party[0].conditions.map(c => c.name), ['prone'],
    'partyConditions replaces the array — the bleeding condition is gone, prone remains');
});

test('U341: partyConditions op can EMPTY the player conditions array (bleed fully expired)', () => {
  let w = mkPlayerWorld('op-empty');
  w = applyDeltas(w, [{ op: 'condition', entityId: 'party', cond: makeBleed('shallow') }]);
  assert.equal(w.party[0].conditions.length, 1);
  w = applyDeltas(w, [{ op: 'partyConditions', set: [{ id: 'party', conditions: [] }] }]);
  assert.equal(w.party[0].conditions.length, 0, 'writing [] clears the array — "the bleed just expired"');
});

test('U341: partyConditions op resolves the "party" sentinel to party[0] and accepts single-target shape', () => {
  let w = mkPlayerWorld('op-sentinel');
  const realId = w.party[0].id; // 'party' here, but the op must resolve the sentinel generally
  w = applyDeltas(w, [{ op: 'partyConditions', entityId: 'party', conditions: [{ name: 'stunned', until: 'save_ends', severity: 1 }] }]);
  assert.equal(w.party[0].conditions[0]?.name, 'stunned', 'single-target { entityId, conditions } shape works');
  // A concrete id is passed through unchanged.
  w = applyDeltas(w, [{ op: 'partyConditions', set: [{ id: realId, conditions: [] }] }]);
  assert.equal(w.party[0].conditions.length, 0, 'concrete id targets the same entity');
});
