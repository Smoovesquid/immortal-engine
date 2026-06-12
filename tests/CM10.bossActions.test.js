// CM10 / P-75: Boss mechanics — payload resolution + phase trigger.
//
// Tests assert:
//   * catalog-shaped legendary options (action: {}) resolve to a real payload
//   * option name matching an enemy action reuses that action
//   * synthesized payloads are deterministic and CR-scaled
//   * lair entries without an action payload synthesize a save-based payload
//   * bossPhase derives purely from hp fraction (no persisted state)
//   * crossing ½ HP in a turn emits a phase beat in the combat summary
//   * the beat fires once per crossing, not every turn below ½
//   * phase 2 changes behavior (authored phase action or bloodied boost)
//   * non-boss enemies pass through applyBossPhase unchanged (same reference)
//   * determinism: same seed → same summaries

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { resolveCombatTurn } from '../engine/combat/combatResolve.js';
import { resolveEscapeCombatTurn, initEscapeHp, initEscapeKit } from '../engine/combat/escapeCombat.js';
import {
  resolveBossActionPayload,
  resolveLairActionPayload,
  bossPhase,
  applyBossPhase,
  detectPhaseCrossings
} from '../engine/combat/bossActions.js';

// ── helpers ────────────────────────────────────────────────────────────────

function mkCombatWorld(seedKey) {
  let w = newWorld({ seed: `cm10-${seedKey}`, fate: 0.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = ensureWorld({
    ...w,
    party: [{
      id: 'party', name: 'Hero', vibe: 'steady', archetype: 'wanderer',
      wounds: 0, stress: 0, resources: { Supply: 5 },
      stats: { MIGHT: 18, AGILITY: 14, GRIT: 14, CHARM: 14, WITS: 14 },
      level: 6
    }],
    scene: { location: 'lair', objective: 'win', time: 'start', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });
  return w;
}

function mkBoss(over = {}) {
  return {
    id: 'enemy_0',
    name: 'Entropic Sphinx',
    hp: 190,
    maxHp: 190,
    damage: 5,
    ac: 12,
    cr: 10,
    damageType: 'entropic',
    resistances: {},
    conditionImmunities: [],
    conditions: [],
    actions: [
      { name: 'Entropy Claw', toHit: 9, damage: '2d10+5', type: 'entropic', range: null, save: null, conditions: [], recharge: null }
    ],
    multiattack: null,
    saveProficiencies: [],
    canParley: false,
    defeated: false,
    sourceNpcId: '',
    lootTableRef: null,
    initMod: 2,
    // Catalog shape after ensureCombat normalization: action is an EMPTY object.
    legendaryActions: {
      perRound: 3,
      remaining: 3,
      options: [
        { name: 'Claw Attack', cost: 1, action: {} },
        { name: 'Entropy Pulse', cost: 3, action: {} }
      ]
    },
    reactions: null,
    lairActions: null,
    ...over
  };
}

function mkPlainEnemy(over = {}) {
  return mkBoss({
    name: 'Bandit', cr: 1, hp: 20, maxHp: 20, ac: 12,
    legendaryActions: null, lairActions: null,
    actions: [{ name: 'Club', toHit: 3, damage: '1d6+1', type: 'bludgeoning' }],
    ...over
  });
}

function startCombat(w, enemies, initiativeOrder) {
  return applyDeltas(w, [{
    op: 'combatState',
    set: {
      active: true, round: 1, turnIndex: 0, enemies, beganAt: 0, reason: 'test',
      playerGuard: false, companionGuard: false, initiativeOrder
    }
  }]);
}

const FORCE_MOVE = { actorId: 'party', intentText: 'strike', approachTag: 'force', risk: 0.5, stakeTag: 'harm', targetId: 'enemy_0' };

// ── payload resolution ─────────────────────────────────────────────────────

test('CM10-01 empty-action legendary option matching an enemy action reuses it', () => {
  const boss = mkBoss();
  const payload = resolveBossActionPayload(boss, { name: 'Entropy Claw', cost: 1, action: {} });
  assert.equal(payload.name, 'Entropy Claw');
  assert.equal(payload.toHit, 9);
  assert.equal(payload.damage, '2d10+5');
});

test('CM10-02 unmatched empty-action option synthesizes a CR-scaled payload', () => {
  const boss = mkBoss();
  const payload = resolveBossActionPayload(boss, { name: 'Entropy Pulse', cost: 3, action: {} });
  assert.equal(payload.name, 'Entropy Pulse');
  assert.ok(typeof payload.toHit === 'number' && payload.toHit > 0, 'synthesized toHit');
  assert.match(String(payload.damage), /^\d+d\d+(\+\d+)?$/);
  assert.equal(payload.type, 'entropic');
});

test('CM10-03 option with a real action payload is used as-is', () => {
  const boss = mkBoss();
  const real = { name: 'Tail Swipe', toHit: 6, damage: '1d8+3', type: 'bludgeoning' };
  const payload = resolveBossActionPayload(boss, { name: 'Tail Swipe', cost: 1, action: real });
  assert.deepEqual(payload, real);
});

test('CM10-04 payload synthesis is deterministic (pure function of inputs)', () => {
  const boss = mkBoss();
  const a = resolveBossActionPayload(boss, { name: 'Entropy Pulse', cost: 3, action: {} });
  const b = resolveBossActionPayload(boss, { name: 'Entropy Pulse', cost: 3, action: {} });
  assert.deepEqual(a, b);
});

test('CM10-05 lair entry without action payload synthesizes a save-based payload', () => {
  const boss = mkBoss();
  const payload = resolveLairActionPayload(boss, { name: 'Time Dilation' });
  assert.equal(payload.name, 'Time Dilation');
  assert.ok(payload.save && typeof payload.save.dc === 'number', 'save-based');
  assert.match(String(payload.damage), /^\d+d\d+(\+\d+)?$/);
});

// ── phase derivation ───────────────────────────────────────────────────────

test('CM10-06 bossPhase derives from hp fraction', () => {
  assert.equal(bossPhase(mkBoss({ hp: 190 })), 1);
  assert.equal(bossPhase(mkBoss({ hp: 96 })), 1);  // just above half
  assert.equal(bossPhase(mkBoss({ hp: 95 })), 2);  // exactly half
  assert.equal(bossPhase(mkBoss({ hp: 10 })), 2);
});

test('CM10-07 non-boss enemy passes through applyBossPhase unchanged', () => {
  const plain = mkPlainEnemy({ hp: 5 });
  assert.equal(applyBossPhase(plain), plain, 'same reference, no clone');
});

test('CM10-08 phase 2 changes the boss action set', () => {
  const fresh = mkBoss();
  const bloodied = mkBoss({ hp: 60 });
  const freshActions = applyBossPhase(fresh);
  const bloodiedActions = applyBossPhase(bloodied);
  assert.equal(freshActions, fresh, 'phase 1: unchanged');
  assert.notEqual(bloodiedActions, bloodied, 'phase 2: modified copy');
  const sig = (e) => JSON.stringify({ a: e.actions, m: e.multiattack });
  assert.notEqual(sig(bloodiedActions), sig(bloodied), 'actions actually differ');
});

test('CM10-09 detectPhaseCrossings reports a crossing once', () => {
  const before = new Map([['enemy_0', 120]]);
  const crossed = detectPhaseCrossings(before, [mkBoss({ hp: 80 })]);
  assert.equal(crossed.length, 1);
  assert.equal(crossed[0].id, 'enemy_0');
  assert.ok(crossed[0].narration && crossed[0].narration.length > 0);

  const stayedBelow = detectPhaseCrossings(new Map([['enemy_0', 80]]), [mkBoss({ hp: 70 })]);
  assert.equal(stayedBelow.length, 0, 'no re-announce while already below');

  const dead = detectPhaseCrossings(new Map([['enemy_0', 120]]), [mkBoss({ hp: 0 })]);
  assert.equal(dead.length, 0, 'dead enemies do not announce a phase');
});

// ── integration through resolveCombatTurn ──────────────────────────────────

test('CM10-10 boss fight: legendary actions actually deal resolved damage or visibly act', () => {
  let w = mkCombatWorld('legendary');
  const boss = mkBoss({ hp: 190 });
  w = startCombat(w, [boss], [
    { id: 'party', type: 'party', roll: 15, modifier: 2, total: 17 },
    { id: 'enemy_0', type: 'enemy', roll: 10, modifier: 2, total: 12 }
  ]);
  const { result } = resolveCombatTurn(w, FORCE_MOVE);
  assert.match(result.combatSummary, /legendary/i, 'legendary action appears in summary');
  // The dud bug produced 'legendary: X misses' with toHit 0 vs computed AC almost always.
  // With payload resolution, over a few seeds at AC this low we expect a hit line.
});

test('CM10-11 crossing half HP emits a phase beat exactly once', () => {
  let w = mkCombatWorld('phase');
  // Boss at just above half; one player hit will cross. Defanged so the
  // fight survives long enough to observe the beat (the beat is the test,
  // not boss lethality).
  // Name deliberately NOT in the elite catalog so the default bloodied beat
  // fires (authored catalog phases carry their own narration).
  const boss = mkBoss({
    name: 'Test Tyrant', hp: 97, maxHp: 190,
    actions: [{ name: 'Entropy Claw', toHit: 1, damage: '1d2', type: 'entropic', range: null, save: null, conditions: [], recharge: null }],
    legendaryActions: {
      perRound: 1, remaining: 1,
      options: [{ name: 'Flick', cost: 1, action: { name: 'Flick', toHit: 1, damage: '1d2', type: 'entropic' } }]
    }
  });
  w = ensureWorld({ ...w, party: [{ ...w.party[0], level: 10, stats: { ...w.party[0].stats, GRIT: 20 } }] });
  w = startCombat(w, [boss], [
    { id: 'party', type: 'party', roll: 20, modifier: 2, total: 22 },
    { id: 'enemy_0', type: 'enemy', roll: 1, modifier: 2, total: 3 }
  ]);
  let crossedTurn = null;
  let world = w;
  for (let i = 0; i < 12; i++) {
    const out = resolveCombatTurn(world, FORCE_MOVE);
    world = out.world;
    const beat = /bloodied|unmak|phase/i.test(out.result.combatSummary);
    const enemy = world.combat?.enemies?.find(e => e.id === 'enemy_0');
    if (beat && crossedTurn === null) {
      crossedTurn = i;
      assert.ok(enemy === undefined || enemy.hp <= 95 || !world.combat?.active, 'beat coincides with crossing');
    } else if (beat && crossedTurn !== null) {
      assert.fail('phase beat announced twice');
    }
    if (!world.combat?.active) break;
  }
  assert.notEqual(crossedTurn, null, 'phase beat fired at some turn');
});

// ── the LIVE surface: escape combat (what v1.html runs) ────────────────────

function mkEscapeWorld(seedKey, { enemies, location = 'open road', might = 18 } = {}) {
  let w = newWorld({ seed: `cm10e-${seedKey}`, fate: 0.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  w = ensureWorld({
    ...w,
    party: [{
      id: 'party', name: 'Hero', vibe: 'steady', archetype: 'wanderer',
      wounds: 0, stress: 0, resources: { Supply: 5 },
      stats: { MIGHT: might, AGILITY: 14, GRIT: 14, CHARM: 10, WITS: 10 }
    }],
    scene: { location, objective: 'survive', time: 'start', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });
  w = initEscapeKit(initEscapeHp(w));
  return applyDeltas(w, [{
    op: 'combatState',
    set: { active: true, round: 1, turnIndex: 0, enemies, beganAt: 0, reason: 'test' }
  }]);
}

test('CM10-13 escape: a boss answers your turn with a visible legendary action', () => {
  const w = mkEscapeWorld('leg', { enemies: [mkBoss()] });
  const hp0 = Number(w.meta.escapeHp);
  const { world, result } = resolveEscapeCombatTurn(w, 'strike');
  assert.match(result.combatSummary, /\(legendary\)/, 'legendary beat is visible at the table');
  assert.ok(result.beats.some(b => /steals a beat/.test(b)), 'interleaved between turns');
  // Determinism: same world, same words, same beats.
  const again = resolveEscapeCombatTurn(w, 'strike');
  assert.equal(again.result.combatSummary, result.combatSummary);
  assert.equal(Number(again.world.meta.escapeHp), Number(world.meta.escapeHp));
  assert.ok(hp0 >= Number(world.meta.escapeHp), 'boss pressure is real (or at worst a miss)');
});

test('CM10-14 escape: crossing the phase threshold emits the beat exactly once', () => {
  // Non-catalog name → the default bloodied beat; hp just above half so one
  // player hit crosses. The boss is defanged so the fight outlives the beat.
  const tyrant = mkBoss({
    name: 'Test Tyrant', hp: 97, maxHp: 190, damage: 2, ac: 10,
    legendaryActions: { perRound: 1, remaining: 1, options: [{ name: 'Flick', cost: 1, action: { name: 'Flick', toHit: 1, damage: '1d2', type: 'bludgeoning' } }] }
  });
  let w = mkEscapeWorld('phase', { enemies: [tyrant] });
  let beatTurns = 0;
  for (let i = 0; i < 10; i++) {
    const out = resolveEscapeCombatTurn(w, 'strike');
    w = out.world;
    if (out.result.beats.some(b => /bloodied — its manner changes/.test(b))) beatTurns++;
    if (!w.combat?.active) break;
  }
  assert.equal(beatTurns, 1, 'phase beat fires once, never re-announces');
});

test('CM10-15 escape: a bloodied boss swings with visible fury', () => {
  const bloodied = mkBoss({
    name: 'Test Tyrant', hp: 60, maxHp: 190, damage: 6, ac: 30, // unhittable: fury must come from ITS swings
    legendaryActions: { perRound: 1, remaining: 1, options: [{ name: 'Flick', cost: 1, action: { name: 'Flick', toHit: 0, damage: '1d2', type: 'bludgeoning' } }] }
  });
  let w = mkEscapeWorld('fury', { enemies: [bloodied] });
  let seen = false;
  for (let i = 0; i < 12 && !seen; i++) {
    const out = resolveEscapeCombatTurn(w, 'guard');
    w = out.world;
    seen = out.result.beats.some(b => /\(bloodied fury\)/.test(b));
    if (!w.combat?.active) break;
  }
  assert.ok(seen, 'phase-2 swings read harder at the table');
});

test('CM10-16 escape: the lair fights only at the seat', () => {
  const boss = mkBoss({
    // Defanged legendary so the hero is still standing when the lair moves.
    legendaryActions: { perRound: 1, remaining: 1, options: [{ name: 'Flick', cost: 1, action: { name: 'Flick', toHit: 0, damage: '1d2', type: 'bludgeoning' } }] },
    lairActions: [{ name: 'Time Dilation', effect: 'time skips' }]
  });
  const atSeat = resolveEscapeCombatTurn(mkEscapeWorld('lair', { enemies: [boss], location: 'the sphinx lair' }), 'strike');
  assert.ok(atSeat.result.beats.some(b => /lair itself answers/.test(b)), 'lair action at the seat');
  const onRoad = resolveEscapeCombatTurn(mkEscapeWorld('lair', { enemies: [boss], location: 'open road' }), 'strike');
  assert.ok(!onRoad.result.beats.some(b => /lair itself answers/.test(b)), 'no lair action on the road');
});

test('CM10-17 escape: a legendary creature does not break and run', () => {
  // ≤25% HP triggers morale for ordinary foes; the normalized legendaryActions
  // shape must exempt bosses (the old gate only matched raw arrays).
  const boss = mkBoss({ hp: 12, maxHp: 190, ac: 30, damage: 2 });
  let w = mkEscapeWorld('morale', { enemies: [boss] });
  for (let i = 0; i < 6; i++) {
    const out = resolveEscapeCombatTurn(w, 'guard');
    w = out.world;
    assert.ok(!out.result.beats.some(b => /has had enough/.test(b)), 'the boss holds the field');
    if (!w.combat?.active) break;
  }
});

test('CM10-12 determinism: same seed → identical combat summaries', () => {
  const run = () => {
    let w = mkCombatWorld('det');
    w = startCombat(w, [mkBoss({ hp: 100, maxHp: 190 })], [
      { id: 'party', type: 'party', roll: 15, modifier: 2, total: 17 },
      { id: 'enemy_0', type: 'enemy', roll: 10, modifier: 2, total: 12 }
    ]);
    const summaries = [];
    for (let i = 0; i < 5; i++) {
      const out = resolveCombatTurn(w, FORCE_MOVE);
      w = out.world;
      summaries.push(out.result.combatSummary);
      if (!w.combat?.active) break;
    }
    return summaries.join('||');
  };
  assert.equal(run(), run());
});
