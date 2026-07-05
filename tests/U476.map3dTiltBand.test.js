// U476 — MAP-3DR: dark stays cheap, lit stays true.
//
// The tilt is wired into the CURRENT one-map zoom (worldSpace: Z_MIN 0.008 →
// BAND.plan 32 → Z_MAX 60), NOT the retired Z_3D_START/CROSS constants. Two
// guarantees:
//   DARK (below the start threshold): the 3D layer contributes nothing — tilt
//   fraction 0 AND blend 0 — so the render is the flat 2D sheet exactly, at the
//   plan band and everywhere below it (today's cheap path, unchanged). The flag
//   being TRUE must not perturb the flat band.
//   LIT (z past the thresholds): the blend/tilt engage — tilt fraction climbs to
//   1 by `full`, the diorama fades fully in by `cross`, and the camera pitch maps
//   monotonically from ~top-down to the oblique diorama angle.
// Plus: the player mini's world point is the SAME resolveEntityWuFromWorld point
// the 2D marker uses (÷ NODE_WU into node-tile units — no independent position),
// and the whole projection is deterministic (x2). Model-level: pure math over the
// exported tiltStateForZoom / playerTileFocus, no DOM/WebGL.
// Hermetic — no network, no WebGL, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { BAND, Z_MAX, NODE_WU } from '../public/map/worldSpace.js';
import { playerFocusWu } from '../public/map/oneMap.js';
import { MAP_3D_ENABLED, tiltStateForZoom, TILT_DEFAULTS, playerTileFocus } from '../public/map/continuousMap.js';

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
  newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null }, campaignId: `U476-${++_n}` }),
  PACKS
).world;

test('U476: the flag is reconnected (MAP_3D_ENABLED true) with the tilt band pinned to the live one-map zoom', () => {
  assert.equal(MAP_3D_ENABLED, true, 'MAP-3DR reconnects the diorama');
  // The default band is anchored to the CURRENT zoom scale (BAND.plan..Z_MAX), not
  // the old Z_3D_START=0.22 regime — the whole point of the retune.
  assert.equal(TILT_DEFAULTS.start, BAND.plan, 'the tilt engages at the plan band (the full-room zoom), not the old 0.22');
  assert.equal(TILT_DEFAULTS.full, Z_MAX, 'the tilt is fully developed by Z_MAX (the building-plan band)');
  assert.ok(TILT_DEFAULTS.start < TILT_DEFAULTS.cross && TILT_DEFAULTS.cross <= TILT_DEFAULTS.full, 'ordered band: start < cross <= full');
});

test('U476: DARK — below the start threshold the 3D layer contributes nothing (tilt 0, blend 0) at the plan band and below', () => {
  const k = TILT_DEFAULTS;
  for (const z of [0.008, 0.12, 0.5, 4, 20, k.start - 0.001, k.start]) {
    const s = tiltStateForZoom(z, k);
    assert.equal(s.tiltFrac, 0, `z=${z}: no tilt below/at the start threshold (flat 2D sheet)`);
    assert.equal(s.blend, 0, `z=${z}: the 3D overlay stays fully hidden (opacity 0) — the cheap 2D path is unchanged`);
  }
});

test('U476: LIT — past the thresholds the blend and tilt engage and rise monotonically to full', () => {
  const k = TILT_DEFAULTS;
  const mid = tiltStateForZoom((k.start + k.full) / 2, k);
  assert.ok(mid.tiltFrac > 0 && mid.tiltFrac < 1, 'mid-band: the paper is tilting (0 < tiltFrac < 1)');
  assert.ok(mid.blend > 0, 'mid-band: the diorama is fading in (blend > 0)');

  const atCross = tiltStateForZoom(k.cross, k);
  assert.ok(atCross.blend >= 0.999, 'by the cross threshold the diorama is fully opaque (2D faded out beneath)');

  const full = tiltStateForZoom(k.full, k);
  assert.equal(full.tiltFrac, 1, 'at `full` the tilt is fully developed');
  // Monotonic pitch: top-down-ish at start → oblique at full.
  const pStart = tiltStateForZoom(k.start, k).phi;
  assert.ok(full.phi > pStart, 'the camera pitch increases from ~top-down toward the oblique diorama vantage');
  assert.ok(Math.abs(full.phi - k.pitchDeg * Math.PI / 180) < 1e-9, 'full pitch equals the pitchDeg knob');
});

test('U476: the player mini stands on the SAME resolveEntityWuFromWorld point as the 2D marker (÷ NODE_WU tiles) — one position truth', () => {
  const w = boot();
  const marker = playerFocusWu(w);        // the wu point the 2D ink marker draws at
  assert.ok(marker, 'the marker resolves');
  const mini = playerTileFocus(w);        // the node-tile point the 3D mini stands at
  assert.ok(mini, 'the mini focus resolves');
  // The 3D scene multiplies node-tile units by TILE_WU; the bridge from wu is ÷ NODE_WU.
  assert.equal(mini.tx, marker.wx / NODE_WU, 'the mini x is the marker wu ÷ NODE_WU (same point, tile units)');
  assert.equal(mini.ty, marker.wy / NODE_WU, 'the mini y is the marker wu ÷ NODE_WU (same point, tile units)');
});

test('U476: deterministic x2 — two independent boots resolve identical tilt state and mini positions', () => {
  const project = () => {
    const w = boot();
    const mini = playerTileFocus(w);
    const s = tiltStateForZoom(TILT_DEFAULTS.full, TILT_DEFAULTS);
    return { tx: mini.tx, ty: mini.ty, tiltFrac: s.tiltFrac, phi: s.phi, blend: s.blend };
  };
  assert.deepEqual(project(), project(), 'the projection is a pure, deterministic read of engine positions');
});
