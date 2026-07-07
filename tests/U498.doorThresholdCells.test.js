// U498 — MR-1a: doorThresholdCells is a pure, deterministic door→cells map.
//
// The egress fix commits the DOORSTEP: stepping out lands the body just outside the
// structure's door, on the region sheet. doorThresholdCells (engine/map/spatial/
// tacticalPos.js) is the pure geometry that computes that — the inside struct cell
// and the outside region cell of a door — with NO rng, NO LLM, a function of the
// structure's floorPlan and its node anchor. This proves it SEES the geometry for a
// door facing each of the four directions, and holds the contract's invariants:
//   • inside is a struct-frame cell that resolves to the doorway (entry) room;
//   • outside is a region-frame cell, one doorstep beyond the entry room's outer
//     edge, within the probe's doorstep threshold, projecting to the same node;
//   • the outward direction is the dominant cardinal of entry-vs-footprint geometry;
//   • it is deterministic (two calls → identical) and returns null when ungrounded.
//
// docs/POSITION_AS_CANON.md §2 (arrivals at the door) + §3 (frame swap at the door
// cells). Siblings: U496/U497 (probe helpers + real sequence), U499/U500 (egress).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  doorThresholdCells,
  roomOfStructCell,
  nearestNodeToRegionCell,
} from '../engine/map/spatial/tacticalPos.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { structFootprintRegionCells, EXIT_TELEPORT_CELLS } from '../scripts/positionProbe.mjs';

// A minimal world holding one structure at the home node (grid 0,0 → region 0,0).
// floorPlan() derives the real geometry from the topology; doorThresholdCells reads
// it exactly as the live egress path does. No Math.random, nothing hashed.
function makeWorld(structure) {
  return {
    meta: { seed: 'synth' },
    party: [{ id: 'party', pos: null }],
    scene: {},
    structures: { byId: { [structure.id]: structure } },
    map: {
      currentNodeId: structure.nodeId,
      nodes: [
        { id: 'nHome', x: 0, y: 0, settlement: { npcs: [] } },
        { id: 'nFar', x: 5, y: 0, settlement: { npcs: [] } }, // 1000 region cells east
      ],
    },
  };
}

// A two-room cottage whose ids are chosen so the seed-derived interior compass puts
// the entry room's door on a KNOWN outward face. The compass direction derives from
// the room ids (topology.js: order(id) = seedFromString('dir|'+id)), so these four
// id sets were picked to yield one door per cardinal (verified: see the assertions).
const DIR_FIXTURES = {
  east:  { id: 'synth:dir:0', entry: 'e0', other: 'b0' },
  south: { id: 'synth:dir:1', entry: 'e1', other: 'b1' },
  west:  { id: 'synth:dir:2', entry: 'e2', other: 'b2' },
  north: { id: 'synth:dir:7', entry: 'e7', other: 'b7' },
};
function fixtureStruct(f) {
  return {
    id: f.id, nodeId: 'nHome', buildingType: 'cottage',
    topology: { kind: 'rooms', rooms: [{ id: f.entry, tags: ['entry'] }, { id: f.other }], edges: [{ a: f.entry, b: f.other }] },
  };
}

// ── A door facing each of the four directions grounds a valid threshold ─────────
for (const [wantDir, f] of Object.entries(DIR_FIXTURES)) {
  test(`U498: doorThresholdCells grounds a ${wantDir}-facing door — inside is the entry room, outside is a doorstep`, () => {
    const st = fixtureStruct(f);
    const w = makeWorld(st);
    const th = doorThresholdCells(w, st.id);
    assert.ok(th, 'threshold resolves');
    assert.equal(th.dir, wantDir, `door faces ${wantDir} (got ${th.dir})`);

    // Inside cell: a struct frame for THIS structure, resolving to the entry room.
    assert.equal(th.inside.frame, `struct:${st.id}`, 'inside is this structure\'s struct frame');
    const plan = floorPlan(st);
    const roomAtInside = roomOfStructCell(plan, th.inside.gx, th.inside.gy);
    assert.equal(roomAtInside, f.entry, 'inside cell resolves to the entry room');

    // Outside cell: a region frame, projecting to the SAME node, within threshold.
    assert.equal(th.outside.frame, 'region', 'outside is the region frame');
    assert.equal(nearestNodeToRegionCell(w.map, th.outside.gx, th.outside.gy), 'nHome',
      'outside cell still projects to the home node (no node crossing)');
    const fp = structFootprintRegionCells(w, st.id);
    const dist = Math.hypot(th.outside.gx - fp.cx, th.outside.gy - fp.cy);
    assert.ok(dist <= EXIT_TELEPORT_CELLS, `outside is within the doorstep threshold (${dist.toFixed(1)} ≤ ${EXIT_TELEPORT_CELLS})`);

    // The outside cell sits on the OUTWARD side of the DRAWN footprint (a real
    // doorstep, not inside the building): one doorstep beyond the entry room's outer
    // edge. MAP-EGRESS-1 — the doorstep is anchored on the building's DRAWN position
    // (settlementLayout), so "outward" is measured against the DRAWN footprint centre
    // (fp.cx/fp.cy above), NOT the raw node-centre + room offset (the old centre-frame
    // math that assumed every building sat at the node centre — the phantom this fix
    // retired). fp comes from structFootprintRegionCells, which is now likewise
    // drawn-anchored, so doorstep and footprint are compared in ONE frame (the screen's).
    if (wantDir === 'east') assert.ok(th.outside.gx > fp.cx, 'east doorstep is east of the drawn footprint centre');
    if (wantDir === 'west') assert.ok(th.outside.gx < fp.cx, 'west doorstep is west of the drawn footprint centre');
    if (wantDir === 'south') assert.ok(th.outside.gy > fp.cy, 'south doorstep is south of the drawn footprint centre');
    if (wantDir === 'north') assert.ok(th.outside.gy < fp.cy, 'north doorstep is north of the drawn footprint centre');
  });
}

// ── Determinism: two calls → byte-identical threshold ───────────────────────────
test('U498: doorThresholdCells is deterministic (two calls → identical)', () => {
  const st = fixtureStruct(DIR_FIXTURES.east);
  const w = makeWorld(st);
  const a = doorThresholdCells(w, st.id);
  const b = doorThresholdCells(w, st.id);
  assert.deepEqual(a, b, 'identical threshold across calls (pure, no rng)');
});

// ── doorId selects a specific room's face when supplied ─────────────────────────
test('U498: doorThresholdCells honours an explicit doorId (the room the player entered by)', () => {
  const st = fixtureStruct(DIR_FIXTURES.east);
  const w = makeWorld(st);
  // Passing the entry room id explicitly resolves the same door as the default.
  const viaDefault = doorThresholdCells(w, st.id);
  const viaEntryId = doorThresholdCells(w, st.id, DIR_FIXTURES.east.entry);
  assert.deepEqual(viaEntryId, viaDefault, 'explicit entry-room doorId matches the entry default');
  // Passing the OTHER room's id resolves that room as the doorway (inside cell there).
  const viaOther = doorThresholdCells(w, st.id, DIR_FIXTURES.east.other);
  assert.ok(viaOther, 'other-room doorId still grounds a threshold');
  const plan = floorPlan(st);
  assert.equal(roomOfStructCell(plan, viaOther.inside.gx, viaOther.inside.gy), DIR_FIXTURES.east.other,
    'the inside cell is now the room named by doorId');
});

// ── Null when the structure/plan/node can't be grounded ─────────────────────────
test('U498: doorThresholdCells returns null for an unknown structure', () => {
  const st = fixtureStruct(DIR_FIXTURES.east);
  const w = makeWorld(st);
  assert.equal(doorThresholdCells(w, 'no:such:structure'), null, 'unknown structure → null');
});

test('U498: doorThresholdCells returns null when the node has no grid coordinate', () => {
  const st = fixtureStruct(DIR_FIXTURES.east);
  const w = makeWorld(st);
  // Strip the node's integer grid coords — the region anchor can't be computed.
  w.map.nodes = w.map.nodes.map(n => n.id === 'nHome' ? { id: 'nHome', settlement: { npcs: [] } } : n);
  assert.equal(doorThresholdCells(w, st.id), null, 'ungrounded node → null (caller falls back)');
});
