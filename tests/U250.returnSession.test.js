// U250 — D-B3, the return-session "never forgets" gate (the moat made provable). A real
// playthrough (a deed → reputation, a quest chosen via D-B1, a met NPC, a position) survives
// save → reload byte-for-byte, and its CONSEQUENCES still fire afterward. Standing regression.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playerMove } from '../engine/playloop.js';
import { villageBakerWorld, PACKS } from '../scripts/convergence/fixtures.mjs';
import { exportWorld, importWorld } from '../engine/save.js';
import { worldHash } from '../engine/worldHash.js';
import { ensureWorld } from '../engine/state.js';
import { activeGoals } from '../engine/goals/goalContract.js';

function played() {
  let w = villageBakerWorld();
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  node.settlement.npcs.push({ id: 'npc_bandit', name: 'Brokefang', role: 'bandit', hostile: true });  // the quest target (still alive)
  node.settlement.npcs.push({ id: 'npc_ash', name: 'Ashblade', role: 'bandit', hostile: true });       // the deed (already done)
  w = ensureWorld(w);
  // a deed on Ashblade (reputation) — a DIFFERENT foe, so it does NOT auto-complete the Brokefang quest
  w = ensureWorld({ ...w, timeline: [...w.timeline, { id: 'r:deed', t: w.timeline.length, kind: 'resolution', data: { targetDefeated: 'npc_ash' } }] });
  w = playerMove(w, PACKS, "I'll deal with Brokefang").world;   // mint a defeat goal (stays active)
  w = playerMove(w, PACKS, "I'll go talk to Mira").world;        // meet Mira
  return w;
}

test('U250 return-session — play → save → reload preserves the whole playthrough (the moat)', () => {
  const w = played();
  const reloaded = importWorld(exportWorld(w));
  assert.equal(worldHash(reloaded), worldHash(w), 'worldHash identical after save + reload — nothing lost');
  assert.deepEqual(activeGoals(reloaded).map(g => g.targetRef), activeGoals(w).map(g => g.targetRef));  // the quest
  assert.ok(activeGoals(reloaded).length >= 1, 'the minted quest survived the reload');
  const mira = reloaded.map.nodes.flatMap(n => n.settlement?.npcs || []).find(p => p.id === 'npc_baker');
  assert.ok(mira?.conversationState?.metPlayer, 'the NPC still remembers meeting you');                  // memory
  assert.ok((reloaded.timeline || []).some(e => e?.data?.targetDefeated === 'npc_ash'), 'the deed survived'); // reputation source
  assert.equal(reloaded.map.currentNodeId, w.map.currentNodeId);                                          // position
});

test('U250 return-session — consequences persist: a stranger STILL greets you by your deed after reload', () => {
  let w = importWorld(exportWorld(played()));
  // a fresh stranger, added after the reload, recognizes the deed — proving reputation lives in the save
  w.map.nodes.find(n => n.id === w.map.currentNodeId).settlement.npcs.push({ id: 'npc_new', name: 'Pell Weaver', role: 'weaver', hostile: false });
  w = ensureWorld(w);
  assert.match(playerMove(w, PACKS, "I'll go talk to Pell").output.narration, /Word wrote of/);
});
