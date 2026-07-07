// U630 — MAP-BLEND-1: no double vision at rest (Tim's report, 2026-07-06).
//
// The photo: the 2D plan and the 3D diorama ghosted over each other — two
// projections of the same place at once. Two causes, both pinned here:
//   1. the crossfade band [start..cross] was wide enough (×1.35) that the
//      camera could SIT inside it, and
//   2. (driver-side, verified live) the plan never faded beneath the diorama.
// The law: a TRANSITION may dissolve; a RESTING camera shows ONE projection.
// `settleZoomTarget` is the pure half of that law — given an idle zoom, the
// blend-edge z the camera must glide to, or null when it already rests clean.

import test from 'node:test';
import assert from 'node:assert/strict';
import { BAND } from '../public/map/worldSpace.js';
import { MAP_3D_ENABLED, tiltStateForZoom, TILT_DEFAULTS, settleZoomTarget } from '../public/map/continuousMap.js';

const K = { ...TILT_DEFAULTS };

test('U630a the blend is 0 at start, 1 at cross — the band edges are clean states', () => {
  assert.equal(tiltStateForZoom(K.start, K).blend, 0);
  assert.equal(tiltStateForZoom(K.cross, K).blend, 1);
  // And beyond the edges it stays pinned (clamped ramp).
  assert.equal(tiltStateForZoom(K.start * 0.5, K).blend, 0);
  assert.equal(tiltStateForZoom(K.cross * 2, K).blend, 1);
});

test('U630b THE BAND LAW — the default crossfade band is narrow (≤ 15% of zoom), not a resting place', () => {
  // Was BAND.plan×1.35: a third of the plan band spent half-2D/half-3D. One
  // wheel notch should cross the whole dissolve.
  assert.ok(K.cross / K.start <= 1.15,
    `cross/start must stay ≤ 1.15 (got ${(K.cross / K.start).toFixed(3)}) — a wide band re-opens the double-vision window`);
  assert.equal(K.start, BAND.plan, 'the tilt still engages exactly at the plan band (WS-3 indoor snap lands flat)');
});

test('U630c settleZoomTarget — clean rests return null (never nudge a camera that is not ghosting)', () => {
  if (!MAP_3D_ENABLED) return; // flag off ⇒ always null; the law is vacuous
  assert.equal(settleZoomTarget(K.start * 0.5, K), null);  // far below the band
  assert.equal(settleZoomTarget(K.start, K), null);        // exactly flat
  assert.equal(settleZoomTarget(K.cross, K), null);        // exactly diorama
  assert.equal(settleZoomTarget(K.cross * 1.5, K), null);  // deep in the diorama
});

test('U630d settleZoomTarget — any mid-band rest resolves to an edge, and that edge IS a clean state', () => {
  if (!MAP_3D_ENABLED) return;
  // Sweep the open band; every settled target must land at blend ≤0.02 / ≥0.98.
  for (let i = 1; i <= 19; i++) {
    const z = K.start + (K.cross - K.start) * (i / 20);
    const b = tiltStateForZoom(z, K).blend;
    if (b <= 0.02 || b >= 0.98) continue; // ramp tails — already clean, settle may pass
    const zt = settleZoomTarget(z, K);
    assert.ok(zt === K.start || zt === K.cross, `mid-band z=${z.toFixed(2)} must settle to an edge (got ${zt})`);
    const bt = tiltStateForZoom(zt, K).blend;
    assert.ok(bt === 0 || bt === 1, `the settled state must be clean (z=${zt}, blend ${bt})`);
    // Direction unknown → nearer edge by blend (the tie goes to the diorama).
    assert.equal(zt, b < 0.5 ? K.start : K.cross);
  }
});

test('U630e the settle law converges — settling a settled camera is a no-op', () => {
  if (!MAP_3D_ENABLED) return;
  const zMid = (K.start + K.cross) / 2;
  const zt = settleZoomTarget(zMid, K);
  assert.notEqual(zt, null);
  assert.equal(settleZoomTarget(zt, K), null, 'the glide target itself must need no further settling');
});

test('U630f MAP-BLEND-2 — the settle FOLLOWS the gesture, never undoes it (Tim\'s glitchy-zoom report)', () => {
  if (!MAP_3D_ENABLED) return;
  // A zoom-IN that parks low-mid-band must settle INTO the diorama (the b127
  // nearer-edge rule glided it back out — the map visibly undoing the wheel).
  const zLow = K.start + (K.cross - K.start) * 0.25;  // blend ≈ 0.16 — nearer edge is start
  assert.equal(settleZoomTarget(zLow, K, 'in'), K.cross, 'zooming in must continue IN');
  // A zoom-OUT that parks high-mid-band must settle OUT to the plan.
  const zHigh = K.start + (K.cross - K.start) * 0.75; // blend ≈ 0.84 — nearer edge is cross
  assert.equal(settleZoomTarget(zHigh, K, 'out'), K.start, 'zooming out must continue OUT');
  // Clean rests stay null regardless of direction (never nudge a clean camera).
  assert.equal(settleZoomTarget(K.start, K, 'in'), null);
  assert.equal(settleZoomTarget(K.cross * 1.5, K, 'out'), null);
  // Directional settles still converge (the target needs no further settling).
  assert.equal(settleZoomTarget(settleZoomTarget(zLow, K, 'in'), K, 'in'), null);
});
