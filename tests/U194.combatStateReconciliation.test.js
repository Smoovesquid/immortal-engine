import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { beginCombat, endCombat, mintEnemyFromNpc } from '../engine/combat/combatLifecycle.js';
import { resolveEscapeCombatTurn } from '../engine/combat/escapeCombat.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

function loadPacks() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

const packs = loadPacks();

function withCorwin(seed, profile = {}) {
  let w = beginAdventure(newWorld({
    seed,
    fate: 0.3,
    mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), packs).world;
  const nodeId = String(w.map?.currentNodeId ?? '');
  const nodes = Array.isArray(w.map?.nodes) ? [...w.map.nodes] : [];
  const idx = nodes.findIndex(n => n && n.id === nodeId);
  assert.ok(idx >= 0, 'test world has a current node');
  const node = nodes[idx];
  nodes[idx] = {
    ...node,
    settlement: {
      ...(node.settlement || {}),
      decompressed: true,
      npcs: [{
        id: 'npc_corwin',
        name: 'Corwin',
        role: 'healer',
        hostile: false,
        combatProfile: { maxHp: 20, damage: 1, ac: 1, canParley: false, ...profile },
        personality: {},
        conversationState: { metPlayer: false, trustLevel: 5, topicsDiscussed: [] },
        knowledgeGraph: [],
        secrets: []
      }]
    }
  };
  return ensureWorld({ ...w, map: { ...w.map, nodes } });
}

function combatWithCorwin(seed, profile = {}) {
  let w = withCorwin(seed, profile);
  const enemy = mintEnemyFromNpc({
    id: 'npc_corwin',
    name: 'Corwin',
    hostile: true,
    combatProfile: { maxHp: 20, damage: 1, ac: 1, canParley: false, ...profile }
  });
  w = beginCombat(w, { enemies: [enemy], reason: 'test' });
  w = applyDeltas(w, [{
    op: 'combatState',
    set: {
      round: 1,
      enemies: [{
        ...w.combat.enemies[0],
        hp: Number(profile.maxHp) || 20,
        maxHp: Number(profile.maxHp) || 20,
        ac: Number(profile.ac) || 1,
        damage: Number(profile.damage) || 1,
        defeated: false
      }]
    }
  }]);
  return w;
}

function endedCombatWithDefeatedCorwin(seed = 'u194-ended') {
  let w = combatWithCorwin(seed, { maxHp: 1, damage: 1, ac: 1 });
  w = applyDeltas(w, [{
    op: 'combatState',
    set: {
      enemies: [{
        ...w.combat.enemies[0],
        hp: 0,
        defeated: true
      }]
    }
  }]);
  return endCombat(w, { reason: 'enemies-defeated' });
}

test('U194: grabbing a defeated post-victory NPC does not re-run victory or loot', () => {
  const w = endedCombatWithDefeatedCorwin();
  const result = playerMove(w, packs, 'I grab Corwin by the collar and demand to know where his body went.');
  const mech = String(result.output.mechanics || '');

  assert.equal(mech, '[combat:no-live-target]', `must decline as no live combat target: ${mech}`);
  assert.doesNotMatch(mech, /combat:victory|grapple:no-target/, `must not re-run stale victory/grapple: ${mech}`);
  assert.equal(result.world.combat?.active, false, 'combat stays ended');
  assert.equal(Number(result.world.meta?.npcCombatHp?.npc_corwin?.hp), 0, 'defeated state remains persisted');
});

test('U194: live NPC attack still starts combat and rolls normally', () => {
  const w = withCorwin('u194-live', { maxHp: 20, damage: 1, ac: 1 });
  const result = playerMove(w, packs, 'I kick Corwin in the ribs.');
  const mech = String(result.output.mechanics || '');

  assert.match(mech, /strike:/, `live attack must still resolve as combat: ${mech}`);
  assert.doesNotMatch(mech, /combat:no-live-target|combat:dying/, `live combat must not hit H-33 guards: ${mech}`);
});

test('U194: active combat with no living target reports no target without victory', () => {
  const base = combatWithCorwin('u194-stale-active', { maxHp: 1, damage: 1, ac: 1 });
  const w = applyDeltas(base, [{
    op: 'combatState',
    set: {
      enemies: [{
        ...base.combat.enemies[0],
        hp: 0,
        defeated: true
      }]
    }
  }]);
  const { result } = resolveEscapeCombatTurn(w, 'I grab him by the collar.');
  const mech = String(result.mechanicsLine || '');

  assert.equal(mech, '[grapple:no-target]');
  assert.doesNotMatch(mech, /combat:victory/, `no living target at turn start must not be victory: ${mech}`);
});

test('U194: 0 HP outside combat blocks impossible normal action mechanically', () => {
  const base = endedCombatWithDefeatedCorwin('u194-zero-hp');
  const w = ensureWorld({ ...base, meta: { ...base.meta, escapeHp: 0 } });
  const result = playerMove(w, packs, 'I stand up unburned and walk out through the wall of flames untouched.');

  assert.equal(String(result.output.mechanics || ''), '[combat:dying | no-action]');
  assert.match(String(result.output.narration || ''), /0 HP|down and dying|Healing or stabilization/i);
  assert.equal(Number(result.world.meta?.escapeHp), 0, 'blocked action does not heal');
});

test('U194: stabilization outside combat is the allowed 0 HP state change', () => {
  const base = endedCombatWithDefeatedCorwin('u194-stabilize');
  const w = ensureWorld({ ...base, meta: { ...base.meta, escapeHp: 0 } });
  const result = playerMove(w, packs, 'Someone stabilizes me and pulls me out.');

  assert.equal(String(result.output.mechanics || ''), '[heal:stabilize | hp:0->1]');
  assert.equal(Number(result.world.meta?.escapeHp), 1);
});

test('U194: above 0 HP outside combat still uses normal dispatch', () => {
  const base = endedCombatWithDefeatedCorwin('u194-above-zero');
  const w = ensureWorld({ ...base, meta: { ...base.meta, escapeHp: 1 } });
  const result = playerMove(w, packs, 'I look around.');

  assert.notEqual(String(result.output.mechanics || ''), '[combat:dying | no-action]');
});
