import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { beginCombat, mintEnemyFromNpc } from '../engine/combat/combatLifecycle.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

function loadPacks() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

const packs = loadPacks();

function withNpcs(seed, npcs) {
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
  nodes[idx] = {
    ...nodes[idx],
    settlement: {
      ...(nodes[idx].settlement || {}),
      decompressed: true,
      npcs
    }
  };
  return ensureWorld({ ...w, map: { ...w.map, nodes } });
}

function testNpc(id, name, role, profile = {}) {
  return {
    id,
    name,
    role,
    hostile: Boolean(profile.hostile),
    combatProfile: { maxHp: 20, damage: 1, canParley: false, ...profile },
    personality: {},
    conversationState: { metPlayer: false, trustLevel: 5, topicsDiscussed: [] },
    knowledgeGraph: [],
    secrets: []
  };
}

function combatWithCorwin(seed, profile = {}) {
  let w = withNpcs(seed, [
    testNpc('npc_corwin', 'Corwin', 'healer', { hostile: true, maxHp: 20, damage: 1, canParley: false, ...profile })
  ]);
  const enemy = {
    ...mintEnemyFromNpc({
      id: 'npc_corwin',
      name: 'Corwin',
      hostile: true,
      combatProfile: { maxHp: 20, damage: 1, canParley: false, ...profile }
    }),
    hp: Number(profile.maxHp) || 20,
    maxHp: Number(profile.maxHp) || 20,
    ac: Number(profile.ac) || 10,
    damage: Number(profile.damage) || 1,
    defeated: false
  };
  w = beginCombat(w, { enemies: [enemy], reason: 'test' });
  const activeEnemy = w.combat?.enemies?.[0];
  assert.ok(activeEnemy, 'fixture should begin combat with one enemy');
  const shapedEnemy = {
    ...activeEnemy,
    hp: Number(profile.maxHp) || 20,
    maxHp: Number(profile.maxHp) || 20,
    ac: Number(profile.ac) || 10,
    damage: Number(profile.damage) || 1,
    defeated: false
  };
  w = applyDeltas(w, [{
    op: 'combatState',
    set: { round: Number(profile.round) || 1, enemies: [shapedEnemy] }
  }]);
  return w;
}

test('U206: declared attack with trailing dice demand resolves as a real strike, not table-talk', () => {
  const w = combatWithCorwin('u206-declared-attack', { maxHp: 20, ac: 1, damage: 1 });
  const before = w.combat.enemies[0].hp;
  const result = playerMove(w, packs, 'I hit Corwin with my worn blade. Roll it, give me the d20 and total?');
  const mech = String(result.output.mechanics || '');
  const enemy = result.world.combat?.enemies?.find(e => e.name === 'Corwin');

  assert.doesNotMatch(mech, /combat:table-talk/, `declared attack must not become table-talk: ${mech}`);
  assert.match(mech, /\[strike:Worn Blade \| atk:-?\d+ vs AC:\d+ → hit \| \d+ dmg\]/, `strike must surface atk/damage: ${mech}`);
  assert.ok(enemy && Number(enemy.hp) < before, `enemy HP should drop: ${before} -> ${enemy?.hp}`);
});

test('U206: narrated landed hit always carries mechanics damage and an enemy HP delta', () => {
  const w = combatWithCorwin('u206-hit-implies-hp', { maxHp: 20, ac: 1, damage: 1, round: 6 });
  const before = w.combat.enemies[0].hp;
  const result = playerMove(w, packs, 'I slash Corwin and drive him back');
  const narration = String(result.output.narration || '');
  const mech = String(result.output.mechanics || '');
  const enemy = result.world.combat?.enemies?.find(e => e.name === 'Corwin');

  assert.match(narration, /\bhits?\b|\bfor \d+\b/i, `fixture should narrate a landed hit: ${narration}`);
  assert.match(mech, /\[strike:.*\| atk:-?\d+ vs AC:\d+ → hit \| \d+ dmg\]/, `landed hit must have strike damage: ${mech}`);
  assert.ok(enemy && Number(enemy.hp) < before, `narrated hit must lower HP: ${before} -> ${enemy?.hp}`);
});

test('U206: PC at 0 HP with a live enemy remains in dying combat and cannot self-act', () => {
  const w = combatWithCorwin('u206-down-0', { maxHp: 40, ac: 30, damage: 20 });
  const lowHp = { ...w, meta: { ...w.meta, escapeHp: 1 } };
  const downed = playerMove(lowHp, packs, 'I swing at Corwin');
  const downedMech = String(downed.output.mechanics || '');

  assert.equal(downed.world.combat?.active, true, `combat should not end while the live enemy stands: ${downedMech}`);
  assert.equal(Number(downed.world.meta?.escapeHp), 0, 'PC should be downed at 0 HP');
  assert.ok(downed.world.combat?.enemies?.some(e => e.name === 'Corwin' && !e.defeated && Number(e.hp) > 0), 'enemy should still be alive');
  assert.match(downedMech, /combat:dying|combat:defeat/, `downed state should be explicit: ${downedMech}`);

  const blocked = playerMove(downed.world, packs, 'I get back up and stab Corwin');
  assert.match(String(blocked.output.mechanics || ''), /combat:dying \| no-action/, '0-HP PC cannot take a normal self-recovery action');
  assert.equal(Number(blocked.world.meta?.escapeHp), 0, 'self-recovery without stabilize must not restore HP');
});

test('U206: pointing out a stranger and ignoring Corwin is social identification, not combat', () => {
  const w = withNpcs('u206-point-at-stranger', [
    testNpc('npc_corwin', 'Corwin', 'healer', { hostile: true, maxHp: 20, damage: 1 }),
    testNpc('npc_roof_stranger', 'Brae', 'stranger', { hostile: false, maxHp: 20, damage: 1 })
  ]);
  const result = playerMove(w, packs, 'Brae, ignore Corwin. Point at the stranger on the roof.');
  const mech = String(result.output.mechanics || '');

  assert.doesNotMatch(mech, /strike:|combat:/, `social/deixis line must not route to combat: ${mech}`);
  assert.notEqual(result.world.combat?.active, true, 'combat should not start');
});
