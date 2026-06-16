import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { beginCombat, mintEnemyFromNpc } from '../engine/combat/combatLifecycle.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { hasCondition } from '../engine/combat/conditions.js';

// The grapple slice wired into the LIVE escape path (escapeCombat): typed
// "grab / throw / choke" routes through resolveEscapeCombatTurn and carries the
// grapple state as conditions across rounds, ending in unconscious.

function setup() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  let w = beginAdventure(newWorld({ seed: 'glass-harbor', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  const npc = w.map.nodes.find(n => n.id === w.map.currentNodeId).settlement.npcs[0];
  // a tough lone foe so the chain has room to play out deterministically-ish
  w = beginCombat(w, { enemies: [{ ...mintEnemyFromNpc(npc), hp: 40, maxHp: 40 }], reason: 'test' });
  return { w, byId, nm: String(npc.name).split(' ')[0] };
}
const foe = (w) => (w.combat?.enemies || [])[0];

test('U152: typed "grab" applies grappled via the live escape resolver', () => {
  let { w, byId, nm } = setup();
  // retry a couple of rounds in case of a low roll — the point is the route works
  for (let i = 0; i < 4 && !hasCondition(foe(w)?.conditions, 'grappled'); i++) {
    w = playerMove(w, byId, `I grab ${nm} and clinch hard`).world;
  }
  assert.ok(w.combat?.active, 'still in combat');
  assert.ok(hasCondition(foe(w).conditions, 'grappled'), 'foe is grappled via the live path');
});

test('U152: a sustained choke finishes a grappled foe (unconscious/defeated)', () => {
  let { w, byId, nm } = setup();
  for (let i = 0; i < 6 && !hasCondition(foe(w)?.conditions, 'grappled'); i++) {
    w = playerMove(w, byId, `I grab ${nm} in a tight clinch`).world;
  }
  assert.ok(hasCondition(foe(w).conditions, 'grappled'), 'grip established');
  // choke until out (CHOKE_ROUNDS=3, but allow re-grips if it slips)
  for (let i = 0; i < 12 && !foe(w)?.defeated; i++) {
    if (!hasCondition(foe(w)?.conditions, 'grappled')) { w = playerMove(w, byId, `I grab ${nm} again`).world; continue; }
    w = playerMove(w, byId, `I choke ${nm}`).world;
  }
  assert.ok(foe(w)?.defeated || !w.combat?.active, 'foe choked out / fight over');
});

test('U152: "throw" without a grip first does not crash and is a no-op clinch-wise', () => {
  let { w, byId, nm } = setup();
  const before = (foe(w).conditions || []).length;
  w = playerMove(w, byId, `I throw ${nm} to the ground`).world; // no grip yet
  assert.ok(w.combat?.active);
  assert.equal((foe(w).conditions || []).length, before, 'no prone applied without a grip');
});
