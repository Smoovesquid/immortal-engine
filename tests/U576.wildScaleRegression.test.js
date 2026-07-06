// U576 — WILD-SCALE-1 regression: the wild footprint law (U575) must never
// break the three things it deliberately sits next to.
//
//   1. GOLDENS byte-identical — the 2-D ink (oneMap.js's canvas draw) is
//      UNTOUCHED by this packet (this sizes 3-D minis to match the ink, never
//      the reverse); the 7 canonical scenes' pixel hashes must not drift.
//      Run via `npm run playtest:screen` as the live receipt (this file
//      asserts the SOURCE-LEVEL half: nothing in the 2-D draw path was
//      touched, and figures3d.js/render3d.js's edits are additive-only where
//      pre-existing entity/prop scale code is concerned).
//   2. U540's rebuild determinism — the SAME (world, position) must still
//      derive the IDENTICAL wild-mini SET (same features, same kinds) at the
//      new scale; a scale law must never perturb WHICH minis exist, only how
//      big they draw. Re-run at this packet's HEAD, not re-derived here (a
//      second copy would drift from U540's own source of truth).
//   3. People/prop scaling (U566/U567 values) untouched — the wild footprint
//      law was ADDED alongside the existing mini-scale law, never edited it;
//      FIGURE_HEIGHT_WU/PROP_TRUE_SIZE and their consumers must read exactly
//      as REND-SCALE-1 (381fdde2) left them.
//
// Hermetic — no network, no WebGL, no API key, no Math.random.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  FIGURE_HEIGHT_WU, figureHeightWu, PROP_TRUE_SIZE, propTrueSize, miniSheetScale,
  wildTrueSize, WILD_TRUE_SIZE, WU_PER_FT,
} from '../public/map/figures3d.js';
import { wildFeaturesAround } from '../engine/world/wildFeatures.js';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { nodeGridToRegionCell } from '../engine/map/spatial/tacticalPos.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.join(__dirname, '..');
const RENDER3D_SRC = fs.readFileSync(path.join(REPO_ROOT, 'public', 'map', 'render3d.js'), 'utf8');
const FIGURES3D_SRC = fs.readFileSync(path.join(REPO_ROOT, 'public', 'map', 'figures3d.js'), 'utf8');
const DRAWMODEL_SRC = fs.readFileSync(path.join(REPO_ROOT, 'public', 'map', 'drawModel.js'), 'utf8');
const ONEMAP_SRC = fs.readFileSync(path.join(REPO_ROOT, 'public', 'map', 'oneMap.js'), 'utf8');

// -------------------- 1. The 2-D ink path is untouched (source-level) --------------------

test('U576a drawModel.js and oneMap.js (the 2-D ink draw path) are byte-identical to the pre-packet base — this packet only sizes 3-D minis, never the ink', () => {
  // Pinned to 109f3146 — this worker's own reset point (docs/PACKETS.md's
  // WILD-SCALE-1 dispatch commit), immutable in shared history.
  const BASE = '109f3146';
  let baseDrawModel = '', baseOneMap = '';
  try {
    baseDrawModel = execFileSync('git', ['show', `${BASE}:public/map/drawModel.js`], { encoding: 'utf8', cwd: REPO_ROOT });
    baseOneMap = execFileSync('git', ['show', `${BASE}:public/map/oneMap.js`], { encoding: 'utf8', cwd: REPO_ROOT });
  } catch { /* leave empty — precondition assertions below will fail loudly */ }
  assert.ok(baseDrawModel.length > 0, 'precondition: could read drawModel.js from the dispatch-point base via git');
  assert.ok(baseOneMap.length > 0, 'precondition: could read oneMap.js from the dispatch-point base via git');
  assert.equal(DRAWMODEL_SRC, baseDrawModel, 'drawModel.js must be BYTE-IDENTICAL to the pre-packet base — the 2-D ink model is untouched (this packet reads INK_PARAMS, never edits it)');
  assert.equal(ONEMAP_SRC, baseOneMap, 'oneMap.js must be BYTE-IDENTICAL to the pre-packet base — the 2-D canvas draw is untouched');
});

test('U576b render3d.js reads INK_PARAMS (the live ink-truth) but never assigns/mutates it — a read-only import, matching the brief\'s "2-D ink UNTOUCHED" law', () => {
  assert.ok(/import\s*\{\s*placedTokenModel,\s*INK_PARAMS\s*\}\s*from\s*'\.\/drawModel\.js';/.test(RENDER3D_SRC),
    'render3d.js must import INK_PARAMS alongside its existing placedTokenModel import from drawModel.js');
  // Same-line only ([^\n=]* rather than [^=]*) — a same-line assignment
  // target like `INK_PARAMS.x = ...` or `INK_PARAMS = ...`; must not match
  // across a newline into an unrelated later `=` (a comment mentioning
  // INK_PARAMS.treeRadiusWu followed several lines later by an unrelated
  // `const x = ...` is not an assignment INTO INK_PARAMS).
  assert.ok(!/INK_PARAMS\s*[.\[][^\n=]*=[^=]/.test(RENDER3D_SRC), 'render3d.js must never assign into INK_PARAMS (read-only ink-truth reference)');
});

// -------------------- 2. U540's rebuild determinism holds at the new scale --------------------

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

// A minimal fake THREE for measureAuthoredSize/measureAuthoredFootprint's Box3
// call, sized so every kind's authored extent is deterministic and identical
// call-to-call (no real geometry needed — the scale LAW's determinism is what
// this test proves, not the geometry builders' own determinism, already
// covered by U539/U540's own fingerprint tests).
function fakeThreeFixedBox() {
  return {
    Box3: class {
      setFromObject() { return this; }
      getSize(v) { v.x = 1.1; v.y = 1.6; v.z = 0.9; return v; }
    },
    Vector3: class { constructor() { this.x = 0; this.y = 0; this.z = 0; } },
  };
}

test('U576c the SAME (world, position) derives IDENTICAL wild-mini scale factors on repeat — a scale law must not perturb the SET, only the drawn size (joins U540\'s own set-identity guarantee)', () => {
  const world = bootSlice();
  const { centre } = greenwood(world);
  const featsA = wildFeaturesAround(world, centre, 12);
  const featsB = wildFeaturesAround(world, centre, 12);
  assert.ok(featsA.length > 0, 'precondition: the Greenwood centre derives a non-empty bubble at radius 12 (same precondition U540 uses)');
  assert.equal(featsA.length, featsB.length, 'two derivations must return the same feature COUNT');

  const THREE = fakeThreeFixedBox();
  const spw = 1.4; // a representative interior-band scenePerWu
  for (let i = 0; i < featsA.length; i++) {
    assert.deepEqual(featsA[i], featsB[i], `feature #${i} must be identical between two derivations (U540's own guarantee, unperturbed by this packet)`);
    const kind = featsA[i].kind;
    const trueSize = wildTrueSize(kind, 5.6);
    if (!trueSize) continue; // an unrecognized kind never reaches the scale law (buildWildMini already guards this — same as before this packet)
    const authored = trueSize.axis === 'x' ? 1.1 : trueSize.axis === 'z' ? 0.9 : trueSize.axis === 'footprint' ? Math.hypot(1.1, 0.9) : 1.6;
    const scaleA = miniSheetScale(trueSize.wu / authored, spw, 1);
    const scaleB = miniSheetScale(trueSize.wu / authored, spw, 1);
    assert.equal(scaleA, scaleB, `kind "${kind}"'s derived scale factor must be identical call-to-call for the same inputs — the law is pure`);
  }
});

test('U576d render3d.js\'s wild loop still derives feats 1:1 from wildFeaturesAround and iterates them unchanged — U540\'s two source-contract regexes still match after this packet\'s edits (they were not touched, only code was added around them)', () => {
  // The exact literal U540 asserts against — re-checked here so a future edit
  // that breaks U540 also fails loudly in this packet's own regression file.
  assert.ok(/const feats = wildFeaturesAround\(opts\.world, center, WILD_BUBBLE_CELLS\);/.test(RENDER3D_SRC),
    'render3d.js must still derive `feats` directly from wildFeaturesAround (U540\'s own literal)');
  assert.ok(/for \(const f of feats\) \{/.test(RENDER3D_SRC),
    'render3d.js\'s wild loop must still iterate the derivation\'s own feats array 1:1 (U540\'s own literal)');
  assert.ok(!/Math\.random\s*\(/.test(RENDER3D_SRC), 'render3d.js must still never call Math.random (U540\'s determinism law, unperturbed)');
  assert.ok(!/Math\.random\s*\(/.test(FIGURES3D_SRC), 'figures3d.js must still never call Math.random (U538/U539\'s purity law, unperturbed)');
});

// -------------------- 3. People/prop scaling (U566/U567 values) untouched --------------------

test('U576e FIGURE_HEIGHT_WU and PROP_TRUE_SIZE (REND-SCALE-1\'s own tables) are byte-value-identical to their landed values — UNIT-CLASH-1 relock: authored feet × WU_PER_FT (metric wu)', () => {
  // Relocked 2026-07-06 (UNIT-CLASH-1): the tables' AUTHORED values (3.5/6 ft
  // figures; 3.2/2.2/4.2/7 ft props) are unchanged — they now export through
  // the one ft→wu seam because the sheet's wu is metric. The original packet
  // constraint this test pinned (WILD-SCALE-1 must not edit REND-SCALE-1's
  // tables) is preserved in exactly that authored-value form.
  assert.deepEqual(FIGURE_HEIGHT_WU, { small: 3.5 * WU_PER_FT, medium: 6 * WU_PER_FT }, 'FIGURE_HEIGHT_WU authored values must be untouched');
  assert.deepEqual(PROP_TRUE_SIZE, {
    barrel: { axis: 'y', wu: 3.2 * WU_PER_FT },
    chest: { axis: 'y', wu: 2.2 * WU_PER_FT },
    dresser: { axis: 'y', wu: 4.2 * WU_PER_FT },
    bed: { axis: 'z', wu: 7 * WU_PER_FT },
  }, 'PROP_TRUE_SIZE authored values must be untouched');
  // Spot-check the consumer functions still return the SAME values U566 pins.
  assert.equal(figureHeightWu({ name: 'Hobbit' }), 3.5 * WU_PER_FT);
  assert.equal(figureHeightWu(null), 6 * WU_PER_FT);
  assert.equal(propTrueSize('bed').wu, 7 * WU_PER_FT);
  assert.equal(propTrueSize('barrel').axis, 'y');
});

test('U576f WILD_TRUE_SIZE is its OWN table, disjoint in spirit from PROP_TRUE_SIZE\'s prop kinds — no kind collision that could shadow a prop\'s true size', () => {
  const propKinds = Object.keys(PROP_TRUE_SIZE);
  const wildKinds = Object.keys(WILD_TRUE_SIZE); // does not include 'tree' (derived, see U575b/c) — that's fine, still disjoint
  for (const k of wildKinds) {
    assert.ok(!propKinds.includes(k), `wild kind "${k}" must not collide with a prop kind — the two families are looked up by DIFFERENT builders (buildWildMini vs buildPropMini) but share no table`);
  }
});

test('U576g render3d.js\'s entity (people/prop) scale-reapply loop is unchanged text, and the new wild scale-reapply loop is ADDITIVE (a separate for-loop, not a rewrite of the entity one)', () => {
  assert.ok(/for \(const m of entityMinis\) \{/.test(RENDER3D_SRC), 'the entityMinis scale-reapply loop (REND-SCALE-1) must still exist verbatim');
  assert.ok(/for \(const m of wildMinis\) \{/.test(RENDER3D_SRC), 'a NEW, separate wildMinis scale-reapply loop must exist (WILD-SCALE-1) — additive, not a merge into the entity loop');
});
