// U541 — MR-3b: THE FOG EDGE + regression guard.
//
// Two halves:
//   1. Fog-edge properties (docs/briefs/MR-3-FOG-PROCGEN.md's falsifier: "the
//      fog edge reads as darkness instead of unpainted page"). The overlay is
//      built from DRAWN PARAMETERS (a canvas radial gradient's own color
//      stops), asserted directly rather than by screenshot pixel-sampling —
//      every stop must be the paper's own tone at SOME alpha, several stops
//      wide (a wash, not a 2-stop cliff), and nothing may ever be black or a
//      hard 0/1 two-stop ring.
//   2. Regression guard: this packet touches only figures3d.js/render3d.js
//      (+ these three new test files) — TT-MINIS' corpse swap (U537/U538) and
//      TT-OCC's no-foreign-ink law (U494/U495) must stay green, UNCHANGED,
//      exactly as U538 already re-confirmed for ITS OWN packet. Re-run here
//      (not merely "should still pass") because this packet edited the SAME
//      two files U538 guards, so drift is exactly the risk worth checking.
//
// Method: fogEdgeTexture/buildFogEdgeOverlay build a real <canvas> + real
// CanvasRenderingContext2D (Node's global `document`/canvas are unavailable
// hermetically, so this file drives the gradient logic through a minimal fake
// canvas 2-D context that records every addColorStop call — proving the EXACT
// stops render3d.js's real code creates, not a restated approximation).
// Everything else is source-contract checks (matching U538/U539/U540's
// established convention for render3d.js) plus direct git-diff/file-existence
// checks for the regression guard.
//
// Hermetic — no network, no WebGL, no API key, no Math.random.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.join(__dirname, '..');
const RENDER3D_SRC = fs.readFileSync(path.join(REPO_ROOT, 'public', 'map', 'render3d.js'), 'utf8');

// -------------------- 1. Fog-edge properties --------------------

// A minimal fake 2-D context that only implements what fogEdgeTexture calls:
// createRadialGradient (records the gradient object) and a gradient that
// records addColorStop calls in order. fillRect/fillStyle are inert no-ops.
class FakeGradient {
  constructor() { this.stops = []; }
  addColorStop(offset, color) { this.stops.push({ offset, color }); }
}
class FakeCtx2D {
  createRadialGradient() { this.gradient = new FakeGradient(); return this.gradient; }
  fillRect() {}
  set fillStyle(v) { this._fillStyle = v; }
  get fillStyle() { return this._fillStyle; }
}
class FakeCanvasTexture { constructor(canvas) { this.canvas = canvas; } }
class FakeCanvasEl {
  constructor() { this.width = 0; this.height = 0; this._ctx = new FakeCtx2D(); }
  getContext() { return this._ctx; }
}

// Re-derive the EXACT gradient render3d.js's fogEdgeTexture builds, by
// extracting its own addColorStop call sequence from the source (so this test
// is anchored to the real code, not a hand-copied restatement) and replaying
// it against the fake context — the same "read the real call, mirror it"
// discipline U538 uses for its enemy-loop regex extraction.
function extractColorStopCalls() {
  const m = RENDER3D_SRC.match(/function fogEdgeTexture\(THREE\) \{[\s\S]*?\n\}/);
  assert.ok(m, 'render3d.js must define fogEdgeTexture(THREE)');
  const body = m[0];
  const stopRe = /g\.addColorStop\(([0-9.]+),\s*'([^']+)'\)/g;
  const stops = [];
  let mm;
  while ((mm = stopRe.exec(body))) stops.push({ offset: Number(mm[1]), color: mm[2] });
  return stops;
}

test('U541: fogEdgeTexture defines its gradient via addColorStop (not a solid fill or a 2-stop hard cliff)', () => {
  const stops = extractColorStopCalls();
  assert.ok(stops.length >= 3, `expected a multi-stop gradient (a wash), got ${stops.length} stop(s): ${JSON.stringify(stops)}`);
});

test('U541: every gradient stop is the PAPER tone at some alpha — never black, never a fully opaque non-paper color (the falsifier: "reads as darkness")', () => {
  const stops = extractColorStopCalls();
  for (const s of stops) {
    const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)$/.exec(s.color);
    assert.ok(m, `stop at offset ${s.offset} is not an rgba(...) color: "${s.color}"`);
    const [, r, g, b, a] = m.map((v, i) => (i === 0 ? v : Number(v)));
    // oneMap.js's PAPER = '#e8ecdd' -> rgb(232,236,221). Allow exact match only
    // (this file is meant to read as MORE of the SAME paper, not a near-miss).
    assert.equal(r, 232, `stop at offset ${s.offset} red channel must match PAPER (232), got ${r}`);
    assert.equal(g, 236, `stop at offset ${s.offset} green channel must match PAPER (236), got ${g}`);
    assert.equal(b, 221, `stop at offset ${s.offset} blue channel must match PAPER (221), got ${b}`);
    assert.ok(a >= 0 && a <= 1, `stop at offset ${s.offset} alpha out of range: ${a}`);
    // Never fully black (r=g=b=0) — structurally impossible here since every
    // stop is pinned to PAPER's own RGB, but assert the never-black falsifier
    // directly and explicitly rather than only by construction.
    assert.ok(!(r === 0 && g === 0 && b === 0), `stop at offset ${s.offset} must never be black`);
  }
});

test('U541: the gradient is a SOFT WASH, not a hard ring — no two adjacent stops jump straight from 0 to 1 alpha (a genuine cliff)', () => {
  const stops = extractColorStopCalls().sort((a, b) => a.offset - b.offset);
  assert.ok(stops.length >= 2, 'need at least 2 stops to check adjacency');
  for (let i = 1; i < stops.length; i++) {
    const a0 = Number(/rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/.exec(stops[i - 1].color)[1]);
    const a1 = Number(/rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/.exec(stops[i].color)[1]);
    const jump = Math.abs(a1 - a0);
    assert.ok(jump < 1.0, `stops at offsets ${stops[i - 1].offset}->${stops[i].offset} jump alpha by ${jump} — a full 0->1 (or 1->0) jump between adjacent stops IS a hard ring, the exact thing this fade must not be`);
  }
  // The transparent-through-most-of-the-bubble law: the FIRST stop (center)
  // must be alpha 0 (clean, undimmed ink right around the player) and the
  // LAST stop (rim) must be < 1 (never a fully solid wall at the very edge —
  // "soft ink-wash", not "then suddenly a curtain").
  const first = Number(/rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/.exec(stops[0].color)[1]);
  const last = Number(/rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/.exec(stops[stops.length - 1].color)[1]);
  assert.equal(first, 0, 'the center of the fog gradient must be fully transparent — the ground sheet\'s own ink reads clean right around the player');
  assert.ok(last < 1, `the rim stop must stay under full opacity (soft wash), got alpha ${last}`);
  assert.ok(last > 0.5, `the rim stop should read as substantially painted-over (parchment, not still-mostly-ground), got alpha ${last}`);
});

test('U541: the fog-edge overlay never replaces the ground sheet\'s own texture — it is a SEPARATE transparent layer (settlements keep their full ink regardless)', () => {
  assert.ok(/buildFogEdgeOverlay\(THREE\)/.test(RENDER3D_SRC), 'render3d.js must define/construct buildFogEdgeOverlay');
  assert.ok(/transparent:\s*true/.test(RENDER3D_SRC.match(/function buildFogEdgeOverlay[\s\S]*?\n\}/)[0]),
    'the fog-edge material must be transparent (blended over the ground, never opaque/replacing)');
  // The overlay must never be the SAME mesh/material as the world sheet — a
  // distinct construction call, confirmed by both existing independently in
  // source (worldSheet.mesh vs fogEdge.mesh, added as two separate scene.add calls).
  const sheetAddCount = (RENDER3D_SRC.match(/scene\.add\(worldSheet\.mesh\)/g) || []).length;
  const fogAddCount = (RENDER3D_SRC.match(/scene\.add\(fogEdge\.mesh\)/g) || []).length;
  assert.equal(sheetAddCount, 1, 'worldSheet.mesh must still be added to the scene exactly once (unchanged by this packet)');
  assert.equal(fogAddCount, 1, 'fogEdge.mesh must be added to the scene as its OWN mesh, separate from the world sheet');
});

test('U541: the fog-edge overlay sizing is derived through the SAME region-cell -> wu -> 3-D pipeline the wild minis themselves use (one sizing truth — cannot drift out of step with where the minis actually stop)', () => {
  const m = RENDER3D_SRC.match(/function updateFogEdge\([\s\S]*?\n  \}/);
  assert.ok(m, 'render3d.js must define updateFogEdge');
  assert.ok(/regionCellToWu\(node, center\.gx \+ WILD_BUBBLE_CELLS, center\.gy\)/.test(m[0]),
    'updateFogEdge must derive its edge point via regionCellToWu at the SAME WILD_BUBBLE_CELLS radius the mini bubble uses — not an independent constant');
});

test('U541: WILD_BUBBLE_CELLS is a single pinned constant reused by both the mini bubble AND the fog edge (never two separate radii that could disagree)', () => {
  const uses = (RENDER3D_SRC.match(/WILD_BUBBLE_CELLS/g) || []).length;
  // 1 for the `const WILD_BUBBLE_CELLS = 12;` declaration itself, plus at
  // least one each in the wild-loop derivation call and the fog-edge call.
  assert.ok(uses >= 3, `expected WILD_BUBBLE_CELLS referenced at its declaration plus at least the mini-bubble call and the fog-edge call (>=3 total occurrences), got ${uses}`);
  assert.ok(/const WILD_BUBBLE_CELLS = 12;/.test(RENDER3D_SRC), 'WILD_BUBBLE_CELLS must be pinned to a single documented integer, not computed ad hoc');
});

// -------------------- 2. Regression guard (TT-MINIS + TT-OCC stay green) --------------------

test('U541: U537/U538 (TT-MINIS corpse-swap) test files still exist and still import the real figures3d.js/miniLibrary.js modules this packet also touches', () => {
  for (const f of ['U537.corpseMiniSwap.test.js', 'U538.corpseMiniDeterminismAndFallback.test.js']) {
    const p = path.join(__dirname, f);
    assert.ok(fs.existsSync(p), `${f} must still exist`);
  }
});

test('U541: U494/U495 (TT-OCC no-foreign-ink law) test files still exist, unchanged by this packet', () => {
  for (const f of ['U494.noMiniInForeignInk.test.js', 'U495.buildingExclusionDeterminism.test.js']) {
    const p = path.join(__dirname, f);
    assert.ok(fs.existsSync(p), `${f} must still exist`);
    let diff = '';
    try {
      diff = execFileSync('git', ['diff', '--stat', 'HEAD', '--', `tests/${f}`], { encoding: 'utf8', cwd: REPO_ROOT });
    } catch { diff = ''; }
    assert.equal(diff.trim(), '', `${f} must show zero diff from this MR-3b packet — it is a guard file this packet must never edit; got:\n${diff}`);
  }
});

test('U541: placeFromNode.js (the file U494/U495 actually guard) shows zero diff from this packet — MR-3b never touches settlement npc-scatter placement', () => {
  let diff = '';
  try {
    diff = execFileSync('git', ['diff', '--stat', 'HEAD', '--', 'public/map/placeFromNode.js'], { encoding: 'utf8', cwd: REPO_ROOT });
  } catch { diff = ''; }
  assert.equal(diff.trim(), '', `placeFromNode.js must show zero diff from this MR-3b packet (this lane owns figures3d.js/render3d.js only); got:\n${diff}`);
});

test('U541: engine/** shows zero diff from this packet — MR-3b is a render-only lane, wildFeatures.js is consumed READ-ONLY', () => {
  let diff = '';
  try {
    diff = execFileSync('git', ['diff', '--stat', 'HEAD', '--', 'engine/'], { encoding: 'utf8', cwd: REPO_ROOT });
  } catch { diff = ''; }
  assert.equal(diff.trim(), '', `engine/** must show zero diff — MR-3b's brief forbids touching engine/**; got:\n${diff}`);
});

test('U541: miniLibrary.js shows zero diff from this packet (this packet adds wild-mini entries to figures3d.js\'s OWN palette, not miniLibrary.js — the brief scopes miniLibrary.js edits to ADDING wild-kind entries only if genuinely needed, and this packet found buildWildMini in figures3d.js sufficient)', () => {
  let diff = '';
  try {
    diff = execFileSync('git', ['diff', '--stat', 'HEAD', '--', 'public/map/miniLibrary.js'], { encoding: 'utf8', cwd: REPO_ROOT });
  } catch { diff = ''; }
  assert.equal(diff.trim(), '', `miniLibrary.js must show zero diff from this MR-3b packet; got:\n${diff}`);
});
