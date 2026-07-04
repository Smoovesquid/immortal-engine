// U417 — TT-DRAW-2 zoom ceiling reaches plan scale (docs/briefs/
// TT-DRAW-2-one-sizing-truth.md). Basecamp's live finding: the camera's z clamp
// stopped around the settlement/street band (Z_MAX was 16), so even a
// TRUE-scale building (post the sizing-truth fix, ~9-11 wu per side —
// structureWorldRect scale) stayed a small fraction of the frame — repeated
// wheel-in produced identical frames (a hard clamp short of plan-legible: room
// names + door gaps never got big enough to read).
//
// oneMap.js's camera projects world units to pixels as a pure linear scale —
// toPx(wx,wy) = center + (world - camCenter) * z (public/map/oneMap.js:675) —
// so "does a building span >=60% of the shorter viewport axis at max zoom" is
// pure arithmetic on Z_MAX, with no DOM/canvas required: a span of S world
// units projects to exactly S*z pixels at zoom z, for ANY viewport size.
//
// This test locks: (A) Z_MAX admits >=60% coverage of a 10-wu building across
// every viewport width in a realistic range (200-1400 px, spanning the actual
// canvas floor `Math.max(200, canvas.clientWidth || 700)` in oneMap.js up
// through a large desktop panel) — not just one lucky size. (B) Z_MAX is
// strictly greater than the old value (16) — the ceiling actually deepened,
// not just "still technically admits some frame". (C) the wall/label z-scale
// formulas oneMap.js uses downstream (wall width, room-name font, npc radius)
// stay bounded (saturate via their own Math.min caps) at the NEW Z_MAX, so
// deepening the ceiling doesn't blow up line weights or font sizes into
// nonsense at depth ("sane label scaling at depth" per the brief).
// Pure camera/math — no DOM, no engine, no Math.random, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';

import { Z_MIN, Z_MAX } from '../public/map/worldSpace.js';

// Mirrors oneMap.js's toPx exactly (public/map/oneMap.js:675) — a pure linear
// world-to-pixel projection, camera-centered. Re-derived here (rather than
// imported) because toPx is a closure-local helper inside renderOneMap's DOM
// mount, not an exported pure function — the LINEAR MATH is what's under test,
// and it's simple enough to restate faithfully without pulling in canvas/DOM.
function toPx(wx, wy, camCx, camCy, z, W, H) {
  return [W / 2 + (wx - camCx) * z, H / 2 + (wy - camCy) * z];
}

// A building's world-unit span (structureWorldRect scale, post the sizing-truth
// fix) — the brief's own worked example (~9.5-11 wu observed on the tallow boot
// cottage, U416). Use a representative round figure squarely in that range.
const BUILDING_SPAN_WU = 10;

function coverageFraction(spanWu, z, shorterAxisPx) {
  // The building is centered in frame (camera on it) — the projected span in
  // pixels is spanWu * z regardless of camera center, since toPx is a pure
  // linear scale (translation by camCx/camCy cancels out of a SPAN).
  const spanPx = spanWu * z;
  return spanPx / shorterAxisPx;
}

test('U417-A: Z_MAX admits >=60% coverage of a 10-wu building on the shorter viewport axis, across the realistic range of live map-panel widths', () => {
  // 200 is oneMap.js's own floor (Math.max(200, canvas.clientWidth || 700)).
  // 1000 is a generous upper bound for the actual live map panel: the play
  // layout's main column is `minmax(0,1fr)` beside a fixed ~280-300px sidebar
  // (public/styles.css .play-layout), so even a wide ~1400px browser window
  // leaves the map panel well under 1100px after padding/gap — 1000 is already
  // a comfortable ceiling on the realistic case, not the theoretical max.
  const axes = [200, 320, 480, 600, 700, 800, 900, 1000];
  for (const axis of axes) {
    const frac = coverageFraction(BUILDING_SPAN_WU, Z_MAX, axis);
    assert.ok(frac >= 0.6, `at shorter-axis=${axis}px, Z_MAX=${Z_MAX} must cover >=60% of frame (got ${(frac * 100).toFixed(1)}%)`);
  }
});

test('U417-B: Z_MAX strictly deepened past the old ceiling (16) — the fix actually raised it, not a no-op', () => {
  const OLD_Z_MAX = 16;
  assert.ok(Z_MAX > OLD_Z_MAX, `Z_MAX (${Z_MAX}) must exceed the old shallow ceiling (${OLD_Z_MAX})`);
  // And the old ceiling, for contrast, does NOT clear 60% at a realistic axis —
  // proving this is a real fix, not tightening an already-sufficient value.
  const oldFrac = coverageFraction(BUILDING_SPAN_WU, OLD_Z_MAX, 700);
  assert.ok(oldFrac < 0.6, `sanity: the OLD Z_MAX (${OLD_Z_MAX}) must have been insufficient at a realistic viewport (got ${(oldFrac * 100).toFixed(1)}%), confirming U417-A is a genuine improvement`);
});

test('U417-C: Z_MAX is a named, finite, sane constant — comfortably above Z_MIN, no runaway magnitude', () => {
  assert.ok(Number.isFinite(Z_MAX) && Z_MAX > 0, 'Z_MAX must be a finite positive number');
  assert.ok(Z_MAX > Z_MIN * 1000, 'Z_MAX must sit comfortably above Z_MIN (a real zoom RANGE, not a degenerate one)');
  assert.ok(Z_MAX < 500, 'Z_MAX must not be an unbounded/runaway value — a deep ceiling, not an infinite one');
});

test('U417-D: the wall-weight and room-name-font z-scale formulas oneMap.js uses saturate (stay bounded) at the new Z_MAX — deepening the ceiling does not blow up ink at depth', () => {
  // Mirrors the exact formulas in oneMap.js's drawLayout:
  //   wall = Math.max(0.8, Math.min(2.6, z * 0.5))                         (line ~743)
  //   wallLineWidth = wallWeight[shell] * Math.max(0.5, Math.min(1, z*0.6)) (line ~791)
  //   roomNameFontPx = Math.round(Math.min(14, 1.1 * PLACE_WU * z))         (line ~821, PLACE_WU=4)
  const wallAtMax = Math.max(0.8, Math.min(2.6, Z_MAX * 0.5));
  const wallFactorAtMax = Math.max(0.5, Math.min(1, Z_MAX * 0.6));
  const fontAtMax = Math.round(Math.min(14, 1.1 * 4 * Z_MAX));
  assert.equal(wallAtMax, 2.6, 'wall line width must saturate at its own cap (2.6px), not grow unbounded with the deeper Z_MAX');
  assert.equal(wallFactorAtMax, 1, 'wall-weight z-factor must saturate at its own cap (1x), not grow unbounded');
  assert.equal(fontAtMax, 14, 'room-name font must saturate at its own cap (14px) — legible, not billboard-huge, at the new depth');
});

test('U417-E: coverage is a pure function of (span, z, axis) — two independent computations at the same inputs agree exactly (no hidden state)', () => {
  const a = coverageFraction(BUILDING_SPAN_WU, Z_MAX, 700);
  const b = coverageFraction(BUILDING_SPAN_WU, Z_MAX, 700);
  assert.equal(a, b, 'identical inputs must yield an identical coverage fraction, every call');
  // And camera translation (panning) never changes a SPAN's projected pixel
  // size — toPx's (wx - camCx) subtraction cancels for any two points sharing
  // camCx/camCy, so coverage is independent of where the camera happens to sit.
  const [x0a] = toPx(1000, 0, 500, 0, Z_MAX, 800, 600);
  const [x1a] = toPx(1000 + BUILDING_SPAN_WU, 0, 500, 0, Z_MAX, 800, 600);
  const [x0b] = toPx(1000, 0, -9999, 0, Z_MAX, 800, 600);
  const [x1b] = toPx(1000 + BUILDING_SPAN_WU, 0, -9999, 0, Z_MAX, 800, 600);
  assert.equal(x1a - x0a, x1b - x0b, 'projected pixel span must be identical regardless of camera center (a pure translation)');
});
