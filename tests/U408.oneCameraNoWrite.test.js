// U408 — WS-2 one camera, player-centered: no-write proof (docs/MAP_PATH.md Phase
// 1.2, docs/POSITION_AS_CANON.md §6 "camera/zoom/tilt never write"). The camera
// (oneMap.js cameraFor/playerFocusWu) and the marker it feeds are a READ-ONLY view
// over engine state — this locks:
//   (A) computing the player's camera focus (playerFocusWu) never mutates worldHash.
//   (B) simulating a full camera session — mount, wheel-zoom, drag-pan ("looking
//       away"), a real player move, recenter — never mutates worldHash, at any point
//       along the sequence.
//   (C) the marker's derived position (what oneMap.js now draws it at) is EXACTLY
//       playerFocusWu's result, which is EXACTLY WS-1's resolveEntityWu address —
//       for the boot world, no daylight between "what the camera centers on" and
//       "what the marker draws at" and "engine ground truth."
// Hermetic — no DOM/canvas required. No LLM/API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { placeFrame, resolveEntityWuFromWorld } from '../public/map/worldSpace.js';
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

let _camN = 0;
const nextCampaign = () => `U408-cam-${++_camN}`;
const boot = (campaignId) => beginAdventure(
  newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null }, campaignId }),
  PACKS
).world;

test('U408-A: playerFocusWu never mutates worldHash (single call, boot world)', () => {
  const w = boot(nextCampaign());
  const h0 = worldHash(w);
  const focus = playerFocusWu(w);
  const h1 = worldHash(w);
  assert.ok(focus, 'precondition: playerFocusWu resolves on the boot world');
  assert.equal(h1, h0, 'computing the camera focus must never mutate anything worldHash covers');
});

test('U408-B: a full simulated camera session — mount, wheel-zoom, drag-pan, recenter — never mutates worldHash at any step', () => {
  const campaignId = nextCampaign();
  const w = boot(campaignId);
  const h0 = worldHash(w);

  // Mount: cameraFor's first call for this campaign (module-singleton CAMS init).
  const focus0 = playerFocusWu(w);
  const cam = cameraFor(w, undefined, focus0);
  assert.equal(worldHash(w), h0, 'after camera mount');

  // Wheel-zoom: exactly what the real handler does (mutate cam.z, keep the
  // cursor's world point fixed) — view-state only, no world touched.
  cam.z = Math.max(0.008, Math.min(16, cam.z * 1.4));
  assert.equal(worldHash(w), h0, 'after a simulated wheel-zoom');

  // Drag-pan: exactly what the real handler does (mutate cam.cx/cy, set
  // lookingAway) — view-state only.
  cam.cx += 1200; cam.cy -= 800; cam.lookingAway = true;
  assert.equal(worldHash(w), h0, 'after a simulated drag-pan (looking away)');

  // Re-render the SAME world (no move) while looking away — cameraFor must not
  // touch the world even when it leaves the pan in place.
  const focusSame = playerFocusWu(w);
  cameraFor(w, undefined, focusSame);
  assert.equal(worldHash(w), h0, 'after a same-location re-render while looking away');

  // A real player move (the only thing allowed to touch the world) — captured
  // as its OWN hash; then recentering the camera on the moved world must not
  // mutate ANYTHING FURTHER (the move's hash is stable across the recenter).
  const w1 = playerMove(w, PACKS, 'I go through the doorway into the next room.').world;
  const h1 = worldHash(w1);
  const focus1 = playerFocusWu(w1);
  assert.equal(worldHash(w1), h1, 'after computing the post-move camera focus');
  cameraFor(w1, undefined, focus1);
  assert.equal(worldHash(w1), h1, 'after recentering the camera on the post-move world');
});

test('U408-C: the marker\'s derived position for the boot world matches WS-1\'s resolveEntityWu exactly (no daylight between camera, marker, and ground truth)', () => {
  const w = boot(nextCampaign());
  const nodeId = String(w.map.currentNodeId);
  const node = w.map.nodes.find(n => String(n.id) === nodeId);
  const inside = Boolean(w.scene?.interior);
  const place = node.settlement ? placeFromWorldNode(w, nodeId) : null;
  const frame = place ? placeFrame(place) : null;

  // Ground truth, computed independently of oneMap.js (mirrors U400/U401's own
  // pattern): the exact same {nodeId[,structureKey,roomId]|[,ux,uy]} shape
  // resolveEntityWuFromWorld expects — plus party[0].pos (TAC-4: the marker/camera
  // resolve from the canonical tactical square when it's present, so the ground
  // truth carries it too).
  const tacPos = (() => {
    const p = w.party?.[0]?.pos;
    return (p && typeof p === 'object' && Number.isInteger(p.gx) && Number.isInteger(p.gy)) ? p : null;
  })();
  const loc = inside
    ? { nodeId, structureKey: String(w.scene.interior.structureKey), roomId: String(w.scene.interior.roomId), pos: tacPos }
    : (() => {
        const walk = w.party?.[0]?.position;
        return (walk && String(walk.nodeId) === nodeId && Number.isFinite(walk.ux) && Number.isFinite(walk.uy))
          ? { nodeId, ux: walk.ux, uy: walk.uy, pos: tacPos } : { nodeId, pos: tacPos };
      })();
  const groundTruth = resolveEntityWuFromWorld(w, place, frame, loc);
  assert.ok(groundTruth, 'precondition: ground truth resolves on the boot world');

  // What the camera (and the marker fed from the SAME playerFocusWu call inside
  // renderOneMap) actually uses.
  const focus = playerFocusWu(w);
  assert.ok(focus, 'playerFocusWu resolves');
  assert.equal(focus.wx, groundTruth.wx, 'marker/camera wx == resolveEntityWu wx');
  assert.equal(focus.wy, groundTruth.wy, 'marker/camera wy == resolveEntityWu wy');

  // And the camera itself centers on exactly that point.
  const cam = cameraFor(w, undefined, focus);
  assert.equal(cam.cx, groundTruth.wx, 'camera cx == resolveEntityWu wx');
  assert.equal(cam.cy, groundTruth.wy, 'camera cy == resolveEntityWu wy');
});
