// U575 — WILD-SCALE-1: a wild mini's FOOTPRINT rides the same sheet-scale law
// REND-SCALE-1 (b104, 381fdde2) gave people/props (figures3d.js's
// miniSheetScale/figureHeightWu/propTrueSize), extended to the five MR-3b wild
// kinds (tree/boulder/brush/deadfall/stump). Same falsifier class: a tree's
// 2-D ink circle is drawn at its own wu size (drawModel.js's
// INK_PARAMS.treeRadiusWu), but the 3-D mini standing on that ink kept an
// authored-fixed size before this packet — wrong against the ink at every
// zoom the squares are visible.
//
// The law (figures3d.js's wildTrueSize + measureAuthoredSize/
// measureAuthoredFootprint, feeding the EXISTING miniSheetScale): drawn
// footprint == true wu size × sheetScenePerWu, floored at the authored token
// look for zoomed-out legibility — pinned here across three zooms, exactly
// U567's method for people, so both mini families are provably the same law.
//
// Pure + THREE-free (this file, and the functions it tests) — hermetic, no
// network, no WebGL, no Math.random.

import test from 'node:test';
import assert from 'node:assert/strict';
import { sheetScenePerWu } from '../public/map/worldSpace.js';
import {
  wildTrueSize, WILD_TRUE_SIZE, miniSheetScale, measureAuthoredFootprint,
} from '../public/map/figures3d.js';

const SHEET_PX = 2048; // render3d's capture size — any consistent value works here

// A minimal fake THREE.Box3/Vector3 (the same shape measureAuthoredSize/
// measureAuthoredFootprint's try-block expects) so this file stays THREE-free
// like figures3d.js itself. `size` is the authored group's {x,y,z} extent.
function fakeThreeForSize(size) {
  return {
    Box3: class {
      setFromObject() { return this; }
      getSize(v) { v.x = size.x; v.y = size.y; v.z = size.z; return v; }
    },
    Vector3: class { constructor() { this.x = 0; this.y = 0; this.z = 0; } },
  };
}

test('U575a wildTrueSize — a recognized kind for all five MR-3a kinds, null for anything else', () => {
  for (const kind of ['tree', 'boulder', 'brush', 'deadfall', 'stump']) {
    const t = wildTrueSize(kind);
    assert.ok(t, `wildTrueSize must recognize kind "${kind}"`);
    assert.ok(['x', 'y', 'z', 'footprint'].includes(t.axis), `kind "${kind}" must have a valid axis`);
    assert.ok(t.wu > 0, `kind "${kind}" must have a positive true wu size`);
  }
  assert.equal(wildTrueSize('dragon'), null, 'an unrecognized kind must return null — never invent a size for data outside the five kinds this stage covers');
  assert.equal(wildTrueSize(''), null);
  assert.equal(wildTrueSize(undefined), null);
});

test('U575b wildTrueSize(tree) anchors to the settlement-band ink\'s own tree diameter (INK_PARAMS.treeRadiusWu · 2), never a second hardcoded copy', () => {
  const INK_TREE_RADIUS_WU = 2.8; // drawModel.js's live INK_PARAMS.treeRadiusWu (0.7 * PLACE_WU, PLACE_WU=4) at time of writing
  const t = wildTrueSize('tree', INK_TREE_RADIUS_WU * 2);
  assert.equal(t.wu, INK_TREE_RADIUS_WU * 2, 'a wild tree\'s true footprint must equal 2·treeRadiusWu exactly — the SAME ink-truth the settlement-band grove tokens draw');
  // A caller passing a DIFFERENT live ink value must see it reflected — proves
  // this is a live parameter, not a baked-in duplicate that could drift.
  const t2 = wildTrueSize('tree', 9.4);
  assert.equal(t2.wu, 9.4, 'wildTrueSize(tree) must use the CALLER-supplied treeDiameterWu, not an internal constant');
});

test('U575c wildTrueSize(tree) falls back to today\'s ink value when the caller omits treeDiameterWu (e.g. a bare test)', () => {
  const t = wildTrueSize('tree');
  assert.equal(t.wu, 5.6, 'the documented default (2 · today\'s INK_PARAMS.treeRadiusWu of 2.8) must hold when no live value is threaded in');
  assert.equal(t.axis, 'x');
});

test('U575d the drawn footprint law: for each wild kind, drawn size == true wu size × sheetScenePerWu at three zooms, floor binds at region zoom', () => {
  const authoredExtent = { x: 1.1, y: 1.6, z: 0.9 }; // a plausible mixed authored box for a procedural wild mini
  const THREE = fakeThreeForSize(authoredExtent);
  for (const kind of ['tree', 'boulder', 'brush', 'deadfall', 'stump']) {
    const trueSize = wildTrueSize(kind, 5.6);
    const authored = trueSize.axis === 'footprint'
      ? measureAuthoredFootprint(THREE, {})
      : authoredExtent[trueSize.axis];
    const wuPerAuthored = trueSize.wu / authored;
    // Three zooms across the street→plan band (mirrors U567's own band).
    for (const spanScene of [100]) {
      for (const z of [45, 60, 90]) {
        const spw = sheetScenePerWu(spanScene, z, SHEET_PX);
        const scale = miniSheetScale(wuPerAuthored, spw, 1);
        const drawnWu = (scale * authored) / spw;
        if (scale > 1 + 1e-9) {
          // Above the floor: the drawn footprint must equal the true wu size EXACTLY.
          assert.ok(Math.abs(drawnWu - trueSize.wu) < 1e-9,
            `kind "${kind}" at z=${z}: drawn footprint (${drawnWu}) must equal true wu size (${trueSize.wu})`);
        }
      }
    }
    // Region zoom: true scale is below the floor — the drawn size must equal
    // the authored look (today's pre-packet behavior), never below it.
    const spwFar = sheetScenePerWu(100, 0.8, SHEET_PX);
    const scaleFar = miniSheetScale(wuPerAuthored, spwFar, 1);
    assert.ok(trueSize.wu * spwFar < authored, `precondition for kind "${kind}": true scale must be below the floor at region zoom`);
    assert.equal(scaleFar, 1, `kind "${kind}": the floor must bind at region zoom (authored token look preserved)`);
  }
});

test('U575e monotonic in zoom — footprints grow with the squares, never shrink, for every wild kind', () => {
  const authoredExtent = 1.3;
  for (const kind of ['tree', 'boulder', 'brush', 'deadfall', 'stump']) {
    const trueSize = wildTrueSize(kind, 5.6);
    const wuPerAuthored = trueSize.wu / authoredExtent;
    let prev = 0;
    for (const spw of [0.3, 0.6, 1.0, 1.8, 2.6]) {
      const s = miniSheetScale(wuPerAuthored, spw, 1);
      assert.ok(s >= prev - 1e-12, `kind "${kind}": scale must not shrink as the sheet zooms in (spw=${spw})`);
      prev = s;
    }
  }
});

test('U575f degenerate guards — measureAuthoredFootprint never explodes on a zero/garbage box, matching measureAuthoredSize\'s own guard value', () => {
  const zeroThree = fakeThreeForSize({ x: 0, y: 0, z: 0 });
  assert.equal(measureAuthoredFootprint(zeroThree, {}), 2.2, 'a degenerate (zero) box must fall back to the guard value, never 0 (which would divide-by-zero downstream)');
  const throwingThree = { Box3: class { setFromObject() { throw new Error('no geometry'); } } };
  assert.equal(measureAuthoredFootprint(throwingThree, {}), 2.2, 'a throwing Box3 must be caught and fall back to the guard value');
});

test('U575g measureAuthoredFootprint is yaw-invariant — the diagonal is exact for a length-true shape rotated any amount around Y (deadfall\'s actual build behavior)', () => {
  // A log of true length L, rotated by yaw θ around Y, has authored Box3
  // extents (approximately, ignoring the small radius) x=L·|cos θ|, z=L·|sin
  // θ| — so hypot(x,z) must recover L regardless of θ. This is the exact
  // reason deadfall (which bakes a random `rng()·2π` Y-yaw into its OWN
  // build, unlike bed/other props which are built axis-aligned) needs the
  // diagonal measure rather than measureAuthoredSize's single fixed axis.
  const L = 6.5;
  for (const theta of [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2, 1.9, 2.7]) {
    const x = Math.abs(L * Math.cos(theta));
    const z = Math.abs(L * Math.sin(theta));
    const THREE = fakeThreeForSize({ x, y: 0.3, z });
    const measured = measureAuthoredFootprint(THREE, {});
    assert.ok(Math.abs(measured - L) < 1e-9, `yaw θ=${theta}: measureAuthoredFootprint must recover the true length ${L}, got ${measured}`);
  }
});

test('U575h WILD_TRUE_SIZE — the four non-tree kinds are grounded taste constants (no ink counterpart exists for them), each with a sane axis + positive wu', () => {
  // Documented precedent: PROP_TRUE_SIZE (REND-SCALE-1) already stands on
  // reasoned-not-derived constants for barrel/chest/dresser — same footing.
  assert.equal(WILD_TRUE_SIZE.boulder.axis, 'y');
  assert.equal(WILD_TRUE_SIZE.deadfall.axis, 'footprint');
  assert.equal(WILD_TRUE_SIZE.brush.axis, 'x');
  assert.equal(WILD_TRUE_SIZE.stump.axis, 'y');
  assert.ok(!('tree' in WILD_TRUE_SIZE), 'tree must NOT carry a literal entry — its size is derived from the live ink value, never a second hardcoded copy (U575b/c)');
  for (const kind of ['boulder', 'deadfall', 'brush', 'stump']) {
    assert.ok(WILD_TRUE_SIZE[kind].wu > 0 && WILD_TRUE_SIZE[kind].wu < 15, `kind "${kind}"'s wu must be a plausible few-foot-to-a-dozen-foot size, not degenerate`);
  }
});
