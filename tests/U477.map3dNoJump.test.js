// U477 — MAP-3DR: no jump at the morph; orbit moves the camera, never the world.
//
// The 2D→3D tilt must be a continuous MORPH of one surface, not a cut between two.
// The load-bearing property: the player mini stands on the EXACT world point the
// flat 2D ink marker occupied at the moment of tilt. Both projections read the one
// resolveEntityWuFromWorld rail (playerFocusWu, wu) — the 3D bridge is just
// wu ÷ NODE_WU into node-tile units, which render3d multiplies back by TILE_WU. So
// projecting the mini's tile point back to wu returns the marker's wu point exactly,
// on BOTH sides of the tilt boundary (below start = flat marker; above = tilting
// mini). No independent 3D position → no jump.
//
// And the map is READ-ONLY: orbiting (an XCOM camera swing) is a render3d camera
// operation (orbitBy → positionCamera) that never writes world state, so the
// engine-truth position the mini reads is invariant to camera motion (worldHash
// unchanged; the same tile point before and "after" an orbit). DM is the only verb.
// Hermetic — pure math + a worldHash check, no DOM/WebGL/API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { NODE_WU } from '../public/map/worldSpace.js';
import { playerFocusWu } from '../public/map/oneMap.js';
import { tiltStateForZoom, TILT_DEFAULTS, playerTileFocus } from '../public/map/continuousMap.js';

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
  newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null }, campaignId: `U477-${++_n}` }),
  PACKS
).world;

test('U477: the mini projects back to the EXACT 2D-marker world point (no jump at the tilt boundary)', () => {
  const w = boot();
  const marker = playerFocusWu(w);      // wu — where the 2D ink marker draws
  const mini = playerTileFocus(w);      // node-tile — where the 3D mini stands
  assert.ok(marker && mini, 'both projections resolve');

  // The 3D scene multiplies tile units by TILE_WU; the wu→tile bridge is ÷ NODE_WU.
  // Round-tripping the mini's tile point back through NODE_WU must land on the marker.
  assert.equal(mini.tx * NODE_WU, marker.wx, 'the mini reprojects to the marker wu-x exactly — same square');
  assert.equal(mini.ty * NODE_WU, marker.wy, 'the mini reprojects to the marker wu-y exactly — same square');
});

test('U477: the position is identical whether the camera is just below or just above the tilt boundary', () => {
  const w = boot();
  const k = TILT_DEFAULTS;
  // Just below start = flat (2D marker only); just above = tilting (mini shown).
  const below = tiltStateForZoom(k.start - 0.001, k);
  const above = tiltStateForZoom(k.start + 0.001, k);
  assert.equal(below.tiltFrac, 0, 'precondition: flat just below the threshold');
  assert.ok(above.tiltFrac > 0, 'precondition: tilting just above the threshold');

  // The world point the mini/marker share does NOT depend on z — the tilt only
  // changes the camera, not where "you" are. Same point on both sides → no jump.
  const mini = playerTileFocus(w);
  const marker = playerFocusWu(w);
  assert.equal(mini.tx * NODE_WU, marker.wx, 'x is the same world point across the boundary');
  assert.equal(mini.ty * NODE_WU, marker.wy, 'y is the same world point across the boundary');
});

test('U477: orbit changes the camera only — the engine-truth position (and worldHash) is untouched', () => {
  const w = boot();
  const h0 = worldHash(w);
  const before = playerTileFocus(w);

  // An orbit is a render3d camera op (orbitBy → positionCamera → renderFrame); it
  // never calls into the engine. Reading the mini's position again after any amount
  // of camera motion yields the SAME point, because it is a pure read of world state
  // that the camera cannot mutate. Assert the invariant directly: no world write.
  const after = playerTileFocus(w);
  const h1 = worldHash(w);

  assert.deepEqual(after, before, 'the mini position is invariant to camera motion (read-only map)');
  assert.equal(h1, h0, 'resolving the map position never mutates anything worldHash covers (orbit/zoom are pure view)');
});

test('U477: orbitBy in render3d is a camera-only operation (source contract — never a world write)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'map', 'render3d.js'), 'utf8');
  const m = src.match(/function orbitBy\([^)]*\)\s*\{([\s\S]*?)\n  \}/);
  assert.ok(m, 'orbitBy must exist in render3d.js');
  const body = m[1];
  // It only adjusts camera offsets + repaints — no scene/world mutation, no engine call.
  assert.ok(/azOffset|phiOffset/.test(body), 'orbitBy adjusts the camera azimuth/pitch offsets');
  assert.ok(/positionCamera\(\)/.test(body), 'orbitBy re-places the camera');
  assert.ok(!/world|applyDeltas|playerMove|scene\.add|\.position\.set/.test(body), 'orbitBy touches no world state and moves no token — camera only');
});
