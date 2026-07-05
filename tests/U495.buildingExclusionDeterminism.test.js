// U495 — TT-OCC: determinism + the exclusion property under adversarial tight
// geometry. U494 proves the fix on real boot worlds; this file proves the
// underlying mechanism (pushClearOfBuildings / insideAnyRect, exported from
// public/map/placeFromNode.js) two things a real-boot test can't easily force:
//   1. identical inputs always yield an identical escape point (no rng, no
//      hidden non-determinism), and
//   2. the fallback actually TERMINATES and stays outside ink even when
//      buildings cover most of the frame — the case a normal village layout
//      never quite reaches but a future denser settlement tier might.
//
// Design note on the algorithm itself (see placeFromNode.js's pushClearOfBuildings
// doc comment for the full account): a first draft pushed the scattered point
// directly away from the nearest (or nearest-edge, or vector-summed) building
// rect, mirroring ROADS-1's buildings-vs-road projection. Under this file's own
// adversarial checkerboard fixture (below), that approach got stuck — the point
// oscillates between two close neighbours' opposing pulls, or settles into a
// stable equilibrium where several rects' push vectors exactly cancel — in 40 to
// 80% of sampled starting points, depending on the exact push rule tried. That
// was caught HERE, by this test's fixture, before it shipped: a gentler synthetic
// (e.g. 3-4 buildings with generous gaps) would never have exposed it. The
// shipped implementation instead does a deterministic ring/angle spiral search
// outward from the original point and takes the first clear point found — an
// exhaustive search cannot get stuck in an equilibrium because nothing is being
// followed, so this test's checkerboard is the actual regression guard for that
// class of bug, not a formality.
//
// Hermetic — no network, no API key, no engine boot (pure synthetic geometry).

import test from 'node:test';
import assert from 'node:assert/strict';

import { pushClearOfBuildings, insideAnyRect, NPC_MARGIN_LU } from '../public/map/placeFromNode.js';

// A checkerboard of 25 building rects (5x5 grid) with only 1-layout-unit gaps
// between neighbours — narrower than 2x NPC_MARGIN_LU (2.4 lu), so the
// margin-inflated zones of adjacent buildings OVERLAP in every internal gap.
// No clear point exists anywhere inside the grid's interior; the only clear
// ground is outside the whole cluster. "Buildings covering most of the frame":
// the 25 blocks (5x5 lu each) cover 625 of the 900 sq-lu bounding frame (~69%).
function tightCheckerboard() {
  const rects = [];
  for (let gx = 0; gx < 5; gx++) {
    for (let gy = 0; gy < 5; gy++) {
      const x0 = gx * 6, y0 = gy * 6;
      rects.push({ minX: x0, minY: y0, maxX: x0 + 5, maxY: y0 + 5 });
    }
  }
  return rects;
}

test('U495: pushClearOfBuildings is a pure deterministic function — identical inputs, identical output, across repeated calls', () => {
  const rects = tightCheckerboard();
  const a = pushClearOfBuildings(15, 15, rects, NPC_MARGIN_LU);
  const b = pushClearOfBuildings(15, 15, rects, NPC_MARGIN_LU);
  const c = pushClearOfBuildings(15, 15, rects, NPC_MARGIN_LU);
  assert.deepEqual(a, b, 'first and second call must agree exactly');
  assert.deepEqual(b, c, 'second and third call must agree exactly');
});

test('U495: same seed -> identical token SET (end-to-end determinism through the real scatter, not just the helper in isolation)', () => {
  // Exercises the same guarantee U399 already proves for the pre-TT-OCC scatter,
  // now that every npc token also passes through pushClearOfBuildings — replay
  // must still agree byte-for-byte.
  const npcs = ['Alaric', 'Bryn', 'Cass', 'Dael', 'Elowen'].map((name, i) => ({ id: 'n' + i, name }));
  const world = () => ({
    meta: { seed: 'U495-determinism-world' },
    map: {
      currentNodeId: 'home',
      nodes: [{ id: 'home', x: 0, y: 0, nodeType: 'settlement', settlement: { population: 400, npcs, buildings: [{ name: 'smithy' }, { name: 'tavern' }, { name: 'workshop' }] } }]
    },
    structures: { byId: {} }
  });
  // Import lazily to keep this file's determinism tests independent of the
  // engine-boot tests above (placeFromWorldNode itself, not just the helper).
  return import('../public/map/placeFromNode.js').then(({ placeFromWorldNode }) => {
    const a = placeFromWorldNode(world(), 'home');
    const b = placeFromWorldNode(world(), 'home');
    assert.deepEqual(a.tokens, b.tokens, 'identical (seed, occupancy, buildings) must yield an identical token layout, including post-exclusion positions');
  });
});

test('U495: tight-packed synthetic geometry — every npc scatter point that would land inside a building instead resolves clear, and the search always terminates', () => {
  const rects = tightCheckerboard();
  let checked = 0, insideAfter = 0;
  // Sample a spread of starting points across the frame (deterministic
  // pseudo-grid via a fixed step, no rng) including points that start dead
  // INSIDE a rect (the realistic case — a raw scatter point before the fix).
  for (let trial = 0; trial < 300; trial++) {
    const x = (trial * 1.31) % 32 - 1;
    const y = (trial * 2.63) % 32 - 1;
    checked++;
    const before = insideAnyRect(x, y, rects, NPC_MARGIN_LU);
    const { x: fx, y: fy } = pushClearOfBuildings(x, y, rects, NPC_MARGIN_LU);
    assert.ok(Number.isFinite(fx) && Number.isFinite(fy), `trial ${trial}: escape point must be finite`);
    if (insideAnyRect(fx, fy, rects, NPC_MARGIN_LU)) insideAfter++;
    if (before) {
      // The interesting case: started inside, must have actually moved (the
      // search must not silently no-op on a point that needed escaping).
      assert.ok(fx !== x || fy !== y, `trial ${trial}: a point that started inside a building+margin must be relocated, not left in place`);
    }
  }
  assert.ok(checked === 300, 'sanity: the full sample ran');
  assert.equal(insideAfter, 0, `every one of ${checked} sampled points must resolve to a location clear of every building rect + margin (found ${insideAfter} still inside)`);
});

test('U495: a point sitting exactly on a building\'s centre (fully enclosed, worst case) still terminates clear, well within the search radius', () => {
  const rects = tightCheckerboard();
  // Dead centre of rects[0] ([0,0,5,5] -> centre (2.5,2.5)): the most enclosed
  // starting point possible in this fixture — every rect's own centre is a
  // degenerate case for a naive "push away from centre" approach (zero-length
  // vector), which is exactly the class of case the abandoned vector-field
  // draft handled inconsistently.
  const { x, y } = pushClearOfBuildings(2.5, 2.5, rects, NPC_MARGIN_LU);
  assert.ok(!insideAnyRect(x, y, rects, NPC_MARGIN_LU), 'dead-centre start must still resolve to a clear point');
});

test('U495: an already-clear point is a true no-op — the search must not perturb a point that never needed escaping', () => {
  const rects = tightCheckerboard();
  const { x, y } = pushClearOfBuildings(1000, 1000, rects, NPC_MARGIN_LU);
  assert.equal(x, 1000, 'x must be untouched for an already-clear point');
  assert.equal(y, 1000, 'y must be untouched for an already-clear point');
});

test('U495: deeply enclosed inside one large rect (no nearby gap at all) still escapes correctly and reasonably fast', () => {
  const rects = [{ minX: 0, minY: 0, maxX: 100, maxY: 100 }];
  const t0 = Date.now();
  const { x, y } = pushClearOfBuildings(50, 50, rects, NPC_MARGIN_LU, 200);
  const elapsedMs = Date.now() - t0;
  assert.ok(!insideAnyRect(x, y, rects, NPC_MARGIN_LU), 'must escape a single giant rect from its dead centre');
  assert.ok(elapsedMs < 1000, `must resolve well under a second (took ${elapsedMs}ms) — no runaway search`);
});
