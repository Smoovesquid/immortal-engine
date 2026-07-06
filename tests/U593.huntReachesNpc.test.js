// U593 — MP-6: THE HUNT REACHES NPCs (docs/MORAL_PHYSICS.md §7 Arc A · §4 T3 row).
//
// Deliverable 1 of the Carl Witness Test. The physics are the WORLD'S — so an NPC evildoer whose
// own heat crosses HUNT_HEAT is answered the SAME way the player is: avengers arrive at HIS node
// through the EXISTING spawnEncounter organ, latched once per crossing on HIS morality record. Before
// MP-6 the hunt (worldTick.tickHunt) read the PLAYER's heat only (party[0]); U591-04 documented this
// as "the hook MP-6 can hang the hunt-reaches-Carl assertion on." This file lands that beat and pins
// the spine invariants around it:
//   (01) a stamped, over-threshold NPC at the current node draws the hunt at HIS node;
//   (02) it fires ONCE per crossing — a huntedT latch on the NPC's own record stops a re-spawn every
//        tick (mirrors the player's latch, U564-04);
//   (03) the PLAYER's record is never touched by the NPC hunt (no player heat, no player huntedT);
//   (04) a below-threshold stamped NPC draws NOTHING;
//   (05) NO-NPC-OFFENDER INVARIANCE — a run with no over-threshold NPC is byte-identical to before
//        (worldHash equality run-to-run) and the player hunt is unchanged (U564 stays green: a
//        player-only over-threshold world still spawns exactly the player's hunt and nothing else).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldTick } from '../engine/worldTick.js';
import { worldHash } from '../engine/worldHash.js';
import { HUNT_HEAT } from '../engine/morality/escalation.js';
import { assertWorldInvariants } from '../engine/invariants.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();
const CARL = 'figure_carl';

// Boot the slice seed — it places Carl AT the start node (the current node), co-located with the
// idle player. So "Carl's node" is the current node, and the hunt lands on him in view.
function bootSlice(seed = 'aldermere') {
  return beginAdventure(newWorld({
    seed, fate: 0.3, campaignId: `u593-${seed}`, mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), packs).world;
}
function currentNode(w) {
  return (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId) || null;
}
function carlAtCurrent(w) {
  return (currentNode(w)?.settlement?.npcs || []).find(x => x && String(x.id) === CARL) || null;
}
function npcCount(w, nodeId) {
  const node = (w.map?.nodes || []).find(n => n && n.id === nodeId);
  return (node?.settlement?.npcs || []).length;
}
// Push Carl's own heat over the line in ONE recorded deed (the accrual algebra is proven in U563;
// here we want a controlled crossing, not the whole cadence). recordDeed with actorId=Carl stamps
// HIS morality-lite record — the honest NPC path (effectsCore mutateNpcAnywhere).
function stampCarlOverThreshold(w, nodeId) {
  const witnesses = (currentNode(w)?.settlement?.npcs || [])
    .filter(n => n && String(n.id) !== CARL).map(n => String(n.id)).slice(0, 4);
  // Several HEAVY cruelties in one batch → heat well over HUNT_HEAT (each ~+17 at WITS 10).
  const deltas = [];
  for (let k = 0; k < 4; k++) {
    deltas.push({ op: 'recordDeed', deedKind: 'cruelty', severity: 20, actorId: CARL, nodeId, witnesses, summary: `carl-atrocity-${k}`, t: k });
  }
  return applyDeltas(w, deltas);
}

test('U593-01: a stamped, over-threshold NPC at the current node draws the hunt at HIS node', () => {
  let w = bootSlice();
  const here = String(w.map.currentNodeId);
  assert.ok(carlAtCurrent(w), 'fixture: Carl stands at the current node on the slice seed');
  assert.equal(carlAtCurrent(w).morality ?? null, null, 'a clean NPC carries no morality accumulator yet (lazy)');

  w = stampCarlOverThreshold(w, here);
  assert.ok(carlAtCurrent(w).morality.heat >= HUNT_HEAT, 'Carl\'s OWN heat is over HUNT_HEAT');
  const beforeNpcs = npcCount(w, here);
  const playerHeat0 = w.party[0].morality.heat;

  const w2 = worldTick(w, 'u593-hunt-fires');
  assert.ok(npcCount(w2, here) > beforeNpcs, `avengers arrived at Carl's node (npcs ${beforeNpcs} → ${npcCount(w2, here)})`);
  assert.ok(carlAtCurrent(w2).morality.huntedT > 0, 'the hunt latch was set on CARL\'s own record');
  // The player, who did nothing, is untouched.
  assert.equal(w2.party[0].morality.heat, playerHeat0, 'the player accrued no heat');
  assert.equal(w2.party[0].morality.huntedT, 0, 'the player\'s hunt latch was never set (the NPC hunt is not the player\'s)');
  assertWorldInvariants(w2);
});

test('U593-02: the NPC hunt fires ONCE per crossing — the latch stops a re-spawn every tick', () => {
  let w = bootSlice();
  const here = String(w.map.currentNodeId);
  w = stampCarlOverThreshold(w, here);

  const t1 = worldTick(w, 'u593-a');
  const afterFirst = npcCount(t1, here);
  assert.ok(afterFirst > npcCount(w, here), 'first tick: the hunt arrives at Carl');
  assert.ok(carlAtCurrent(t1).morality.huntedT > 0, 'latch set on Carl');

  // Immediate next tick: Carl still hot, latch set → NO new avengers.
  const t2 = worldTick(t1, 'u593-b');
  assert.equal(npcCount(t2, here), afterFirst, 'second tick while hot: no re-spawn (Carl\'s latch holds)');
  // And a third, to be sure it is a true latch, not a one-tick coincidence.
  const t3 = worldTick(t2, 'u593-c');
  assert.equal(npcCount(t3, here), afterFirst, 'third tick: still latched — the reckoning came once');
  assertWorldInvariants(t3);
});

test('U593-03: a BELOW-threshold stamped NPC draws no hunt', () => {
  let w = bootSlice();
  const here = String(w.map.currentNodeId);
  // One MODERATE deed → Carl is stamped but under HUNT_HEAT.
  const witnesses = (currentNode(w)?.settlement?.npcs || []).filter(n => n && String(n.id) !== CARL).map(n => String(n.id)).slice(0, 2);
  w = applyDeltas(w, [{ op: 'recordDeed', deedKind: 'cruelty', severity: 12, actorId: CARL, nodeId: here, witnesses, summary: 'carl-mild', t: 0 }]);
  assert.ok(carlAtCurrent(w).morality, 'Carl now carries an accumulator');
  assert.ok(carlAtCurrent(w).morality.heat < HUNT_HEAT, 'but his heat is below HUNT_HEAT');

  const before = npcCount(w, here);
  const w2 = worldTick(w, 'u593-under');
  assert.equal(npcCount(w2, here), before, 'no avengers arrived below the threshold');
  assert.equal(carlAtCurrent(w2).morality.huntedT, 0, 'no latch — Carl was never hunted');
  assertWorldInvariants(w2);
});

test('U593-04: THE NPC HUNT IS DETERMINISTIC — same seed, same tick → identical outcome', () => {
  const run = () => {
    let w = bootSlice(); // slice seed places Carl at the current node
    w = stampCarlOverThreshold(w, String(w.map.currentNodeId));
    return worldTick(w, 'u593-same-tick');
  };
  assert.equal(worldHash(run()), worldHash(run()), 'two identical over-threshold ticks → identical worldHash');
});

test('U593-05: NO-NPC-OFFENDER INVARIANCE — the NPC hunt draws nothing on a world without one; the player hunt is unchanged (U564 stays green)', () => {
  // (a) A pure player-over-threshold world: the player hunt must still fire, and the NPC branch must
  //     add NOTHING (no NPC at the node carries an accumulator). This is the U564-01 scenario — it
  //     must be byte-identical run-to-run and the hunters must be exactly the player's.
  function playerOnlyHunt(seed) {
    let w = beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u593-po-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
    w = applyDeltas(w, [{ op: 'adjustHeat', by: HUNT_HEAT + 5 }]);
    return worldTick(w, 'player-only');
  }
  const a = playerOnlyHunt('u593-po');
  const b = playerOnlyHunt('u593-po');
  assert.equal(worldHash(a), worldHash(b), 'a player-only hunt is deterministic run-to-run (the NPC branch is inert)');
  assert.ok(a.party[0].morality.huntedT > 0, 'the player hunt still fires (unchanged)');
  // No NPC anywhere gained a hunt latch — the NPC branch touched nothing.
  const anyNpcHunted = (a.map?.nodes || []).some(n => (n.settlement?.npcs || []).some(x => x && x.morality && Number(x.morality.huntedT || 0) > 0));
  assert.equal(anyNpcHunted, false, 'no NPC was hunted in a player-only world');

  // (b) A grind on a seed with NO Carl: no NPC ever crosses the threshold → no NPC hunt, and the run
  //     is deterministic. (The lazy accumulator never even appears.)
  function noCarlGrind(seed) {
    let w = beginAdventure(newWorld({ seed, fate: 0.3, campaignId: `u593-nc-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
    for (let i = 0; i < 30; i++) w = worldTick(w, `${seed}|nc|${i}`);
    return w;
  }
  const c = noCarlGrind('u593-nocarl');
  const d = noCarlGrind('u593-nocarl');
  assert.equal(worldHash(c), worldHash(d), 'a no-Carl grind is deterministic run-to-run');
  const anyNpcMoral = (c.map?.nodes || []).some(n => (n.settlement?.npcs || []).some(x => x && x.morality));
  assert.equal(anyNpcMoral, false, 'no NPC gained a morality accumulator on a seed with no offender (nothing else moved)');
  assertWorldInvariants(c);
});
