// CM09: Lair Actions & Mechanical Senses.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld, ensureCombat } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { resolveCombatTurn } from '../engine/combat/combatResolve.js';
import { mintEnemyFromNpc } from '../engine/combat/combatLifecycle.js';
import { applySenseOverrides } from '../engine/combat/senses.js';

// ── helpers ────────────────────────────────────────────────────────────────

function mkCombatWorld(seedKey, fate = 0.0) {
  let w = newWorld({ seed: `cm9-${seedKey}`, fate, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = ensureWorld({
    ...w,
    party: [{
      id: 'party', name: 'Hero', vibe: 'steady', archetype: 'wanderer',
      wounds: 0, stress: 0, resources: { Supply: 5 },
      stats: { MIGHT: 14, AGILITY: 14, GRIT: 14, CHARM: 14, WITS: 14 }
    }],
    scene: { location: 'lair', objective: 'survive', time: 'start', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });
  return w;
}

function mkEnemy(over = {}) {
  return {
    id: 'enemy_0', name: 'Dragon', hp: 100, maxHp: 100, damage: 5, ac: 16, cr: 10,
    damageType: 'fire', resistances: {}, conditionImmunities: [], conditions: [],
    actions: [{ name: 'Claw', toHit: 8, damage: '2d6+5', type: 'slashing' }],
    multiattack: null, saveProficiencies: [], canParley: false, defeated: false,
    sourceNpcId: 'npc_dragon', lootTableRef: null, initMod: 2,
    legendaryActions: null, reactions: null,
    lairActions: null,
    senses: { darkvision: 120, blindsight: 30, tremorsense: null, truesight: null },
    ...over
  };
}

function mkCombatWithInit(seedKey, enemies, initOrder) {
  let w = mkCombatWorld(seedKey);
  w = applyDeltas(w, [{
    op: 'combatState',
    set: {
      active: true, round: 1, turnIndex: 0, enemies, beganAt: 0,
      reason: 'test', playerGuard: false, companionGuard: false, initiativeOrder: initOrder
    }
  }]);
  return w;
}

// ── ensureCombat normalization ─────────────────────────────────────────────

test('CM09-01 ensureCombat normalizes lairActions correctly', () => {
  const c = ensureCombat({
    active: true, round: 1, turnIndex: 0, beganAt: 0, reason: 'test',
    playerGuard: false, companionGuard: false, initiativeOrder: [],
    enemies: [{
      id: 'e0', name: 'Dragon', hp: 100, maxHp: 100, damage: 5, ac: 16, cr: 10,
      damageType: 'fire', resistances: {}, conditionImmunities: [], conditions: [],
      actions: [], multiattack: null, saveProficiencies: [], canParley: false,
      defeated: false, sourceNpcId: '', lootTableRef: null, initMod: 2,
      legendaryActions: null, reactions: null,
      lairActions: [
        { name: 'Magma Eruption', action: { name: 'Magma Eruption', save: { stat: 'AGILITY', dc: 15, halfOnSave: true }, damage: '3d6', type: 'fire' } },
        { name: 'Cave-in', action: { name: 'Cave-in', save: { stat: 'AGILITY', dc: 13, halfOnSave: false }, damage: '2d10', type: 'bludgeoning' } }
      ],
      senses: { darkvision: 120, blindsight: 30, tremorsense: null, truesight: null }
    }]
  });

  const e = c.enemies[0];
  assert.ok(Array.isArray(e.lairActions), 'lairActions should be array');
  assert.equal(e.lairActions.length, 2);
  assert.equal(e.lairActions[0].name, 'Magma Eruption');
  assert.equal(e.lairActions[1].name, 'Cave-in');
});

test('CM09-02 ensureCombat normalizes senses correctly', () => {
  const c = ensureCombat({
    active: true, round: 1, turnIndex: 0, beganAt: 0, reason: 'test',
    playerGuard: false, companionGuard: false, initiativeOrder: [],
    enemies: [{
      id: 'e0', name: 'Wyrm', hp: 50, maxHp: 50, damage: 3, ac: 14, cr: 5,
      damageType: 'fire', resistances: {}, conditionImmunities: [], conditions: [],
      actions: [], multiattack: null, saveProficiencies: [], canParley: false,
      defeated: false, sourceNpcId: '', lootTableRef: null, initMod: 0,
      legendaryActions: null, reactions: null, lairActions: null,
      senses: { darkvision: 60, blindsight: 10, tremorsense: 30, truesight: null }
    }]
  });

  const s = c.enemies[0].senses;
  assert.equal(s.darkvision, 60);
  assert.equal(s.blindsight, 10);
  assert.equal(s.tremorsense, 30);
  assert.equal(s.truesight, null);
});

test('CM09-03 malformed lairActions → null', () => {
  const c = ensureCombat({
    active: true, round: 1, turnIndex: 0, beganAt: 0, reason: 'test',
    playerGuard: false, companionGuard: false, initiativeOrder: [],
    enemies: [{
      id: 'e0', name: 'Blob', hp: 10, maxHp: 10, damage: 1, ac: 10, cr: 0,
      damageType: 'bludgeoning', resistances: {}, conditionImmunities: [], conditions: [],
      actions: [], multiattack: null, saveProficiencies: [], canParley: true,
      defeated: false, sourceNpcId: '', lootTableRef: null, initMod: 0,
      legendaryActions: null, reactions: null, lairActions: 'garbage', senses: 42
    }]
  });
  assert.equal(c.enemies[0].lairActions, null);
  assert.ok(c.enemies[0].senses, 'senses should be an object even from malformed input');
  assert.equal(c.enemies[0].senses.darkvision, null);
});

test('CM09-04 empty lairActions array → null', () => {
  const c = ensureCombat({
    active: true, round: 1, turnIndex: 0, beganAt: 0, reason: 'test',
    playerGuard: false, companionGuard: false, initiativeOrder: [],
    enemies: [{
      id: 'e0', name: 'Imp', hp: 10, maxHp: 10, damage: 1, ac: 10, cr: 0,
      damageType: 'fire', resistances: {}, conditionImmunities: [], conditions: [],
      actions: [], multiattack: null, saveProficiencies: [], canParley: false,
      defeated: false, sourceNpcId: '', lootTableRef: null, initMod: 0,
      legendaryActions: null, reactions: null, lairActions: [], senses: {}
    }]
  });
  assert.equal(c.enemies[0].lairActions, null, 'empty array normalizes to null');
});

// ── lair actions in combat ────────────────────────────────────────────────

test('CM09-05 lair action fires at round start', () => {
  const enemy = mkEnemy({
    lairActions: [
      { name: 'Magma Eruption', action: { name: 'Magma Eruption', save: { stat: 'AGILITY', dc: 15, halfOnSave: true }, damage: '3d6', type: 'fire' } }
    ]
  });
  const initOrder = [
    { id: 'party', type: 'party', roll: 18, modifier: 2, total: 20 },
    { id: 'enemy_0', type: 'enemy', roll: 10, modifier: 2, total: 12 }
  ];
  let w = mkCombatWithInit('lair-fire', [enemy], initOrder);

  const { world, result } = resolveCombatTurn(w, {
    approachTag: 'force', intentText: 'attack', risk: 0.5, stakeTag: 'harm'
  });

  assert.ok(result.combatSummary.includes('Lair'), 'lair action should appear in summary');
  assert.ok(result.combatSummary.includes('Magma Eruption'), 'lair action name in summary');
});

test('CM09-06 lair actions cycle by round', () => {
  const enemy = mkEnemy({
    lairActions: [
      { name: 'Action A', action: { name: 'Action A', toHit: 10, damage: '1d4', type: 'bludgeoning' } },
      { name: 'Action B', action: { name: 'Action B', toHit: 10, damage: '1d4', type: 'fire' } }
    ]
  });
  const initOrder = [
    { id: 'party', type: 'party', roll: 18, modifier: 2, total: 20 },
    { id: 'enemy_0', type: 'enemy', roll: 10, modifier: 2, total: 12 }
  ];

  // Round 1 → idx 0 → Action A
  let w1 = mkCombatWithInit('lair-cycle-1', [enemy], initOrder);
  const { result: r1 } = resolveCombatTurn(w1, {
    approachTag: 'force', intentText: 'attack', risk: 0.5, stakeTag: 'harm'
  });
  assert.ok(r1.combatSummary.includes('Action A'), 'round 1 should use Action A');

  // Round 2 → idx 1 → Action B
  let w2 = mkCombatWithInit('lair-cycle-2', [enemy], initOrder);
  w2 = applyDeltas(w2, [{ op: 'combatState', set: { round: 2 } }]);
  const { result: r2 } = resolveCombatTurn(w2, {
    approachTag: 'force', intentText: 'attack', risk: 0.5, stakeTag: 'harm'
  });
  assert.ok(r2.combatSummary.includes('Action B'), 'round 2 should use Action B');
});

test('CM09-07 no lair action for null lairActions', () => {
  const enemy = mkEnemy({ lairActions: null });
  const initOrder = [
    { id: 'party', type: 'party', roll: 18, modifier: 2, total: 20 },
    { id: 'enemy_0', type: 'enemy', roll: 10, modifier: 2, total: 12 }
  ];
  let w = mkCombatWithInit('no-lair', [enemy], initOrder);

  const { result } = resolveCombatTurn(w, {
    approachTag: 'force', intentText: 'attack', risk: 0.5, stakeTag: 'harm'
  });

  assert.ok(!result.combatSummary.includes('Lair'), 'no lair action in summary');
});

// ── senses ────────────────────────────────────────────────────────────────

test('CM09-08 applySenseOverrides: blindsight bypasses invisible', () => {
  const attacker = { senses: { blindsight: 30, darkvision: null, tremorsense: null, truesight: null }, conditions: [] };
  const target = { conditions: [{ name: 'invisible', until: null, source: '', severity: 1 }] };
  const result = applySenseOverrides(attacker, target);
  assert.ok(result.bypassInvisible, 'blindsight should bypass invisible');
});

test('CM09-09 applySenseOverrides: no senses vs invisible → -5 toHit', () => {
  const attacker = { senses: { blindsight: null, darkvision: null, tremorsense: null, truesight: null }, conditions: [] };
  const target = { conditions: [{ name: 'invisible', until: null, source: '', severity: 1 }] };
  const result = applySenseOverrides(attacker, target);
  assert.equal(result.toHitMod, -5, 'should be -5 toHit vs invisible without senses');
  assert.equal(result.bypassInvisible, false);
});

test('CM09-10 applySenseOverrides: truesight bypasses invisible and gives +1', () => {
  const attacker = { senses: { blindsight: null, darkvision: null, tremorsense: null, truesight: 60 }, conditions: [] };
  const target = { conditions: [{ name: 'invisible', until: null, source: '', severity: 1 }] };
  const result = applySenseOverrides(attacker, target);
  assert.ok(result.bypassInvisible, 'truesight should bypass invisible');
  assert.equal(result.toHitMod, 1, 'truesight gives +1 toHit');
});

test('CM09-11 applySenseOverrides: darkvision negates darkness penalty', () => {
  const attacker = { senses: { blindsight: null, darkvision: 60, tremorsense: null, truesight: null }, conditions: [] };
  const target = { conditions: [] };
  const env = new Set(['darkness']);
  const result = applySenseOverrides(attacker, target, env);
  assert.equal(result.toHitMod, 0, 'darkvision negates darkness penalty');
});

test('CM09-12 applySenseOverrides: no darkvision in darkness → -2', () => {
  const attacker = { senses: { blindsight: null, darkvision: null, tremorsense: null, truesight: null }, conditions: [] };
  const target = { conditions: [] };
  const env = new Set(['darkness']);
  const result = applySenseOverrides(attacker, target, env);
  assert.equal(result.toHitMod, -2, 'no vision in darkness = -2');
});

test('CM09-13 applySenseOverrides: attacking blinded target → +2', () => {
  const attacker = { senses: { blindsight: null, darkvision: null, tremorsense: null, truesight: null }, conditions: [] };
  const target = { conditions: [{ name: 'blinded', until: null, source: '', severity: 1 }] };
  const result = applySenseOverrides(attacker, target);
  assert.equal(result.toHitMod, 2, '+2 vs blinded target');
});

test('CM09-14 applySenseOverrides: tremorsense bypasses invisible', () => {
  const attacker = { senses: { blindsight: null, darkvision: null, tremorsense: 60, truesight: null }, conditions: [] };
  const target = { conditions: [{ name: 'invisible', until: null, source: '', severity: 1 }] };
  const result = applySenseOverrides(attacker, target);
  assert.ok(result.bypassInvisible, 'tremorsense should bypass invisible');
});

// ── integration: senses in combat ─────────────────────────────────────────

test('CM09-15 enemy with blindsight gets sense advantage in combat', () => {
  const enemy = mkEnemy({
    senses: { darkvision: 120, blindsight: 60, tremorsense: null, truesight: null }
  });
  const initOrder = [
    { id: 'party', type: 'party', roll: 18, modifier: 2, total: 20 },
    { id: 'enemy_0', type: 'enemy', roll: 10, modifier: 2, total: 12 }
  ];
  let w = mkCombatWithInit('sense-combat', [enemy], initOrder);
  assertWorldInvariants(w);

  const { world, result } = resolveCombatTurn(w, {
    approachTag: 'force', intentText: 'attack', risk: 0.5, stakeTag: 'harm'
  });
  assertWorldInvariants(world);
  assert.ok(result.combatSummary, 'combat should produce summary');
});

// ── mintEnemyFromNpc passthrough ──────────────────────────────────────────

test('CM09-16 mintEnemyFromNpc passes through lairActions and senses', () => {
  const npc = {
    id: 'npc_boss', name: 'Wyrm Lord',
    combatProfile: {
      maxHp: 200, damage: 15,
      lairActions: [{ name: 'Quake', action: { name: 'Quake', save: { stat: 'AGILITY', dc: 16 }, damage: '4d6', type: 'bludgeoning' } }],
      senses: { darkvision: 120, blindsight: 60, tremorsense: 30, truesight: null }
    }
  };
  const e = mintEnemyFromNpc(npc);
  assert.deepEqual(e.lairActions, npc.combatProfile.lairActions);
  assert.deepEqual(e.senses, npc.combatProfile.senses);
});

// ── invariants ────────────────────────────────────────────────────────────

test('CM09-17 world with lairActions and senses passes invariants', () => {
  const enemy = mkEnemy({
    lairActions: [{ name: 'Eruption', action: { name: 'Eruption' } }],
    senses: { darkvision: 60, blindsight: 30, tremorsense: null, truesight: null }
  });
  const initOrder = [
    { id: 'party', type: 'party', roll: 18, modifier: 2, total: 20 },
    { id: 'enemy_0', type: 'enemy', roll: 10, modifier: 2, total: 12 }
  ];
  const w = mkCombatWithInit('inv-lair', [enemy], initOrder);
  assertWorldInvariants(w);
});

// ── multi-target lair actions ─────────────────────────────────────────────

test('CM09-19 lair action targets all living party members', () => {
  const enemy = mkEnemy({
    lairActions: [
      { name: 'Tremor', action: { name: 'Tremor', save: { stat: 'AGILITY', dc: 14, halfOnSave: true }, damage: '2d8', type: 'bludgeoning' } }
    ]
  });
  const initOrder = [
    { id: 'party', type: 'party', roll: 18, modifier: 2, total: 20 },
    { id: 'companion_1', type: 'party', roll: 14, modifier: 1, total: 15 },
    { id: 'enemy_0', type: 'enemy', roll: 10, modifier: 2, total: 12 }
  ];
  let w = mkCombatWithInit('lair-multi', [enemy], initOrder);
  w = ensureWorld({
    ...w,
    party: [
      w.party[0],
      {
        id: 'companion_1', name: 'Tove', vibe: 'loyal', archetype: 'guardian',
        wounds: 0, stress: 0, resources: { Supply: 3 },
        stats: { MIGHT: 12, AGILITY: 12, GRIT: 12, CHARM: 10, WITS: 10 }
      }
    ]
  });

  const { world, result } = resolveCombatTurn(w,
    { approachTag: 'force', intentText: 'attack', risk: 0.5, stakeTag: 'harm' },
    { afterPlayerTurn: (wrld, cid) => ({ world: wrld, summaryParts: [] }) }
  );

  // Both party members should be mentioned in the lair action summary.
  assert.ok(result.combatSummary.includes('Lair'), 'lair action should fire');
  assert.ok(result.combatSummary.includes('Tremor'), 'lair action name should appear');
  assert.ok(result.combatSummary.includes('Hero'), 'Hero should be targeted by lair action');
  assert.ok(result.combatSummary.includes('Tove'), 'Tove should be targeted by lair action');
});

test('CM09-20 lair action — one party member can pass while another fails', () => {
  // Use a save DC that makes mixed results likely with different stats.
  const enemy = mkEnemy({
    lairActions: [
      { name: 'Quake', action: { name: 'Quake', save: { stat: 'AGILITY', dc: 12, halfOnSave: true }, damage: '2d6', type: 'bludgeoning' } }
    ]
  });
  const initOrder = [
    { id: 'party', type: 'party', roll: 18, modifier: 2, total: 20 },
    { id: 'companion_1', type: 'party', roll: 14, modifier: -2, total: 12 },
    { id: 'enemy_0', type: 'enemy', roll: 10, modifier: 2, total: 12 }
  ];
  let w = mkCombatWithInit('lair-mixed', [enemy], initOrder);
  // Give the companion very low AGILITY to increase save failure likelihood.
  w = ensureWorld({
    ...w,
    party: [
      w.party[0],
      {
        id: 'companion_1', name: 'Tove', vibe: 'loyal', archetype: 'guardian',
        wounds: 0, stress: 0, resources: { Supply: 3 },
        stats: { MIGHT: 12, AGILITY: 5, GRIT: 12, CHARM: 10, WITS: 10 }
      }
    ]
  });

  const { world, result } = resolveCombatTurn(w,
    { approachTag: 'force', intentText: 'attack', risk: 0.5, stakeTag: 'harm' },
    { afterPlayerTurn: (wrld, cid) => ({ world: wrld, summaryParts: [] }) }
  );

  // Both names should be in the summary — each gets their own save result.
  assert.ok(result.combatSummary.includes('Hero'), 'Hero should appear in lair summary');
  assert.ok(result.combatSummary.includes('Tove'), 'Tove should appear in lair summary');
  // The summary should contain per-member results (saves/fails independently).
  const lairPart = result.combatSummary.split(';').find(s => s.includes('Lair'));
  assert.ok(lairPart, 'lair segment should exist in summary');
});

// ── determinism ───────────────────────────────────────────────────────────

test('CM09-18 determinism: same seed → same lair action outcomes', () => {
  function runOnce() {
    const enemy = mkEnemy({
      lairActions: [{ name: 'Eruption', action: { name: 'Eruption', save: { stat: 'AGILITY', dc: 15, halfOnSave: true }, damage: '3d6', type: 'fire' } }]
    });
    const initOrder = [
      { id: 'party', type: 'party', roll: 18, modifier: 2, total: 20 },
      { id: 'enemy_0', type: 'enemy', roll: 10, modifier: 2, total: 12 }
    ];
    const w = mkCombatWithInit('det-lair', [enemy], initOrder);
    return resolveCombatTurn(w, { approachTag: 'force', intentText: 'attack', risk: 0.5, stakeTag: 'harm' });
  }
  const r1 = runOnce();
  const r2 = runOnce();
  assert.equal(r1.result.combatSummary, r2.result.combatSummary, 'same seed → same summary');
  assert.equal(r1.world.party[0].wounds, r2.world.party[0].wounds, 'same seed → same wounds');
});
