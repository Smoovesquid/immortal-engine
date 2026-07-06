// U631 — MAP-VIEW-1: the diorama camera hangs back as the tilt develops
// (Tim, 2026-07-06: "the tilt into the 3d view … is a bit too close").
//
// The law: `dioramaPull` (tiltStateForZoom) scales the sheet-locked pxPerTile.
// It must be EXACTLY 1 at/below `start` — the 3D ink matches the 2D sheet 1:1
// through the whole crossfade window's visible moment, preserving U477's
// no-jump morph — and ease monotonically to `dioramaScale` at `full`, where
// the oblique diorama vantage sits ~28% further out than the old nose-to-nose
// framing. Pure math, hermetic.

import test from 'node:test';
import assert from 'node:assert/strict';
import { tiltStateForZoom, TILT_DEFAULTS } from '../public/map/continuousMap.js';

const K = { ...TILT_DEFAULTS };

test('U631a flat and below: no pull — the sheet and the diorama agree 1:1', () => {
  assert.equal(tiltStateForZoom(K.start, K).dioramaPull, 1);
  assert.equal(tiltStateForZoom(K.start * 0.5, K).dioramaPull, 1);
});

test('U631b at the crossfade edge the pull is still ≈1 — no size pop mid-dissolve', () => {
  const pull = tiltStateForZoom(K.cross, K).dioramaPull;
  assert.ok(1 - pull < 0.02,
    `at cross (diorama fully opaque) the scene must still match the ink within 2% (pull=${pull})`);
});

test('U631c at full tilt the pull equals dioramaScale exactly — the further-away vantage', () => {
  assert.equal(tiltStateForZoom(K.full, K).dioramaPull, K.dioramaScale);
  assert.equal(tiltStateForZoom(K.full * 2, K).dioramaPull, K.dioramaScale); // clamped past full
});

test('U631d the pull is monotonic non-increasing across the band (eases back, never lurches in)', () => {
  let prev = 1 + 1e-12;
  for (let i = 0; i <= 40; i++) {
    const z = K.start + (K.full - K.start) * (i / 40);
    const p = tiltStateForZoom(z, K).dioramaPull;
    assert.ok(p <= prev + 1e-12, `pull must never increase as the tilt deepens (z=${z.toFixed(2)})`);
    assert.ok(p >= K.dioramaScale - 1e-12 && p <= 1 + 1e-12, 'pull stays inside [dioramaScale, 1]');
    prev = p;
  }
});

test('U631e the default is a taste constant in sane bounds, and dioramaScale=1 restores the old framing', () => {
  assert.ok(K.dioramaScale > 0.5 && K.dioramaScale < 1,
    `default dioramaScale must be a mild pull-back (got ${K.dioramaScale})`);
  const noPull = { ...K, dioramaScale: 1 };
  assert.equal(tiltStateForZoom(K.full, noPull).dioramaPull, 1); // the knob can turn it off live
});
