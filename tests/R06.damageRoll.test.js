// R06 — Damage roll: combat damage includes gear bonus from equipped weapon.
//
// Verifies that resolveCombatTurn adds weapon damage bonus to the
// existing base + margin formula. Deterministic: scans seeds to find
// a success outcome and verifies the damage dealt.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { resolveCombatTurn } from '../engine/combat/combatResolve.js';
import { computeAttack } from '../engine/gear/gearProps.js';

function mkCombatWorld(seedKey, items = []) {
  let w = newWorld({ seed: `r06-${seedKey}`, fate: 0.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = ensureWorld({
    ...w,
    party: [{
      id: 'party', name: 'Hero', vibe: 'steady', archetype: 'wanderer',
      wounds: 0, stress: 0, resources: { Supply: 5 },
      stats: { MIGHT: 14, AGILITY: 14, WITS: 10, GRIT: 10, CHARM: 10 },
      inventory: { items }
    }],
    scene: { location: 'arena', objective: 'win', time: 'start', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });
  return w;
}

function mkEnemy(over = {}) {
  return {
    id: 'enemy_0', name: 'Thug', hp: 30, maxHp: 30,
    damage: 1, canParley: true, defeated: false,
    sourceNpcId: 'npc_test_0', ...over
  };
}

function startCombat(world, enemies) {
  return applyDeltas(world, [{
    op: 'combatState',
    set: { active: true, round: 1, turnIndex: 0, enemies, beganAt: 0, reason: 'test', playerGuard: false }
  }]);
}

function findForceSuccess(world, max = 80) {
  for (let i = 0; i < max; i++) {
    const w = ensureWorld({ ...world, scene: { ...world.scene, promptSeed: `${world.scene.promptSeed || '0'}-${i}` } });
    const move = { actorId: 'party', intentText: `attack ${i}`, approachTag: 'force', risk: 0.5, stakeTag: 'harm', targetId: 'enemy_0', toolTag: null };
    const r = resolveCombatTurn(w, move);
    if (r.result.outcome === 'success') return r;
  }
  return null;
}

test('R06-01: unarmed force success deals base damage (no weapon bonus)', () => {
  let w = mkCombatWorld('unarmed');
  w = startCombat(w, [mkEnemy()]);
  const r = findForceSuccess(w);
  assert.ok(r, 'must find a force success');
  const enemyAfter = r.world.combat.enemies[0];
  const dmgDealt = 30 - enemyAfter.hp;
  // Unarmed: MIGHT 14 → mod +2, so weapon bonus = +2
  // base 3 + floor(margin/2) + 2, clamped 1..20
  assert.ok(dmgDealt >= 1, `damage dealt ${dmgDealt} >= 1`);
  assert.ok(dmgDealt <= 20, `damage dealt ${dmgDealt} <= 20`);
  // With weapon bonus of +2, minimum is 3 + 0 + 2 = 5
  assert.ok(dmgDealt >= 5, `damage with MIGHT bonus must be >= 5, got ${dmgDealt}`);
});

test('R06-02: equipped longsword adds weapon damage bonus', () => {
  const items = [{ id: 'sword_1', defRef: 'longsword', equipped: 'main_hand' }];
  let w = mkCombatWorld('longsword', items);
  w = startCombat(w, [mkEnemy()]);

  const atk = computeAttack(w.party[0]);
  const weaponBonus = atk.damageBonus; // MIGHT mod (+2) + 0

  const r = findForceSuccess(w);
  assert.ok(r, 'must find a force success');
  const dmgDealt = 30 - r.world.combat.enemies[0].hp;
  // base 3 + floor(margin/2) + weaponBonus, clamped 1..20
  assert.ok(dmgDealt >= 3 + weaponBonus, `longsword damage ${dmgDealt} >= ${3 + weaponBonus}`);
});

test('R06-03: magic weapon bonus adds to damage', () => {
  const items = [{ id: 'msword', defRef: 'longsword_magic_1', equipped: 'main_hand' }];
  let w = mkCombatWorld('magic', items);
  w = startCombat(w, [mkEnemy()]);

  const atk = computeAttack(w.party[0]);
  // MIGHT 14 → mod +2, magic bonus +1 → damageBonus = 3
  assert.equal(atk.damageBonus, 3);

  const r = findForceSuccess(w);
  assert.ok(r, 'must find a force success');
  const dmgDealt = 30 - r.world.combat.enemies[0].hp;
  // base 3 + floor(margin/2) + 3, clamped 1..20 → min 6
  assert.ok(dmgDealt >= 6, `magic weapon damage ${dmgDealt} >= 6`);
});

test('R06-04: finesse approach also gets weapon bonus', () => {
  const items = [{ id: 'ss', defRef: 'shortsword', equipped: 'main_hand' }];
  let w = mkCombatWorld('finesse', items);
  w = startCombat(w, [mkEnemy()]);

  // Find finesse success
  for (let i = 0; i < 80; i++) {
    const wt = ensureWorld({ ...w, scene: { ...w.scene, promptSeed: `fin-${i}` } });
    const move = { actorId: 'party', intentText: `finesse ${i}`, approachTag: 'finesse', risk: 0.5, stakeTag: 'harm', targetId: 'enemy_0', toolTag: null };
    const r = resolveCombatTurn(wt, move);
    if (r.result.outcome === 'success') {
      const dmgDealt = 30 - r.world.combat.enemies[0].hp;
      const atk = computeAttack(wt.party[0]);
      // finesse base 2 + margin/2 + weaponBonus
      assert.ok(dmgDealt >= 2 + atk.damageBonus, `finesse damage ${dmgDealt} >= ${2 + atk.damageBonus}`);
      return;
    }
  }
  assert.fail('must find a finesse success within 80 seeds');
});
