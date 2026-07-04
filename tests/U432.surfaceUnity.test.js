// U432 — WS-3 surface unity (docs/briefs/WS-3-one-surface.md, docs/TABLETOP_MAP.md
// decision #3 "indoor<->outdoor is CONTINUOUS", PACKETS §TABLETOP WS-3 acceptance).
//
// Tim's pinned sighting: expanding the map while indoors used to SWAP SURFACES
// (interior plan -> overworld) and the two views disagreed. The fix retires the
// v0.28.8 stopgap branch in v1.js's in-play map mount — `inside ? renderLocalMap(w,
// {compact:true}) : renderContinuousMap(w, ...)` — so BOTH the compact in-play map
// and the fullscreen Map screen (renderMap(), which never had the fork) always
// resolve to the ONE continuous-sheet renderer (renderContinuousMap -> oneMap.js's
// renderOneMap). This locks:
//   (A) the retired branch is actually gone from v1.js's source (a renderer choice
//       keyed on scene.interior no longer exists in the play-map mount) — the ONE
//       v1.js hunk the brief licenses.
//   (B) with scene.interior set, the shared camera (oneMap.js's playerFocusWu +
//       cameraFor — the SAME rail both the old compact map and the fullscreen Map
//       screen read) resolves the player's position and centers on it at the
//       plan-scale default (worldSpace.BAND.plan) — not the outdoor band.
//   (C) stepping outside (a real engine call) keeps the SAME cameraFor/CAMS
//       object (no renderer swap) and widens the band to the outdoor default —
//       "band widens, same surface."
//   (D) walking room-to-room WHILE STAYING INDOORS recenters position but does
//       NOT re-snap the zoom (a manual wheel-zoom indoors is never fought by the
//       very next in-building move) — only a genuine indoor/outdoor crossing
//       changes the band, matching "expand changes SIZE, never surface."
//   (E) determinism: two independent boots of the same seed produce byte-identical
//       camera resolutions (x2) — this is presentation-only, no engine write, no
//       Math.random, worldHash unchanged.
// Hermetic — no DOM/canvas required (cameraFor/playerFocusWu are pure state-machine
// functions over campaign-keyed module state, exactly like U407/U408). No LLM/API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { BAND } from '../public/map/worldSpace.js';
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
const nextCampaign = () => `U432-cam-${++_camN}`;
const boot = (campaignId) => beginAdventure(
  newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null }, campaignId }),
  PACKS
).world;

const moveDeeper = (w) => playerMove(w, PACKS, 'I go through the doorway into the next room.').world;
const stepOut = (w) => playerMove(w, PACKS, 'I step out through the way to the open air.').world;

test('U432-A: the isInterior renderer fork is actually retired from v1.js\'s in-play map mount — one call, no branch on scene.interior', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'v1.js'), 'utf8');
  // The play-map mount now builds `inner` from exactly one renderContinuousMap
  // call — no `inside ? renderLocalMap(...) : renderContinuousMap(...)` ternary,
  // and no local `inside`/`isInterior` boolean gating which renderer runs.
  assert.ok(src.includes("const inner = renderContinuousMap(w,"), 'the play-map mount must build `inner` via a single unconditional renderContinuousMap call');
  assert.ok(!/renderLocalMap\(w,\s*\{\s*compact:\s*true\s*\}\)/.test(src), 'the play-surface must never call renderLocalMap(w, {compact:true}) — that was the retired branch\'s interior arm');
  // The only surviving renderLocalMap(...) calls are renderWalkPlace's own error
  // fallbacks (when placeFromWorldNode/createPlaceMap throw) — NOT the play-map
  // mount, and their signature (nulling placeCtl/placeCache first) is distinct
  // from the play-map's `inner`/`mapEl` construction. Skip lines that are pure
  // comments (this test file's own prose can legitimately mention the retired
  // call shape when documenting the fix).
  const lines = src.split('\n');
  const codeLines = lines.filter(l => !/^\s*\/\//.test(l));
  const joined = codeLines.join('\n');
  const remaining = [...joined.matchAll(/renderLocalMap\(/g)];
  assert.ok(remaining.length > 0, 'precondition: renderLocalMap must still exist on disk as a dead fallback (brief item 5), not deleted');
  for (const m of remaining) {
    const before = joined.slice(Math.max(0, m.index - 80), m.index);
    assert.ok(/placeCtl = null;\s*ui\.placeCache = null;\s*return\s*$/.test(before), 'every remaining renderLocalMap call must be a renderWalkPlace error fallback (`placeCtl = null; ui.placeCache = null; return renderLocalMap(...)`), not the play-surface mount');
  }
});

test('U432-B: with scene.interior set, the camera resolves to the player\'s room and centers at the plan-scale default (BAND.plan), not the outdoor band', () => {
  const w = boot(nextCampaign());
  assert.ok(w.scene?.interior, 'precondition: the tallow boot world starts indoors');
  const focus = playerFocusWu(w);
  assert.ok(focus, 'playerFocusWu resolves indoors');
  assert.ok(focus.sig.startsWith('in|'), 'precondition: the focus signature is tagged indoors');
  // Simulate the in-play embed's own call shape: an outdoor initialZoom is
  // passed (INPLAY_MAP_ZOOM, v1.js), but the indoor state must override it.
  const cam = cameraFor(w, 0.12, focus);
  assert.equal(cam.cx, focus.wx, 'camera centers on the resolved room (cx)');
  assert.equal(cam.cy, focus.wy, 'camera centers on the resolved room (cy)');
  assert.equal(cam.z, BAND.plan, 'a fresh indoor mount snaps to the plan-scale default, ignoring the caller\'s outdoor initialZoom');
});

test('U432-C: stepping outside keeps the SAME camera object (no renderer swap) and widens the band to the outdoor default', () => {
  const campaignId = nextCampaign();
  const wIn = boot(campaignId);
  const focusIn = playerFocusWu(wIn);
  const camIn = cameraFor(wIn, 0.12, focusIn);
  assert.equal(camIn.z, BAND.plan, 'precondition: indoors starts at plan scale');

  const wOut = stepOut(wIn);
  assert.equal(Boolean(wOut.scene?.interior), false, 'precondition: the engine actually stepped outside');
  const focusOut = playerFocusWu(wOut);
  assert.ok(focusOut, 'outdoor focus resolves');
  assert.ok(focusOut.sig.startsWith('out|') || focusOut.sig.startsWith('node|'), 'precondition: the focus signature is tagged outdoors');

  const camOut = cameraFor(wOut, 0.12, focusOut);
  assert.equal(camOut, camIn, 'cameraFor returns the SAME campaign-keyed camera object across the threshold — one surface, not a swapped renderer');
  assert.equal(camOut.cx, focusOut.wx, 'camera follows the player outside (cx)');
  assert.equal(camOut.cy, focusOut.wy, 'camera follows the player outside (cy)');
  assert.equal(camOut.z, 0.12, 'stepping outside widens the band to the outdoor default (the caller\'s initialZoom) — "band widens, same surface"');
});

test('U432-D: a room-to-room move that stays INDOORS recenters position but does NOT re-snap the zoom (a manual zoom is never fought by the next in-building move)', () => {
  const campaignId = nextCampaign();
  const w0 = boot(campaignId);
  const focus0 = playerFocusWu(w0);
  const cam = cameraFor(w0, 0.12, focus0);
  assert.equal(cam.z, BAND.plan, 'precondition: indoor mount at plan scale');

  // Simulate a manual wheel-zoom deeper than the plan default.
  cam.z = BAND.plan * 1.6;

  const w1 = moveDeeper(w0);
  assert.equal(Boolean(w1.scene?.interior), true, 'precondition: still indoors after the move');
  const roomBefore = String(w0.scene.interior.roomId), roomAfter = String(w1.scene.interior.roomId);
  assert.notEqual(roomAfter, roomBefore, 'precondition: the engine actually changed rooms');

  const focus1 = playerFocusWu(w1);
  assert.ok(focus1.sig.startsWith('in|'), 'precondition: still tagged indoors after the move');
  const camAfter = cameraFor(w1, 0.12, focus1);
  assert.equal(camAfter.cx, focus1.wx, 'camera recenters on the new room (cx)');
  assert.equal(camAfter.cy, focus1.wy, 'camera recenters on the new room (cy)');
  assert.equal(camAfter.z, BAND.plan * 1.6, 'the manual zoom survives an in-building room change — only a genuine indoor/outdoor crossing re-snaps the band');
});

test('U432-E: two independent boots of the same seed resolve the camera identically (determinism x2) and never mutate worldHash', () => {
  const project = () => {
    const w = boot(nextCampaign());
    const h0 = worldHash(w);
    const focus = playerFocusWu(w);
    const cam = cameraFor(w, 0.12, focus);
    const h1 = worldHash(w);
    return { cx: cam.cx, cy: cam.cy, z: cam.z, sig: focus.sig, hashStable: h1 === h0 };
  };
  const a = project();
  const b = project();
  assert.deepEqual(a, b, 'two independent boots of the same seed must resolve the camera identically');
  assert.ok(a.hashStable && b.hashStable, 'resolving the camera must never mutate anything worldHash covers');
});
