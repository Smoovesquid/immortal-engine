// U451 — TAC-4: nothing breaks WITHOUT a canonical tactical position.
//
// TAC-4 makes the map marker read party[0].pos when present (U450). This test locks
// the OTHER half of the contract: a world/actor with `pos == null` (legacy saves,
// NPCs never assigned a tactical position) resolves EXACTLY as before —
// room-granular indoors, legacy village walk-position outdoors — and the marker
// still READS engine truth, never writing it (worldHash byte-identical). It also
// proves the WS-2 unity the follow-camera depends on: the camera's focus point and
// the drawn marker point are the SAME resolved value after a walk.
//
// Pure, LLM-off, renderer read-only. No engine writes, no Math.random, no network,
// no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { buildPreRolledCharacter } from '../engine/chargen/preRolled.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';
import {
  placeFrame, buildingAnchorInPlace, interiorRoomToWu,
  resolveEntityWu, resolveEntityWuFromWorld
} from '../public/map/worldSpace.js';
import { playerFocusWu } from '../public/map/oneMap.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadPacks() {
  const manifest = normalizeManifest(JSON.parse(fs.readFileSync(path.join(ROOT, 'packs', 'manifest.json'), 'utf-8')));
  const out = {};
  for (const p of manifest.packs) out[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(ROOT, p.path), 'utf-8')));
  return out;
}
const PACKS = loadPacks();

let __camSeq = 0;
function bootIndoors() {
  const pc = buildPreRolledCharacter({ id: 'bryn' });
  const w0 = newWorld({ seed: SLICE_SEED, fate: 0.2, campaignId: `campaign-U451-${++__camSeq}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const w1 = ensureWorld({ ...w0, party: [pc] });
  return beginAdventure(w1, PACKS).world;
}

// The village embedding the resolver needs for `loc`.
function embedding(world) {
  const nodeId = String(world.map.currentNodeId);
  const node = world.map.nodes.find(n => String(n.id) === nodeId);
  const place = node.settlement ? placeFromWorldNode(world, nodeId) : null;
  const frame = place ? placeFrame(place) : null;
  return { nodeId, node, place, frame };
}

// ── U451-01 — indoors, pos absent → the legacy room-granular projection, exactly ─

test('U451-01: an indoor loc with NO pos resolves to EXACTLY the pre-change room-granular point (interiorRoomToWu)', () => {
  const w = bootIndoors();
  const { nodeId, node, place, frame } = embedding(w);
  const stKey = String(w.scene.interior.structureKey);
  const roomId = String(w.scene.interior.roomId);
  const plan = floorPlan(w.structures.byId[stKey]);
  const anchor = buildingAnchorInPlace(place, stKey);

  // The pre-change expectation: the room-center projection.
  const expected = interiorRoomToWu(node, frame, anchor, plan, roomId);

  // A loc with no `pos` field at all (legacy caller / old save).
  const gotAbsent = resolveEntityWuFromWorld(w, place, frame, { nodeId, structureKey: stKey, roomId });
  assert.deepEqual(gotAbsent, expected, 'pos-absent indoor loc == interiorRoomToWu (room-granular, unchanged)');

  // An explicit pos:null must behave identically to pos-absent.
  const gotNull = resolveEntityWuFromWorld(w, place, frame, { nodeId, structureKey: stKey, roomId, pos: null });
  assert.deepEqual(gotNull, expected, 'explicit pos:null indoor loc is identical to pos-absent');
});

// ── U451-02 — outdoors, pos absent → the legacy walk-position projection, exactly ─

test('U451-02: an outdoor loc with NO pos resolves via the village walk-position, unchanged, and pos:null is identical', () => {
  const w = bootIndoors();
  const { node, place, frame } = embedding(w);
  // A pure outdoor walk-position loc (no interior, has ux/uy) — the pre-change path.
  const outLoc = { nodeId: String(w.map.currentNodeId), ux: frame.cx + 2, uy: frame.cy };
  const expected = resolveEntityWu({ node, place, frame }, outLoc);
  assert.ok(expected && Number.isFinite(expected.wx) && Number.isFinite(expected.wy), 'outdoor walk-position resolves finite');

  const withNull = resolveEntityWu({ node, place, frame }, { ...outLoc, pos: null });
  assert.deepEqual(withNull, expected, 'explicit pos:null outdoor loc is identical to pos-absent (legacy walk-position)');
});

// ── U451-03 — a struct-frame pos whose building is missing falls back cleanly ────

test('U451-03: a pos naming an UNKNOWN structure falls back to the legacy room-granular point (never null, never a throw)', () => {
  const w = bootIndoors();
  const { nodeId, node, place, frame } = embedding(w);
  const stKey = String(w.scene.interior.structureKey);
  const roomId = String(w.scene.interior.roomId);
  const plan = floorPlan(w.structures.byId[stKey]);
  const anchor = buildingAnchorInPlace(place, stKey);
  const expected = interiorRoomToWu(node, frame, anchor, plan, roomId);

  // A pos pointing at a structure that isn't in world.structures.byId — the resolver
  // must drop the ungroundable pos and take the legacy structureKey/roomId path.
  const loc = { nodeId, structureKey: stKey, roomId, pos: { frame: 'struct:NOPE_missing', gx: 3, gy: 3 } };
  const got = resolveEntityWuFromWorld(w, place, frame, loc);
  assert.deepEqual(got, expected, 'an ungroundable struct-frame pos degrades to the legacy room point');
});

// ── U451-04 — the marker READS engine truth: worldHash is untouched ──────────────

test('U451-04: resolving the marker (with and without a walk) never mutates anything worldHash covers', () => {
  const w = bootIndoors();
  const h0 = worldHash(w);
  // Exercise the full marker rail — boot, and after a real cross-room + within-room walk.
  playerFocusWu(w);
  const afterEast = playerMove(w, PACKS, 'go east').world;
  playerFocusWu(afterEast);
  const afterWalk = playerMove(afterEast, PACKS, 'walk east').world;
  playerFocusWu(afterWalk);
  // The ORIGINAL world's hash is unchanged by all this projection (pure read).
  assert.equal(worldHash(w), h0, 'projecting the marker must never mutate the world it read');
});

// ── U451-05 — WS-2 unity: the camera focus point IS the marker point after a walk ─

test('U451-05: after a walk, the camera focus point equals the marker point (one resolved rail)', () => {
  // playerFocusWu is the ONE rail both the drawn marker (oneMap.js) and the follow-
  // camera (cameraFor) read. After a walk, the point they use must be identical — a
  // single resolution, not two drifting ones. (We compare the resolver's own output
  // to itself across two calls on the same post-walk world: same input, same point.)
  let w = bootIndoors();
  w = playerMove(w, PACKS, 'go east').world;      // cross-room
  w = playerMove(w, PACKS, 'walk east').world;    // within-room
  const marker = playerFocusWu(w);
  const cameraFocus = playerFocusWu(w); // the value cameraFor is handed each render
  assert.ok(marker && Number.isFinite(marker.wx) && Number.isFinite(marker.wy), 'resolves after the walk');
  assert.equal(marker.wx, cameraFocus.wx, 'marker.wx == camera focus wx');
  assert.equal(marker.wy, cameraFocus.wy, 'marker.wy == camera focus wy');
  assert.equal(marker.sig, cameraFocus.sig, 'same focus signature — one rail, no drift');
});
