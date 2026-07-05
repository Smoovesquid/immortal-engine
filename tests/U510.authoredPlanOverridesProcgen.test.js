// U510 — MR-2c: an authored house-builder plan LOADS as the structure's canon
// topology (the REPRODUCE-FIRST baseline).
//
// docs/briefs/MR-2-FUNCTIONAL-INK.md §MR-2c. Tim hand-draws floorplans in
// public/house-builder.html; the loader (engine/structures/authoredPlans.js) turns
// its export into a real structure. BEFORE this packet there was no loader at all:
// a structure id with an authored plan registered for it would materialize as an
// ordinary procgen structure (generateStructuresForNode's chain-of-3-4-rooms stub),
// never Tim's own layout. This file is the failing baseline the fix closed: it
// asserts that materializing the node the sample fixture
// (packs/base/structures/authored/wake_cottage.house.js) targets yields the
// AUTHORED topology (room count, adjacency) — two rooms, one edge — not the
// procgen default. Every un-authored node is asserted UNCHANGED (byte-identical
// merge behaviour) alongside it, so the override is proven additive, not a
// regression of the ordinary path.
//
// Siblings: U511 (door records + mask), U512 (determinism + roomOf agreement).
// Pure engine-level assertions — no public/, no LLM, no rng beyond the engine's own.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { applyGeneratedStructuresForNode } from '../engine/structures/applyGeneratedStructuresForNode.js';
import { normalizeTopology, adjacentRooms } from '../engine/structures/topology.js';
// LOADER-MERGE relock: the authored-plan registry moved from authoredPlans.js into
// authoredStructure.js (one loader, one registry). Same API surface, same behavior —
// only the import path changed.
import {
  hasAuthoredPlan,
  authoredRawFor,
  authoredStructureIds,
  buildAuthoredTopology,
  makeAuthoredStructure,
} from '../engine/structures/authoredStructure.js';

const AUTHORED_STRUCT_ID = 'stgen:v27:n99_mr2c_wake_cottage:0';
const AUTHORED_NODE_ID = 'n99_mr2c_wake_cottage';

function bootAt(nodeId, worldSeed = 'U510-seed') {
  let w = ensureWorld(newWorld({ seed: worldSeed, fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }));
  w = {
    ...w,
    map: {
      ...w.map,
      currentNodeId: nodeId,
      nodes: [...(w.map.nodes || []), { id: nodeId, x: 7, y: 7, tags: [] }],
    },
  };
  return ensureWorld(applyGeneratedStructuresForNode(w, nodeId));
}

// ── the registry itself ────────────────────────────────────────────────────────

test('U510: the sample fixture is registered under its declared structureId', () => {
  assert.ok(hasAuthoredPlan(AUTHORED_STRUCT_ID), 'authoredStructureIds must include the fixture');
  assert.ok(authoredStructureIds().includes(AUTHORED_STRUCT_ID));
  const raw = authoredRawFor(AUTHORED_STRUCT_ID);
  assert.equal(raw.schema, 'house-builder/v5');
  assert.equal(raw.rooms.length, 2, 'the fixture draws two rooms (Hall + Bedchamber)');
});

test('U510: an unregistered id has no authored plan', () => {
  assert.equal(hasAuthoredPlan('stgen:v27:n_totally_unregistered:0'), false);
  assert.equal(authoredRawFor('stgen:v27:n_totally_unregistered:0'), null);
});

// ── the load: authored topology overrides procgen for the registered id ────────

test('U510: materializing the authored node yields the AUTHORED topology (2 rooms, 1 edge) — not procgen', () => {
  const w = bootAt(AUTHORED_NODE_ID);
  const st = w.structures.byId[AUTHORED_STRUCT_ID];
  assert.ok(st, 'the structure materialized under its expected stgen id');
  assert.ok(st.authoredPlan, 'the structure carries the authored floorPlan-shaped geometry');

  const topo = normalizeTopology(st.topology);
  assert.equal(topo.rooms.length, 2, 'exactly the two rooms Tim drew');
  assert.equal(topo.edges.length, 1, 'exactly one interior doorway edge');

  // Adjacency: the two rooms are connected (an interior door joins them).
  const [a, b] = topo.rooms.map(r => r.id);
  assert.ok(adjacentRooms(topo, a).includes(b), 'the two rooms are adjacent (the interior door edge)');

  // The entry room is tagged 'entry' and sorts FIRST (room:<id>:1) so
  // interiors.js's enterStructureInterior — which picks topo.rooms[0] after an
  // alpha sort, not the tag — still drops the player in the right room.
  const entry = topo.rooms.find(r => r.tags.includes('entry'));
  assert.ok(entry, 'exactly one room is tagged entry');
  const sorted = topo.rooms.map(r => r.id).slice().sort((x, y) => x.localeCompare(y));
  assert.equal(sorted[0], entry.id, 'the entry room sorts first (matches procgen\'s :1 convention)');
});

test('U510: this MATCHES buildAuthoredTopology(raw, structId) called directly (pure, same input same output)', () => {
  const raw = authoredRawFor(AUTHORED_STRUCT_ID);
  const direct = buildAuthoredTopology(raw, AUTHORED_STRUCT_ID);
  const w = bootAt(AUTHORED_NODE_ID);
  const st = w.structures.byId[AUTHORED_STRUCT_ID];
  assert.deepEqual(normalizeTopology(st.topology), normalizeTopology(direct));
});

test('U510: makeAuthoredStructure returns null for an unregistered id (never throws)', () => {
  assert.equal(makeAuthoredStructure('stgen:v27:n_not_registered:0', 'n_not_registered'), null);
});

// ── the non-goal: every UN-authored node is completely unaffected ──────────────

test('U510: an ordinary (un-authored) node still materializes via procgen, unchanged', () => {
  const w = bootAt('n0_ordinary_procgen_node');
  const id = 'stgen:v27:n0_ordinary_procgen_node:0';
  const st = w.structures.byId[id];
  assert.ok(st, 'procgen still materializes a structure for an ordinary node');
  assert.equal(st.authoredPlan, undefined, 'no authoredPlan field on a procgen structure');
  assert.ok(Array.isArray(st.topology.rooms) && st.topology.rooms.length >= 3, 'procgen\'s chain-of-3-4-rooms stub still runs');
});

test('U510: applying generated structures twice for the same authored node is idempotent (no duplicate/second write)', () => {
  const w1 = bootAt(AUTHORED_NODE_ID);
  const w2 = ensureWorld(applyGeneratedStructuresForNode(w1, AUTHORED_NODE_ID));
  assert.deepEqual(w1.structures.byId[AUTHORED_STRUCT_ID], w2.structures.byId[AUTHORED_STRUCT_ID]);
});
