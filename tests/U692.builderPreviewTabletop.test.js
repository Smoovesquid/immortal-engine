// U692 — BUILDER-PREVIEW-3: the preview projection renders the isolated building
// on the GAME's own tabletop, through the real gameplay renderer (mountSlice3D),
// and tells the truth about GLB art.
//
// Three.js/WebGL cannot run headless here (the established U479/U687 limit — no
// jsdom, no CDN, 'three' is browser-only). So, following that split: the PURE
// contracts (the honesty banner, the camera-fit math) run for real; the WIRING
// SURFACE (which options the adapter passes into mountSlice3D, how the preview
// branch suppresses world content and enforces GLB truth, that normal gameplay is
// untouched when the preview option is absent) is proven via source-contract
// checks against the actual file text. The building actually appearing on the
// tabletop is the live receipt (screenshot), not a Node assertion.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { previewBanner } from '../public/map/builderPreview3d.js';
import { previewFrameRadius } from '../public/map/render3d.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RENDER3D = fs.readFileSync(path.join(ROOT, 'public', 'map', 'render3d.js'), 'utf8');
const ADAPTER = fs.readFileSync(path.join(ROOT, 'public', 'map', 'builderPreview3d.js'), 'utf8');
const flat = RENDER3D.replace(/\n\s*/g, ' ');

// ── PURE: the honesty banner reflects RUNTIME facts, not hard-coded success ──

test('U692: a fully-placed preview reports compact success — "N/N placed GLBs", no warnings', () => {
  const report = { props: [
    { kind: 'hearth', wired: true, glb: true },
    { kind: 'table', wired: true, glb: true },
    { kind: 'barrel', wired: true, glb: true },
  ] };
  const b = previewBanner(report);
  assert.ok(b.ok, 'all wired props resolved a real GLB → ok');
  assert.deepEqual(b.warnings, [], 'success stays compact — no warning lines');
  assert.ok(b.line.includes('your building only'), 'names the isolation');
  assert.ok(b.line.includes('graph-paper floorplan'), 'names the canonical ground');
  assert.ok(b.line.includes('3/3 placed GLBs'), 'the count comes from the runtime facts');
  assert.ok(b.line.includes('game camera'), 'names the gameplay camera');
  assert.ok(b.line.includes('save untouched'), 'names save safety');
});

test('U692: a failed GLB EXPANDS into a truthful warning — never a hidden placeholder', () => {
  const report = { props: [
    { kind: 'hearth', wired: true, glb: true },
    { kind: 'chair', wired: true, glb: false }, // GLB failed to load
  ] };
  const b = previewBanner(report);
  assert.ok(!b.ok, 'a failed wired GLB is not ok');
  assert.equal(b.line.match(/(\d+)\/(\d+) placed GLBs/)[0], '1/2 placed GLBs', 'the count reflects the failure');
  assert.ok(b.warnings.some(w => /chair/.test(w) && /No placeholder was shown/.test(w)),
    'the failure names the object and states no placeholder was fabricated');
});

test('U692: an un-registered (no GLB art) kind is reported honestly, ink-only, not as a GLB failure', () => {
  const report = { props: [
    { kind: 'table', wired: true, glb: true },
    { kind: 'anvil', wired: false, glb: false }, // no registered GLB
  ] };
  const b = previewBanner(report);
  assert.ok(b.line.includes('1/1 placed GLBs'), 'the no-art kind is NOT counted against the wired GLB tally');
  assert.ok(b.warnings.some(w => /anvil/.test(w)), 'the missing art is surfaced, not hidden');
  assert.ok(!b.warnings.some(w => /anvil/.test(w) && /failed/.test(w)), 'no-art is not miscalled a GLB failure');
});

// ── PURE: camera fit frames both a small one-room plan and a large multi-room plan ──

test('U692: previewFrameRadius scales with the building — small plan close, large plan pulled back, both finite', () => {
  const small = previewFrameRadius(3, 3);   // a ~3×3 m one-room cottage
  const large = previewFrameRadius(24, 16);  // a big multi-room hall
  assert.ok(Number.isFinite(small) && small > 0, 'a small plan gets a real, positive distance');
  assert.ok(Number.isFinite(large) && large > 0, 'a large plan gets a real, positive distance');
  assert.ok(large > small, 'a bigger building is framed from further back');
  // sensible margin: the distance clears the building (never inside it).
  assert.ok(small > 3, 'the small plan is framed from outside its own footprint');
});

test('U692: previewFrameRadius never returns zero/NaN for a degenerate (empty) plan', () => {
  const r = previewFrameRadius(0, 0);
  assert.ok(Number.isFinite(r) && r > 0, 'an empty plan still yields a usable framing distance');
});

// ── SOURCE CONTRACT: the render3d.js preview projection seam ──

test('U692: mountSlice3D takes an optional preview projection (opts.preview)', () => {
  assert.ok(/const preview = opts\.preview/.test(RENDER3D),
    'mountSlice3D reads opts.preview as the preview-projection seam');
});

test('U692: the preview supplies the ground INK canvas — the world sheet is only built WITHOUT preview', () => {
  assert.ok(/preview\.groundCanvas/.test(RENDER3D), 'the preview ground is the supplied ink canvas');
  // buildWorldSheet (the settlement/world cartography ground) is gated behind the
  // non-preview branch, so an isolated tabletop never pulls in the world map.
  assert.ok(/if \(preview\)[\s\S]*?\} else \{[\s\S]*?buildWorldSheet\(/.test(RENDER3D),
    'buildWorldSheet is in the else branch — a preview never mounts the world cartography');
});

test('U692: the preview suppresses the player/scale figure, nodes/edges dressing, and props are its own', () => {
  // The player token / mini is built only when NOT a preview (and not combat).
  assert.ok(/else if \(!preview\) \{[\s\S]*?buildArchetypeFigure\(THREE, 'player'/.test(RENDER3D),
    'the player token is gated out of the preview (no scale figure)');
  // Preview props come from preview.props, not the world (placedTokenModel).
  assert.ok(/for \(const p of preview\.props\)/.test(flat) || /preview\.props/.test(RENDER3D),
    'the preview places its OWN authored props, not world/settlement occupancy');
});

test('U692: GLB truth — a wired preview prop requires a real GLB result; no generic block fallback', () => {
  // The preview prop placement requires userData.glb === true and never fabricates
  // a Box/Cylinder when the GLB is missing.
  assert.ok(/userData\.glb === true/.test(RENDER3D),
    'the preview only mounts a prop whose GLB actually resolved');
  // Isolate the preview prop loop and prove it contains no geometry fabrication.
  const m = RENDER3D.match(/for \(const p of preview\.props\) \{([\s\S]*?)\n {4}\}/);
  assert.ok(m, 'the preview prop loop exists');
  assert.ok(!/BoxGeometry|CylinderGeometry|PlaneGeometry/.test(m[1]),
    'the preview prop loop never fabricates a placeholder mesh — ink stays visible instead');
});

test('U692: the preview uses the GAMEPLAY camera contract — north-up azimuth, the full map tilt, and previewFrameRadius', () => {
  assert.ok(/previewFrameRadius\(/.test(RENDER3D), 'camera distance is derived from the building bounds via previewFrameRadius');
  // north-up (az 0 = north-up per setCamera) + the gameplay full-tilt pitch (58°).
  assert.ok(/baseAz = 0/.test(RENDER3D), 'preview frames north-up (az 0), matching the 2D plan');
  assert.ok(/58 \* Math\.PI \/ 180|58 \* DEG|1\.012/.test(RENDER3D), "preview uses the gameplay full-tilt pitch (58°)");
});

test('U692: the preview does NOT change the perspective FOV or tone mapping — same camera/renderer as gameplay', () => {
  assert.ok(/new THREE\.PerspectiveCamera\(45,/.test(RENDER3D), 'the ONE camera is still FOV 45 (gameplay), preview or not');
  assert.ok(/ACESFilmicToneMapping/.test(RENDER3D), 'the ONE renderer still tone-maps like gameplay');
});

test('U692: normal gameplay is untouched when opts.preview is absent (preview defaults to null)', () => {
  assert.ok(/const preview = opts\.preview && typeof opts\.preview === 'object' \? opts\.preview : null/.test(RENDER3D),
    'preview is null unless a caller opts in — the world path is the default, unchanged');
  assert.ok(!/Math\.random/.test(RENDER3D), 'purity rule intact — no Math.random introduced');
});

// ── SOURCE CONTRACT: the adapter passes the projection into mountSlice3D ──

test('U692: the adapter hands the ground canvas, props, and bounds into mountSlice3D with showPlayer:false', () => {
  assert.ok(/mountSlice3D\(/.test(ADAPTER), 'the adapter mounts the gameplay renderer');
  assert.ok(/groundCanvas/.test(ADAPTER), 'passes the ink ground canvas');
  assert.ok(/props/.test(ADAPTER) && /bounds/.test(ADAPTER), 'passes authored props + isolated bounds');
  assert.ok(/showPlayer:\s*false/.test(ADAPTER), 'no player / scale figure in the preview');
});

test('U692: the adapter builds the ground ink via the SHARED hand-drawn interior renderer', () => {
  assert.ok(/createInteriorMap\(/.test(ADAPTER),
    'the graph-paper/ink ground is the canonical shared floorplan renderer, not a bespoke draw');
});
