// U439 — ROADS-1 THE RULE: no building or prop ever shares squares with a road.
// docs/briefs/ROADS-1-one-road-truth.md (Tim's ruling: "Buildings CANNOT be on
// the same squares as roads"). For every settlement in the tallow boot world AND
// a second hand-built seed, the true drawn footprint of every building clears the
// drawn road corridor; no two buildings overlap; the well sits beside the road,
// clear of it; and the layout is byte-deterministic across two builds. The old
// give-up-and-overlap loophole (accept overlap after 48 tries) is gone.

import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';

// The corridor half-width the rule enforces (placeFromNode.js CORRIDOR_LU =
// ROAD_HALF_LU 0.7 + ROAD_CLEAR_LU 1.3). A footprint/prop must keep at least this
// far from the road CENTERLINE. Tested with a hair of slack for float noise.
const CORRIDOR_LU = 2.0;
const SLACK = 0.05;

// True drawn footprint of a building (the same rect the sheet inks): the plan's
// room-extent re-centered so its midpoint lands at (ox+mid) — i.e. ox/oy already
// encode the seat, so worldRect = ox+ext.
function planExtent(plan) {
  let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
  for (const r of (plan.rooms || [])) {
    const rw = (r.w || r.r * 2) / 2, rh = (r.h || r.r * 2) / 2;
    a = Math.min(a, r.cx - rw); c = Math.max(c, r.cx + rw);
    b = Math.min(b, r.cy - rh); d = Math.max(d, r.cy + rh);
  }
  return { minX: a, minY: b, maxX: c, maxY: d };
}
function buildingRect(b) {
  const e = planExtent(b.plan);
  return { minX: b.ox + e.minX, minY: b.oy + e.minY, maxX: b.ox + e.maxX, maxY: b.oy + e.maxY };
}
// Distance from a point to the AABB (0 inside).
function distPtRect(px, py, r) {
  const dx = Math.max(r.minX - px, 0, px - r.maxX), dy = Math.max(r.minY - py, 0, py - r.maxY);
  return Math.hypot(dx, dy);
}
// True min distance from a road segment [a..b] to a rect: dense sampling of the
// segment (segments are short after subdivision; 40 samples is exact enough).
function distSegRect(ax, ay, bx, by, r) {
  let m = Infinity;
  const N = 40;
  for (let i = 0; i <= N; i++) { const t = i / N, x = ax + (bx - ax) * t, y = ay + (by - ay) * t; m = Math.min(m, distPtRect(x, y, r)); }
  return m;
}
function rectMinDistToPaths(r, paths) {
  let m = Infinity;
  for (const p of paths) { const pts = p.pts || []; for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, distSegRect(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r)); }
  return m;
}
function distPtSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay, vv = vx * vx + vy * vy;
  let t = vv > 0 ? (wx * vx + wy * vy) / vv : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}
function ptMinDistToPaths(px, py, paths) {
  let m = Infinity;
  for (const p of paths) { const pts = p.pts || []; for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, distPtSeg(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])); }
  return m;
}
function rectsOverlap(a, b) {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

// A settlement passes THE RULE if every footprint clears the corridor, no two
// footprints overlap, and every prop clears the corridor.
function assertSettlementClear(place, label) {
  const paths = place.terrain?.paths || [];
  assert.ok(paths.length >= 1, `${label}: has a drawn road`);
  const rects = (place.buildings || []).map(buildingRect);
  assert.ok(rects.length >= 1, `${label}: has buildings`);

  // 1) No building footprint intrudes the road corridor.
  for (let i = 0; i < rects.length; i++) {
    const d = rectMinDistToPaths(rects[i], paths);
    assert.ok(d >= CORRIDOR_LU - SLACK, `${label}: building ${i} (${place.buildings[i].name || place.buildings[i].buildingName || '?'}) must clear the road corridor — dist ${d.toFixed(2)} < ${CORRIDOR_LU}`);
  }
  // 2) No two building footprints overlap.
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    assert.ok(!rectsOverlap(rects[i], rects[j]), `${label}: buildings ${i} and ${j} overlap`);
  }
  // 3) Props sit clear of the corridor.
  for (const p of (place.terrain?.props || [])) {
    const d = ptMinDistToPaths(p.ux, p.uy, paths);
    assert.ok(d >= CORRIDOR_LU - SLACK, `${label}: prop ${p.type} must sit beside the road — dist ${d.toFixed(2)} < ${CORRIDOR_LU}`);
  }
}

function tallowWorld() {
  let world = ensureWorld(newWorld('tallow'));
  const r = beginAdventure(world, {});
  if (r && r.world) world = r.world;
  return world;
}

// A second seed for breadth: two dense adjacent settlements + a wilderness spur.
function synthWorld() {
  const bld = (name) => ({ name });
  return {
    meta: { seed: 'synthburg', homeNodeId: 'A' },
    structures: { byId: {} },
    map: {
      currentNodeId: 'A',
      discovered: ['A', 'B'],
      nodes: [
        { id: 'A', x: 0, y: 0, nodeType: 'settlement', settlement: { population: 220, npcs: [1, 2, 3], buildings: [bld('cottage'), bld('storehouse'), bld('smithy'), bld('tavern'), bld('granary'), bld('storehouse'), bld('cottage'), bld('smithy'), bld('granary')] } },
        { id: 'B', x: 3, y: 0, nodeType: 'settlement', settlement: { population: 450, npcs: [1, 2, 3, 4, 5, 6], buildings: [bld('cottage'), bld('storehouse'), bld('smithy'), bld('tavern'), bld('temple'), bld('granary'), bld('cottage'), bld('storehouse'), bld('smithy'), bld('cottage'), bld('granary')] } },
        { id: 'C', x: 0, y: 3, nodeType: 'wilderness' }
      ],
      edges: [{ a: 'A', b: 'B' }, { a: 'A', b: 'C' }]
    }
  };
}

test('U439-01: tallow boot village — every building & prop clears the road corridor', () => {
  const world = tallowWorld();
  const settlements = world.map.nodes.filter(n => n.settlement && Array.isArray(n.settlement.buildings) && n.settlement.buildings.length);
  assert.ok(settlements.length >= 1, 'the boot world has at least one built settlement');
  for (const n of settlements) {
    const place = placeFromWorldNode(world, n.id);
    assert.ok(place, `place for ${n.id}`);
    assertSettlementClear(place, `tallow ${n.id}`);
  }
});

test('U439-02: second seed (dense adjacent settlements) — same rule holds', () => {
  const world = synthWorld();
  for (const id of ['A', 'B']) {
    const place = placeFromWorldNode(world, id);
    assert.ok(place, `place for ${id}`);
    assertSettlementClear(place, `synth ${id}`);
  }
});

test('U439-03: layout is byte-deterministic across two builds (same seed → same village)', () => {
  const a = placeFromWorldNode(tallowWorld(), 'n6_2357722854');
  const b = placeFromWorldNode(tallowWorld(), 'n6_2357722854');
  assert.equal(JSON.stringify(a.buildings), JSON.stringify(b.buildings), 'buildings identical');
  assert.equal(JSON.stringify(a.terrain.paths), JSON.stringify(b.terrain.paths), 'paths identical');
  assert.equal(JSON.stringify(a.terrain.props), JSON.stringify(b.terrain.props), 'props identical');
});
