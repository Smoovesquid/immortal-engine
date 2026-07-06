// U561 — PLAN-SPLIT-1: the one-geometry law (docs/briefs/PLAN-SPLIT-1-one-geometry.md).
//
// For an engine-backed structure, the drawn model's building rect (the place-unit
// walkable-place view, public/map/placeFromNode.js) and the engine's OWN
// floorPlan(structure) rect are the SAME geometry — not two independently-derived
// plans that happen to agree by coincidence, but literally the same room set,
// same footprint, same scale. This is MAP_REAL.md's law made concrete: "the map
// is not a picture OF the world; it is a view INTO the one real world." Before
// this packet, placeFromNode.js drew a real structure's walls from getPlan(type)
// (an authored catalog cottage) while the player token seated itself from the
// engine's floorPlan(structure) — one building, two geometries, so the token
// measurably sat off its own drawn walls (the VIS-ORACLE oracle's first catch,
// U553). Pure-rails: no browser, no canvas — a direct read of the drawn model
// and the engine plan, on the real boot world.
//
// docs/MAP_REAL.md promise 3 ("what's drawn there is what's there"). Sibling:
// U562 (the catalog-only regression + golden stability).

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';

// The one minimal pack the slice boot needs (mirrors scripts/screenTruth.scenes.mjs).
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

function bootSlice() {
  const w0 = newWorld({ seed: SLICE_SEED, fate: 0.2, campaignId: 'campaign-plan-split-1', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  return beginAdventure(ensureWorld(w0), PACKS).world;
}

// The same bbox math placeFromNode.js's own planExtent() (and screenTruth's) use:
// a plan's rooms bounding box, in the plan's own layout units.
function planExtent(plan) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const r of (plan?.rooms || [])) {
    const rw = (r.w || (r.r ? r.r * 2 : 0)) / 2, rh = (r.h || (r.r ? r.r * 2 : 0)) / 2;
    minX = Math.min(minX, r.cx - rw); maxX = Math.max(maxX, r.cx + rw);
    minY = Math.min(minY, r.cy - rh); maxY = Math.max(maxY, r.cy + rh);
  }
  return { minX, minY, maxX, maxY };
}

test('U561-A: precondition — the wake boot has a real engine structure with a drawable floorPlan', () => {
  const world = bootSlice();
  const nodeId = world.map.currentNodeId;
  const structs = Object.values(world.structures.byId).filter(s => String(s?.nodeId || '') === String(nodeId));
  assert.ok(structs.length > 0, 'at least one real structure at the wake node');
  const st = structs[0];
  const fp = floorPlan(st);
  assert.ok(Array.isArray(fp.rooms) && fp.rooms.length > 0, 'the structure has a drawable engine floorPlan');
});

test('U561-B: the drawn building entry for a real structure carries the engine floorPlan rooms, not the catalog plan', () => {
  const world = bootSlice();
  const nodeId = world.map.currentNodeId;
  const st = Object.values(world.structures.byId).find(s => String(s?.nodeId || '') === String(nodeId));
  const place = placeFromWorldNode(world, nodeId);
  const drawn = (place.buildings || []).find(b => String(b?.structureKey || '') === String(st.id));
  assert.ok(drawn, 'the real structure is present in the drawn buildings list');

  const enginePlan = floorPlan(st);
  // Same room COUNT and same room SHAPES (cx/cy/w/h), room-for-room, not merely
  // "some plan with rooms" — a coincidental catalog plan with the same room count
  // would still fail this (different cx/cy/w/h values).
  assert.equal(drawn.plan.rooms.length, enginePlan.rooms.length, 'drawn plan has the SAME room count as the engine floorPlan');
  for (let i = 0; i < enginePlan.rooms.length; i++) {
    const dr = drawn.plan.rooms[i], er = enginePlan.rooms[i];
    assert.equal(dr.cx, er.cx, `room ${i} cx matches the engine floorPlan`);
    assert.equal(dr.cy, er.cy, `room ${i} cy matches the engine floorPlan`);
    assert.equal(dr.w, er.w, `room ${i} w matches the engine floorPlan`);
    assert.equal(dr.h, er.h, `room ${i} h matches the engine floorPlan`);
  }
});

test('U561-C: the ONE-GEOMETRY law — the drawn building rect and the engine floorPlan rect are the SAME geometry', () => {
  const world = bootSlice();
  const nodeId = world.map.currentNodeId;
  const st = Object.values(world.structures.byId).find(s => String(s?.nodeId || '') === String(nodeId));
  const place = placeFromWorldNode(world, nodeId);
  const drawn = (place.buildings || []).find(b => String(b?.structureKey || '') === String(st.id));

  const enginePlan = floorPlan(st);
  const drawnExt = planExtent(drawn.plan);
  const engineExt = planExtent(enginePlan);
  // Same bbox EXTENT (width/height) — the drawn plan's rooms occupy the exact
  // same footprint the engine's own floorPlan claims, not a rescaled stand-in.
  assert.equal(drawnExt.maxX - drawnExt.minX, engineExt.maxX - engineExt.minX, 'drawn plan bbox width == engine floorPlan bbox width');
  assert.equal(drawnExt.maxY - drawnExt.minY, engineExt.maxY - engineExt.minY, 'drawn plan bbox height == engine floorPlan bbox height');
  assert.equal(drawn.plan.footprint?.w, enginePlan.footprint?.w, 'drawn plan footprint.w == engine floorPlan footprint.w');
  assert.equal(drawn.plan.footprint?.h, enginePlan.footprint?.h, 'drawn plan footprint.h == engine floorPlan footprint.h');
});

test('U561-D: the player token (place-unit space) lands INSIDE the drawn building rect it stands in — the wake bug\'s exact assertion, verified directly', () => {
  const world = bootSlice();
  const nodeId = world.map.currentNodeId;
  const place = placeFromWorldNode(world, nodeId);
  const tok = (place.tokens || []).find(t => t.type === 'player');
  assert.ok(tok, 'a player token is drawn');

  const pos = world.party[0].pos;
  const m = /^struct:(.+)$/.exec(String(pos?.frame || ''));
  assert.ok(m, 'precondition: the player is in a struct-frame position (indoors)');
  const structId = m[1];
  const drawn = (place.buildings || []).find(b => String(b?.structureKey || '') === structId);
  assert.ok(drawn, 'the structure the player is inside is drawn');

  // The building's rect in place-unit space, footprint-CENTERED at its anchor
  // (ox,oy) — the SAME convention worldSpace.js's structureWorldRect uses in
  // wu-space ("footprint centered at its anchor", proven by U400-C) and
  // structCellToPlaceUnit uses to seat the token itself (`ux = ox + lx - fw/2`).
  // NOT ext.minX/maxX + ox (a room-BBOX-relative offset) — that convention only
  // coincided with this one for a catalog plan by the old seating math's own
  // symmetry; screenTruth.scenes.mjs carried exactly that latent formula bug
  // until PLAN-SPLIT-1 fixed it (see scripts/screenTruth.scenes.mjs's
  // playerPlaceUnitRect comment for the full derivation).
  const fw = Number(drawn.plan?.footprint?.w) || 1, fh = Number(drawn.plan?.footprint?.h) || 1;
  const rect = { minX: drawn.ox - fw / 2, minY: drawn.oy - fh / 2, maxX: drawn.ox + fw / 2, maxY: drawn.oy + fh / 2 };
  const inside = tok.ux >= rect.minX && tok.ux <= rect.maxX && tok.uy >= rect.minY && tok.uy <= rect.maxY;
  assert.ok(inside, `player token (${tok.ux},${tok.uy}) must land inside its own building's footprint-centered rect [${rect.minX},${rect.minY}..${rect.maxX},${rect.maxY}]`);
});

test('U561-E: determinism — two independent boots produce byte-identical drawn plan geometry for the real structure', () => {
  const build = () => {
    const world = bootSlice();
    const nodeId = world.map.currentNodeId;
    const st = Object.values(world.structures.byId).find(s => String(s?.nodeId || '') === String(nodeId));
    const place = placeFromWorldNode(world, nodeId);
    const drawn = (place.buildings || []).find(b => String(b?.structureKey || '') === String(st.id));
    return { rooms: drawn.plan.rooms.map(r => ({ cx: r.cx, cy: r.cy, w: r.w, h: r.h })), ox: drawn.ox, oy: drawn.oy };
  };
  assert.deepEqual(build(), build(), 'same seed → identical drawn plan geometry');
});

test('U561-F: worldHash is unchanged by building the drawn model (read-only)', async () => {
  const { worldHash } = await import('../engine/worldHash.js');
  const world = bootSlice();
  const h0 = worldHash(world);
  const nodeId = world.map.currentNodeId;
  placeFromWorldNode(world, nodeId);
  placeFromWorldNode(world, nodeId);
  const h1 = worldHash(world);
  assert.equal(h1, h0, 'deriving the drawn plan must never mutate anything worldHash covers');
});
