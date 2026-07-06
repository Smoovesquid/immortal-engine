// U573 — JR-HUNT-1: the hunt meets you on the road (docs/briefs/JR-HUNT-1-roadside-reckoning.md).
//
// THE BUG (MP-3 worker finding, 2026-07-06): playloop's fast-travel (journey) resolver returns
// BEFORE the normal per-turn worldTick call. So a hunt due on a fast-travel turn (heat ≥ HUNT_HEAT)
// did NOT fire on that turn — it slipped to the player's NEXT normal action. The reckoning belongs
// AT THE ROADSIDE: the hunters should meet the traveller at the journey's destination.
//
// THE FIX: a journey turn now runs worldTick exactly once (see U574 for the no-double-tick wall),
// so tickHunt fires as part of the journey turn and the hunters land at the arrival node.
//
// This test drives the REAL engine journey path (begin → go outside → "I head to <neighbour>") and
// asserts:
//   (a) over-threshold + fast-travel → the hunt fires ON the journey turn (huntedT latched, hunters
//       present at the arrival node);
//   (b) it composes with — does not replace — an interrupted (pending-encounter) journey: the hunt
//       still fires even when the road throws a brigand standoff;
//   (c) BELOW the threshold → a fast-travel turn brings NO hunt.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { HUNT_HEAT } from '../engine/morality/escalation.js';
import { assertWorldInvariants } from '../engine/invariants.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path.replace(/^\//, '')), 'utf8')));
  return byId;
}
const packs = loadPacks();

// npc count at a node — the hunters land in settlement.npcs (spawnEncounter ambush:false).
const npcCount = (w, id) => ((w.map?.nodes || []).find(n => n && n.id === id)?.settlement?.npcs || []).length;

// Boot outdoors, standing at a node with a named neighbour, ready to fast-travel.
function bootOutside(seed) {
  let w = beginAdventure(newWorld({
    seed, fate: 0.2, campaignId: `u573-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), packs).world;
  w = playerMove(w, packs, 'go outside').world;
  return w;
}
// The (deterministic) named neighbour to fast-travel toward, and its id.
function firstNeighbour(w) {
  const here = w.map.currentNodeId;
  const id = (w.map.edges || [])
    .filter(e => e.a === here || e.b === here)
    .map(e => (e.a === here ? e.b : e.a))[0];
  const name = (w.map.nodes || []).find(n => n && n.id === id)?.name || '';
  return { id, name };
}

test('U573-01: over-threshold heat + fast-travel → the hunt fires ON the journey turn (at the destination)', () => {
  // Seed u573b arrives CLEAN (no pending/ambush) at its first neighbour — the crispest case.
  let w = bootOutside('u573b');
  const dest = firstNeighbour(w);
  assert.ok(dest.name, 'sanity: there is a named neighbour to travel to');

  // Push heat over the line (the accrual algebra is proven in U563/U564).
  w = applyDeltas(w, [{ op: 'adjustHeat', by: HUNT_HEAT + 7 }]);
  assert.ok(w.party[0].morality.heat >= HUNT_HEAT, 'heat is over HUNT_HEAT before the journey');
  assert.equal(w.party[0].morality.huntedT, 0, 'the hunt has not fired yet (no latch)');
  const beforeNpc = npcCount(w, dest.id);

  const r = playerMove(w, packs, `I head to ${dest.name}`);
  w = r.world;

  assert.equal(String(w.map.currentNodeId), String(dest.id), 'the journey arrived at the destination');
  // THE FIX: the hunt fires on THIS turn — the latch is set and hunters are present at arrival.
  assert.ok(w.party[0].morality.huntedT > 0, 'the hunt fired ON the fast-travel turn (latch set)');
  assert.ok(npcCount(w, dest.id) > beforeNpc,
    `hunters met the traveller at the roadside (npcs ${beforeNpc} → ${npcCount(w, dest.id)})`);
  assertWorldInvariants(w);
});

test('U573-02: the hunt COMPOSES with an interrupted journey — it fires even on a pending-encounter turn', () => {
  // Seed tallow's first neighbour (Old Shrine) deterministically rolls a pending brigand encounter
  // on the road (JR-1 risk premium). The hunt must STILL fire — it composes with the road event,
  // it does not replace it. (The interrupt drops the traveller at a real node; the hunt reads that
  // node.)
  let w = bootOutside('tallow');
  const dest = firstNeighbour(w);
  w = applyDeltas(w, [{ op: 'adjustHeat', by: HUNT_HEAT + 7 }]);
  const before = w.party[0].morality.huntedT;
  assert.equal(before, 0, 'no latch before the journey');

  const r = playerMove(w, packs, `I head to ${dest.name}`);
  w = r.world;
  const stopId = String(w.map.currentNodeId);

  // The journey turn ticked the world once → the hunt fired regardless of the road interrupt.
  assert.ok(w.party[0].morality.huntedT > 0, 'the hunt fired on the journey turn even with a road interrupt');
  assert.ok(npcCount(w, stopId) > 0, 'hunters are present at the node the journey stopped at');
  assertWorldInvariants(w);
});

test('U573-03: BELOW the threshold → a fast-travel turn brings NO hunt', () => {
  let w = bootOutside('u573b');
  const dest = firstNeighbour(w);
  w = applyDeltas(w, [{ op: 'adjustHeat', by: HUNT_HEAT - 8 }]);
  assert.ok(w.party[0].morality.heat < HUNT_HEAT, 'heat is below HUNT_HEAT');
  const beforeNpc = npcCount(w, dest.id);

  const r = playerMove(w, packs, `I head to ${dest.name}`);
  w = r.world;

  assert.equal(w.party[0].morality.huntedT, 0, 'no latch — the hunt never armed below the threshold');
  assert.equal(npcCount(w, dest.id), beforeNpc, 'no hunters arrived on a below-threshold journey');
  assertWorldInvariants(w);
});
