// U659 — FUNC-MINIS-1: the Builder's placed furniture IS the room's furniture.
//
// Tim's hard bar (2026-07-09): "If a thing can be placed, the world must believe in
// it. If I place three barrels in a bedroom, the world has three barrels there."
// Exact placed count, kind, identity, and drawn position must survive finalize/load;
// no role-based substitute furniture is acceptable.
//
// REPRODUCE-FIRST: today the loader documents the opposite (authoredStructure.js,
// "What is IGNORED / DEGRADED": "narration/furniture is regenerated from the room
// ROLE (roomDetail), so a bed drawn in a corner reads as 'a bed' but at the role's
// canonical layout, not the exact drawn spot") — a quarters room yields the ROLE
// loadout (bed, bed, nightstand, chest, lantern, rug) no matter what was drawn.
// These tests are RED against that behavior and define the new law.
//
// Carriers asserted (both must agree, and both must survive the ensureStructures
// round-trip — normalizeTopology/ensureStructure rebuild records field-by-field, so
// an additive field that isn't in the normalizer is silently stripped; that trap is
// exactly what bit ensureCombat's enemy whitelist):
//   • structure.authoredPlan.rooms[].furniture — the floor-plan/render/blocking surface
//   • topology rooms → roomDetail(room) — the cover/assignment/narration surface
//
// Siblings: U660 (node.furniture seeding), U513–U517 (the LOAD-1 loader baseline).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadAuthoredStructure } from '../engine/structures/authoredStructure.js';
import { roomDetail } from '../engine/structures/roomDetail.js';
import { normalizeTopology } from '../engine/structures/topology.js';
import { ensureStructures } from '../engine/structures/structuresState.js';

// A minimal house-builder/v6 export — EXACTLY the shape the Builder's Export JSON
// writes (loader_demo.house.js is the reference twin): one quarters room, one door,
// THREE drawn barrels along the east wall and one bed by the west wall.
const threeBarrelBedroom = {
  kind: 'authored-structure',
  schema: 'house-builder/v6',
  name: "Cooper's Bedroom",
  grid: { cols: 120, rows: 90, cell: 28 },
  rooms: [
    { id: 'bedroom', name: 'Bedroom', role: 'quarters', shape: 'rect', material: 'timber', x: 10, y: 10, w: 8, h: 6 }
  ],
  walls: [],
  openings: [
    { kind: 'door', x: 10, y: 13, angle: 90, orient: 'v', len: 1, room: 'bedroom' }
  ],
  tunnels: [],
  corridors: [],
  furniture: [
    { type: 'bed',    x: 11, y: 11, w: 2, h: 3, rot: 0, room: 'bedroom', ux: 0.25,   uy: 0.4167 },
    { type: 'barrel', x: 16, y: 11, w: 1, h: 1, rot: 0, room: 'bedroom', ux: 0.8125, uy: 0.25 },
    { type: 'barrel', x: 16, y: 12, w: 1, h: 1, rot: 0, room: 'bedroom', ux: 0.8125, uy: 0.4167 },
    { type: 'barrel', x: 16, y: 13, w: 1, h: 1, rot: 0, room: 'bedroom', ux: 0.8125, uy: 0.5833 },
  ],
  secrets: []
};

const NODE = 'n_test_cooper';

function kindsOf(furniture) {
  return (furniture || []).map(f => String(f.kind)).sort();
}

test('U659: the plan room carries EXACTLY the drawn pieces — three barrels and a bed, no role substitutes', () => {
  const st = loadAuthoredStructure(threeBarrelBedroom, { nodeId: NODE });
  const room = st.authoredPlan.rooms[0];
  const kinds = kindsOf(room.furniture);

  assert.deepEqual(kinds, ['barrel', 'barrel', 'barrel', 'bed'],
    `drawn furniture must survive verbatim (got: ${kinds.join(', ') || 'none'})`);
  assert.equal(room.furniture.length, 4,
    'exact placed COUNT survives — no injected crates, no role extras');
  for (const forbidden of ['nightstand', 'chest', 'lantern', 'rug', 'crate']) {
    assert.ok(!kinds.includes(forbidden),
      `role-loadout substitute "${forbidden}" must not appear in an authored room`);
  }
});

test('U659: drawn POSITIONS survive — each piece sits where Tim put it, not at a canonical layout slot', () => {
  const st = loadAuthoredStructure(threeBarrelBedroom, { nodeId: NODE });
  const room = st.authoredPlan.rooms[0];
  const barrels = (room.furniture || []).filter(f => String(f.kind) === 'barrel');
  const bed = (room.furniture || []).find(f => String(f.kind) === 'bed');

  assert.equal(barrels.length, 3, 'all three barrels present');
  assert.ok(bed, 'the bed is present');

  // All three barrels hug the east wall (drawn ux 0.8125); the bed sits west (0.25).
  for (const b of barrels) {
    assert.ok(Math.abs(b.fx - 0.8125) < 0.03,
      `barrel fx=${b.fx} must be the drawn spot (~0.8125), not a layout slot`);
  }
  const barrelYs = barrels.map(b => b.fy).sort((a, b) => a - b);
  const drawnYs = [0.25, 0.4167, 0.5833];
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(barrelYs[i] - drawnYs[i]) < 0.03,
      `barrel fy=${barrelYs[i]} must match drawn row ${drawnYs[i]}`);
  }
  assert.ok(Math.abs(bed.fx - 0.25) < 0.03, `bed fx=${bed.fx} must be the drawn spot (~0.25)`);
});

test('U659: the topology room carries the authored furniture — roomDetail (cover/narration read stack) returns the drawn pieces', () => {
  const st = loadAuthoredStructure(threeBarrelBedroom, { nodeId: NODE });
  const topo = normalizeTopology(st.topology);
  const room = topo.rooms[0];
  const det = roomDetail(room, st.buildingType);
  const kinds = kindsOf(det.furniture);

  assert.deepEqual(kinds, ['barrel', 'barrel', 'barrel', 'bed'],
    `the runtime read stack must see the drawn pieces (got: ${kinds.join(', ') || 'none'})`);
});

test('U659: the ensureStructures round-trip preserves authored furniture on BOTH carriers (the field-whitelist trap)', () => {
  const st = loadAuthoredStructure(threeBarrelBedroom, { nodeId: NODE });
  const roundTripped = ensureStructures({ byId: { [st.id]: st }, nextId: 1 }).byId[st.id];

  const planKinds = kindsOf(roundTripped.authoredPlan?.rooms?.[0]?.furniture);
  assert.deepEqual(planKinds, ['barrel', 'barrel', 'barrel', 'bed'],
    'authoredPlan furniture survives normalization');

  const topoRoom = normalizeTopology(roundTripped.topology).rooms[0];
  const detKinds = kindsOf(roomDetail(topoRoom, roundTripped.buildingType).furniture);
  assert.deepEqual(detKinds, ['barrel', 'barrel', 'barrel', 'bed'],
    'topology-carried furniture survives normalization');
});

test('U659: every authored piece has a stable identity', () => {
  const a = loadAuthoredStructure(threeBarrelBedroom, { nodeId: NODE });
  const b = loadAuthoredStructure(threeBarrelBedroom, { nodeId: NODE });
  const idsA = a.authoredPlan.rooms[0].furniture.map(f => String(f.id));
  const idsB = b.authoredPlan.rooms[0].furniture.map(f => String(f.id));

  assert.equal(new Set(idsA).size, 4, 'ids are unique per room');
  assert.deepEqual(idsA, idsB, 'ids are deterministic across loads');
  for (const id of idsA) assert.ok(id.length > 0, 'each piece carries a real id');
});
