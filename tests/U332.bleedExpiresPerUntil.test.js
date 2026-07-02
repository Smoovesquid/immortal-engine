// U332 — bleed expires per its `until`; a passed save ends a save_ends bleed.
//
// combat/bleed.js: shallow=until:2 (rounds), deep/severe=until:'save_ends'
// (GRIT save), arterial=until:'permanent' (covered in U331). A raw numeric
// `until` (shallow's 2) is a DURATION — the pre-existing tickConditions
// contract (CM02.conditions.test.js, UX5.edgeProbes.test.js P3-02/P3-03)
// treats a numeric `until` as an ABSOLUTE round. tickConditions (bleed.js
// scoped, via the `bleedTier` marker) self-anchors a bleed's numeric
// duration to an absolute round on its OWN first tick — the general
// contract used by every other caller is untouched. This test proves the
// anchored bleed actually expires after the tier's stated round count,
// applied mid-fight (round 9, not round 1) so the anchoring bug — a raw
// `until:2` reading as "already past" the moment combat.round is already
// beyond 2 — cannot hide.
//
// LLM-off.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { resolveCombatTurn } from '../engine/combat/combatResolve.js';
import { makeBleed, BLEED_TIERS } from '../engine/combat/bleed.js';

function mkPlayerWorld(seedKey) {
  let w = newWorld({ seed: `u332-${seedKey}`, fate: 0.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
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

function mkUnhittableEnemy(conditions, grit = 10) {
  return {
    id: 'enemy_0', name: 'Bleeding Target', hp: 200, maxHp: 200, damage: 1, ac: 30, cr: 5,
    stats: { GRIT: grit },
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

test('U332: shallow bleed (until:2, a DURATION) applied mid-fight expires after exactly 2 tick-rounds, not immediately', () => {
  // Round 9 — deliberately well past the raw "2" so a pre-anchoring bug
  // (reading until:2 as an absolute round already behind combat.round) would
  // make this fail differently: the condition would vanish before dealing
  // any damage at all, or after exactly 1 tick instead of 2.
  let w = mkCombat('shallow-mid', [mkUnhittableEnemy([makeBleed('shallow')])], 9);
  const rounds = [];
  for (let i = 0; i < 4; i++) {
    const hpBefore = w.combat.enemies[0].hp;
    const condsBefore = w.combat.enemies[0].conditions.length;
    const res = resolveCombatTurn(w, { approachTag: 'endure' });
    w = res.world;
    const hpAfter = w.combat.enemies[0].hp;
    rounds.push({ dmg: hpBefore - hpAfter, hadCondition: condsBefore > 0 });
  }
  const dmgRounds = rounds.filter(r => r.dmg > 0);
  assert.equal(dmgRounds.length, 2, `shallow bleed should tick exactly 2 times, ticked ${dmgRounds.length}: ${JSON.stringify(rounds)}`);
  assert.equal(w.combat.enemies[0].conditions.length, 0, 'shallow bleed is gone after its 2 rounds');
});

test('U332: deep bleed (save_ends, GRIT DC 11) — a passed save ends it before more damage', () => {
  // High GRIT (statMod comfortably positive) across many seeds should save
  // quickly; confirm at least one seed clears it in <= 3 rounds and, once
  // saved, no further tick damage occurs.
  let cleared = false;
  for (let seedI = 0; seedI < 20 && !cleared; seedI++) {
    let w = mkCombat(`deep-save-${seedI}`, [mkUnhittableEnemy([makeBleed('deep')], 20)]); // GRIT 20 -> big + mod
    let sawZeroConditions = false;
    let dmgAfterClear = 0;
    for (let i = 0; i < 6; i++) {
      const res = resolveCombatTurn(w, { approachTag: 'endure' });
      const hpBefore = w.combat.enemies[0].hp;
      w = res.world;
      const hpAfter = w.combat.enemies[0].hp;
      const hasBleed = w.combat.enemies[0].conditions.some(c => c.name === 'bleeding');
      if (!hasBleed && !sawZeroConditions) { sawZeroConditions = true; }
      else if (sawZeroConditions && hpBefore - hpAfter > 0) { dmgAfterClear += (hpBefore - hpAfter); }
    }
    if (sawZeroConditions) {
      cleared = true;
      assert.equal(dmgAfterClear, 0, 'no bleed damage should occur after the save cleared it');
    }
  }
  assert.ok(cleared, 'expected at least one seed (of 20) to save off a GRIT-20 deep bleed within 6 rounds');
});

test('U332: deep bleed always deals its first-tick damage before any save can end it that same round', () => {
  // The save is rolled the SAME tick it could end the condition, but
  // tr.damage is computed before the save/removal check — so round 1 always
  // costs the full severity regardless of how the save eventually goes.
  // True across GRIT extremes (high roughly-always-saves-eventually and low
  // rarely-saves), which is the deterministic, non-probabilistic part of the
  // save_ends contract worth pinning down.
  for (const grit of [3, 10, 20]) {
    let w = mkCombat(`deep-first-tick-grit${grit}`, [mkUnhittableEnemy([makeBleed('deep')], grit)]);
    const hpBefore = w.combat.enemies[0].hp;
    const res = resolveCombatTurn(w, { approachTag: 'endure' });
    w = res.world;
    const hpAfter = w.combat.enemies[0].hp;
    assert.equal(hpBefore - hpAfter, BLEED_TIERS.deep.severity, `GRIT ${grit}: first tick should always deal deep's severity regardless of the save roll`);
  }
});

test('U332: a low-GRIT target (statMod deeply negative) fails its DC-11 save far more often than it passes across many seeds', () => {
  // GRIT 3 -> statMod -4 -> needs roll >= 15 on a d20 (~30% per round). Over
  // 40 independent seeds, most single-round saves should fail; this is the
  // probabilistic half of save_ends, sampled rather than pinned to one seed.
  let failedFirstRound = 0;
  const N = 40;
  for (let i = 0; i < N; i++) {
    let w = mkCombat(`deep-lowgrit-${i}`, [mkUnhittableEnemy([makeBleed('deep')], 3)]);
    const res = resolveCombatTurn(w, { approachTag: 'endure' });
    w = res.world;
    const stillBleeding = w.combat.enemies[0].conditions.some(c => c.name === 'bleeding');
    if (stillBleeding) failedFirstRound++;
  }
  assert.ok(failedFirstRound >= N * 0.5, `expected most (>=50%) of ${N} GRIT-3 targets to still be bleeding after round 1 (~30% save chance), got ${failedFirstRound}/${N}`);
});
