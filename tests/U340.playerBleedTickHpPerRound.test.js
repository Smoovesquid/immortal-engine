// U340 — the PLAYER side of the bleed spectrum ticks the right HP/round.
//
// Sibling of U331 (which proves the ENEMY tick). combat/bleed.js (frozen)
// defines severity = HP lost per round per tier: papercut=1(no onTick,
// flavor-only), shallow=1, deep=2, severe=3, arterial=5. A bleeding condition
// on the player must lose exactly `severity` off the player's live-HP track
// each round it ticks.
//
// We measure in ESCAPE MODE, where live HP is meta.escapeHp. That is the clean
// channel: in combatResolve.js the ONLY writer of meta.escapeHp is the
// player-bleed tick, so the delta on escapeHp is the bleed's contribution
// alone — the tactical engine's enemy-strike damage lands on party.wounds and
// cannot contaminate the reading. (The wound-track branch is exercised by
// U341's lifecycle + U342's determinism replay.)
//
// LLM-off. No API key touched. Pure engine/rng.js seeded randomness.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { resolveCombatTurn } from '../engine/combat/combatResolve.js';
import { makeBleed, BLEED_TIERS } from '../engine/combat/bleed.js';

function mkPlayerWorld(seedKey) {
  let w = newWorld({ seed: `u340-${seedKey}`, fate: 0.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = ensureWorld({
    ...w,
    // Escape mode: live HP tracked on meta.escapeHp (NOT party.wounds).
    meta: { ...w.meta, mode: 'escape', escapeHp: 100, escapeMaxHp: 100 },
    party: [{
      id: 'party', name: 'Adventurer', vibe: 'steady', archetype: 'wanderer',
      wounds: 0, stress: 0, resources: { Supply: 5 }, level: 5,
      stats: { MIGHT: 12, AGILITY: 12, WITS: 12, GRIT: 12, CHARM: 10 },
      inventory: { items: [] }, conditions: [],
    }],
    scene: { location: 'test', objective: 'flee', time: 'start', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });
  return w;
}

// A harmless enemy that just keeps the fight active. Even if its strike lands,
// enemy damage in combatResolve goes to party.wounds — never to meta.escapeHp,
// which in combatResolve is written ONLY by the player-bleed tick. So the
// escapeHp delta we read is the bleed's contribution alone, uncontaminated.
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

function mkCombat(seedKey, round = 1) {
  let w = mkPlayerWorld(seedKey);
  w = applyDeltas(w, [{
    op: 'combatState',
    set: { active: true, round, turnIndex: 0, enemies: [mkEnemy()], beganAt: 0, reason: 'test', playerGuard: false, companionGuard: false, initiativeOrder: STANDARD_INIT }
  }]);
  return w;
}

for (const tier of ['shallow', 'deep', 'severe', 'arterial']) {
  test(`U340: a ${tier} bleed on the player costs severity (${BLEED_TIERS[tier].severity}) HP on its first tick round`, () => {
    let w = mkCombat(`tier-${tier}`);
    w = applyDeltas(w, [{ op: 'condition', entityId: 'party', cond: makeBleed(tier, 'monster-claw') }]);
    const hpBefore = w.meta.escapeHp;
    w = resolveCombatTurn(w, { approachTag: 'endure' }).world;
    assert.equal(hpBefore - w.meta.escapeHp, BLEED_TIERS[tier].severity,
      `${tier} player-bleed should cost exactly ${BLEED_TIERS[tier].severity} escapeHp on its first tick — proving HP comes off the escape track, not the wound path`);
  });
}

test('U340: a papercut on the player (onTick:null) costs zero HP — flavor only, per bleed.js contract', () => {
  const cond = makeBleed('papercut');
  assert.equal(cond.onTick, null, 'papercut has no onTick by contract');
  let w = mkCombat('papercut');
  w = applyDeltas(w, [{ op: 'condition', entityId: 'party', cond }]);
  const hpBefore = w.meta.escapeHp;
  w = resolveCombatTurn(w, { approachTag: 'endure' }).world;
  assert.equal(hpBefore - w.meta.escapeHp, 0, 'papercut costs no HP');
});

test('U340: an arterial player-bleed keeps costing severity HP every round — it never self-expires', () => {
  let w = mkCombat('arterial-sustained');
  w = applyDeltas(w, [{ op: 'condition', entityId: 'party', cond: makeBleed('arterial') }]);
  for (let i = 0; i < 4; i++) {
    const hpBefore = w.meta.escapeHp;
    w = resolveCombatTurn(w, { approachTag: 'endure' }).world;
    assert.equal(hpBefore - w.meta.escapeHp, BLEED_TIERS.arterial.severity,
      `round ${i}: arterial should still cost ${BLEED_TIERS.arterial.severity} escapeHp`);
  }
  assert.ok(w.party[0].conditions.some(c => c.name === 'bleeding'), 'arterial player-bleed is still present after 4 rounds');
});
