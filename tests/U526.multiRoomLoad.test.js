// U526 — LOAD-2: the loader consumes ALL rooms of a multi-room house-builder export
// (docs/briefs/LOAD-2-multiroom-realnode.md).
//
// LOAD-1 (U513) loaded ONE room. LOAD-2 makes the WHOLE building walkable: every room
// in the export becomes a topology room carrying its authored ROLE, so "look around"
// reads each room truthfully. This is the REPRODUCE-FIRST baseline: the hand-written
// three-room fixture (hall + two side rooms) loads clean, every room is present with
// the right role, and the fixture is the byte-for-byte twin of the engine demo module.
//
// Siblings: U527 (door→adjacency reciprocal-compass), U528 (walk it), U529 (determinism),
// U530 (malformed/disconnected + default boot byte-identical). Pure engine-level.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadAuthoredStructure } from '../engine/structures/authoredStructure.js';
import { ensureStructures } from '../engine/structures/structuresState.js';
import { normalizeTopology } from '../engine/structures/topology.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { roomDetail } from '../engine/structures/roomDetail.js';
import threeRoomDemoHouse from '../packs/base/structures/authored/three_room_demo.house.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, 'fixtures', 'loader', 'three_room.house.json');
const FIXTURE = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
const NODE = 'n_load2_demo';

const short = (id) => String(id).split(':').slice(-1)[0];
const roleTagOf = (room) => (room.tags.find(t => t.startsWith('role:')) || '').slice(5);

// ── the fixture is real tool output + the demo's twin ──────────────────────────

test('U526: the fixture is a well-formed house-builder/v7 three-room export', () => {
  assert.equal(FIXTURE.schema, 'house-builder/v7');
  assert.equal(FIXTURE.rooms.length, 3, 'LOAD-2 proves a WHOLE building — three rooms');
  for (const r of FIXTURE.rooms) assert.ok(Number(r.w) > 0 && Number(r.h) > 0, `${r.id} has a footprint`);
  // Three door openings (one front + two interior) + one window.
  const doors = FIXTURE.openings.filter(o => o.kind === 'door');
  assert.equal(doors.length, 3, 'a front door + two interior doors');
});

test('U526: the engine demo module (three_room_demo.house.js) is the byte-for-byte twin of the fixture', () => {
  // The .json drives loadAuthoredStructure (proving it consumes real tool output); the
  // .js module is what the engine demo imports (fs-free in the browser). They MUST be
  // the same house or the test validates a different building than the player walks.
  assert.deepEqual(threeRoomDemoHouse, FIXTURE);
});

// ── the load: all rooms, each with its role ────────────────────────────────────

test('U526: loadAuthoredStructure yields a valid multi-room structure', () => {
  const st = loadAuthoredStructure(FIXTURE, { nodeId: NODE });
  assert.equal(st.id, `authored:${NODE}`);
  assert.equal(st.kind, 'building');
  assert.equal(st.nodeId, NODE);
  assert.equal(st.buildingType, 'cottage');
  assert.ok(st.authoredPlan, 'carries the authored floorPlan-shaped geometry');
  assert.ok(st.tags.includes('authored') && st.tags.includes('loader'));
});

test('U526: the topology has ALL three rooms, each carrying its authored role', () => {
  const st = loadAuthoredStructure(FIXTURE, { nodeId: NODE });
  const topo = normalizeTopology(st.topology);
  assert.equal(topo.rooms.length, 3, 'every room Tim drew is present (not just the first)');

  // Exactly one entry room, canonicalized to :1 so interiors.js drops the player there.
  const entryRooms = topo.rooms.filter(r => r.tags.includes('entry'));
  assert.equal(entryRooms.length, 1, 'exactly one entry room');
  assert.equal(short(entryRooms[0].id), '1', 'the entry room is canonicalized to :1 (sorts first)');

  // Each room carries the role the tool named (hall→hearthroom, and a bedchamber + a
  // scullery among the two side rooms), so roomDetail reads it (truthful "look around").
  const roles = new Set(topo.rooms.map(roleTagOf));
  assert.ok(roles.has('hearthroom'), 'the hall carries role:hearthroom');
  assert.ok(roles.has('bedchamber'), 'a side room carries role:bedchamber');
  assert.ok(roles.has('scullery'), 'a side room carries role:scullery');
});

test('U526: each room narrates truthfully per its role (roomDetail resolves distinct rooms)', () => {
  const st = loadAuthoredStructure(FIXTURE, { nodeId: NODE });
  const topo = normalizeTopology(st.topology);
  const names = topo.rooms.map(r => roomDetail(r, 'cottage').name);
  // The three roles resolve to three distinct room names (a hearth room, a bedchamber,
  // a scullery) — not three copies of one blueprint default.
  assert.ok(names.includes('Hearth Room'));
  assert.ok(names.includes('Bedchamber'));
  assert.ok(names.includes('Scullery'));

  // The bedchamber's roomDetail loadout includes a bed (so the drawn bed reads right).
  const bed = topo.rooms.find(r => roleTagOf(r) === 'bedchamber');
  assert.ok(roomDetail(bed, 'cottage').furniture.some(f => f.kind === 'bed'), 'the bedchamber has a bed');
});

test('U526: the authored plan is all three rooms at the drawn geometry, with furniture', () => {
  const st = loadAuthoredStructure(FIXTURE, { nodeId: NODE });
  const plan = floorPlan(st); // authored override returns authoredPlan verbatim
  assert.equal(plan.rooms.length, 3);
  assert.equal(plan.shell, 'timber', 'timber material selects the timber shell');
  // Rooms keep their DRAWN size (house-builder units == layout units, HB_UNIT_TO_LAYOUT=1).
  const hall = plan.rooms.find(r => r.isEntry);
  assert.equal(hall.w, 6); assert.equal(hall.h, 6);
  // Every room draws role-appropriate furniture (so the map + prose agree).
  for (const r of plan.rooms) assert.ok(r.furniture.length > 0, `${r.name} shows furniture on the plan`);
});

// ── ensureStructures round-trip ────────────────────────────────────────────────

test('U526: the multi-room structure survives an ensureStructures round-trip unchanged', () => {
  const st = loadAuthoredStructure(FIXTURE, { nodeId: NODE });
  const es = ensureStructures({ byId: { [st.id]: st }, nextId: 1 });
  const back = es.byId[st.id];
  assert.ok(back, 'ensureStructures keeps the structure');
  assert.equal(back.buildingType, 'cottage');
  assert.equal(back.authoredPlan.rooms.length, 3, 'all three rooms survive');
  assert.deepEqual(normalizeTopology(back.topology), normalizeTopology(st.topology));
});
