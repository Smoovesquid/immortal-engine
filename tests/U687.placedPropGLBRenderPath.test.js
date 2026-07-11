// U687 — BUILDER-OBJ-2: a placed object with confirmed GLB art actually
// RENDERS with that art, not just a procedural placeholder/glyph.
//
// BUILDER-OBJ-1 (b151) wired the engine-truth side of the Builder's 16-kind
// palette (KIND_PHYSICS, the palette itself, propArt.js as a curated
// kind->GLB registry) but explicitly left `wired: false` on every entry —
// "no placed-piece GLB render path exists yet" (propArt.js's own header,
// pre-this-packet). This packet closes that gap: figures3d.js's buildPropMini
// now prefers a GLB (via treeAssets.js's already-preloaded furniture
// templates) before falling back to its old procedural box, gated kind-by-
// kind on propArt.js's `wired` flag — the single source of truth the
// Builder's status chips already read.
//
// three.js cannot run headless in this test env (U539's own documented
// limit — no jsdom/WebGL here, and 'three' is loaded via CDN import map in
// the browser only, not an npm dependency). So, following U539's established
// split: the GATING LOGIC is proven hermetically (real propArt.js + real
// figures3d.js, a fake THREE, no window — the exact conditions a Node test
// runs under, which is also the exact condition buildGLBProp's own guard
// clause is written for: "typeof window === 'undefined' return"); the WIRING
// SURFACE (which functions call which, in which order) is proven via source-
// contract checks against the actual file text. The real GLB literally
// painting an object in a browser is the live receipt (screenshot), not a
// Node assertion — see the playtest checklist in this packet's report.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPropMini, PROP_TRUE_SIZE, propTrueSize } from '../public/map/figures3d.js';
import { PROP_ART, artForKind } from '../public/map/propArt.js';
import { FURN } from '../engine/structures/roomDetail.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIGURES3D_SRC = fs.readFileSync(path.join(ROOT, 'public', 'map', 'figures3d.js'), 'utf8');
const DRAWMODEL_SRC = fs.readFileSync(path.join(ROOT, 'public', 'map', 'drawModel.js'), 'utf8');
const RENDER3D_SRC = fs.readFileSync(path.join(ROOT, 'public', 'map', 'render3d.js'), 'utf8');

class FakeObject3D {
  constructor() {
    this.children = [];
    this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.rotation = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.scale = { x: 1, y: 1, z: 1, set(x, y, z) { this.x = x; this.y = y; this.z = z; }, setScalar(s) { this.x = this.y = this.z = s; } };
    this.userData = {};
    this.castShadow = false; this.receiveShadow = false;
  }
  add(child) { this.children.push(child); return this; }
}
class FakeGroup extends FakeObject3D { constructor() { super(); this.isGroup = true; } }
class FakeMesh extends FakeObject3D {
  constructor(geometry, material) { super(); this.isMesh = true; this.geometry = geometry; this.material = material; }
}
class FakeGeometry { constructor(...args) { this.args = args; } }
class FakeMaterial { constructor(opts = {}) { Object.assign(this, opts); } }
function makeFakeThree() {
  return {
    Group: FakeGroup, Mesh: FakeMesh,
    BoxGeometry: FakeGeometry, CylinderGeometry: FakeGeometry, CircleGeometry: FakeGeometry,
    MeshBasicMaterial: FakeMaterial, MeshStandardMaterial: FakeMaterial,
  };
}

const WIRED_KINDS = Object.keys(PROP_ART).filter(k => PROP_ART[k].wired);
const UNWIRED_KINDS = Object.keys(PROP_ART).filter(k => !PROP_ART[k].wired);

test('U687: at least three kinds are wired for GLB rendering, and every wired kind is a real engine FURN kind', () => {
  assert.ok(WIRED_KINDS.length >= 3, `expected >=3 wired kinds, got ${WIRED_KINDS.length}`);
  for (const kind of WIRED_KINDS) assert.ok(FURN[kind], `wired kind '${kind}' must be a real engine FURN kind`);
});

test('U687: rack stays unwired (its art is on the lazy miniLibrary loader, not the eager treeAssets preload buildPropMini consumes)', () => {
  assert.equal(artForKind('rack').wired, false);
  assert.ok(UNWIRED_KINDS.includes('rack'));
});

test('U687 (hermetic — no window, no real GLTFLoader): buildPropMini never throws for any wired kind, and gracefully returns null or the procedural fallback when the GLB template set is empty (the exact Node/no-window condition)', () => {
  const THREE = makeFakeThree();
  const PROCEDURAL_FALLBACK_KINDS = new Set(['barrel', 'bed', 'chest', 'dresser']);
  for (const kind of WIRED_KINDS) {
    let mini;
    assert.doesNotThrow(() => { mini = buildPropMini(THREE, kind); }, `buildPropMini('${kind}') must never throw`);
    if (PROCEDURAL_FALLBACK_KINDS.has(kind)) {
      assert.ok(mini, `'${kind}' has a procedural fallback and must still render something with no GLB loaded`);
      assert.equal(mini.userData.kind, kind);
    } else {
      // no procedural box exists for these — with no window/no loaded GLB, the
      // caller (drawModel.js's props loop) must see null and skip the piece,
      // never a fabricated placeholder.
      assert.equal(mini, null, `'${kind}' has no procedural fallback — must be null, not a fabricated shape, when its GLB isn't loaded`);
    }
  }
});

test('U687 (hermetic): buildPropMini for an unwired/unknown kind is unaffected by this packet — same behavior as before', () => {
  const THREE = makeFakeThree();
  assert.equal(buildPropMini(THREE, 'rack'), null, 'rack has no procedural fallback and is unwired — must stay null');
  assert.equal(buildPropMini(THREE, 'dragon'), null, 'unrecognized kind must stay null');
});

test('U687 (source contract): figures3d.js gates the GLB attempt on propArt.js\'s own `wired` flag, not a private duplicate list', () => {
  assert.ok(/artForKind\(kind\)\?\.\s*wired/.test(FIGURES3D_SRC),
    'figures3d.js must read propArt.js\'s wired flag directly (the single source of truth the Builder chips also read)');
  assert.ok(/import\s*\{\s*buildGLBProp\s*\}\s*from\s*'\.\/treeAssets\.js';/.test(FIGURES3D_SRC),
    'figures3d.js must consume treeAssets.js\'s existing GLB loader rather than building a second one');
});

test('U687 (source contract): the cookpot->cauldron kind alias exists (a GLB never names the engine object)', () => {
  assert.ok(/GLB_KIND_ALIAS\s*=\s*\{\s*cookpot:\s*'cauldron'\s*\}/.test(FIGURES3D_SRC),
    'figures3d.js must alias the cookpot FURN kind to treeAssets\' cauldron REG kind');
});

test('U687 (source contract): drawModel.js\'s PROP_MINI_KINDS carries every wired kind (a piece can only become a mini candidate if it is in this set)', () => {
  for (const kind of WIRED_KINDS) {
    const re = new RegExp(`PROP_MINI_KINDS[\\s\\S]{0,20}\\bnew Set\\(\\[[^\\]]*'${kind}'`);
    assert.match(DRAWMODEL_SRC.replace(/\n/g, ' '), re, `PROP_MINI_KINDS must include '${kind}'`);
  }
});

test('U687: propTrueSize supplies an explicit entry (not just the 3-ft default) for every wired non-procedural kind, so a flat/wide GLB (table, rug) never blows its scale up via a near-zero height-axis read', () => {
  const NEW_WIRED = WIRED_KINDS.filter(k => !['barrel', 'bed', 'chest', 'dresser'].includes(k));
  assert.ok(NEW_WIRED.length > 0, 'precondition: this packet actually wired some new kinds');
  for (const kind of NEW_WIRED) {
    assert.ok(PROP_TRUE_SIZE[kind], `propTrueSize must have an explicit entry for '${kind}'`);
    const t = propTrueSize(kind);
    assert.ok(['x', 'y', 'z', 'footprint'].includes(t.axis), `'${kind}' true-size axis must be a real measurement axis`);
    assert.ok(Number.isFinite(t.wu) && t.wu > 0, `'${kind}' true-size wu must be a positive number`);
  }
});

test('U687 (source contract): render3d.js measures a footprint-axis prop via the yaw-invariant measureAuthoredFootprint, not the fixed-axis measureAuthoredSize', () => {
  assert.ok(/trueSize\.axis === 'footprint'\s*\?\s*measureAuthoredFootprint\(THREE, mini\)/.test(RENDER3D_SRC.replace(/\n\s*/g, ' ')),
    'render3d.js must branch to measureAuthoredFootprint when propTrueSize reports a footprint axis');
});
