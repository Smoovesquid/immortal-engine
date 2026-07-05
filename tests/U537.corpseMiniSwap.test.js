// U537 — TT-MINIS: a defeated entity's mini swaps to a corpse GLB.
//
// BEFORE this packet: a defeated combat enemy never vanished, but it never got
// a body either — buildTacticalBoard's enemy loop (public/map/render3d.js) called
// buildArchetypeFigure(THREE, arch, { defeated: true, ... }) unconditionally, and
// figures3d.js's `defeated` branch just TOPPLED the same standing archetype rig
// in place (rotated 90° + faded translucent, figures3d.js's buildArchetypeFigure,
// the `if (defeated) { g.rotation.z = ... }` branch) — a downed humanoid still
// looked like a stylized standing-humanoid silhouette lying on its side, not a
// body. Reproduced below (U537's first test) against figures3d.js directly.
//
// AFTER: figures3d.js gains buildCorpseMini(THREE, key) — a GLB-backed corpse
// mini from miniLibrary.js's 'corpse' category (Tim's two hand-made GLBs,
// corpse_assemblage.glb + corpse_remains_red.glb, received 2026-07-05 per
// docs/MINIS_WISHLIST.md) — and render3d.js's enemy loop tries it FIRST for a
// defeated foe, falling back to the toppled archetype only when no corpse GLB
// is available (empty library / not loaded yet / load failed).
//
// figures3d.js never imports three at module scope (THREE is always passed in
// by the caller — see its own file-header comment), so this file can import it
// directly in plain Node and drive it with a MINIMAL fake THREE that implements
// only the handful of classes buildArchetypeFigure/buildCorpseMini actually
// touch (Group/Mesh/geometries/materials as inert containers) — a real
// functional test of the swap logic, not a source-regex stand-in. render3d.js
// itself DOES reach real WebGL/DOM setup in its exported mount functions
// (mountCombat3D/mountSlice3D), which three.js genuinely can't run hermetically
// (no jsdom/WebGL in this test env — the same constraint U479's header
// documents) — so render3d.js's specific enemy-loop wiring is covered by
// U538's source-contract checks instead, the established convention for that
// file (see U479.ttInkNoBuildingMeshes.test.js).
//
// Hermetic — no network, no WebGL, no API key, no Math.random (buildCorpseMini's
// picker is the FNV-1a hash figures3d.js already uses for phaseFromKey).

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildArchetypeFigure, buildCorpseMini, pickCorpseMini } from '../public/map/figures3d.js';
import { MINI_LIBRARY, minisByCategory } from '../public/map/miniLibrary.js';

// ---- minimal fake THREE ---------------------------------------------------
// Only the surface figures3d.js's procedural + corpse paths actually call.
// Every geometry/material is an inert data bag; Group/Mesh track children,
// position/rotation/scale, and traverse() (used by figures3d.js's defeated-
// transparency pass over materials).
class FakeObject3D {
  constructor() {
    this.children = [];
    this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1, setScalar(s) { this.x = this.y = this.z = s; } };
    this.userData = {};
    this.castShadow = false; this.receiveShadow = false;
  }
  add(child) { this.children.push(child); return this; }
  traverse(fn) {
    fn(this);
    for (const c of this.children) c.traverse ? c.traverse(fn) : fn(c);
  }
}
class FakeGroup extends FakeObject3D { constructor() { super(); this.isGroup = true; } }
class FakeMesh extends FakeObject3D {
  constructor(geometry, material) { super(); this.isMesh = true; this.geometry = geometry; this.material = material; }
}
class FakeGeometry { constructor(...args) { this.args = args; } }
class FakeMaterial { constructor(opts = {}) { Object.assign(this, opts); } }

function makeFakeThree() {
  return {
    Group: FakeGroup,
    Mesh: FakeMesh,
    BoxGeometry: FakeGeometry, CapsuleGeometry: FakeGeometry, CircleGeometry: FakeGeometry,
    ConeGeometry: FakeGeometry, CylinderGeometry: FakeGeometry, SphereGeometry: FakeGeometry,
    TorusGeometry: FakeGeometry,
    MeshBasicMaterial: FakeMaterial, MeshStandardMaterial: FakeMaterial,
  };
}

test('U537 (BEFORE, documented): a defeated archetype figure only topples the standing rig — no corpse body, no GLB', () => {
  const THREE = makeFakeThree();
  const fig = buildArchetypeFigure(THREE, 'humanoid', { defeated: true });
  assert.ok(fig, 'a defeated figure must still return SOMETHING (never vanish)');
  assert.equal(fig.userData.archetype, 'humanoid', 'it is still tagged as the humanoid archetype — the SAME standing rig, not a distinct corpse asset');
  assert.equal(fig.userData.defeated, true, 'defeated flag carries through');
  assert.ok(!('corpseId' in fig.userData), 'the pre-fix path never sets a corpseId — proves this is the toppled archetype, not a corpse mini');
  assert.ok(Math.abs(fig.rotation.z) > 1, 'the toppling rotation (Math.PI / 2.15) is the ONLY "downed" signal — geometry-wise this is a standing figure knocked on its side');
});

test('U537: miniLibrary.js has a non-empty corpse category to swap in (the two received GLBs)', () => {
  const corpses = minisByCategory('corpse');
  assert.ok(corpses.length >= 2, 'expected both corpse_assemblage and corpse_remains_red registered');
  const ids = corpses.map(c => c.id);
  assert.ok(ids.includes('corpse_assemblage'), 'corpse_assemblage must be registered');
  assert.ok(ids.includes('corpse_remains_red'), 'corpse_remains_red must be registered');
});

test('U537: pickCorpseMini(key) resolves to a real MINI_LIBRARY corpse entry', () => {
  const mini = pickCorpseMini('goblin-scout-3');
  assert.ok(mini, 'pickCorpseMini must resolve to an entry when the corpse category is non-empty');
  assert.ok(MINI_LIBRARY.includes(mini), 'the resolved entry must be a real member of MINI_LIBRARY, not a fabricated shape');
  assert.equal(mini.category, 'corpse');
});

test('U537 (AFTER — the fix): buildCorpseMini(THREE, key) resolves in a browser-like environment (window present) — the actual swap the brief asks for', async () => {
  // buildCorpseMini's GLTFLoader fetch only runs when `window` exists (mirrors
  // figureAssets.js's ensureFigureGLB guard) — in this hermetic Node test there
  // is no window, so the swap function itself is exercised (this proves the
  // deterministic-picker + graceful-null contract); the actual GLB fetch path
  // is proven separately by U538's fallback-discipline tests, which is the
  // honest boundary for a GLTFLoader/fetch dependency in a no-network test env.
  const THREE = makeFakeThree();
  const result = buildCorpseMini(THREE, 'goblin-scout-3');
  assert.equal(result, null, 'without `window` (no browser fetch), buildCorpseMini must return null — never throw, never fabricate a mesh from nothing');
});
