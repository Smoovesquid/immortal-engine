// U632 — MAP-EGRESS-1: "go outside" lands the body beside the building it actually LEFT.
//
// THE BUG (Tim's live sighting): exiting the boot home teleported the body 77 m across
// the settlement — 14 m EAST of a storehouse — because the engine computed "just outside
// the front door" as if every building sat at the node CENTRE, while the map DRAWS
// buildings scattered along a curved road (the P-81b organic layout). The two frames
// disagreed. THE LAW (docs/MAP_REAL.md): the drawn world IS the simulated world.
//
// THE FIX: doorThresholdCells now anchors the doorstep on the building's DRAWN position
// (engine/world/settlementLayout.js — the one layout the renderer draws from). This test
// drives the REAL exit and asserts the landing sits within one building-footprint of the
// DRAWN home (derived from the renderer's own placeFromWorldNode), AND that the NEAREST
// drawn building to the landing is the home itself — never a neighbour. It also proves
// the fix MATTERS by reconstructing the OLD centre-anchored doorstep and showing it fell
// far from the drawn home (the ~77 m teleport this fix retired).
//
// Boot: the Bryn quickstart (the exact recipe the brief reproduces). LLM OFF.
// Siblings: U499 (engine-cell doorstep threshold), U498 (pure geometry), U633/U634.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { PRE_ROLLED, buildPreRolledCharacter } from '../engine/chargen/preRolled.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';
import { placeFrame, placeUnitToWu, regionCellToWu } from '../public/map/worldSpace.js';
import { doorThresholdCells, nodeGridToRegionCell, roomOfStructCell, PLACE_WU } from '../engine/map/spatial/tacticalPos.js';

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

function bootBryn(seed = SLICE_SEED) {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: `campaign-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const pc = buildPreRolledCharacter(PRE_ROLLED.find(e => /bryn/i.test(e.name || e.id)));
  const { world } = beginAdventure(ensureWorld({ ...w0, party: [pc] }), PACKS);
  return world;
}

// The bbox-midpoint of a drawn building's plan (place-units), so building CENTRE = anchor + mid.
function planMid(plan) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of (plan.rooms || [])) {
    const rw = (r.w || (r.r ? r.r * 2 : 0)) / 2, rh = (r.h || (r.r ? r.r * 2 : 0)) / 2;
    minX = Math.min(minX, r.cx - rw); maxX = Math.max(maxX, r.cx + rw);
    minY = Math.min(minY, r.cy - rh); maxY = Math.max(maxY, r.cy + rh);
  }
  return { mx: (minX + maxX) / 2, my: (minY + maxY) / 2 };
}

// The drawn building's CENTRE in world units (metres): the renderer's own projection.
function drawnCentreWu(node, frame, b) {
  const m = planMid(b.plan);
  return placeUnitToWu(node, frame, b.ox + m.mx, b.oy + m.my);
}

test('U632: "go outside" lands the body within one footprint of its OWN drawn door', () => {
  const world = bootBryn();
  const nodeId = String(world.map.currentNodeId);
  const node = world.map.nodes.find(n => String(n.id) === nodeId);
  const homeKey = String(world.scene.interior.structureKey);

  // The drawn settlement (the renderer's own view-model) BEFORE the exit.
  const place = placeFromWorldNode(world, nodeId);
  const frame = placeFrame(place);
  const homeB = place.buildings.find(b => String(b.structureKey || '') === homeKey);
  assert.ok(homeB, 'the home cottage is drawn in the settlement');

  // Drive the REAL exit (LLM off).
  const { world: w2 } = playerMove(world, PACKS, 'go outside');
  const pos = w2.party[0].pos;
  assert.ok(pos && pos.frame === 'region', `exit lands outdoors; got ${JSON.stringify(pos)}`);

  // The landing, projected to world units on the SAME lattice the map draws.
  const landWu = regionCellToWu(node, pos.gx, pos.gy);
  const homeWu = drawnCentreWu(node, frame, homeB);

  // The home's footprint half-span in metres (wu). PLACE_WU wu per place-unit.
  const plan = floorPlan(world.structures.byId[homeKey]);
  const halfW = (plan.footprint.w / 2) * PLACE_WU;
  const halfH = (plan.footprint.h / 2) * PLACE_WU;

  // Distance from the landing to the drawn home's footprint EDGE — a doorstep, not a
  // teleport. One extra footprint-span of slack covers the doorstep step-out; far below
  // the 77 m the phantom centre-anchor produced.
  const edx = Math.max(0, Math.abs(landWu.wx - homeWu.x) - halfW);
  const edy = Math.max(0, Math.abs(landWu.wy - homeWu.y) - halfH);
  const distToEdge = Math.hypot(edx, edy);
  const doorstepSlack = Math.hypot(halfW, halfH) + 15; // ≤ one footprint + a 15 m doorstep
  assert.ok(distToEdge <= doorstepSlack,
    `body lands on its drawn doorstep: ${distToEdge.toFixed(1)} m from the home footprint edge (≤ ${doorstepSlack.toFixed(1)} m)`);

  // The NEAREST drawn building to the landing must be the HOME — never a neighbour
  // (the storehouse the old teleport landed beside).
  let nearest = null, best = Infinity;
  for (const b of place.buildings) {
    const c = drawnCentreWu(node, frame, b);
    const d = Math.hypot(landWu.wx - c.x, landWu.wy - c.y);
    if (d < best) { best = d; nearest = b; }
  }
  assert.equal(String(nearest.structureKey || '') || (nearest.buildingName || nearest.name || ''), homeKey,
    `the nearest drawn building to the landing is the home, not a neighbour (got ${nearest.structureKey || nearest.buildingName || nearest.name})`);
});

test('U632: the fix MATTERS — the OLD centre-anchored doorstep fell far from the drawn home', () => {
  const world = bootBryn();
  const nodeId = String(world.map.currentNodeId);
  const node = world.map.nodes.find(n => String(n.id) === nodeId);
  const homeKey = String(world.scene.interior.structureKey);
  const place = placeFromWorldNode(world, nodeId);
  const frame = placeFrame(place);
  const homeB = place.buildings.find(b => String(b.structureKey || '') === homeKey);
  const homeWu = drawnCentreWu(node, frame, homeB);

  // The door room + outward direction the geometry maps (frame-independent).
  const th = doorThresholdCells(world, homeKey, world.scene.interior.visited?.[0]);
  assert.ok(th && th.outside, 'the door threshold grounds');
  const plan = floorPlan(world.structures.byId[homeKey]);
  const doorRoom = plan.rooms.find(r => roomOfStructCell(plan, th.inside.gx, th.inside.gy) === String(r.id))
    || plan.rooms.find(r => r.isEntry) || plan.rooms[0];
  const dx = th.dir === 'east' ? 1 : th.dir === 'west' ? -1 : 0;
  const dy = th.dir === 'south' ? 1 : th.dir === 'north' ? -1 : 0;

  // Reconstruct the OLD centre-anchored doorstep EXACTLY as pre-fix doorThresholdCells
  // did: nodeCentre + (roomCentre ± halfSpan) × PLACE_WU + one doorstep. This is the
  // phantom the fix retired — the building was assumed to sit AT the node centre.
  const centre = nodeGridToRegionCell(node.x, node.y);
  const edgeXLayout = doorRoom.cx + dx * Math.max(0, (doorRoom.w || 0) / 2);
  const edgeYLayout = doorRoom.cy + dy * Math.max(0, (doorRoom.h || 0) / 2);
  const oldGx = Math.round(centre.gx + edgeXLayout * PLACE_WU) + dx;
  const oldGy = Math.round(centre.gy + edgeYLayout * PLACE_WU) + dy;
  const oldWu = regionCellToWu(node, oldGx, oldGy);
  const oldGap = Math.hypot(oldWu.wx - homeWu.x, oldWu.wy - homeWu.y);
  assert.ok(oldGap > 40,
    `the phantom centre anchor sat ${oldGap.toFixed(0)} m from the drawn home (the teleport this fix retired; >40 m)`);

  // The NEW landing is far closer to the drawn home than the old centre anchor was.
  const { world: w2 } = playerMove(world, PACKS, 'go outside');
  const pos = w2.party[0].pos;
  const newWu = regionCellToWu(node, pos.gx, pos.gy);
  const newGap = Math.hypot(newWu.wx - homeWu.x, newWu.wy - homeWu.y);
  assert.ok(newGap < oldGap - 20,
    `the new doorstep (${newGap.toFixed(1)} m from the drawn home) is dramatically closer than the old centre anchor (${oldGap.toFixed(1)} m)`);
});
