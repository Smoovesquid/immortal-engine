// U407 — WS-2 one camera, player-centered: camera math (docs/MAP_PATH.md Phase 1.2,
// docs/POSITION_AS_CANON.md §6 "the camera keeps the player centered", Tim
// 2026-07-04-pm). oneMap.js's cameraFor/playerFocusWu now recenter the camera on the
// player's ENGINE-TRUTHFUL location — read through WS-1's resolveEntityWuFromWorld
// (node -> outdoors walk-position or room-granular indoors) — on every real move, not
// just a node change. This locks:
//   (A) outdoors: the camera center equals the player's resolveEntityWu point.
//   (B) a scripted interior room-to-room move (the same real, deterministic,
//       no-LLM driver U401 uses) recenters the camera on the NEW room's own center.
//   (C) a simulated manual pan moves the camera away; the next real player move
//       snaps focus back to the player (the "looking" flag clears on an actual move).
//   (D) LOD band selection (worldSpace.fadeIn against BAND) is a pure function of z:
//       two independent calls with the same z (and the same BAND thresholds — one
//       seed, computed twice) return byte-identical results.
// Hermetic — no DOM/canvas required (cameraFor/playerFocusWu are pure state-machine
// functions over campaign-keyed module state; each test uses a unique campaignId so
// the CAMS singleton never leaks across cases). No LLM/API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import {
  placeFrame, BAND, fadeIn,
  buildingAnchorInPlace, interiorRoomToWu,
  resolveEntityWuFromWorld
} from '../public/map/worldSpace.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';
import { playerFocusWu, cameraFor } from '../public/map/oneMap.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();

// A fresh campaignId per test keeps oneMap.js's CAMS module singleton isolated —
// tests never see another test's camera state.
let _camN = 0;
const nextCampaign = () => `U407-cam-${++_camN}`;
const boot = (campaignId) => beginAdventure(
  newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null }, campaignId }),
  PACKS
).world;

const moveDeeper = (w) => playerMove(w, PACKS, 'I go through the doorway into the next room.').world;
const stepOut = (w) => playerMove(w, PACKS, 'I step out through the way to the open air.').world;

// The player's canonical tactical position, when present — the finer truth the
// marker/camera now resolve FROM (TAC-4). Included in the ground-truth loc so this
// helper agrees with production playerFocusWu (which threads the same pos).
function tacPosOf(w) {
  const p = w.party?.[0]?.pos;
  return (p && typeof p === 'object' && Number.isInteger(p.gx) && Number.isInteger(p.gy)) ? p : null;
}

// Same helper shape U401 uses: the exact {wx,wy} the engine's current location
// resolves to via WS-1's rail, independent of oneMap.js — the ground truth we
// check the camera against. TAC-4: the loc carries party[0].pos, so this ground
// truth is the SAME pos-aware point production resolves (a walk moves the marker to
// its canonical square, not just its room center).
function expectedFocus(w) {
  const nodeId = String(w.map.currentNodeId);
  const node = w.map.nodes.find(n => String(n.id) === nodeId);
  const inside = Boolean(w.scene?.interior);
  const place = node.settlement ? placeFromWorldNode(w, nodeId) : null;
  const frame = place ? placeFrame(place) : null;
  const pos = tacPosOf(w);
  if (!inside) {
    const walk = w.party?.[0]?.position;
    const loc = (walk && String(walk.nodeId) === nodeId && Number.isFinite(walk.ux) && Number.isFinite(walk.uy))
      ? { nodeId, ux: walk.ux, uy: walk.uy, pos } : { nodeId, pos };
    return resolveEntityWuFromWorld(w, place, frame, loc);
  }
  const structureKey = String(w.scene.interior.structureKey);
  const roomId = String(w.scene.interior.roomId);
  return resolveEntityWuFromWorld(w, place, frame, { nodeId, structureKey, roomId, pos });
}

test('U407-A: playerFocusWu resolves to the SAME address resolveEntityWu gives for the current location (indoors, boot world)', () => {
  const w = boot(nextCampaign());
  const focus = playerFocusWu(w);
  const expected = expectedFocus(w);
  assert.ok(focus, 'playerFocusWu resolves on the boot world');
  assert.ok(expected, 'precondition: the ground-truth resolver also resolves');
  assert.equal(focus.wx, expected.wx);
  assert.equal(focus.wy, expected.wy);
});

test('U407-B: cameraFor centers the camera on the player\'s resolved focus on first mount', () => {
  const w = boot(nextCampaign());
  const focus = playerFocusWu(w);
  const cam = cameraFor(w, undefined, focus);
  assert.equal(cam.cx, focus.wx, 'camera cx == player focus wx');
  assert.equal(cam.cy, focus.wy, 'camera cy == player focus wy');
});

test('U407-C: an interior room-to-room move (real engine call) recenters the camera on the NEW room\'s own center', () => {
  const campaignId = nextCampaign();
  const w0 = boot(campaignId);
  const focus0 = playerFocusWu(w0);
  const cam = cameraFor(w0, undefined, focus0);
  assert.equal(cam.cx, focus0.wx);
  assert.equal(cam.cy, focus0.wy);
  // cameraFor returns the SAME campaign-keyed object every call (it's the module
  // singleton the real map relies on to survive v1's per-turn full-DOM rebuild)
  // — snapshot the pre-move values now, or the next cameraFor() call below
  // mutates `cam` in place and any "did it move" comparison would compare an
  // object against itself.
  const preX = cam.cx, preY = cam.cy;

  const w1 = moveDeeper(w0);
  assert.equal(Boolean(w1.scene?.interior), true, 'precondition: still indoors after the move');
  const roomBefore = String(w0.scene.interior.roomId);
  const roomAfter = String(w1.scene.interior.roomId);
  assert.notEqual(roomAfter, roomBefore, 'precondition: the engine actually changed rooms');

  const focus1 = playerFocusWu(w1);
  const cam1 = cameraFor(w1, undefined, focus1);
  const expected1 = expectedFocus(w1);
  assert.equal(cam1.cx, expected1.wx, 'camera recentered on the new room (the player\'s tactical square in it) (cx)');
  assert.equal(cam1.cy, expected1.wy, 'camera recentered on the new room (the player\'s tactical square in it) (cy)');
  // Two different rooms can share a grid axis (e.g. two rooms at the same gy in
  // this building's layout both land at the same world-Y) — require the camera's
  // {cx,cy} pair to differ from the pre-move pair on AT LEAST one axis, not both;
  // the room-center equality asserts above already prove exact correctness.
  const moved = (cam1.cx !== preX) || (cam1.cy !== preY);
  assert.ok(moved, 'the camera actually moved with the room change (at least one axis)');
});

test('U407-D: an outside<->inside transition (real engine call) recenters the camera on the new side of the threshold', () => {
  const campaignId = nextCampaign();
  const wIn = boot(campaignId);
  const focusIn = playerFocusWu(wIn);
  const camIn = cameraFor(wIn, undefined, focusIn);
  assert.equal(camIn.cx, focusIn.wx);

  const wOut = stepOut(wIn);
  assert.equal(Boolean(wOut.scene?.interior), false, 'precondition: the engine actually stepped outside');
  const focusOut = playerFocusWu(wOut);
  assert.ok(focusOut, 'outdoor focus resolves');
  const camOut = cameraFor(wOut, undefined, focusOut);
  const expectedOut = expectedFocus(wOut);
  assert.equal(camOut.cx, expectedOut.wx, 'camera follows the player across the threshold (cx)');
  assert.equal(camOut.cy, expectedOut.wy, 'camera follows the player across the threshold (cy)');
});

test('U407-E: a simulated manual pan moves the camera away; the NEXT real player move snaps focus back to the player', () => {
  const campaignId = nextCampaign();
  const w0 = boot(campaignId);
  const focus0 = playerFocusWu(w0);
  const cam = cameraFor(w0, undefined, focus0);
  const centeredX = cam.cx, centeredY = cam.cy;

  // Simulate the drag-pan handler: move the camera away and mark "looking".
  cam.cx += 5000; cam.cy -= 3000;
  cam.lookingAway = true;
  assert.notEqual(cam.cx, centeredX, 'precondition: the simulated pan actually moved the camera');

  // Re-rendering the SAME location (no move) must NOT fight the manual pan.
  const focusSame = playerFocusWu(w0);
  const camStill = cameraFor(w0, undefined, focusSame);
  assert.equal(camStill.cx, cam.cx, 'panned-away camera holds its position across a same-location re-render');
  assert.equal(camStill.lookingAway, true, 'still marked as looking away — no move has happened yet');

  // A REAL player move changes the focus signature -> the camera snaps back.
  const w1 = moveDeeper(w0);
  const focus1 = playerFocusWu(w1);
  const camAfterMove = cameraFor(w1, undefined, focus1);
  const expected1 = expectedFocus(w1);
  assert.equal(camAfterMove.cx, expected1.wx, 'the next real move re-centers on the player (cx)');
  assert.equal(camAfterMove.cy, expected1.wy, 'the next real move re-centers on the player (cy)');
  assert.equal(camAfterMove.lookingAway, false, 'the looking-away flag clears on a real move');
});

test('U407-F: LOD band selection (worldSpace.fadeIn against BAND) is a pure function of z — two independent computations at the same z, same BAND thresholds, agree exactly', () => {
  // "Two builds, same seed" for a pure LOD function: call it twice, independently,
  // across the whole region/settlement/street band set, and require byte-identical
  // (not merely close) results — the fade must never depend on hidden state.
  const zs = [BAND.region * 0.5, BAND.region, BAND.region * 1.5, BAND.settlement, BAND.settlement * 2, BAND.street * 0.9, BAND.street * 3];
  for (const z of zs) {
    const run1 = {
      region: fadeIn(z, BAND.region * 0.75, BAND.region * 1.9),
      settlement: fadeIn(z, BAND.settlement * 0.7, BAND.settlement * 4),
      street: fadeIn(z, BAND.street * 0.8, BAND.street * 1.8)
    };
    const run2 = {
      region: fadeIn(z, BAND.region * 0.75, BAND.region * 1.9),
      settlement: fadeIn(z, BAND.settlement * 0.7, BAND.settlement * 4),
      street: fadeIn(z, BAND.street * 0.8, BAND.street * 1.8)
    };
    assert.deepEqual(run2, run1, `fadeIn(z=${z}) must be identical across independent calls`);
    for (const k of Object.keys(run1)) {
      assert.ok(run1[k] >= 0 && run1[k] <= 1, `${k} fade at z=${z} stays in [0,1]`);
    }
  }
  // Monotonic across the region band's own transition window (never a pop/dip).
  const a = fadeIn(BAND.region * 0.75, BAND.region * 0.75, BAND.region * 1.9);
  const b = fadeIn(BAND.region * 1.2, BAND.region * 0.75, BAND.region * 1.9);
  const c = fadeIn(BAND.region * 1.9, BAND.region * 0.75, BAND.region * 1.9);
  assert.ok(a <= b && b <= c, 'fadeIn is monotonically non-decreasing across its own band window');
});
