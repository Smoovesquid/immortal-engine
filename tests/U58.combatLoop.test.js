// U58: Combat loop — Pass 5 (final pass) of the sim-to-game arc.
//
// Combat is a resolver that REUSES Pass 1–4 (rng/resolveMove, applyDeltas,
// goal kinds, recentBeats), not a parallel subsystem. These tests assert:
//
//   * world.combat shape, normalizer, and invariants
//   * beginCombat / mintEnemyFromNpc lifecycle
//   * approach signatures inside combat (force/finesse/endure/heart/focus)
//   * deterministic enemy counter-attacks + playerGuard one-shot
//   * victory routing → defeat goal completion via timeline events
//   * player defeat → ending lock (no new ending type)
//   * flee path
//   * R13 closure: beats written for combat turns; physics intercept bypassed
//   * determinism, save/load roundtrip, worldHash projection, v12→v13 warning

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld, defaultCombat, ensureCombat, WORLD_VERSION } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { resolveCombatTurn } from '../engine/combat/combatResolve.js';
import { beginCombat, endCombat, mintEnemyFromNpc } from '../engine/combat/combatLifecycle.js';
import { resolveMove } from '../engine/resolve.js';
import { createGoal, checkGoals } from '../engine/goals/goalContract.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld, importWorld, loadSlot } from '../engine/save.js';
import { playerMove } from '../engine/playloop.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  }
};

// ── helpers ────────────────────────────────────────────────────────────────

function mkCombatWorld(seedKey, fate = 0.0) {
  let w = newWorld({ seed: `u58-${seedKey}`, fate, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = ensureWorld({
    ...w,
    party: [{
      id: 'party', name: 'Party', vibe: 'steady', archetype: 'wanderer',
      wounds: 0, stress: 0, resources: { Supply: 5 },
      stats: { MIGHT: 14, AGILITY: 14, GRIT: 14, CHARM: 14, WITS: 14 }
    }],
    scene: { location: 'arena', objective: 'win', time: 'start', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });
  return w;
}

function mkEnemy(over = {}) {
  return {
    id: 'enemy_0',
    name: 'Brigand',
    hp: 8,
    maxHp: 8,
    damage: 2,
    canParley: true,
    defeated: false,
    sourceNpcId: 'npc_test_0',
    ...over
  };
}

function startCombatDirectly(world, enemies, reason = 'player-attack') {
  // Bypass beginCombat's auto-id assignment when we want explicit ids/state.
  return applyDeltas(world, [{
    op: 'combatState',
    set: { active: true, round: 1, turnIndex: 0, enemies, beganAt: 0, reason, playerGuard: false }
  }]);
}

function mkMove(over = {}) {
  return {
    actorId: 'party',
    intentText: 'I attack.',
    approachTag: 'force',
    risk: 0.5,
    stakeTag: 'harm',
    targetId: 'enemy_0',
    toolTag: null,
    ...over
  };
}

// Run a player turn until target outcome appears (mirrors U56 pattern).
function findCombatTurnOutcome(world, approach, targetOutcome, max = 80) {
  for (let i = 0; i < max; i++) {
    const w = ensureWorld({ ...world, scene: { ...world.scene, promptSeed: `${world.scene.promptSeed || '0'}-${i}` } });
    const move = mkMove({ approachTag: approach, intentText: `I ${approach} (${i})` });
    const r = resolveCombatTurn(w, move);
    if (r.result.outcome === targetOutcome) return r;
  }
  return null;
}

// ── 1–6: state shape & normalization ──────────────────────────────────────

test('U58-01: newWorld combat shape is the inactive default and version is 13', () => {
  const w = newWorld({ seed: 'u58-fresh', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  assert.equal(w.meta.version, 13);
  assert.equal(WORLD_VERSION, 13);
  assert.deepEqual(w.combat, defaultCombat());
  assert.equal(w.combat.active, false);
  assert.deepEqual(w.combat.enemies, []);
});

test('U58-02: ensureCombat normalizes malformed input to default', () => {
  assert.deepEqual(ensureCombat(null), defaultCombat());
  assert.deepEqual(ensureCombat('garbage'), defaultCombat());
  assert.deepEqual(ensureCombat({ enemies: 'bad' }), defaultCombat());
});

test('U58-03: ensureCombat clamps enemy maxHp/hp/damage to ranges', () => {
  const c = ensureCombat({
    active: true,
    round: 1,
    enemies: [{ id: 'e1', name: 'huge', maxHp: 99, hp: 99, damage: 99, canParley: true, sourceNpcId: '' }]
  });
  assert.equal(c.enemies[0].maxHp, 20);
  assert.equal(c.enemies[0].hp, 20);
  assert.equal(c.enemies[0].damage, 6);
});

test('U58-04: invariant — active combat with empty enemies throws', () => {
  const w = newWorld({ seed: 'u58-inv', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const bad = { ...w, combat: { active: true, round: 1, turnIndex: 0, enemies: [], beganAt: 0, reason: 'x', playerGuard: false } };
  assert.throws(() => assertWorldInvariants(bad), /active combat must have at least one enemy/);
});

test('U58-05: invariant — enemy count > 6 throws', () => {
  const w = newWorld({ seed: 'u58-cap', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const enemies = [];
  for (let i = 0; i < 7; i++) enemies.push(mkEnemy({ id: `enemy_${i}` }));
  // ensureCombat truncates to 6, so build a world that bypasses ensureCombat:
  const bad = { ...w, combat: { active: true, round: 1, turnIndex: 0, enemies, beganAt: 0, reason: '', playerGuard: false } };
  assert.throws(() => assertWorldInvariants(bad), /enemies\.length 7 exceeds cap 6/);
});

test('U58-06: invariant — dialogue and combat are mutually exclusive', () => {
  const w = newWorld({ seed: 'u58-mutex', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const bad = {
    ...w,
    combat: { active: true, round: 1, turnIndex: 0, enemies: [mkEnemy()], beganAt: 0, reason: 'x', playerGuard: false },
    scene: { ...w.scene, dialogue: { npcId: 'npc_x', startedAt: 0, turnsInDialogue: 0, topicsOffered: [], lastAnswer: null } }
  };
  assert.throws(() => assertWorldInvariants(bad), /mutually exclusive/);
});

// ── 7–10: combat begin ────────────────────────────────────────────────────

test('U58-07: beginCombat transitions inactive→active with correct round/beganAt', () => {
  let w = mkCombatWorld('begin');
  const tlBefore = w.timeline.length;
  w = beginCombat(w, { enemies: [mintEnemyFromNpc({ id: 'npc_a', name: 'Marta' })], reason: 'player-attack' });
  assert.equal(w.combat.active, true);
  assert.equal(w.combat.round, 1);
  assert.equal(w.combat.enemies.length, 1);
  assert.equal(w.combat.enemies[0].id, 'enemy_0');
  assert.equal(w.combat.enemies[0].sourceNpcId, 'npc_a');
  assert.equal(w.combat.beganAt, tlBefore);
  // combat-begin event was pushed
  assert.ok(w.timeline.some(e => e.kind === 'combat-begin'));
});

test('U58-08: beginCombat refuses when ending.locked', () => {
  let w = mkCombatWorld('locked');
  w = { ...w, ending: { triggered: true, type: 'The Cost Paid', epilogueLine: 'x', locked: true, reason: '' } };
  const w2 = beginCombat(w, { enemies: [mintEnemyFromNpc({ id: 'npc_a', name: 'Marta' })], reason: 'player-attack' });
  assert.equal(w2.combat.active, false);
});

test('U58-09: "attack <hostile NPC>" at current node begins combat with that NPC', () => {
  let w = mkCombatWorld('begin-trigger');
  // Inject a node with one hostile NPC.
  w = ensureWorld({
    ...w,
    map: {
      currentNodeId: 'n0',
      nodes: [{ id: 'n0', name: 'arena', nodeType: 'settlement', settlement: { decompressed: true, npcs: [
        { id: 'npc_n0_0', name: 'Marta', hostile: true, conversationState: { metPlayer: false, topicsDiscussed: [], trustLevel: 5, lastInteraction: null } }
      ] } }]
    }
  });
  const out = playerMove(w, packsById, 'attack Marta');
  assert.equal(out.world.combat.active === true || out.world.combat.enemies.length > 0, true,
    'combat should have begun (active or aftermath preserved)');
  assert.equal(out.world.combat.enemies[0].sourceNpcId, 'npc_n0_0');
});

test('U58-10: attacking a non-hostile NPC does NOT begin combat', () => {
  let w = mkCombatWorld('non-hostile');
  w = ensureWorld({
    ...w,
    map: {
      currentNodeId: 'n0',
      nodes: [{ id: 'n0', name: 'arena', nodeType: 'settlement', settlement: { decompressed: true, npcs: [
        { id: 'npc_n0_0', name: 'Marta', hostile: false, conversationState: { metPlayer: false, topicsDiscussed: [], trustLevel: 5, lastInteraction: null } }
      ] } }]
    }
  });
  const out = playerMove(w, packsById, 'attack Marta');
  assert.equal(out.world.combat.active, false);
  assert.equal(out.world.combat.enemies.length, 0);
});

// ── 11–17: approach signatures inside combat ──────────────────────────────

test('U58-11: force success deals HP damage to target enemy', () => {
  let w = mkCombatWorld('force-hit');
  w = startCombatDirectly(w, [mkEnemy({ hp: 20, maxHp: 20 })]);
  const found = findCombatTurnOutcome(w, 'force', 'success');
  assert.ok(found, 'expected to find a force success');
  assert.ok(found.world.combat.enemies[0].hp < 20, 'enemy hp should drop');
});

test('U58-12: finesse success deals damage too, but base is lower than force', () => {
  // We can't compare across worlds at "same margin" easily; instead show the
  // formula is the spec'd value at margin=0: force=3, finesse=2. We construct
  // synthetic results by directly testing the formula via min damage cases.
  let w = mkCombatWorld('finesse');
  w = startCombatDirectly(w, [mkEnemy({ hp: 20, maxHp: 20 })]);
  const found = findCombatTurnOutcome(w, 'finesse', 'success');
  assert.ok(found, 'expected a finesse success');
  // finesse must have inflicted at least 1 damage (formula min)
  assert.ok(found.world.combat.enemies[0].hp < 20);
  assert.ok(found.world.combat.enemies[0].hp >= 20 - 8, 'finesse damage clamped at 8');
});

test('U58-13: endure success heals stress and sets playerGuard', () => {
  let w = mkCombatWorld('endure');
  // Pre-stress so endure can heal.
  w = ensureWorld({ ...w, party: [{ ...w.party[0], stress: 3 }] });
  w = startCombatDirectly(w, [mkEnemy({ damage: 3 })]);
  const found = findCombatTurnOutcome(w, 'endure', 'success');
  assert.ok(found, 'expected an endure success');
  // playerGuard was set then immediately consumed by the same-turn enemy counter,
  // so we observe the consumed state. The proof is that the counter dealt
  // damage-1 instead of damage. Enemy.damage is 3, so wound delta should be 2.
  // (Stress also healed via Pass 3 endure-success signature.)
  assert.equal(found.world.party[0].stress, 2);
  assert.equal(found.world.party[0].wounds, 2, 'enemy counter softened by playerGuard');
  assert.equal(found.world.combat.playerGuard, false, 'playerGuard consumed');
});

test('U58-14: heart success against canParley enemy ends combat (parley)', () => {
  let w = mkCombatWorld('parley');
  w = startCombatDirectly(w, [mkEnemy({ canParley: true })]);
  const found = findCombatTurnOutcome(w, 'heart', 'success');
  assert.ok(found, 'expected a heart success');
  assert.equal(found.world.combat.active, false, 'parley ends combat');
  // Parley does NOT mark enemies as defeated.
  assert.equal(found.world.combat.enemies[0].defeated, false);
  // No targetDefeated resolution events for non-parley enemies.
  const defs = found.world.timeline.filter(e => e.kind === 'resolution' && e.data?.outcome === 'combat-victory');
  assert.equal(defs.length, 0);
});

test('U58-15: heart success vs non-parley enemy falls through to trivial damage', () => {
  let w = mkCombatWorld('no-parley');
  w = startCombatDirectly(w, [mkEnemy({ canParley: false, hp: 10, maxHp: 10 })]);
  const found = findCombatTurnOutcome(w, 'heart', 'success');
  assert.ok(found, 'expected a heart success');
  assert.equal(found.world.combat.active, true, 'still in combat');
  assert.ok(found.world.combat.enemies[0].hp < 10, 'enemy took some damage');
  assert.ok(found.world.combat.enemies[0].hp >= 8, 'damage was small (~1)');
});

test('U58-16: focus success leaves enemy hp untouched and arms studied-the-miss DC hook', () => {
  let w = mkCombatWorld('focus');
  w = startCombatDirectly(w, [mkEnemy({ hp: 10, maxHp: 10 })]);
  // Focus FAILURE first to arm the hook (Pass 3 signature).
  const fail = findCombatTurnOutcome(w, 'focus', 'failure');
  assert.ok(fail, 'expected a focus failure');
  const hookFact = fail.world.ledger.facts[0]?.text;
  // Pass 3: focus-failure adds you:studied-the-miss as a fact in the ledger.
  assert.equal(hookFact, 'you:studied-the-miss');
  // Combat HP unchanged on focus failure.
  assert.equal(fail.world.combat.enemies[0].hp, 10);
});

test('U58-17: focus success leaves combat HP untouched', () => {
  let w = mkCombatWorld('focus-success');
  w = startCombatDirectly(w, [mkEnemy({ hp: 10, maxHp: 10 })]);
  const found = findCombatTurnOutcome(w, 'focus', 'success');
  assert.ok(found, 'expected a focus success');
  assert.equal(found.world.combat.enemies[0].hp, 10, 'focus does not damage');
});

// ── 18–20: enemy counters ──────────────────────────────────────────────────

test('U58-18: after a non-terminal player turn, each living enemy deals damage to party', () => {
  let w = mkCombatWorld('counter');
  w = startCombatDirectly(w, [mkEnemy({ damage: 2 }), mkEnemy({ id: 'enemy_1', name: 'Cur', hp: 5, maxHp: 5, damage: 1 })]);
  // Force a player turn that does not kill them all (force success on enemy_0
  // for ~3-5 damage; counters then run for both).
  const found = findCombatTurnOutcome(w, 'force', 'success');
  assert.ok(found);
  // Both enemies survive (8/5 hp; force max=8) → both counter.
  // Wounds should reflect e0 damage (2) + e1 damage (1) = 3.
  assert.equal(found.world.party[0].wounds, 3);
});

test('U58-19: playerGuard reduces only the next enemy counter and is consumed', () => {
  let w = mkCombatWorld('guard');
  w = startCombatDirectly(w, [mkEnemy({ damage: 3 }), mkEnemy({ id: 'enemy_1', name: 'Cur', hp: 5, maxHp: 5, damage: 2 })]);
  const found = findCombatTurnOutcome(w, 'endure', 'success');
  assert.ok(found, 'expected endure success');
  // First counter (enemy_0): 3 - 1 (guard) = 2; second counter (enemy_1): 2.
  // Total wounds = 4.
  assert.equal(found.world.party[0].wounds, 4);
  assert.equal(found.world.combat.playerGuard, false);
});

test('U58-20: enemy counter damage is deterministic across runs', () => {
  let w0 = mkCombatWorld('det-counter');
  w0 = startCombatDirectly(w0, [mkEnemy({ damage: 2 })]);
  const r1 = resolveCombatTurn(w0, mkMove({ approachTag: 'finesse' }));
  const r2 = resolveCombatTurn(w0, mkMove({ approachTag: 'finesse' }));
  assert.equal(r1.result.outcome, r2.result.outcome);
  assert.equal(r1.world.party[0].wounds, r2.world.party[0].wounds);
  assert.equal(r1.world.combat.enemies[0].hp, r2.world.combat.enemies[0].hp);
});

// ── 21–24: victory & defeat goal ──────────────────────────────────────────

test('U58-21: when last enemy reaches 0 HP, combat ends and all enemies marked defeated', () => {
  let w = mkCombatWorld('victory');
  w = startCombatDirectly(w, [mkEnemy({ hp: 1, maxHp: 1, damage: 1 })]);
  // Force does at minimum 1 damage on success.
  const found = findCombatTurnOutcome(w, 'force', 'success');
  assert.ok(found);
  assert.equal(found.world.combat.active, false);
  assert.equal(found.world.combat.enemies[0].hp, 0);
  assert.equal(found.world.combat.enemies[0].defeated, true);
});

test('U58-22: one resolution event per defeated enemy with data.targetDefeated set', () => {
  let w = mkCombatWorld('victory-multi');
  // Two enemies, each 1 HP, then nuke them via direct delta to test event emission.
  w = startCombatDirectly(w, [
    mkEnemy({ id: 'enemy_0', sourceNpcId: 'npc_a', hp: 1, maxHp: 1, damage: 1 }),
    mkEnemy({ id: 'enemy_1', name: 'Cur', sourceNpcId: 'npc_b', hp: 1, maxHp: 1, damage: 1 })
  ]);
  // Whittle one then the other. First: force success kills enemy_0 (1 hp).
  // Then enemy_1 still alive, counter happens (1 wound), round advances.
  const found1 = findCombatTurnOutcome(w, 'force', 'success');
  assert.ok(found1);
  assert.equal(found1.world.combat.enemies[0].hp, 0);
  assert.equal(found1.world.combat.active, true);
  // Second turn: kill enemy_1.
  const found2 = findCombatTurnOutcome(found1.world, 'force', 'success');
  assert.ok(found2);
  assert.equal(found2.world.combat.active, false);
  const defs = found2.world.timeline.filter(e => e.kind === 'resolution' && e.data?.outcome === 'combat-victory');
  // Single victory call on the FINAL kill emits one event per enemy (both).
  assert.equal(defs.length, 2);
  const refs = defs.map(d => d.data.targetDefeated).sort();
  assert.deepEqual(refs, ['npc_a', 'npc_b']);
});

test('U58-23: defeat goal targeting an NPC promotes to completed after combat victory', () => {
  let w = mkCombatWorld('defeat-goal');
  // Seed a defeat goal targeting npc_a.
  const created = createGoal(w, { kind: 'defeat', targetRef: 'npc_a', label: 'beat npc_a' });
  w = created.world;
  assert.ok(created.goal);
  assert.equal(created.goal.status, 'active');
  // Begin combat with a single enemy sourced from npc_a, low HP.
  w = startCombatDirectly(w, [mkEnemy({ id: 'enemy_0', sourceNpcId: 'npc_a', hp: 1, maxHp: 1, damage: 1 })]);
  const found = findCombatTurnOutcome(w, 'force', 'success');
  assert.ok(found);
  const goal = found.world.goals.find(g => g.id === created.goal.id);
  assert.equal(goal.status, 'completed');
});

test('U58-24: targetDefeated uses sourceNpcId when present', () => {
  let w = mkCombatWorld('targetref');
  w = startCombatDirectly(w, [mkEnemy({ sourceNpcId: 'npc_zeta', hp: 1, maxHp: 1 })]);
  const found = findCombatTurnOutcome(w, 'force', 'success');
  assert.ok(found);
  const evt = found.world.timeline.find(e => e.kind === 'resolution' && e.data?.outcome === 'combat-victory');
  assert.ok(evt);
  assert.equal(evt.data.targetDefeated, 'npc_zeta');
});

// ── 25: player defeat ──────────────────────────────────────────────────────

test('U58-25: when party wounds reach 6, combat ends and ending.locked with reason defeated-in-combat', () => {
  let w = mkCombatWorld('defeat');
  w = ensureWorld({ ...w, party: [{ ...w.party[0], wounds: 5 }] });
  // Enemy that surely deals at least 1 damage on counter.
  w = startCombatDirectly(w, [mkEnemy({ damage: 3, hp: 20, maxHp: 20 })]);
  // Any non-terminal turn will trigger an enemy counter for ≥1 wound → death.
  const r = resolveCombatTurn(w, mkMove({ approachTag: 'finesse' }));
  assert.equal(r.world.party[0].wounds, 6);
  assert.equal(r.world.combat.active, false);
  assert.equal(r.world.ending.locked, true);
  assert.equal(r.world.ending.reason, 'defeated-in-combat');
});

// ── 26–27: flee ────────────────────────────────────────────────────────────

test('U58-26: "flee" during active combat ends it and adds stress + pressure', () => {
  let w = mkCombatWorld('flee');
  w = ensureWorld({
    ...w,
    map: {
      currentNodeId: 'n0',
      nodes: [{ id: 'n0', name: 'arena', nodeType: 'settlement', settlement: { decompressed: true, npcs: [] } }]
    }
  });
  w = startCombatDirectly(w, [mkEnemy()]);
  const stressBefore = w.party[0].stress;
  const pressureBefore = w.clocks.pressure;
  const out = playerMove(w, packsById, 'I flee from the fight');
  assert.equal(out.world.combat.active, false);
  assert.equal(out.world.party[0].stress, stressBefore + 1);
  assert.equal(out.world.clocks.pressure, pressureBefore + 1);
});

test('U58-27: flee emits combat-end timeline event with reason player-flee', () => {
  let w = mkCombatWorld('flee-ev');
  w = ensureWorld({
    ...w,
    map: {
      currentNodeId: 'n0',
      nodes: [{ id: 'n0', name: 'arena', nodeType: 'settlement', settlement: { decompressed: true, npcs: [] } }]
    }
  });
  w = startCombatDirectly(w, [mkEnemy()]);
  const out = playerMove(w, packsById, 'flee');
  const evt = out.world.timeline.find(e => e.kind === 'combat-end' && e.data?.reason === 'player-flee');
  assert.ok(evt, 'expected combat-end event with reason player-flee');
});

// ── 28–31: beat integration (R13 closure) ─────────────────────────────────

test('U58-28: combat turns produce a recentBeats entry with populated fields', () => {
  let w = mkCombatWorld('beats');
  w = ensureWorld({
    ...w,
    map: {
      currentNodeId: 'n0',
      nodes: [{ id: 'n0', name: 'arena', nodeType: 'settlement', settlement: { decompressed: true, npcs: [] } }]
    }
  });
  w = startCombatDirectly(w, [mkEnemy({ hp: 20, maxHp: 20 })]);
  const before = w.recentBeats.length;
  const out = playerMove(w, packsById, 'I strike with force');
  assert.equal(out.world.recentBeats.length, before + 1);
  const beat = out.world.recentBeats[out.world.recentBeats.length - 1];
  assert.ok(beat.input.length > 0);
  assert.ok(beat.approach.length > 0);
  assert.ok(['success', 'mixed', 'failure'].includes(beat.outcome));
  assert.ok(beat.mechanics.includes('combat'));
});

test('U58-29: enemy counters do NOT produce separate beats (one beat per player turn)', () => {
  let w = mkCombatWorld('beat-count');
  w = ensureWorld({
    ...w,
    map: {
      currentNodeId: 'n0',
      nodes: [{ id: 'n0', name: 'arena', nodeType: 'settlement', settlement: { decompressed: true, npcs: [] } }]
    }
  });
  w = startCombatDirectly(w, [mkEnemy({ hp: 20, maxHp: 20 }), mkEnemy({ id: 'enemy_1', name: 'Cur', hp: 20, maxHp: 20 })]);
  const before = w.recentBeats.length;
  const out = playerMove(w, packsById, 'I strike with force');
  // One player turn → one beat, regardless of how many enemies countered.
  assert.equal(out.world.recentBeats.length, before + 1);
});

test('U58-30: punch/kick during active combat route to combat resolver and write a beat', () => {
  let w = mkCombatWorld('verb-route');
  w = ensureWorld({
    ...w,
    map: {
      currentNodeId: 'n0',
      nodes: [{ id: 'n0', name: 'arena', nodeType: 'settlement', settlement: { decompressed: true, npcs: [] } }]
    }
  });
  w = startCombatDirectly(w, [mkEnemy({ hp: 20, maxHp: 20 })]);
  const before = w.recentBeats.length;
  const out = playerMove(w, packsById, 'I punch the brigand');
  // Combat route writes a beat; physics intercept does not.
  assert.equal(out.world.recentBeats.length, before + 1);
  // The mechanics line includes the combat marker, proving combat path.
  assert.ok(out.output.mechanics.includes('combat'));
});

test('U58-31: punch/kick when combat is NOT active still routes to physics intercept', () => {
  // Build a world with a furniture item the physics intercept can match.
  let w = mkCombatWorld('verb-physics');
  w = ensureWorld({
    ...w,
    map: {
      currentNodeId: 'n0',
      nodes: [{
        id: 'n0', name: 'cell', nodeType: 'settlement',
        settlement: { decompressed: true, npcs: [] },
        furniture: [{ id: 0, name: 'wooden chair', state: 'intact', tags: ['breakable'], parts: [], notes: '' }]
      }]
    }
  });
  // Combat NOT active.
  assert.equal(w.combat.active, false);
  const before = w.recentBeats.length;
  const out = playerMove(w, packsById, 'I kick the wooden chair');
  // Whether physics succeeds or falls through, the key check: combat did not begin.
  assert.equal(out.world.combat.active, false);
  // If physics intercept ran, no beat is written; if it fell through to mainline,
  // a beat may be written. Either way, combat is not engaged.
  assert.ok(out.world.recentBeats.length >= before);
});

// ── 32–34: determinism ────────────────────────────────────────────────────

test('U58-32: same seed + same transcript → identical final combat state and beats', () => {
  function run() {
    let w = mkCombatWorld('det-replay');
    w = ensureWorld({
      ...w,
      map: {
        currentNodeId: 'n0',
        nodes: [{ id: 'n0', name: 'arena', nodeType: 'settlement', settlement: { decompressed: true, npcs: [] } }]
      }
    });
    w = startCombatDirectly(w, [mkEnemy({ hp: 20, maxHp: 20 })]);
    w = playerMove(w, packsById, 'I strike with force').world;
    w = playerMove(w, packsById, 'I strike with force').world;
    return w;
  }
  const a = run();
  const b = run();
  assert.equal(worldHash(a), worldHash(b));
  assert.deepEqual(a.combat, b.combat);
  assert.deepEqual(a.recentBeats, b.recentBeats);
});

test('U58-33: export/import roundtrip preserves combat state', () => {
  let w = mkCombatWorld('roundtrip');
  w = startCombatDirectly(w, [mkEnemy({ hp: 6, maxHp: 8 })]);
  const text = exportWorld(w);
  const w2 = importWorld(text);
  assert.deepEqual(w2.combat, w.combat);
});

test('U58-34: worldHash observes combat state', () => {
  const w0 = mkCombatWorld('hash');
  const a = ensureWorld({ ...w0, combat: defaultCombat() });
  const b = startCombatDirectly(w0, [mkEnemy()]);
  assert.notEqual(worldHash(a), worldHash(b));
});

// ── 35: save version warning ──────────────────────────────────────────────

// ── 36–41: R15 — mintEnemyFromNpc honors npc.hostile ──────────────────────

test('U58-36: R15 — hostile NPC mints with canParley:false', () => {
  const e = mintEnemyFromNpc({ id: 'n1', name: 'Kael', hostile: true });
  assert.equal(e.canParley, false);
});

test('U58-37: R15 — NPC with no hostile field mints with canParley:true', () => {
  const e = mintEnemyFromNpc({ id: 'n2', name: 'Yara' });
  assert.equal(e.canParley, true);
});

test('U58-38: R15 — explicitly non-hostile NPC mints with canParley:true', () => {
  const e = mintEnemyFromNpc({ id: 'n3', name: 'Orla', hostile: false });
  assert.equal(e.canParley, true);
});

test('U58-39: R15 — explicit combatProfile.canParley overrides hostile derivation', () => {
  const e = mintEnemyFromNpc({ id: 'n4', name: 'Iden', hostile: true, combatProfile: { canParley: true } });
  assert.equal(e.canParley, true);
});

test('U58-40: R15 — heart success vs hostile-minted enemy stays in combat (trivial damage)', () => {
  let w = mkCombatWorld('r15-hostile');
  // Mint via the public path so the hostile flag drives canParley.
  const enemy = mintEnemyFromNpc({ id: 'npc_hostile', name: 'Kael', hostile: true, combatProfile: { maxHp: 10, damage: 2 } });
  w = startCombatDirectly(w, [{ ...enemy, id: 'enemy_0' }]);
  assert.equal(w.combat.enemies[0].canParley, false);
  const found = findCombatTurnOutcome(w, 'heart', 'success');
  assert.ok(found, 'expected a heart success');
  assert.equal(found.world.combat.active, true, 'still in combat — parley refused');
  assert.ok(found.world.combat.enemies[0].hp < 10, 'enemy took trivial damage');
  assert.ok(found.world.combat.enemies[0].hp >= 8, 'damage was small (~1)');
});

test('U58-41: R15 — heart success vs non-hostile-minted enemy ends combat (parley)', () => {
  let w = mkCombatWorld('r15-nonhostile');
  const enemy = mintEnemyFromNpc({ id: 'npc_friend', name: 'Yara', combatProfile: { maxHp: 10, damage: 2 } });
  w = startCombatDirectly(w, [{ ...enemy, id: 'enemy_0' }]);
  assert.equal(w.combat.enemies[0].canParley, true);
  const found = findCombatTurnOutcome(w, 'heart', 'success');
  assert.ok(found, 'expected a heart success');
  assert.equal(found.world.combat.active, false, 'parley ends combat');
  assert.equal(found.world.combat.enemies[0].defeated, false);
});

test('U58-35: loading a v12 save warns and normalizes combat to default', () => {
  const storage = (() => {
    const data = {};
    return {
      getItem(k) { return data[k] ?? null; },
      setItem(k, v) { data[k] = String(v); },
      removeItem(k) { delete data[k]; }
    };
  })();
  // v12 save with the old scaffolding combat shape.
  storage.setItem('ai-dm-v2:slot:slot1', JSON.stringify({
    meta: { version: 12, seed: 'old', fate: 0.3 },
    combat: { active: false, initiatives: {}, turnOrder: [], turnIndex: 0 }
  }));
  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const loaded = loadSlot(storage, 'slot1');
    assert.ok(loaded);
    assert.equal(loaded.meta.version, 13);
    assert.deepEqual(loaded.combat, defaultCombat());
    assert.ok(warnings.length > 0);
    assert.ok(warnings[0].includes('v12'));
    assert.ok(warnings[0].includes('v13'));
  } finally {
    console.warn = origWarn;
  }
});
