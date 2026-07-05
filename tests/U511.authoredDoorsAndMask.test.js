// U511 — MR-2c: an authored plan's OPENINGS turn into canon MR-2a door records +
// a correct walkable mask; window openings are NEVER doors.
//
// docs/briefs/MR-2-FUNCTIONAL-INK.md §MR-2c. The loader itself (authoredPlans.js)
// never hand-builds a DoorRecord — it only shapes floorPlan(structure).doors (the
// same {x,y,dir,a,b} floorPlan.js already emits for procgen), and ensureWorld's
// EXISTING tail (backfillDoors, state.js — untouched by this packet) derives the
// full canon door list from THAT via doors.js's deriveDoors (also untouched). This
// file proves that hand-off actually produces the right canon:
//   • exactly one EXTERIOR door, fronting the entry room, seeded default state
//     (a cottage/home — MR-2a's derivation shuts it by default);
//   • exactly one INTERIOR door, default OPEN (ordinary interior doors of a
//     dwelling stand open);
//   • the window opening in the fixture produces NO doors[] entry at all;
//   • structWalkableMask blocks the wall-band cell between the two rooms and lets
//     the open interior door cross; the front door's threshold projects OUTWARD
//     to a region cell (not another struct cell).
//
// Siblings: U510 (the load itself), U512 (determinism + roomOf agreement).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { applyGeneratedStructuresForNode } from '../engine/structures/applyGeneratedStructuresForNode.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import {
  doorsOf, exteriorDoorOf, doorBetween, doorCells, structWalkableMask,
  crossable, DOOR_STATES,
} from '../engine/structures/doors.js';
// LOADER-MERGE relock: the authored-plan registry moved from authoredPlans.js into
// authoredStructure.js (one loader, one registry). Same API, same behavior — import path only.
import { authoredRawFor, buildAuthoredFloorPlan } from '../engine/structures/authoredStructure.js';
import { roomRectCells } from '../engine/map/spatial/tacticalPos.js';

const AUTHORED_STRUCT_ID = 'stgen:v27:n99_mr2c_wake_cottage:0';
const AUTHORED_NODE_ID = 'n99_mr2c_wake_cottage';

function bootAuthored(worldSeed = 'U511-seed') {
  let w = ensureWorld(newWorld({ seed: worldSeed, fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }));
  w = {
    ...w,
    map: {
      ...w.map,
      currentNodeId: AUTHORED_NODE_ID,
      nodes: [...(w.map.nodes || []), { id: AUTHORED_NODE_ID, x: 9, y: 9, tags: [] }],
    },
  };
  return ensureWorld(applyGeneratedStructuresForNode(w, AUTHORED_NODE_ID));
}

// ── the raw plan's doors[]/windows[] shapes, before canon backfill ─────────────

test('U511: buildAuthoredFloorPlan emits doors[] for the two door openings, and windows[] (NOT doors[]) for the window', () => {
  const raw = authoredRawFor(AUTHORED_STRUCT_ID);
  const plan = buildAuthoredFloorPlan(raw, AUTHORED_STRUCT_ID);
  assert.equal(plan.doors.length, 2, 'front door + interior door = 2 floorPlan-shaped door records');
  const exterior = plan.doors.filter(d => d.b === '');
  const interior = plan.doors.filter(d => d.b !== '');
  assert.equal(exterior.length, 1, 'exactly one door has b:\'\' (the exterior/front door)');
  assert.equal(interior.length, 1, 'exactly one interior room-to-room door');
  assert.ok(Array.isArray(plan.windows) && plan.windows.length === 1, 'the window opening lands in windows[], additively');
  assert.equal(plan.windows[0].exterior, true, 'the fixture\'s window is on an outer wall');
  // Window ids never leak into doors[] under any room-id key.
  const doorRoomsTouched = new Set(plan.doors.flatMap(d => [d.a, d.b]).filter(Boolean));
  const windowRoom = plan.windows[0].room;
  // (the window's room MAY also have a door — bedchamber has the interior door —
  // so this only asserts the window itself never became a THIRD doors[] entry.)
  assert.equal(plan.doors.length, 2, 'the window did not add a third doors[] entry');
  void doorRoomsTouched; void windowRoom;
});

// ── canon backfill: ensureWorld's EXISTING tail derives the full DoorRecord list ─

test('U511: ensureWorld backfills exactly one exterior + one interior canon DoorRecord', () => {
  const w = bootAuthored();
  const st = w.structures.byId[AUTHORED_STRUCT_ID];
  const doors = doorsOf(st);
  assert.equal(doors.length, 2);
  for (const d of doors) assert.ok(DOOR_STATES.includes(d.state), `door ${d.id} has a valid canon state`);

  const front = exteriorDoorOf(st);
  assert.ok(front, 'exactly one exterior door record exists');
  assert.equal(front.exterior, true);
  assert.equal(front.b, '', 'the exterior door\'s far side is outside (b === "")');

  const interior = doors.find(d => !d.exterior);
  assert.ok(interior, 'exactly one interior door record exists');
  assert.notEqual(interior.a, '');
  assert.notEqual(interior.b, '');
});

test('U511: the front door defaults SHUT (cottage/home — MR-2a\'s seeded home policy), the interior door defaults OPEN', () => {
  const w = bootAuthored();
  const st = w.structures.byId[AUTHORED_STRUCT_ID];
  const front = exteriorDoorOf(st);
  const interior = doorsOf(st).find(d => !d.exterior);
  assert.equal(front.state, 'shut', 'a home\'s front door is shut by default (not locked/barred — that is content authorship, never the seed)');
  assert.equal(interior.state, 'open', 'an ordinary interior door of a dwelling stands open by default');
});

test('U511: doorBetween finds the interior door from either room id order', () => {
  const w = bootAuthored();
  const st = w.structures.byId[AUTHORED_STRUCT_ID];
  const rooms = st.topology.rooms.map(r => r.id);
  assert.equal(rooms.length, 2);
  const [r1, r2] = rooms;
  const d1 = doorBetween(st, r1, r2);
  const d2 = doorBetween(st, r2, r1);
  assert.ok(d1 && d2 && d1.id === d2.id, 'order-independent lookup finds the same door record');
});

// ── the mask: walls block, the open door crosses, the front door projects outward ─

test('U511: structWalkableMask blocks the wall-band cell between the two rooms and lets the open interior door cross', () => {
  const w = bootAuthored();
  const st = w.structures.byId[AUTHORED_STRUCT_ID];
  const plan = floorPlan(st);
  const mask = structWalkableMask(w, st);

  const [roomA, roomB] = plan.rooms;
  const rectA = roomRectCells(roomA), rectB = roomRectCells(roomB);
  assert.equal(mask.roomOf(rectA.cx, rectA.cy), roomA.id, 'room A\'s own centre cell resolves to room A');
  assert.equal(mask.roomOf(rectB.cx, rectB.cy), roomB.id, 'room B\'s own centre cell resolves to room B');

  // The two rects are disjoint along x (FP-1's shared-wall inset — WALL_CELLS=1 on
  // each side): rectA ends at maxX, rectB starts at minX, with a real gap between
  // them (the wall band). Probe the cell(s) strictly between the two rects — every
  // one of them must belong to NEITHER room (walls block).
  assert.ok(rectA.maxX < rectB.minX, 'the two rooms are disjoint along x (the axis they abut on)');
  for (let gx = rectA.maxX + 1; gx < rectB.minX; gx++) {
    assert.equal(mask.contains(gx, rectA.cy), false, `wall-band cell (${gx},${rectA.cy}) is not walkable by anyone`);
  }

  // The one interior crossing is OPEN and crossable (default state).
  assert.equal(mask.crossings.length, 1, 'exactly one room-to-room crossing (the interior door)');
  assert.equal(mask.crossings[0].crossable, true, 'the default-open interior door crosses freely');
  assert.equal(crossable(mask.crossings[0].state), true);
});

test('U511: the front door threshold projects OUTWARD to the region frame (never another struct cell)', () => {
  const w = bootAuthored();
  const st = w.structures.byId[AUTHORED_STRUCT_ID];
  const front = exteriorDoorOf(st);
  const cells = doorCells(w, st, front);
  assert.ok(cells, 'the exterior door grounds a threshold');
  assert.equal(cells.inside.frame, `struct:${AUTHORED_STRUCT_ID}`);
  assert.equal(cells.outside.frame, 'region', 'the far side of the front door is OUTSIDE the structure (region frame)');
});

test('U511: an interior door\'s doorCells project both sides to the SAME struct frame (a room-to-room crossing, not egress)', () => {
  const w = bootAuthored();
  const st = w.structures.byId[AUTHORED_STRUCT_ID];
  const interior = doorsOf(st).find(d => !d.exterior);
  const cells = doorCells(w, st, interior);
  assert.ok(cells);
  assert.equal(cells.inside.frame, `struct:${AUTHORED_STRUCT_ID}`);
  assert.equal(cells.outside.frame, `struct:${AUTHORED_STRUCT_ID}`);
  assert.notDeepEqual(cells.inside, cells.outside, 'the two sides are distinct cells (different rooms)');
});
