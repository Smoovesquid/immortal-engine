// U280 - visual-map VG-F1: interior movement must not no-op or teleport.
//
// The visual map gate surfaced two engine-level failures on the demo seed:
//   1. "go east" advanced the interior room id, but left the persisted player
//      interior position stale.
//   2. A map/marker question containing "east" fell through to generic travel
//      while the player was still inside, changing the top-level node.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { DEMO_SEED } from '../engine/world/demoRegion.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}

const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: DEMO_SEED, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const inside = (w) => Boolean(w?.scene?.interior && typeof w.scene.interior === 'object');

function interiorSnap(w) {
  return {
    nodeId: String(w.map?.currentNodeId || ''),
    structureId: String(w.map?.currentStructureId || ''),
    roomId: String(w.map?.currentRoomId || ''),
    sceneStructureId: String(w.scene?.interior?.structureKey || ''),
    sceneRoomId: String(w.scene?.interior?.roomId || ''),
    partyInterior: w.party?.[0]?.position?.interior || null,
  };
}

test('U280: demo-seed east doorway move stays in the same structure and syncs player interior position', () => {
  const w0 = boot();
  assert.equal(inside(w0), true, 'precondition: demo seed starts inside a structure');
  const before = interiorSnap(w0);

  const r = playerMove(w0, PACKS, 'go east');
  const after = interiorSnap(r.world);

  assert.equal(after.nodeId, before.nodeId, 'room-to-room movement must not change the top-level node');
  assert.equal(after.structureId, before.structureId, 'room-to-room movement stays in the same structure');
  assert.equal(after.sceneStructureId, before.sceneStructureId, 'scene interior stays in the same structure');
  assert.notEqual(after.roomId, before.roomId, 'east reaches a real adjacent room on the demo-seed start');
  assert.equal(after.sceneRoomId, after.roomId, 'scene and map agree on the current room');
  assert.deepEqual(after.partyInterior, {
    structureId: after.sceneStructureId,
    roomId: after.sceneRoomId,
  }, 'party position interior mirrors the room move for save/render coherence');
});

test('U280: while inside, marker/map questions containing east do not leak into overworld travel', () => {
  let w = boot();
  w = playerMove(w, PACKS, 'go east').world;
  const before = interiorSnap(w);

  const r = playerMove(w, PACKS, "Hold on - did my marker actually move east on the map? It still looks like I'm on the left side, and that blue marker is still east of me. Which one am I?");
  const after = interiorSnap(r.world);

  assert.equal(inside(r.world), true, 'still inside after a map-position question');
  assert.equal(after.nodeId, before.nodeId, 'an interior map question must not move to a different node');
  assert.equal(after.structureId, before.structureId, 'an interior map question must not clear/change structure');
  assert.equal(after.roomId, before.roomId, 'an interior map question must not silently move rooms');
  assert.equal(after.sceneStructureId, before.sceneStructureId, 'scene structure remains stable');
  assert.equal(after.sceneRoomId, before.sceneRoomId, 'scene room remains stable');
});
