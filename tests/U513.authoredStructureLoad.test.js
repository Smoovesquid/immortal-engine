// U513 — LOAD-1: the smallest loader turns a house-builder export into a valid
// engine structure (docs/briefs/LOAD-1-smallest-loader.md).
//
// ENGINE LEADS. loadAuthoredStructure(json, {nodeId}) reads the FIRST room of a
// house-builder/v6 (or v5) export and maps it DOWN onto the engine's interior model:
// a structure object with the exact { kind, nodeId, anchors, topology, surfaces,
// tags, buildingType, authoredPlan } shape ensureStructures already reads for an
// MR-2c authored plan. This file is the REPRODUCE-FIRST baseline: the hand-written
// fixture (tests/fixtures/loader/one_room.house.json) loads clean, the topology
// normalizes to exactly one entry room carrying the authored role, and the structure
// survives an ensureStructures round-trip unchanged. The fixture is asserted to be
// the byte-for-byte twin of the engine demo module (loader_demo.house.js) so the
// thing the player walks into is the thing this test validates.
//
// Siblings: U514 (enterable), U515 (furniture + material narrate), U516 (determinism),
// U517 (malformed fails loudly, default boot byte-identical). Pure engine-level — no
// public/, no LLM, no rng beyond the engine's own.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadAuthoredStructure } from '../engine/structures/authoredStructure.js';
import { ensureStructures } from '../engine/structures/structuresState.js';
import { normalizeTopology } from '../engine/structures/topology.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import loaderDemoHouse from '../packs/base/structures/authored/loader_demo.house.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, 'fixtures', 'loader', 'one_room.house.json');
const FIXTURE = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
const NODE = 'n_load1_demo';

// ── the fixture is real tool output + the demo's twin ──────────────────────────

test('U513: the fixture is a well-formed house-builder/v6 one-room export', () => {
  assert.equal(FIXTURE.schema, 'house-builder/v6');
  assert.equal(FIXTURE.rooms.length, 1, 'the smallest loader proves ONE room');
  const room = FIXTURE.rooms[0];
  assert.ok(Number(room.w) > 0 && Number(room.h) > 0, 'the room has a positive footprint');
  assert.equal(room.material, 'timber');
});

test('U513: the engine demo module (loader_demo.house.js) is the byte-for-byte twin of the fixture', () => {
  // The .json is what the test drives loadAuthoredStructure with (proving it consumes
  // real tool output); the .js module is what the engine demo imports (fs-free in the
  // browser). They MUST be the same house or the test validates a different room than
  // the player walks into.
  assert.deepEqual(loaderDemoHouse, FIXTURE);
});

// ── the load: a valid engine structure with the authored room ──────────────────

test('U513: loadAuthoredStructure yields a valid structure with the ensureStructures shape', () => {
  const st = loadAuthoredStructure(FIXTURE, { nodeId: NODE });
  assert.equal(st.id, `authored:${NODE}`, 'a deterministic, procgen-collision-free id');
  assert.equal(st.kind, 'building');
  assert.equal(st.nodeId, NODE);
  assert.equal(st.anchors.nodeId, NODE);
  assert.equal(st.buildingType, 'cottage', 'a hand-drawn house reads as a cottage (furniture + material stack)');
  assert.ok(st.authoredPlan, 'carries the authored floorPlan-shaped geometry');
  assert.ok(Array.isArray(st.tags) && st.tags.includes('authored') && st.tags.includes('loader'));
});

test('U513: the topology normalizes to exactly one entry room carrying the authored role', () => {
  const st = loadAuthoredStructure(FIXTURE, { nodeId: NODE });
  const topo = normalizeTopology(st.topology);
  assert.equal(topo.rooms.length, 1, 'exactly the one room Tim drew');
  assert.equal(topo.edges.length, 0, 'a single room has no interior doorways');
  const room = topo.rooms[0];
  assert.ok(room.tags.includes('entry'), 'the sole room is the entry room (interiors.js drops the player here)');
  assert.ok(room.tags.includes('role:quarters'), 'the fixture\'s role:quarters is carried onto the room so roomDetail reads it');
});

test('U513: the authored plan is a single entry room at the drawn geometry', () => {
  const st = loadAuthoredStructure(FIXTURE, { nodeId: NODE });
  const plan = floorPlan(st); // authored override returns authoredPlan verbatim
  assert.equal(plan.rooms.length, 1);
  const r = plan.rooms[0];
  assert.equal(r.isEntry, true, 'the room is the entry (deriveDoors fronts the exterior door on it)');
  assert.equal(r.shape, 'rect');
  assert.equal(r.w, 6); assert.equal(r.h, 5); // house-builder units == layout units (HB_UNIT_TO_LAYOUT=1)
  assert.equal(plan.shell, 'timber', 'timber material selects the timber shell');
});

// ── ensureStructures round-trip: the structure survives normalization ──────────

test('U513: the structure survives an ensureStructures round-trip unchanged', () => {
  const st = loadAuthoredStructure(FIXTURE, { nodeId: NODE });
  const es = ensureStructures({ byId: { [st.id]: st }, nextId: 1 });
  const back = es.byId[st.id];
  assert.ok(back, 'ensureStructures keeps the structure');
  assert.equal(back.buildingType, 'cottage', 'declared buildingType is preserved');
  assert.ok(back.authoredPlan, 'the authoredPlan survives (well-formed floorPlan shape)');
  assert.equal(back.authoredPlan.rooms.length, 1);
  assert.deepEqual(normalizeTopology(back.topology), normalizeTopology(st.topology));
});

test('U513: a round room loads with shape round (the engine has a round shape)', () => {
  const round = { ...FIXTURE, rooms: [{ ...FIXTURE.rooms[0], shape: 'round' }] };
  const st = loadAuthoredStructure(round, { nodeId: NODE });
  assert.equal(floorPlan(st).rooms[0].shape, 'round');
});

test('U513: the loader is pure — same JSON in, byte-identical structure out, twice', () => {
  const a = loadAuthoredStructure(FIXTURE, { nodeId: NODE });
  const b = loadAuthoredStructure(FIXTURE, { nodeId: NODE });
  assert.deepEqual(a, b);
});
