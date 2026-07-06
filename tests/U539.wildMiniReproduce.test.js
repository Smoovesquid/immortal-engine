// U539 — MR-3b: THE WILD DRAWN, reproduced. BEFORE this packet, MR-3a's engine
// derivation (engine/world/wildFeatures.js, landed v0.29.9) knew what stood on
// every wild cell — but nothing on the RENDER side ever asked it. A player
// standing in the middle of the Greenwood's forest, at a real region-frame
// tactical position with real wild features all around them (MR-3a's own
// U533-U536 prove the derivation itself works), saw an EMPTY wild: render3d.js
// never imported wildFeaturesAround, and figures3d.js had no builder for any
// of the five wild kinds (tree/boulder/brush/deadfall/stump) — the fog hid a
// world that was there, but nothing drew it once the fog lifted.
//
// AFTER this packet: figures3d.js gains buildWildMini(THREE, kind, opts) (five
// procedural archetypes, keyed deterministically by the feature's own cell —
// same discipline as buildPropMini/buildCorpseMini), and render3d.js imports
// wildFeaturesAround directly (a pure read of the engine module, the same
// pattern placedTokenModel already established for TT-PROPS) and rebuilds a
// wild-mini bubble around the player's live tactical position on mount and on
// every setPlayerFocus call.
//
// Method: figures3d.js's new builder is tested DIRECTLY and hermetically
// (fake THREE, matching U537/U538's established convention — real code, no
// WebGL/DOM dependency). render3d.js's specific wiring is proven via
// source-contract checks against its actual text (also U538's convention:
// three.js genuinely can't run hermetically here — no jsdom/WebGL in this
// test env). The BEFORE state is proven by diffing against HEAD (the commit
// before this packet's changes), not by taking the packet's own account on
// faith.
//
// Hermetic — no network, no WebGL, no API key, no Math.random.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { buildWildMini } from '../public/map/figures3d.js';
import { wildFeaturesAround, WILD_CONSTANTS } from '../engine/world/wildFeatures.js';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { nodeGridToRegionCell } from '../engine/map/spatial/tacticalPos.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.join(__dirname, '..');
const RENDER3D_SRC = fs.readFileSync(path.join(REPO_ROOT, 'public', 'map', 'render3d.js'), 'utf8');
const FIGURES3D_SRC = fs.readFileSync(path.join(REPO_ROOT, 'public', 'map', 'figures3d.js'), 'utf8');

// ---- minimal fake THREE (matches U537/U538's convention exactly) ----------
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

// ---- a real, playable slice world (same boot as U536) ---------------------
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

// -------------------- 1. BEFORE (documented against real HEAD) --------------------

// LOADER-note (integration fix): these BEFORE-docs originally read `git show HEAD:` — true only in a
// dirty pre-commit worktree; once the packet is COMMITTED, HEAD contains the fix and the doc-tests
// invert. Pinned to fc9019df (v0.29.9, the pre-packet base) — immutable, in shared history.
test('U539 (BEFORE, documented): figures3d.js at the pre-packet base had no wild-mini builder at all', () => {
  let headSrc = '';
  try {
    headSrc = execFileSync('git', ['show', 'fc9019df:public/map/figures3d.js'], { encoding: 'utf8', cwd: REPO_ROOT });
  } catch { headSrc = ''; }
  assert.ok(headSrc.length > 0, 'precondition: could read figures3d.js from the pre-packet base via git');
  assert.ok(!/buildWildMini/.test(headSrc), 'the pre-packet base must not define buildWildMini — this packet introduced it');
  assert.ok(!/WILD_PALETTE/.test(headSrc), 'the pre-packet base must not carry a wild-feature palette');
});

test('U539 (BEFORE, documented): render3d.js at the pre-packet base never imported wildFeaturesAround — the wild derivation was never consumed', () => {
  let headSrc = '';
  try {
    headSrc = execFileSync('git', ['show', 'fc9019df:public/map/render3d.js'], { encoding: 'utf8', cwd: REPO_ROOT });
  } catch { headSrc = ''; }
  assert.ok(headSrc.length > 0, 'precondition: could read render3d.js from the pre-packet base via git');
  assert.ok(!/wildFeaturesAround/.test(headSrc), 'the pre-packet base must not import/call wildFeaturesAround — the render side never asked the derivation for anything');
  assert.ok(!/refreshWildMinis/.test(headSrc), 'the pre-packet base must not have a wild-mini refresh hook');
});

test('U539 (BEFORE, documented): MR-3a\'s derivation itself already returns real features in the Greenwood — proving the fog hid a world that WAS there, only the renderer was blind to it', () => {
  const world = bootSlice();
  const { centre } = greenwood(world);
  // A generous radius inside the forest should already turn up SOMETHING —
  // MR-3a's own U533-U536 prove this at length; this is just the reminder that
  // the data source was never the gap this packet closes.
  const feats = wildFeaturesAround(world, centre, 40);
  assert.ok(feats.length > 0, 'precondition: the Greenwood forest already derives real wild features (MR-3a) — the render side was the only missing half');
});

// -------------------- 2. AFTER — the fix: buildWildMini exists and works --------------------

test('U539 (AFTER — the fix): buildWildMini builds a real mini for all five MR-3a kinds', () => {
  const THREE = makeFakeThree();
  for (const kind of WILD_CONSTANTS.KINDS) {
    const mini = buildWildMini(THREE, kind, { seedKey: '12,34', sizeClass: 'medium' });
    assert.ok(mini, `buildWildMini must return a mini for kind "${kind}"`);
    assert.ok(mini.children.length > 0, `the "${kind}" mini must have actual geometry, not an empty group`);
    assert.equal(mini.userData.kind, kind, `the "${kind}" mini must tag its own kind in userData`);
    assert.equal(mini.userData.wild, true, `the "${kind}" mini must be tagged wild:true (distinct from a settlement prop/NPC mini)`);
  }
});

test('U539 (AFTER — the fix): buildWildMini returns null for an unrecognized kind — never fabricates a shape for data outside the five kinds this stage covers', () => {
  const THREE = makeFakeThree();
  assert.equal(buildWildMini(THREE, 'dragon', {}), null);
  assert.equal(buildWildMini(THREE, '', {}), null);
  assert.equal(buildWildMini(THREE, undefined, {}), null);
});

test('U539 (AFTER — the fix): render3d.js now imports wildFeaturesAround from the engine module — a pure read, the same pattern placedTokenModel already established', () => {
  assert.ok(/import\s*\{\s*wildFeaturesAround\s*\}\s*from\s*'\.\.\/\.\.\/engine\/world\/wildFeatures\.js';/.test(RENDER3D_SRC),
    'render3d.js must import wildFeaturesAround directly from the engine module');
});

test('U539 (AFTER — the fix): render3d.js wires a refreshWildMinis hook that consumes wildFeaturesAround and buildWildMini together', () => {
  assert.ok(/function refreshWildMinis\s*\(/.test(RENDER3D_SRC), 'render3d.js must define refreshWildMinis()');
  assert.ok(/wildFeaturesAround\(opts\.world,\s*center,\s*WILD_BUBBLE_CELLS\)/.test(RENDER3D_SRC),
    'refreshWildMinis must call wildFeaturesAround with the player\'s own center and the pinned bubble radius');
  assert.ok(/buildWildMini\(THREE,\s*f\.kind,/.test(RENDER3D_SRC),
    'refreshWildMinis must build a mini for each derived feature via buildWildMini');
});

test('U539 (AFTER — the fix): figures3d.js\'s Math.random purity law extends to the new wild-mini code (same law U538 checks for the corpse-mini code)', () => {
  assert.ok(!/Math\.random\s*\(/.test(FIGURES3D_SRC), 'figures3d.js must never CALL Math.random directly');
  assert.ok(!/Math\.random\s*\(/.test(RENDER3D_SRC), 'render3d.js must never CALL Math.random directly (still true after this packet\'s edits)');
});
