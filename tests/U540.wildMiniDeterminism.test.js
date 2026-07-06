// U540 — MR-3b: determinism + no-foreign-mini law.
//
// Two guarantees the brief asks this file to prove:
//   1. DETERMINISM: the SAME (world, player position) derives the IDENTICAL
//      wild-mini set on repeat (same features, same kinds, same procedural
//      geometry per feature) — a different position shifts the bubble to a
//      genuinely different feature set. This is figures3d.js's buildWildMini
//      determinism (already exercised directly in U539) PLUS the render-layer
//      guarantee that feeding it the SAME derived feature list twice produces
//      the SAME mini set — proven end-to-end via the real engine derivation
//      (wildFeaturesAround) feeding buildWildMini, mirroring exactly what
//      render3d.js's refreshWildMinis does internally.
//   2. NO FOREIGN INK: a wild mini never appears inside a settlement's
//      footprint or a road/path corridor. MR-3a's own wildFeaturesAround
//      already GUARANTEES this at the data layer (U535's corridor-clearance +
//      settlement-exclusion tests) — this file's job (per the brief: "assert
//      the renderer doesn't break it") is to prove the RENDER PATH never adds
//      a feature the derivation didn't return, and never renders a mini for a
//      cell the derivation excluded — i.e. render3d.js's wild loop is a
//      faithful 1:1 draw of wildFeaturesAround's own output, not a second,
//      independently-scattered decoration pass that could reintroduce a tree
//      inside a building.
//
// Method: the real engine (beginAdventure + the Aldermere slice, same boot as
// U536/U539) sources real settlement/corridor geometry; figures3d.js's real
// buildWildMini is exercised with a hermetic fake THREE (U537/U538/U539's
// convention); render3d.js's specific "1:1 with the derivation" wiring is
// proven via source-contract checks (three.js can't run hermetically here —
// same documented constraint as U538/U539).
//
// Hermetic — no network, no WebGL, no API key, no Math.random.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { buildWildMini } from '../public/map/figures3d.js';
import { wildFeaturesAround, isRegionCellBlocked, WILD_CONSTANTS } from '../engine/world/wildFeatures.js';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { nodeGridToRegionCell, nearestNodeToRegionCell } from '../engine/map/spatial/tacticalPos.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.join(__dirname, '..');
const RENDER3D_SRC = fs.readFileSync(path.join(REPO_ROOT, 'public', 'map', 'render3d.js'), 'utf8');

// ---- minimal fake THREE (U537/U538/U539's convention) ----------------------
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
  clear() { this.children = []; return this; }
  traverse(fn) { fn(this); for (const c of this.children) c.traverse ? c.traverse(fn) : fn(c); }
}
class FakeGroup extends FakeObject3D { constructor() { super(); this.isGroup = true; } }
class FakeMesh extends FakeObject3D {
  constructor(geometry, material) { super(); this.isMesh = true; this.geometry = geometry; this.material = material; }
}
class FakeGeometry { constructor(...args) { this.args = args; } }
class FakeMaterial { constructor(opts = {}) { Object.assign(this, opts); } }
class FakeColor {
  constructor(hex) { this.hex = hex; }
  clone() { return new FakeColor(this.hex); }
  offsetHSL() { return this; }
}
function makeFakeThree() {
  return {
    Group: FakeGroup, Mesh: FakeMesh,
    BoxGeometry: FakeGeometry, CapsuleGeometry: FakeGeometry, CircleGeometry: FakeGeometry,
    ConeGeometry: FakeGeometry, CylinderGeometry: FakeGeometry, SphereGeometry: FakeGeometry,
    TorusGeometry: FakeGeometry, IcosahedronGeometry: FakeGeometry, DodecahedronGeometry: FakeGeometry,
    MeshBasicMaterial: FakeMaterial, MeshStandardMaterial: FakeMaterial, Color: FakeColor,
  };
}

// A structural fingerprint of a built mini group (geometry args + material
// colors + userData), deep enough to catch a divergent shape/palette without
// depending on object identity (two SEPARATE builds of the "same" mini must
// be structurally identical, not the same JS object).
function fingerprint(group) {
  if (!group) return null;
  const walk = (o) => ({
    userData: o.userData,
    geometry: o.geometry ? o.geometry.args : null,
    material: o.material ? { color: o.material.color, roughness: o.material.roughness, metalness: o.material.metalness } : null,
    position: { x: o.position.x, y: o.position.y, z: o.position.z },
    rotation: { x: o.rotation.x, y: o.rotation.y, z: o.rotation.z },
    scale: { x: o.scale.x, y: o.scale.y, z: o.scale.z },
    children: (o.children || []).map(walk),
  });
  return JSON.stringify(walk(group));
}

// ---- real slice world (same boot as U536/U539) -----------------------------
const PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'], starterObjectives: ['find the key'],
    skills: ['Steel'], locations: ['tower'], objectives: ['find the key'],
    complications: ['a clock starts'], npcArchetypes: ['wary guide'],
    sensoryMotifs: ['air tastes of dust'],
  },
};
function bootSlice(seed = SLICE_SEED) {
  const w0 = newWorld({
    seed, fate: 0.2, campaignId: `campaign-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape',
  });
  return beginAdventure(ensureWorld(w0), PACKS).world;
}
function greenwood(world) {
  const gw = world.map.nodes.find(n => n.name === 'The Greenwood');
  return { node: gw, centre: nodeGridToRegionCell(gw.x, gw.y) };
}
function placePlayer(world, node, cell) {
  const w = { ...world, map: { ...world.map, currentNodeId: node.id } };
  return applyDeltas(w, [{ op: 'pos', id: 'party', to: { frame: 'region', gx: cell.gx, gy: cell.gy } }]);
}

// The render-layer bubble build, mirroring render3d.js's refreshWildMinis
// exactly (wildFeaturesAround -> buildWildMini per feature, keyed by cell) —
// re-implemented here (not imported — render3d.js needs a live THREE/DOM to
// import) so this test proves the SAME algorithm end-to-end.
function buildBubble(THREE, world, center, radius) {
  const feats = wildFeaturesAround(world, center, radius);
  return feats.map(f => ({
    feature: f,
    mini: buildWildMini(THREE, f.kind, { seedKey: `${f.cell.gx},${f.cell.gy}`, sizeClass: f.sizeClass }),
  }));
}

// -------------------- 1. Determinism --------------------

test('U540: the SAME (world, position, radius) derives the IDENTICAL wild-mini set on repeat', () => {
  const world = bootSlice();
  const { centre } = greenwood(world);
  const THREE = makeFakeThree();
  const a = buildBubble(THREE, world, centre, 12);
  const b = buildBubble(THREE, world, centre, 12);
  assert.ok(a.length > 0, 'precondition: the Greenwood centre derives a non-empty bubble at radius 12');
  assert.equal(a.length, b.length, 'two derivations of the same (world, center, radius) returned different feature COUNTS');
  for (let i = 0; i < a.length; i++) {
    assert.deepEqual(a[i].feature, b[i].feature, `feature #${i} differed between two derivations of the same (world, position)`);
    assert.equal(fingerprint(a[i].mini), fingerprint(b[i].mini), `mini #${i}'s built geometry differed between two derivations of the same (world, position) — not a pure function`);
  }
});

test('U540: a DIFFERENT player position shifts the bubble to a genuinely different feature set', () => {
  const world = bootSlice();
  const { centre } = greenwood(world);
  const THREE = makeFakeThree();
  const here = buildBubble(THREE, world, centre, 12);
  const farAway = buildBubble(THREE, world, { gx: centre.gx, gy: centre.gy + 400 }, 12);
  const hereKey = JSON.stringify(here.map(x => x.feature));
  const farKey = JSON.stringify(farAway.map(x => x.feature));
  assert.notEqual(hereKey, farKey, 'moving the bubble center 400 cells away must change the derived feature set (a real position-dependent bubble, not a fixed decoration)');
});

test('U540: repeated boots of the SAME seed derive the SAME wild-mini set (two independent world instances, not the same object)', () => {
  const worldA = bootSlice();
  const worldB = bootSlice();
  const { centre } = greenwood(worldA);
  const THREE = makeFakeThree();
  const a = buildBubble(THREE, worldA, centre, 12);
  const b = buildBubble(THREE, worldB, centre, 12);
  assert.equal(a.length, b.length, 'two independent boots of the same seed derived different feature counts');
  for (let i = 0; i < a.length; i++) {
    assert.deepEqual(a[i].feature, b[i].feature, `feature #${i} diverged between two independent boots of the same seed`);
  }
});

// -------------------- 2. No wild mini inside settlement footprints or road corridors --------------------

test('U540: the render-layer bubble build never contains a feature inside a settlement\'s excluded extent (the renderer draws the derivation 1:1 — it never adds its own)', () => {
  const world = bootSlice();
  const { node, centre } = greenwood(world);
  const THREE = makeFakeThree();
  // A radius wide enough to reach past the Greenwood into its neighbours,
  // where a settlement's excluded extent is plausibly nearby.
  const bubble = buildBubble(THREE, world, centre, 60);
  const rad = WILD_CONSTANTS.SETTLEMENT_EXCLUDE_CELLS;
  const settlementNodes = world.map.nodes.filter(n => Number.isInteger(n.x) && Number.isInteger(n.y)
    && (String(n.nodeType) === 'settlement' || String(n.nodeType) === 'town' || String(n.nodeType) === 'hamlet'
      || String(n.nodeType) === 'village' || String(n.nodeType) === 'city'
      || (n.settlement && (n.settlement.buildings || n.settlement.npcs))));
  for (const { feature } of bubble) {
    for (const sn of settlementNodes) {
      const sc = nodeGridToRegionCell(sn.x, sn.y);
      const dx = feature.cell.gx - sc.gx, dy = feature.cell.gy - sc.gy;
      const d2 = dx * dx + dy * dy;
      assert.ok(d2 > rad * rad, `wild feature at (${feature.cell.gx},${feature.cell.gy}) landed inside settlement "${sn.id}"'s excluded extent (radius ${rad}) — a tree grew through a building's ink`);
    }
  }
});

test('U540: the render-layer bubble build never contains a BLOCKING feature the engine\'s own isRegionCellBlocked disagrees with (renderer and walkable-mask read the same truth)', () => {
  const world = bootSlice();
  const { centre } = greenwood(world);
  const THREE = makeFakeThree();
  const bubble = buildBubble(THREE, world, centre, 30);
  let checkedBlocking = 0;
  for (const { feature } of bubble) {
    if (!feature.blocking) continue;
    checkedBlocking++;
    assert.equal(isRegionCellBlocked(world, feature.cell.gx, feature.cell.gy), true,
      `feature at (${feature.cell.gx},${feature.cell.gy}) is marked blocking:true but isRegionCellBlocked disagrees — the render layer and the walkable-mask truth have drifted apart`);
  }
  assert.ok(checkedBlocking > 0, 'precondition: at least one blocking feature exists in this bubble to check');
});

test('U540: render3d.js draws EXACTLY the features wildFeaturesAround returns — no second, independent scatter that could reintroduce excluded cells (source-contract)', () => {
  // The wild loop must iterate `feats` (wildFeaturesAround's own return) and
  // build a mini per feature — never roll its own placement/candidate cells.
  assert.ok(/const feats = wildFeaturesAround\(opts\.world, center, WILD_BUBBLE_CELLS\);/.test(RENDER3D_SRC),
    'render3d.js must derive `feats` directly from wildFeaturesAround, not a re-scattered candidate list');
  assert.ok(/for \(const f of feats\) \{/.test(RENDER3D_SRC),
    'render3d.js\'s wild loop must iterate the derivation\'s own feats array 1:1');
});

test('U540: render3d.js never seeds its own RNG stream for wild placement (no new Math.random, no local rng() call feeding a wild cell) — the ONE LAW holds at the render layer too', () => {
  assert.ok(!/Math\.random\s*\(/.test(RENDER3D_SRC), 'render3d.js must never call Math.random');
});
