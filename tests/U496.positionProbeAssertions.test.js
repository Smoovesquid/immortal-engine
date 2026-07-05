// U496 — MR-ORACLE: the position-probe assertion helpers can SEE.
//
// Proves the oracle's assertion helpers (scripts/positionProbe.mjs) flag a
// violating world and pass a clean one, on hand-built SYNTHETIC fixtures where
// the test controls the body's position exactly. This is the "can the oracle
// see?" guarantee — it must hold GREEN forever, independent of the live engine's
// current (buggy) exit path. The known-red LIVE behaviour is exercised by the
// probe's runtime output (npm run playtest:position), not by a committed test.
//
// docs/MAP_REAL.md stage 0 (MR-ORACLE). Sibling: U497 (real boot sequence).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  structFootprintRegionCells,
  assertWakeInsideRoom,
  assertExitOnDoorstep,
  assertRegionAtNode,
  assertInteriorMoveAdjacent,
  DOORSTEP_MARGIN_CELLS,
  EXIT_TELEPORT_CELLS,
  FINDING_CLASSES,
} from '../scripts/positionProbe.mjs';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { roomRectCells, nodeGridToRegionCell } from '../engine/map/spatial/tacticalPos.js';

// ── Synthetic fixture — a minimal two-room cottage at the home node (grid 0,0) ──
// floorPlan() computes the real room geometry from this topology; the helpers then
// resolve footprint/room math against that plan exactly as they do for the live
// slice. Nothing here is Math.random; nothing is hashed.
const COTTAGE = {
  id: 'synth:cottage:1',
  nodeId: 'nHome',
  buildingType: 'cottage',
  topology: {
    kind: 'rooms',
    rooms: [{ id: 'r1', tags: ['entry'] }, { id: 'r2', tags: ['bedroom'] }],
    edges: [{ a: 'r1', b: 'r2' }],
  },
};

// A second, DISCONNECTED room to test TOPOLOGY_BREACH (no edge to r1/r2).
const COTTAGE_WITH_ISLAND = {
  ...COTTAGE,
  id: 'synth:cottage:2',
  topology: {
    kind: 'rooms',
    rooms: [{ id: 'r1', tags: ['entry'] }, { id: 'r2', tags: ['bedroom'] }, { id: 'r3', tags: ['cellar'] }],
    edges: [{ a: 'r1', b: 'r2' }], // r3 is reachable by NO door
  },
};

function makeWorld(structure, { pos = null, interior = null } = {}) {
  return {
    meta: { seed: 'synth' },
    party: [{ id: 'party', pos }],
    scene: interior ? { interior } : {},
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

// Convenience: the struct-frame pos at a room's centre cell (inside the room).
function posInRoom(structure, roomId) {
  const plan = floorPlan(structure);
  const rect = roomRectCells(plan.rooms.find(r => String(r.id) === roomId));
  return { frame: `struct:${structure.id}`, gx: rect.cx, gy: rect.cy };
}

// ─────────────────────────────────────────────────────────────────────────────
test('U496: the finding classes are the MR-ORACLE classes (incl. MR-2a GEOMETRY_BREACH)', () => {
  assert.deepEqual(Object.keys(FINDING_CLASSES).sort(), ['GEOMETRY_BREACH', 'POSITION_DESYNC', 'TOPOLOGY_BREACH']);
  assert.ok(EXIT_TELEPORT_CELLS > DOORSTEP_MARGIN_CELLS, 'teleport threshold is looser than the doorstep margin');
});

test('U496: structFootprintRegionCells grounds a synthetic cottage into region cells', () => {
  const w = makeWorld(COTTAGE);
  const fp = structFootprintRegionCells(w, COTTAGE.id);
  assert.ok(fp, 'footprint resolves');
  const centre = nodeGridToRegionCell(0, 0);
  // Home node at grid (0,0) → region-cell centre (0,0); the cottage sits near it.
  assert.ok(Math.abs(fp.cx - centre.gx) < 50 && Math.abs(fp.cy - centre.gy) < 50, 'footprint centre is near the node centre');
  assert.ok(fp.halfW > 0 && fp.halfH > 0, 'footprint has positive extent');
});

// ── WAKE: inside the room passes; wrong frame / no interior / wrong cell fails ──
test('U496: assertWakeInsideRoom PASSES when the body is inside the wake room', () => {
  const w = makeWorld(COTTAGE, {
    interior: { structureKey: COTTAGE.id, roomId: 'r2', visited: ['r1', 'r2'] },
    pos: posInRoom(COTTAGE, 'r2'),
  });
  assert.deepEqual(assertWakeInsideRoom(w), [], 'no findings — body is inside the wake room');
});

test('U496: assertWakeInsideRoom FLAGS a region-frame pos while scene says indoors', () => {
  const w = makeWorld(COTTAGE, {
    interior: { structureKey: COTTAGE.id, roomId: 'r2', visited: ['r2'] },
    pos: { frame: 'region', gx: 0, gy: 0 }, // outdoors, but scene.interior is set → desync
  });
  const f = assertWakeInsideRoom(w);
  assert.equal(f.length, 1);
  assert.equal(f[0].class, 'POSITION_DESYNC');
  assert.match(f[0].detail, /body not inside the wake structure/);
});

test('U496: assertWakeInsideRoom FLAGS a struct cell that lands in no room (inside walls)', () => {
  const w = makeWorld(COTTAGE, {
    interior: { structureKey: COTTAGE.id, roomId: 'r2', visited: ['r2'] },
    pos: { frame: `struct:${COTTAGE.id}`, gx: 9999, gy: 9999 }, // valid frame, cell in no room
  });
  const f = assertWakeInsideRoom(w);
  assert.equal(f.length, 1);
  assert.match(f[0].detail, /resolves to no room|inside walls/);
});

// ── EXIT: a doorstep pos passes; a far teleport fails (THE live bug's shape) ──
test('U496: assertExitOnDoorstep PASSES when the body is just outside the footprint', () => {
  const base = makeWorld(COTTAGE);
  const fp = structFootprintRegionCells(base, COTTAGE.id);
  // Stand just past the east wall, within the doorstep margin.
  const doorstep = { frame: 'region', gx: Math.round(fp.cx + fp.halfW + 2), gy: Math.round(fp.cy) };
  const w = makeWorld(COTTAGE, { pos: doorstep });
  assert.deepEqual(assertExitOnDoorstep(w, COTTAGE.id), [], 'no findings — body is on the doorstep');
});

test('U496: assertExitOnDoorstep FLAGS a teleport far from the exited structure (the 235-ft bug shape)', () => {
  const base = makeWorld(COTTAGE);
  const fp = structFootprintRegionCells(base, COTTAGE.id);
  // Reproduce the live shape: a region cell ~47 cells from the footprint centre.
  const teleported = { frame: 'region', gx: Math.round(fp.cx - 42), gy: Math.round(fp.cy + 21) };
  const w = makeWorld(COTTAGE, { pos: teleported });
  const f = assertExitOnDoorstep(w, COTTAGE.id);
  assert.equal(f.length, 1);
  assert.equal(f[0].class, 'POSITION_DESYNC');
  assert.match(f[0].detail, /teleport, not a doorstep/);
});

test('U496: assertExitOnDoorstep FLAGS when exit left the body indoors (wrong frame)', () => {
  const w = makeWorld(COTTAGE, { pos: posInRoom(COTTAGE, 'r1') }); // still a struct frame
  const f = assertExitOnDoorstep(w, COTTAGE.id);
  assert.equal(f.length, 1);
  assert.match(f[0].detail, /did not return the body to the outdoors/);
});

test('U496: assertExitOnDoorstep FLAGS when the doorstep pos projects to a different node', () => {
  // Put the "exit" cell at the far node's centre (1000 cells east) — a node crossing.
  const farCentre = nodeGridToRegionCell(5, 0);
  const w = makeWorld(COTTAGE, { pos: { frame: 'region', gx: farCentre.gx, gy: farCentre.gy } });
  const f = assertExitOnDoorstep(w, COTTAGE.id);
  // Both the node-cross AND the teleport-distance fire; assert the node-cross is present.
  assert.ok(f.some(x => /projects to node/.test(x.detail)), 'flags the node crossing');
  assert.ok(f.every(x => x.class === 'POSITION_DESYNC'));
});

// ── REGION: a cell at the node passes; a cell that projects elsewhere fails ──
test('U496: assertRegionAtNode PASSES for a cell at the current node, is silent for interior frames', () => {
  const atHome = makeWorld(COTTAGE, { pos: { frame: 'region', gx: 3, gy: 2 } });
  assert.deepEqual(assertRegionAtNode(atHome), [], 'no findings — cell projects to the home node');
  const indoors = makeWorld(COTTAGE, { pos: posInRoom(COTTAGE, 'r1') });
  assert.deepEqual(assertRegionAtNode(indoors), [], 'silent — an interior pos is a different check');
});

test('U496: assertRegionAtNode FLAGS a cell that projects to the wrong node', () => {
  const farCentre = nodeGridToRegionCell(5, 0);
  const w = makeWorld(COTTAGE, { pos: { frame: 'region', gx: farCentre.gx, gy: farCentre.gy } });
  const f = assertRegionAtNode(w, 'nHome');
  assert.equal(f.length, 1);
  assert.match(f[0].detail, /projects to node nFar, expected nHome/);
});

// ── TOPOLOGY_BREACH: an adjacent move passes; a jump to a disconnected room fails ──
test('U496: assertInteriorMoveAdjacent PASSES for a door-adjacent move', () => {
  const w = makeWorld(COTTAGE);
  assert.deepEqual(assertInteriorMoveAdjacent(w, COTTAGE.id, 'r1', 'r2'), [], 'r1→r2 shares a door');
});

test('U496: assertInteriorMoveAdjacent FLAGS a jump to a room with no connecting door', () => {
  const w = makeWorld(COTTAGE_WITH_ISLAND);
  const f = assertInteriorMoveAdjacent(w, COTTAGE_WITH_ISLAND.id, 'r1', 'r3');
  assert.equal(f.length, 1);
  assert.equal(f[0].class, 'TOPOLOGY_BREACH');
  assert.match(f[0].detail, /not adjacent-by-door/);
});

test('U496: assertInteriorMoveAdjacent is silent for a same-room no-op', () => {
  const w = makeWorld(COTTAGE);
  assert.deepEqual(assertInteriorMoveAdjacent(w, COTTAGE.id, 'r1', 'r1'), []);
});
