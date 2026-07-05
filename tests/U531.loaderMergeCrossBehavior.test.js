// U531 — LOADER-MERGE: one loader, the UNION of both merged modules' guarantees on a
// single multi-room authored building.
//
// Two conductors independently built a house-builder loader the same day; LOADER-MERGE
// folded engine/structures/authoredPlans.js (the MR-2c id/registry path — door-canon
// records + mask + window separation) into engine/structures/authoredStructure.js (the
// LOAD-1/LOAD-2 proven-live path — multi-room, doors→adjacency, orphan repair, authored
// roles/furniture). This file is the cross-behavior proof: ONE multi-room authored
// building, materialized through the ONE surviving loader, yields at once —
//   • correct DOOR RECORDS with states (authoredPlans' guarantee): exactly one exterior
//     front door defaulting SHUT (a home) + one interior door PER doorway, defaulting OPEN;
//   • correct ROOM ADJACENCY (authoredStructure's guarantee): every interior door is a
//     reciprocal-compass topology edge, and every room is reachable from the entry;
//   • a correct walkable MASK (authoredPlans' guarantee): one crossable crossing PER
//     interior door, and the front door threshold projects OUTWARD to the region frame;
//   • windows stay windows (never a door) — the MR-2d aperture the merge preserved.
// If either module's guarantee had been dropped in the merge, one of these fails.
//
// The fixture is the three-room warden's cottage (Hall entry + West Bedchamber + East
// Scullery, two interior doors + one front door + one window), materialized through the
// SAME applyGeneratedStructuresForNode → ensureWorld tail the live game uses (the
// 'loaderDemo2' seed injects it at the boot node). Pure engine-level — no public/, no LLM.
//
// Sibling: U532 (worldHash replay stability across the merge). Uses ONLY test numbers
// U526–U532 (LOADER-MERGE's allocation).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { applyGeneratedStructuresForNode } from '../engine/structures/applyGeneratedStructuresForNode.js';
import { normalizeTopology, adjacentRooms, interiorCompassLayout } from '../engine/structures/topology.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import {
  doorsOf, exteriorDoorOf, doorBetween, doorCells, structWalkableMask,
  crossable, DOOR_STATES,
} from '../engine/structures/doors.js';
import { reachableRooms } from '../engine/movement/interiorMovement.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { loadAuthoredStructure } from '../engine/structures/authoredStructure.js';
import threeRoomDemoHouse from '../packs/base/structures/authored/three_room_demo.house.js';

const NODE = 'n_u531_merge';
const STRUCT_ID = `authored:${NODE}`;
const DIRS = ['north', 'east', 'south', 'west'];
const OPP = { north: 'south', south: 'north', east: 'west', west: 'east' };

// Boot the 'loaderDemo2' seed (the demo wire-in injects the three-room cottage at the
// node) and materialize the node through the real structures tail. This is the SAME path
// the live game walks — not a hand-built shortcut.
function bootThreeRoom(worldSeed = 'loaderDemo2') {
  let w = ensureWorld(newWorld({ seed: worldSeed, fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }));
  w = {
    ...w,
    party: [{ id: 'party' }],
    map: {
      ...w.map,
      currentNodeId: NODE,
      nodes: [...(w.map.nodes || []), { id: NODE, x: 9, y: 9, tags: [] }],
    },
  };
  return ensureWorld(applyGeneratedStructuresForNode(w, NODE));
}

// ── the building materializes at all (sanity) ───────────────────────────────────────

test('U531: the three-room authored cottage materializes through the live loader tail', () => {
  const w = bootThreeRoom();
  const st = w.structures.byId[STRUCT_ID];
  assert.ok(st, 'the authored structure is present under its authored:<node> id');
  assert.ok(st.authoredPlan, 'it carries the authored floorPlan-shaped geometry');
  const topo = normalizeTopology(st.topology);
  assert.equal(topo.rooms.length, 3, 'all three drawn rooms are present');
});

// ── guarantee 1: DOOR RECORDS with states (authoredPlans' half) ──────────────────────

test('U531: door records — exactly one exterior (SHUT) + one interior door per doorway (OPEN), all valid states', () => {
  const w = bootThreeRoom();
  const st = w.structures.byId[STRUCT_ID];
  const doors = doorsOf(st);
  // 1 front door + 2 interior doorways = 3 canon door records.
  assert.equal(doors.length, 3, 'front door + two interior doors');
  for (const d of doors) assert.ok(DOOR_STATES.includes(d.state), `door ${d.id} has a valid canon state`);

  const front = exteriorDoorOf(st);
  assert.ok(front, 'exactly one exterior door record exists');
  assert.equal(front.exterior, true);
  assert.equal(front.b, '', 'the exterior door\'s far side is outside');
  assert.equal(front.state, 'shut', 'a home\'s front door defaults shut (the seeded home policy, preserved through the merge)');

  const interior = doors.filter(d => !d.exterior);
  assert.equal(interior.length, 2, 'two interior doorways → two interior door records');
  for (const d of interior) {
    assert.equal(d.state, 'open', 'an ordinary interior door of a dwelling stands open by default');
    assert.notEqual(d.a, '');
    assert.notEqual(d.b, '');
  }
});

test('U531: doorBetween finds each interior door from either room-id order', () => {
  const w = bootThreeRoom();
  const st = w.structures.byId[STRUCT_ID];
  const topo = normalizeTopology(st.topology);
  const entry = topo.rooms.find(r => r.tags.includes('entry')).id;
  const sideRooms = topo.rooms.filter(r => r.id !== entry).map(r => r.id);
  assert.equal(sideRooms.length, 2);
  for (const side of sideRooms) {
    const d1 = doorBetween(st, entry, side);
    const d2 = doorBetween(st, side, entry);
    assert.ok(d1 && d2 && d1.id === d2.id, `order-independent lookup finds the same door between the hall and ${side}`);
  }
});

// ── guarantee 2: ROOM ADJACENCY (authoredStructure's half) ───────────────────────────

test('U531: room adjacency — each interior door is a reciprocal-compass edge; every room reachable from the entry', () => {
  const w = bootThreeRoom();
  const st = w.structures.byId[STRUCT_ID];
  const topo = normalizeTopology(st.topology);

  // Two interior doors → two edges, both touching the entry (the hall is the hub).
  assert.equal(topo.edges.length, 2, 'the two interior doors are the two doorways');
  const entry = topo.rooms.find(r => r.tags.includes('entry')).id;
  for (const e of topo.edges) {
    assert.ok(e.a === entry || e.b === entry, 'each side room connects to the hall');
  }
  const adj = adjacentRooms(topo, entry);
  assert.equal(adj.length, 2, 'the hall is adjacent to both side rooms');

  // Reciprocal compass: A dir→B ⇒ B opp(dir)→A.
  const exits = interiorCompassLayout(topo);
  for (const r of topo.rooms) {
    const ex = exits.get(r.id);
    for (const dir of DIRS) {
      const nb = ex[dir];
      if (!nb) continue;
      assert.equal(exits.get(nb)[OPP[dir]], r.id, `${r.id} ${dir}→${nb} implies ${nb} ${OPP[dir]}→${r.id}`);
    }
  }

  // No orphan: every room reachable from the entry.
  const { dist } = reachableRooms(topo, entry);
  for (const r of topo.rooms) assert.ok(dist.has(r.id), `${r.id} reachable from the entry`);
});

test('U531: the plan door direction agrees with the compass exit it represents (drawn door = walked direction)', () => {
  const w = bootThreeRoom();
  const st = w.structures.byId[STRUCT_ID];
  const topo = normalizeTopology(st.topology);
  const plan = floorPlan(st);
  const exits = interiorCompassLayout(topo);
  for (const d of plan.doors) {
    if (!d.b) continue; // exterior door — outward direction, not an interior exit
    const compassDir = DIRS.find(dir => (exits.get(d.a) || {})[dir] === d.b);
    assert.ok(compassDir, `door ${d.a}→${d.b} corresponds to a compass exit`);
    assert.equal(d.dir, compassDir, `plan door dir (${d.dir}) equals the compass exit (${compassDir})`);
  }
});

// ── guarantee 3: the walkable MASK (authoredPlans' half) ─────────────────────────────

test('U531: the mask has one crossable crossing per interior door, and the front door projects outward to the region frame', () => {
  const w = bootThreeRoom();
  const st = w.structures.byId[STRUCT_ID];
  const mask = structWalkableMask(w, st);

  // Two interior doors → two room-to-room crossings, both default-open and crossable.
  assert.equal(mask.crossings.length, 2, 'two interior doors → two crossings');
  for (const c of mask.crossings) {
    assert.equal(c.crossable, true, 'a default-open interior door crosses freely');
    assert.equal(crossable(c.state), true);
  }

  // The front door threshold projects OUTWARD to the region frame (egress), never
  // another struct cell.
  const front = exteriorDoorOf(st);
  const cells = doorCells(w, st, front);
  assert.ok(cells, 'the exterior door grounds a threshold');
  assert.equal(cells.inside.frame, `struct:${STRUCT_ID}`);
  assert.equal(cells.outside.frame, 'region', 'the far side of the front door is outside the structure');

  // Each interior door's doorCells stay inside the struct on both sides (room-to-room,
  // not egress).
  const interior = doorsOf(st).filter(d => !d.exterior);
  for (const d of interior) {
    const ic = doorCells(w, st, d);
    assert.ok(ic);
    assert.equal(ic.inside.frame, `struct:${STRUCT_ID}`);
    assert.equal(ic.outside.frame, `struct:${STRUCT_ID}`, 'an interior crossing stays inside the structure');
    assert.notDeepEqual(ic.inside, ic.outside, 'the two sides are distinct cells (different rooms)');
  }
});

// ── guarantee 4: windows stay windows (never doors) — MR-2d aperture preserved ────────

test('U531: the window opening is a window (never a third/extra door record)', () => {
  const w = bootThreeRoom();
  const st = w.structures.byId[STRUCT_ID];
  const plan = floorPlan(st);
  // The fixture draws exactly one window (in the West Bedchamber's outer wall).
  assert.ok(Array.isArray(plan.windows) && plan.windows.length === 1, 'the window lands in windows[], additively');
  assert.equal(plan.windows[0].exterior, true, 'the fixture window is on an outer wall');
  // It never became a door: the canon still has exactly the 3 door records (1 ext + 2 int).
  assert.equal(doorsOf(st).length, 3, 'the window did not leak into the door canon');
});

// ── the whole thing is invariant-clean (the deep MR-2a checks, satisfied at once) ────

test('U531: assertWorldInvariants passes for the fully-materialized three-room authored world', () => {
  const w = bootThreeRoom();
  assert.doesNotThrow(() => assertWorldInvariants(w), 'the merged loader satisfies every door + shape invariant');
});

// ── the direct loader still carries its own diagnostics (the depth half, at the source) ─

test('U531: loadAuthoredStructure reports HOW the graph connected (doors, no fallback needed) on the direct output', () => {
  // Loaded directly (not through ensureStructures, which rebuilds the object and drops
  // the non-enumerable diagnostics), the three fully-doored rooms need neither abutment
  // fallback nor orphan repair — the authored doors alone connect the graph.
  const st = loadAuthoredStructure(threeRoomDemoHouse, { nodeId: NODE });
  assert.ok(st.__loaderInfo, 'the direct loader exposes its connection diagnostics');
  assert.equal(st.__loaderInfo.roomCount, 3);
  assert.equal(st.__loaderInfo.edgeCount, 2, 'two doorways');
  assert.equal(st.__loaderInfo.abutted.length, 0, 'no abutment fallback needed — the doors reach every room');
  assert.equal(st.__loaderInfo.repaired.length, 0, 'no orphan repair needed');
});
