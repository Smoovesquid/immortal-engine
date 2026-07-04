// U441 — ROADS-1 continuity on the sheet: roads continue to other places, they
// do not stop at the town line. docs/briefs/ROADS-1-one-road-truth.md. For the
// boot village, the drawn road network extends BEYOND the place frame toward every
// road-connected neighbor — no road polyline terminates at the frame edge. And it
// is deterministic across two builds.

import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { roadNetwork } from '../public/map/roadNetwork.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';
import { placeFrame, placeUnitToWu, nodeToWu } from '../public/map/worldSpace.js';

function tallowWorld() {
  let world = ensureWorld(newWorld('tallow'));
  const r = beginAdventure(world, {});
  if (r && r.world) world = r.world;
  return world;
}

// The boot village's place frame in WORLD UNITS (its four corners projected).
function frameWuBounds(world, node, place, frame) {
  const corners = [
    placeUnitToWu(node, frame, frame.minX, frame.minY),
    placeUnitToWu(node, frame, frame.maxX, frame.minY),
    placeUnitToWu(node, frame, frame.minX, frame.maxY),
    placeUnitToWu(node, frame, frame.maxX, frame.maxY)
  ];
  return {
    minX: Math.min(...corners.map(c => c.x)), maxX: Math.max(...corners.map(c => c.x)),
    minY: Math.min(...corners.map(c => c.y)), maxY: Math.max(...corners.map(c => c.y))
  };
}

test('U441-01: every road out of the boot village reaches beyond the place frame (no dead-end at the town line)', () => {
  const world = tallowWorld();
  const net = roadNetwork(world);
  const boot = String(world.map.currentNodeId);
  const node = world.map.nodes.find(n => String(n.id) === boot);
  assert.ok(node && node.settlement, 'boot node is a settlement');
  const place = placeFromWorldNode(world, boot);
  const frame = placeFrame(place);
  const fb = frameWuBounds(world, node, place, frame);

  const touching = net.segments.filter(s => s.a === boot || s.b === boot);
  assert.ok(touching.length >= 1, 'the boot village has road-connected neighbors');

  for (const s of touching) {
    // The neighbor end of this segment must lie OUTSIDE the village frame — the
    // road leaves town toward the next place, it doesn't stop at the boundary.
    const neighborEnd = s.a === boot ? s.pts[s.pts.length - 1] : s.pts[0];
    const outside = neighborEnd[0] < fb.minX || neighborEnd[0] > fb.maxX || neighborEnd[1] < fb.minY || neighborEnd[1] > fb.maxY;
    assert.ok(outside, `road ${s.key} continues past the village frame (neighbor end at ${neighborEnd[0].toFixed(0)},${neighborEnd[1].toFixed(0)} vs frame x[${fb.minX.toFixed(0)},${fb.maxX.toFixed(0)}] y[${fb.minY.toFixed(0)},${fb.maxY.toFixed(0)}])`);
    // And the polyline actually crosses the frame edge (has points both inside and outside).
    const inside = (p) => p[0] >= fb.minX && p[0] <= fb.maxX && p[1] >= fb.minY && p[1] <= fb.maxY;
    const anyInside = s.pts.some(inside), anyOutside = s.pts.some(p => !inside(p));
    assert.ok(anyInside && anyOutside, `road ${s.key} spans the frame edge (continuous in and out)`);
  }
});

test('U441-02: the road reaches toward the actual neighbor node (heads to the next place, not nowhere)', () => {
  const world = tallowWorld();
  const net = roadNetwork(world);
  const boot = String(world.map.currentNodeId);
  const touching = net.segments.filter(s => s.a === boot || s.b === boot);
  for (const s of touching) {
    const neighborId = s.a === boot ? s.b : s.a;
    const nb = world.map.nodes.find(n => String(n.id) === neighborId);
    if (!nb) continue;
    const nbWu = nodeToWu(nb);
    const neighborEnd = s.a === boot ? s.pts[s.pts.length - 1] : s.pts[0];
    // the far terminal sits at (or joining) the neighbor — within one node-step wu.
    const gap = Math.hypot(neighborEnd[0] - nbWu.x, neighborEnd[1] - nbWu.y);
    assert.ok(gap < 350, `road ${s.key} terminates at/near neighbor ${neighborId} (gap ${gap.toFixed(0)} wu)`);
  }
});

test('U441-03: continuity geometry is deterministic across two builds', () => {
  const boot = 'n6_2357722854';
  const a = roadNetwork(tallowWorld()).segments.filter(s => s.a === boot || s.b === boot);
  const b = roadNetwork(tallowWorld()).segments.filter(s => s.a === boot || s.b === boot);
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'boot-village road continuity is identical across builds');
});
