// U475 — MAP-3DR: the map mount SURVIVES v1's per-turn re-render (the root fix).
//
// v1's render() wipes and rebuilds the whole play DOM every typed turn. Before
// MAP-3DR the map was disposed + re-created each turn: the 2D ink drew instantly
// at a deep zoom, then the async 3D scene popped in over it — "two unrelated views
// flashed every sentence" (the 2026-07-03 park). The fix holds the map subtree at
// module level and RE-ADOPTS it: renderContinuousMap returns the SAME wrap node on
// the next render, so v1's appendChild just re-parents it and the canvas + WebGL
// context are never torn down.
//
// This locks the contract at DOM-node identity (jsdom-level, via a minimal stub —
// the repo has no jsdom and `three` is a CDN import, so the 3D layer's dynamic
// import fails gracefully to the 2D fallback, exactly as in a no-WebGL browser):
//   • two renderContinuousMap calls for the same surface (a "typed turn") return
//     the SAME wrap node AND the SAME 2D canvas node — no teardown, identity kept.
//   • disposeContinuousMap3d() (leaving the surface) DOES drop it — the next mount
//     is a fresh node — so the WebGL context can never leak across screens.
//   • the scene signature is STABLE when the world's contents are unchanged (the
//     diff that lets maybeRefreshScene skip a rebuild — no per-turn reconstruction),
//     and CHANGES on a real move (node/room), which is what triggers a re-point.
// Hermetic — no network, no WebGL, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { installDom, findCanvas } from './support/domStub.js';
import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
let _n = 0;
const boot = () => beginAdventure(
  newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null }, campaignId: `U475-${++_n}` }),
  PACKS
).world;

test('U475: two renders of the same surface reuse the SAME wrap + canvas node (no teardown across a typed turn)', async () => {
  const { teardown } = installDom();
  try {
    const cm = await import('../public/map/continuousMap.js');
    cm.disposeContinuousMap3d(); // clean module state before the test
    const w = boot();

    // First render (mount) and a second render (a "typed turn" re-render).
    const wrapA = cm.renderContinuousMap(w, { heightCss: '100%', initialZoom: 2.0 });
    const canvasA = findCanvas(wrapA);
    assert.ok(canvasA, 'the 2D map canvas mounts on first render');

    const wrapB = cm.renderContinuousMap(w, { heightCss: '100%', initialZoom: 2.0 });
    const canvasB = findCanvas(wrapB);

    assert.equal(wrapB, wrapA, 'the map wrapper node is REUSED across renders (same object) — v1 just re-parents it');
    assert.equal(canvasB, canvasA, 'the 2D canvas node is REUSED across renders (same object) — no teardown, WebGL-context-safe');
    cm.disposeContinuousMap3d();
  } finally { teardown(); }
});

test('U475: disposeContinuousMap3d drops the mount — the next render is a FRESH node (no context leak across screens)', async () => {
  const { teardown } = installDom();
  try {
    const cm = await import('../public/map/continuousMap.js');
    cm.disposeContinuousMap3d();
    const w = boot();
    const wrapA = cm.renderContinuousMap(w, { heightCss: '100%', initialZoom: 2.0 });
    cm.disposeContinuousMap3d(); // leaving the play/map surface
    const wrapB = cm.renderContinuousMap(w, { heightCss: '100%', initialZoom: 2.0 });
    assert.notEqual(wrapB, wrapA, 'after dispose the map re-mounts as a new node (fresh subtree) — the old context is gone');
    cm.disposeContinuousMap3d();
  } finally { teardown(); }
});

test('U475: the 3D-scene signature is stable on an unchanged world (diff → no per-turn rebuild) and changes on a real move', async () => {
  const cm = await import('../public/map/continuousMap.js');
  const w0 = boot();
  const sigA = cm.sceneSignature(w0);
  const sigB = cm.sceneSignature(w0);
  assert.equal(sigA, sigB, 'same world → identical scene signature — maybeRefreshScene can skip the rebuild (this is what kills the flash)');

  // A real move changes the signature (node/room), which is what re-points the scene.
  const w1 = playerMove(w0, PACKS, 'I go through the doorway into the next room.').world;
  const sig1 = cm.sceneSignature(w1);
  assert.notEqual(sig1, sigA, 'a room/node change moves the scene signature — the diff correctly detects a real move');
});
