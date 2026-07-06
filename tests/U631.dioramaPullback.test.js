// U631 — MAP-VIEW-2: the diorama OPENS far and lets you all the way in
// (Tim, 2026-07-06: "keep the start of the 3d camera another 50% further away
// but allow me to zoom all the way in" — supersedes MAP-VIEW-1's deep-end pull,
// which capped max zoom at 72% and barely moved the entry).
//
// The law: `dioramaPull` (tiltStateForZoom) scales the sheet-locked pxPerTile.
// ENTRY-far → DEEP-close: it equals `dioramaScale` as the diorama opens (the
// tilt's own ramp starts there) and eases monotonically UP to exactly 1 at
// `full` — max wheel-in reaches the true sheet-locked closeness, never capped.
// The effective zoom z·pull must stay strictly increasing in z (no rubber-band:
// the wheel never fights itself). Pure math, hermetic.
//
// Companion (same packet): the overlay wheel-forwarder — layer3d claims drags
// for orbit but forwards WHEEL to the 2D canvas, fixing "once zoomed in, I
// can't zoom back out" (the overlay had no wheel handler, so past ~15% tilt
// the wheel went dead). Pinned as a source contract below (U576d idiom).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tiltStateForZoom, TILT_DEFAULTS } from '../public/map/continuousMap.js';

const K = { ...TILT_DEFAULTS };
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const SRC = fs.readFileSync(path.join(__dirname, '..', 'public', 'map', 'continuousMap.js'), 'utf8');

test('U631a the diorama OPENS pulled back — entry pull equals dioramaScale at the tilt threshold', () => {
  assert.equal(tiltStateForZoom(K.start, K).dioramaPull, K.dioramaScale);
  assert.equal(tiltStateForZoom(K.start * 0.5, K).dioramaPull, K.dioramaScale); // below: moot (3D invisible), but stable
});

test('U631b at full tilt the pull is exactly 1 — max wheel-in reaches the TRUE closest framing', () => {
  assert.equal(tiltStateForZoom(K.full, K).dioramaPull, 1);
  assert.equal(tiltStateForZoom(K.full * 2, K).dioramaPull, 1); // clamped past full
});

test('U631c the pull rises monotonically (entry-far → deep-close, never lurching back out)', () => {
  let prev = 0;
  for (let i = 0; i <= 40; i++) {
    const z = K.start + (K.full - K.start) * (i / 40);
    const p = tiltStateForZoom(z, K).dioramaPull;
    assert.ok(p >= prev - 1e-12, `pull must never decrease as the tilt deepens (z=${z.toFixed(2)})`);
    assert.ok(p >= K.dioramaScale - 1e-12 && p <= 1 + 1e-12, 'pull stays inside [dioramaScale, 1]');
    prev = p;
  }
});

test('U631d NO RUBBER-BAND — the effective zoom z·pull is strictly increasing in z', () => {
  // This is what makes "zoom all the way in" one continuous move: every wheel
  // notch inward brings the camera closer, every notch outward further away.
  let prevEff = 0;
  for (let i = 0; i <= 80; i++) {
    const z = K.start * 0.8 + (K.full * 1.1 - K.start * 0.8) * (i / 80);
    const eff = z * tiltStateForZoom(z, K).dioramaPull;
    assert.ok(eff > prevEff, `effective zoom must strictly increase (z=${z.toFixed(2)}, eff=${eff.toFixed(2)})`);
    prevEff = eff;
  }
});

test('U631e the default is a mild entry pull in sane bounds, and dioramaScale=1 restores sheet-locked framing', () => {
  assert.ok(K.dioramaScale > 0.4 && K.dioramaScale < 1,
    `default dioramaScale must be a real entry pull (got ${K.dioramaScale})`);
  const noPull = { ...K, dioramaScale: 1 };
  assert.equal(tiltStateForZoom(K.start, noPull).dioramaPull, 1);
  assert.equal(tiltStateForZoom(K.full, noPull).dioramaPull, 1);
});

test('U631f source contract — the 3D overlay forwards WHEEL to the 2D canvas (zoom is never one-way)', () => {
  // The orbit drag may claim the overlay's pointer events, but wheel must be
  // re-dispatched to the 2D map's canvas — the single zoom authority. Without
  // this, zoom dies past ~15% tilt (Tim's "can't zoom back out").
  assert.ok(/layer3d\.addEventListener\('wheel'/.test(SRC),
    'layer3d must have a wheel listener (the forwarder)');
  assert.ok(/dispatchEvent\(new WheelEvent\('wheel'/.test(SRC),
    'the wheel listener must re-dispatch to the 2D canvas');
  assert.ok(/\{ passive: false \}/.test(SRC),
    'the forwarder must be non-passive (it preventDefaults the overlay scroll)');
});
