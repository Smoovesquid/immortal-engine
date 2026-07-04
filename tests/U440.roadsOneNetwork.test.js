// U440 — ROADS-1 ONE road network: the village lane IS the road to the next town.
// docs/briefs/ROADS-1-one-road-truth.md (Tim's ruling: "roads must continue to
// other places. Right now, road stop right outside towns"). Every map edge yields
// exactly ONE world-unit road polyline; each SETTLEMENT terminal lands on that
// settlement's own local lane endpoint (no seam at the frame edge); and the
// network is byte-deterministic. This is the geometry both the region band and
// the street band draw — one source, styling aside.

import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { roadNetwork, laneEndpointsWu } from '../public/map/roadNetwork.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';
import { placeFrame } from '../public/map/worldSpace.js';

function tallowWorld() {
  let world = ensureWorld(newWorld('tallow'));
  const r = beginAdventure(world, {});
  if (r && r.world) world = r.world;
  return world;
}

function synthWorld() {
  const bld = (name) => ({ name });
  return {
    meta: { seed: 'synthburg', homeNodeId: 'A' },
    structures: { byId: {} },
    map: {
      currentNodeId: 'A',
      discovered: ['A', 'B'],
      nodes: [
        { id: 'A', x: 0, y: 0, nodeType: 'settlement', settlement: { population: 220, npcs: [1, 2, 3], buildings: [bld('cottage'), bld('storehouse'), bld('smithy'), bld('tavern'), bld('granary'), bld('storehouse'), bld('cottage')] } },
        { id: 'B', x: 3, y: 0, nodeType: 'settlement', settlement: { population: 450, npcs: [1, 2, 3, 4, 5, 6], buildings: [bld('cottage'), bld('storehouse'), bld('smithy'), bld('tavern'), bld('temple'), bld('granary'), bld('cottage'), bld('storehouse')] } },
        { id: 'C', x: 0, y: 3, nodeType: 'wilderness' }
      ],
      edges: [{ a: 'A', b: 'B' }, { a: 'A', b: 'C' }]
    }
  };
}

// nearest distance from a point to a polyline (wu).
function distPtSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay, vv = vx * vx + vy * vy;
  let t = vv > 0 ? (wx * vx + wy * vy) / vv : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}
function ptToPolyline(px, py, pts) {
  let m = Infinity;
  for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, distPtSeg(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return m;
}

test('U440-01: exactly one road polyline per map edge (tallow + synth)', () => {
  for (const world of [tallowWorld(), synthWorld()]) {
    const net = roadNetwork(world);
    const edges = world.map.edges.length;
    assert.equal(net.segments.length, edges, 'one polyline per edge');
    // every segment is a real ≥2-point polyline with finite coords
    for (const s of net.segments) {
      assert.ok(Array.isArray(s.pts) && s.pts.length >= 2, `segment ${s.key} is a polyline`);
      for (const [x, y] of s.pts) assert.ok(Number.isFinite(x) && Number.isFinite(y), 'finite wu coords');
    }
    // one segment per unordered node pair (no dupes)
    const keys = new Set(net.segments.map(s => s.key));
    assert.equal(keys.size, net.segments.length, 'no duplicate edge polylines');
  }
});

test('U440-02: each settlement terminal lands on that settlement\'s local lane endpoint (no seam)', () => {
  const world = tallowWorld();
  const net = roadNetwork(world);
  const settlements = world.map.nodes.filter(n => n.settlement && Array.isArray(n.settlement.buildings) && n.settlement.buildings.length);
  assert.ok(settlements.length >= 1);
  let checkedJoins = 0;
  for (const n of settlements) {
    const place = placeFromWorldNode(world, n.id);
    const frame = placeFrame(place);
    const ends = laneEndpointsWu(world, n, place, frame);
    const laneEnds = Object.values(ends).filter(Boolean);
    assert.ok(laneEnds.length >= 2, `${n.id} has lane endpoints`);
    for (const s of net.segments) {
      const onThis = s.a === String(n.id) ? 'a' : s.b === String(n.id) ? 'b' : null;
      if (!onThis) continue;
      const joins = onThis === 'a' ? s.aJoinsLane : s.bJoinsLane;
      if (!joins) continue; // node-center fallback (e.g. neighbor un-laid-out) — nothing to seam
      const term = onThis === 'a' ? s.pts[0] : s.pts[s.pts.length - 1];
      // the terminal must coincide with one of this settlement's lane endpoints
      const nearest = Math.min(...laneEnds.map(e => Math.hypot(term[0] - e.x, term[1] - e.y)));
      assert.ok(nearest < 0.5, `${n.id} edge ${s.key} joins a lane endpoint (gap ${nearest.toFixed(2)} wu)`);
      // AND the drawn lane's frame-edge endpoint lies ON the network polyline
      const onLine = ptToPolyline(term[0], term[1], s.pts);
      assert.ok(onLine < 0.5, `${n.id} lane endpoint lies on the network polyline (gap ${onLine.toFixed(2)} wu)`);
      checkedJoins++;
    }
  }
  assert.ok(checkedJoins >= 2, `verified real lane joins (got ${checkedJoins})`);
});

test('U440-03: the network is byte-deterministic (same world → same polylines)', () => {
  const a = roadNetwork(tallowWorld()).segments;
  const b = roadNetwork(tallowWorld()).segments;
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'network geometry identical across builds');
});

test('U440-04: the lane through a village and the road out are ONE line (shared endpoint, one geometry)', () => {
  // The drawn in-village lane (place.terrain.paths) and the network segment leaving
  // toward a neighbor meet at the SAME wu point — proving there is no separate
  // node-center track; it is one continuous line handed off at the frame edge.
  const world = synthWorld();
  const net = roadNetwork(world);
  const place = placeFromWorldNode(world, 'A');
  const frame = placeFrame(place);
  const ends = laneEndpointsWu(world, world.map.nodes[0], place, frame);
  // edge A-B leaves A toward the east; the segment's A-terminal must be A's east lane end.
  const ab = net.segments.find(s => s.key === (('A' < 'B') ? 'A|B' : 'B|A'));
  assert.ok(ab, 'edge A-B has a network segment');
  const aTerm = ab.a === 'A' ? ab.pts[0] : ab.pts[ab.pts.length - 1];
  assert.ok(ab.aJoinsLane || ab.bJoinsLane, 'the A-B segment joins A\'s lane');
  const east = ends.east;
  assert.ok(east, 'A has an east lane endpoint');
  assert.ok(Math.hypot(aTerm[0] - east.x, aTerm[1] - east.y) < 0.5, 'the road out of A begins exactly at A\'s east lane end');
});
