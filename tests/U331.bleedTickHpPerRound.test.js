// U331 — the bleed spectrum ticks the right HP/round per tier in combat.
//
// combat/bleed.js (frozen, imported not modified) defines severity = HP lost
// per round for each tier: papercut=1(no onTick, flavor-only), shallow=1,
// deep=2, severe=3, arterial=5. This test wires a bleeding enemy through the
// REAL resolveCombatTurn path (not a synthetic tickConditions() call) and
// asserts the enemy's hp drops by exactly `severity` on a tick round.
//
// LLM-off. No API key touched. Pure engine/rng.js seeded randomness.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { resolveCombatTurn } from '../engine/combat/combatResolve.js';
import { makeBleed, BLEED_TIERS } from '../engine/combat/bleed.js';

function mkPlayerWorld(seedKey) {
  let w = newWorld({ seed: `u331-${seedKey}`, fate: 0.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = ensureWorld({
    ...w,
    party: [{
      id: 'party', name: 'Adventurer', vibe: 'steady', archetype: 'wanderer',
      wounds: 0, stress: 0, resources: { Supply: 5 }, level: 5,
      stats: { MIGHT: 20, AGILITY: 14, WITS: 12, GRIT: 14, CHARM: 10 },
      inventory: { items: [] },
    }],
    scene: { location: 'test', objective: 'slay', time: 'start', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });
  return w;
}

// AC 30 so the player's attacks never land (isolates the tick's own damage
// from any player-strike damage this round).
function mkUnhittableEnemy(conditions) {
  return {
    id: 'enemy_0', name: 'Bleeding Target', hp: 200, maxHp: 200, damage: 1, ac: 30, cr: 5,
    stats: { GRIT: 10 },
    damageType: 'slashing', resistances: {}, conditionImmunities: [], conditions,
    actions: [{ name: 'Nothing', toHit: 1, damage: '1d1', type: 'slashing', range: null, save: null, conditions: [], recharge: null }],
    multiattack: null, saveProficiencies: [], canParley: false, defeated: false,
    sourceNpcId: 'npc_test', lootTableRef: null, initMod: 0
  };
}

const STANDARD_INIT = [
  { id: 'party', type: 'party', roll: 16, modifier: 2, total: 18 },
  { id: 'enemy_0', type: 'enemy', roll: 12, modifier: 3, total: 15 }
];

function mkCombat(seedKey, enemies, round = 1) {
  let w = mkPlayerWorld(seedKey);
  w = applyDeltas(w, [{
    op: 'combatState',
    set: { active: true, round, turnIndex: 0, enemies, beganAt: 0, reason: 'test', playerGuard: false, companionGuard: false, initiativeOrder: STANDARD_INIT }
  }]);
  return w;
}

for (const tier of ['shallow', 'deep', 'severe', 'arterial']) {
  test(`U331: ${tier} bleed deals severity (${BLEED_TIERS[tier].severity}) HP on its first tick round`, () => {
    const cond = makeBleed(tier);
    let w = mkCombat(`tier-${tier}`, [mkUnhittableEnemy([cond])]);
    const hpBefore = w.combat.enemies[0].hp;
    const res = resolveCombatTurn(w, { approachTag: 'endure' });
    w = res.world;
    const hpAfter = w.combat.enemies[0].hp;
    assert.equal(hpBefore - hpAfter, BLEED_TIERS[tier].severity,
      `${tier} bleed should deal exactly ${BLEED_TIERS[tier].severity} on its first tick, dealt ${hpBefore - hpAfter}`);
  });
}

test('U331: papercut bleed (onTick:null) deals zero HP — flavor only, per bleed.js contract', () => {
  const cond = makeBleed('papercut');
  assert.equal(cond.onTick, null, 'papercut has no onTick by contract');
  let w = mkCombat('papercut', [mkUnhittableEnemy([cond])]);
  const hpBefore = w.combat.enemies[0].hp;
  const res = resolveCombatTurn(w, { approachTag: 'endure' });
  w = res.world;
  const hpAfter = w.combat.enemies[0].hp;
  assert.equal(hpBefore - hpAfter, 0, 'papercut costs no HP');
});

test('U331: arterial bleed keeps dealing severity HP every round — it never self-expires (until:"permanent")', () => {
  const cond = makeBleed('arterial');
  let w = mkCombat('arterial-sustained', [mkUnhittableEnemy([cond])]);
  for (let i = 0; i < 4; i++) {
    const hpBefore = w.combat.enemies[0].hp;
    const res = resolveCombatTurn(w, { approachTag: 'endure' });
    w = res.world;
    const hpAfter = w.combat.enemies[0].hp;
    assert.equal(hpBefore - hpAfter, BLEED_TIERS.arterial.severity, `round ${i}: arterial should still deal ${BLEED_TIERS.arterial.severity}`);
  }
  assert.ok(w.combat.enemies[0].conditions.some(c => c.name === 'bleeding'), 'arterial bleed is still present after 4 rounds');
});
