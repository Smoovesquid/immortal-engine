import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { beginCombat, mintEnemyFromNpc } from '../engine/combat/combatLifecycle.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Environmental hazards wired into the LIVE escape path (out of combat + in the
// escape resolver). The chaos gate caught "kick the beam, roof comes down on us"
// narrated with zero effect — it now deals SRD damage to the PC and area foes.

function setup() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  let w = beginAdventure(newWorld({ seed: 'glass-harbor', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  const npc = w.map.nodes.find(n => n.id === w.map.currentNodeId).settlement.npcs[0];
  return { w, byId, npc };
}

test('U159: an out-of-combat hazard decrements escapeHp', () => {
  const { w, byId } = setup();
  const before = w.meta.escapeHp;
  const { world, output } = playerMove(w, byId, 'I kick the support beam until the whole roof comes down on us');
  assert.ok(world.meta.escapeHp < before, 'PC took collapse damage');
  assert.match(output.mechanics, /hazard:collapse/);
});

test('U159: "throw myself out the window" reads as a fall, not innocent-recoil', () => {
  const { w, byId } = setup();
  const { output } = playerMove(w, byId, 'I throw myself out the window');
  assert.match(output.mechanics, /hazard:fall/);
});

test('U159: an in-combat collapse hits the PC AND area enemies', () => {
  const { w, byId, npc } = setup();
  const w1 = beginCombat(w, { enemies: [{ ...mintEnemyFromNpc(npc), hp: 30, maxHp: 30 }], reason: 'test' });
  const hpBefore = w1.meta.escapeHp;
  const enemyBefore = w1.combat.enemies[0].hp;
  const { world } = playerMove(w1, byId, 'I bring the whole ceiling down on everyone');
  assert.ok(world.meta.escapeHp < hpBefore, 'PC caught in the collapse');
  const e = (world.combat?.enemies || [])[0];
  // enemy either took area damage or the fight ended with them down
  assert.ok(!e || e.hp < enemyBefore || e.defeated || !world.combat?.active, 'enemy caught in the area');
});

test('U159: a benign movement intent is not a hazard', () => {
  const { w, byId } = setup();
  const { output } = playerMove(w, byId, 'I walk to the well');
  assert.doesNotMatch(String(output.mechanics || ''), /hazard:/);
});
