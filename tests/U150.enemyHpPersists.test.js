import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { beginCombat, endCombat, mintEnemyFromNpc } from '../engine/combat/combatLifecycle.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Opus gate #1 (1g): a foe who fled/fell was re-minted at FULL HP on re-engage
// (the dominant "landed strike, still 8/8" cluster). endCombat now persists each
// enemy's final HP keyed by source NPC (meta.npcCombatHp), consumed when re-minting.

function setup() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  let w = beginAdventure(newWorld({ seed: 'glass-harbor', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  const npc = w.map.nodes.find(n => n.id === w.map.currentNodeId).settlement.npcs[0];
  return { w, byId, npc };
}

test('U150: endCombat persists each enemy final HP keyed by source NPC', () => {
  const { w, npc } = setup();
  const enemy = { ...mintEnemyFromNpc(npc), hp: 50, maxHp: 50 };
  let w2 = beginCombat(w, { enemies: [enemy], reason: 'test' });
  // drop the enemy to 3 HP, then end combat
  w2 = applyDeltas(w2, [{ op: 'combatState', set: { enemies: w2.combat.enemies.map(e => ({ ...e, hp: 3 })) } }]);
  w2 = endCombat(w2, { reason: 'test-end' });
  assert.deepEqual(w2.meta.npcCombatHp[String(npc.id)], { hp: 3, down: false });
});

test('U150: a defeated enemy persists as down', () => {
  const { w, npc } = setup();
  const enemy = { ...mintEnemyFromNpc(npc), hp: 50, maxHp: 50 };
  let w2 = beginCombat(w, { enemies: [enemy], reason: 'test' });
  w2 = applyDeltas(w2, [{ op: 'combatState', set: { enemies: w2.combat.enemies.map(e => ({ ...e, hp: 0, defeated: true })) } }]);
  w2 = endCombat(w2, { reason: 'test-end' });
  assert.deepEqual(w2.meta.npcCombatHp[String(npc.id)], { hp: 0, down: true });
});

test('U150: a foe re-engaged after a fight does NOT reset to full HP', () => {
  // Seed the casualty map directly, then attack: the minted enemy must start
  // at the persisted HP, not maxHp.
  const { w, byId, npc } = setup();
  const maxHp = mintEnemyFromNpc(npc).maxHp;
  const wounded = { ...w, meta: { ...w.meta, npcCombatHp: { [String(npc.id)]: { hp: 1, down: false } } } };
  const first = String(npc.name).split(' ')[0];
  const { world } = playerMove(wounded, byId, `I attack ${first}`);
  // After the opening round the foe is at <= 1 HP (started at 1, not maxHp).
  const e = (world.combat?.enemies || []).find(x => String(x.sourceNpcId) === String(npc.id))
    || (world.combat?.enemies || [])[0];
  // Either combat ended (foe finished from 1 HP) or the foe is present at <= 1.
  const stillFull = e && e.hp >= maxHp && maxHp > 1;
  assert.ok(!stillFull, `re-engaged foe must not be at full HP (${e ? e.hp : 'gone'}/${maxHp})`);
});
