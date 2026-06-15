import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { beginCombat, mintEnemyFromNpc } from '../engine/combat/combatLifecycle.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Opus gate #1 (escape-mode chaos run): attacking a NEW present NPC mid-fight
// ("lunge at Petra's throat" while fighting Senna) never instantiated Petra as a
// combatant — the swing resolved to pure narration. A named, present, non-enemy
// NPC attacked mid-combat must join the fight. Conservative: a generic "stab him
// again" (the current foe) or table-talk must NOT add anyone.

function setup() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  // mode:'escape' = the LIVE combat engine (public/v1.js boots this).
  let w = beginAdventure(newWorld({ seed: 'glass-harbor', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const npcs = node.settlement.npcs || [];
  const names = npcs.map(n => String(n.name).split(' ')[0]);
  // Construct active combat against A directly with a high-HP enemy, so the fight
  // deterministically survives the target switch (a weak NPC would be finished or
  // flee on the opening round). beginCombat is the same machinery the engine uses.
  const enemyA = { ...mintEnemyFromNpc(npcs[0]), hp: 50, maxHp: 50, defeated: false };
  w = beginCombat(w, { enemies: [enemyA], reason: 'test' });
  assert.ok(w.combat?.active, 'combat active against first NPC');
  return { w, byId, a: names[0], b: names[1] };
}
const enemyNames = (w) => (w.combat?.enemies || []).map(e => String(e.name).split(' ')[0]);

test('U148: attacking a NEW named present NPC mid-fight adds them as a combatant', () => {
  const { w, byId, b } = setup();
  const before = enemyNames(w).length;
  const w2 = playerMove(w, byId, `I lunge at ${b}'s throat`).world;
  assert.ok(w2.combat?.active, 'still in combat');
  assert.ok(enemyNames(w2).includes(b), `${b} joined the fight`);
  assert.equal(enemyNames(w2).length, before + 1, 'exactly one enemy added');
});

test('U148: a generic "stab him again" does NOT add a new enemy', () => {
  const { w, byId } = setup();
  const before = enemyNames(w).length;
  const w2 = playerMove(w, byId, 'I stab him again').world;
  assert.equal(enemyNames(w2).length, before, 'no enemy added for the current foe');
});

test('U148: attacking the CURRENT enemy by name does not duplicate them', () => {
  const { w, byId, a } = setup();
  const before = enemyNames(w).length;
  const w2 = playerMove(w, byId, `I drive my blade into ${a}'s gut`).world;
  assert.equal(enemyNames(w2).length, before, 'current enemy not re-added');
});

test('U148: table-talk mid-fight adds no enemy', () => {
  const { w, byId } = setup();
  const before = enemyNames(w).length;
  const w2 = playerMove(w, byId, 'what are my options?').world;
  assert.equal(enemyNames(w2).length, before, 'a question adds no combatant');
});
