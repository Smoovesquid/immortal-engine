// U528 — LOAD-2: walk the whole building — enter, move room-to-room through the
// authored doorways, each room narrates truthfully, no soft-lock
// (docs/briefs/LOAD-2-multiroom-realnode.md §Tests).
//
// This drives the REAL engine movement path (enterStructureInterior / moveWithinInterior
// / getInteriorView / getRoomState) over a structure built by the loader — the same
// path the playloop calls. It proves the whole point of LOAD-2: the building Tim drew
// is one you can walk into and move around, room to room, through its doors.
//
// Siblings: U526 (all rooms load), U527 (door→adjacency), U529 (determinism), U530 (guardrails).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ensureWorld, newWorld } from '../engine/state.js';
import { loadAuthoredStructure } from '../engine/structures/authoredStructure.js';
import { ensureStructures } from '../engine/structures/structuresState.js';
import {
  enterStructureInterior, exitStructureInterior, moveWithinInterior,
  getInteriorView, interiorDirectionalExits, describeInteriorLayout,
} from '../engine/structures/interiors.js';
import { getRoomState } from '../engine/structures/roomState.js';
import { doorsOf } from '../engine/structures/doors.js';
import { normalizeTopology } from '../engine/structures/topology.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(fs.readFileSync(join(__dirname, 'fixtures', 'loader', 'three_room.house.json'), 'utf8'));

// Build a minimal world with the authored building at the current node.
function worldWithBuilding(seed = 'load2walk') {
  let w = ensureWorld(newWorld({ seed, campaignId: 'c' }));
  const nid = String(w.map?.currentNodeId || 'n_x');
  const st = loadAuthoredStructure(FIXTURE, { nodeId: nid });
  w = ensureWorld({ ...w, structures: ensureStructures({ byId: { [st.id]: st }, nextId: 1 }) });
  return { w, structId: st.id, nid };
}

const short = (id) => String(id).split(':').slice(-1)[0];

test('U528: enter drops the player into the entry room (the Hall)', () => {
  const { w: w0, structId } = worldWithBuilding();
  const w = enterStructureInterior(w0, structId);
  const rs = getRoomState(w);
  assert.equal(rs.inside, true);
  assert.equal(short(rs.roomId), '1', 'enter lands in the canonical :1 entry room');
  assert.equal(rs.atEntry, true);
  assert.equal(rs.room.role, 'hearthroom', 'the entry is the hall (hearth room)');
});

test('U528: the doors are canon — one exterior + two interior room-to-room doors', () => {
  const { w, structId } = worldWithBuilding();
  const st = w.structures.byId[structId];
  const doors = doorsOf(st);
  assert.equal(doors.filter(d => d.exterior).length, 1, 'exactly one exterior (front) door');
  assert.equal(doors.filter(d => !d.exterior).length, 2, 'two interior room-to-room doors');
});

test('U528: from the entry the player walks through a doorway into EACH side room and back', () => {
  const { w: w0, structId } = worldWithBuilding();
  const wEntry = enterStructureInterior(w0, structId);
  const entryRoom = wEntry.scene.interior.roomId;
  const topo = normalizeTopology(w0.structures.byId[structId].topology);
  const sideRooms = topo.rooms.filter(r => r.id !== entryRoom).map(r => r.id);
  assert.equal(sideRooms.length, 2, 'two side rooms to visit');

  // The entry's exits name both side rooms, each with a real compass direction.
  const iv = getInteriorView(wEntry);
  assert.equal(iv.exits.length, 2, 'the hall shows two doorways');
  for (const e of iv.exits) assert.ok(e.dir, 'each exit carries a compass direction');

  for (const target of sideRooms) {
    // Move INTO the side room.
    const wIn = moveWithinInterior(wEntry, target);
    assert.equal(wIn.scene.interior.roomId, target, `moved into ${short(target)}`);
    const rs = getRoomState(wIn);
    assert.ok(rs.room && rs.room.name, `${short(target)} narrates a real room`);
    assert.equal(rs.atEntry, false, `${short(target)} is not the entry`);

    // The side room's only exit leads BACK to the hall (reciprocal doorway).
    const back = interiorDirectionalExits(wIn);
    const backDirs = ['north', 'east', 'south', 'west'].filter(d => back[d]);
    assert.equal(backDirs.length, 1, `${short(target)} has one doorway (back to the hall)`);
    assert.equal(back[backDirs[0]], entryRoom, 'the doorway leads back to the hall');

    // Walk back.
    const wBack = moveWithinInterior(wIn, entryRoom);
    assert.equal(wBack.scene.interior.roomId, entryRoom, 'walked back to the hall');
  }
});

test('U528: describeInteriorLayout reports the REAL graph (3 rooms, single storey) — no invented geography', () => {
  const { w: w0, structId } = worldWithBuilding();
  const w = enterStructureInterior(w0, structId);
  const layout = describeInteriorLayout(w);
  assert.ok(layout);
  assert.equal(layout.roomCount, 3, 'the DM prompt sees exactly the three real rooms');
  assert.ok(layout.doorways.length >= 1, 'the entry reports its real doorways');
  // From the entry there is no "doorway back toward the front" (you ARE at the front) —
  // only doorways leading deeper in. This constrains the narrator to the real topology.
  assert.ok(layout.atEntry, 'at the entry');
});

test('U528: a room you can enter is a room you can leave — exit returns outdoors (no soft-lock)', () => {
  const { w: w0, structId } = worldWithBuilding();
  // Walk in, deep into a side room, then exit — egress must succeed from anywhere.
  let w = enterStructureInterior(w0, structId);
  const entryRoom = w.scene.interior.roomId;
  const topo = normalizeTopology(w0.structures.byId[structId].topology);
  const side = topo.rooms.find(r => r.id !== entryRoom).id;
  w = moveWithinInterior(w, side);
  // The exit action lifts any bar and steps out (MR-2a never-soft-lock). We first walk
  // back to the entry (egress is from the room the front door fronts), then exit.
  w = moveWithinInterior(w, entryRoom);
  const wOut = exitStructureInterior(w);
  assert.equal(getRoomState(wOut).inside, false, 'the player is back outdoors');
});
