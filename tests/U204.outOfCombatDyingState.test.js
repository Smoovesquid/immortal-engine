import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { beginCombat, endCombat, mintEnemyFromNpc } from '../engine/combat/combatLifecycle.js';
import { createCharacter5e } from '../engine/chargen/srd/index.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

function loadPacks() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

const packs = loadPacks();

function worldWithCorwin(seed) {
  const pc = createCharacter5e({ seed: `${seed}|pc`, speciesId: 'human', classId: 'fighter', abilityMethod: 'standard' });
  let w = beginAdventure(newWorld({
    seed,
    fate: 0.3,
    mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), packs).world;
  w = ensureWorld({ ...w, party: [pc] });
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
        hostile: true,
        combatProfile: { maxHp: 5, damage: 1, ac: 1, canParley: false },
        personality: {},
        conversationState: { metPlayer: false, trustLevel: 0, topicsDiscussed: [] },
        knowledgeGraph: [],
        secrets: []
      }]
    }
  };
  return ensureWorld({ ...w, map: { ...w.map, nodes } });
}

function inactiveCombatWithLiveCorwin(seed, escapeHp, escapeMaxHp = 0) {
  let w = worldWithCorwin(seed);
  const enemy = mintEnemyFromNpc({
    id: 'npc_corwin',
    name: 'Corwin',
    hostile: true,
    combatProfile: { maxHp: 5, damage: 1, ac: 1, canParley: false }
  });
  w = beginCombat(w, { enemies: [enemy], reason: 'test' });
  w = applyDeltas(w, [{
    op: 'combatState',
    set: {
      enemies: [{
        ...w.combat.enemies[0],
        hp: 5,
        maxHp: 5,
        damage: 1,
        ac: 1,
        defeated: false
      }]
    }
  }]);
  w = { ...w, meta: { ...w.meta, escapeHp, escapeMaxHp } };
  w = endCombat(w, { reason: 'test-stale-live-foe' });
  assert.equal(w.combat?.active, false, 'fixture is out of active combat');
  assert.equal(Number(w.combat?.enemies?.[0]?.hp), 5, 'fixture preserves a live foe');
  assert.equal(Number(w.party?.[0]?.dnd?.maxHP) > 0, true, 'sheet HP remains positive');
  return ensureWorld(w);
}

test('U204: 0 HP out of combat with a live foe blocks a normal attack as dying', () => {
  const w = inactiveCombatWithLiveCorwin('u204-zero-live-foe', 0);
  const result = playerMove(w, packs, "I claw my way back up, snatch the dropped door, and swing it into Corwin's knees.");

  assert.equal(String(result.output.mechanics || ''), '[combat:dying | no-action]');
  assert.match(String(result.output.narration || ''), /0 HP|down and dying|cannot act/i);
  assert.equal(Number(result.world.meta?.escapeHp), 0, 'blocked action must not heal or spend HP');
  assert.equal(result.world.combat?.active, false, 'dying gate does not restart combat');
});

test('U204: stabilization phrasing at 0 HP out of combat restores exactly 1 HP', () => {
  const w = inactiveCombatWithLiveCorwin('u204-stabilize-live-foe', 0);
  const result = playerMove(w, packs, 'Someone stabilizes me and pulls me back from Corwin.');

  assert.equal(String(result.output.mechanics || ''), '[heal:stabilize | hp:0->1]');
  assert.equal(Number(result.world.meta?.escapeHp), 1);
  assert.equal(result.world.combat?.active, false, 'stabilize does not restart combat');
});

test('U204: above 0 HP out of combat still allows normal dispatch', () => {
  const w = inactiveCombatWithLiveCorwin('u204-above-zero-live-foe', 1, 0);
  const result = playerMove(w, packs, "I swing the dropped door into Corwin's knees.");
  const mech = String(result.output.mechanics || '');

  assert.notEqual(mech, '[combat:dying | no-action]');
  assert.doesNotMatch(mech, /heal:stabilize/);
});
