// U501 — MR-1b: the frame transform, unit-tested against doorThresholdCells.
//
// docs/POSITION_AS_CANON.md §6: "worldSpace.js grows frame transforms:
// {frame,gx,gy} -> {wx,wy} = frame origin + cell x CELL_WU." MR-1b's read side
// (public/map/placeFromNode.js, the village-scatter renderer) needs the SAME
// transform in PLACE-UNIT space rather than world-unit space, since that
// renderer's whole village layout lives in its own independently-seeded
// place-unit frame (no shared wu lattice). structCellToPlaceUnit
// (public/map/worldSpace.js) is that place-unit sibling — factored out of the
// existing structCellToWu (TAC-4) so both output spaces share ONE pinned cell
// math, never a second conversion.
//
// This proves, for a struct-frame cell:
//   • the transform lands INSIDE the correct room's place-unit rect, for a door
//     facing each of the four cardinals (mirrors U498's DIR_FIXTURES exactly —
//     same synthetic structures, so the SAME geometry is proven in both spaces);
//   • structCellToPlaceUnit and structCellToWu agree (one cell math, two spaces:
//     the wu result equals the place-unit result pushed through placeUnitToWu);
//   • the transform is pure + deterministic (two calls -> identical);
//   • it degrades sanely (null anchor -> building sits at its own origin; null
//     frame/anchor never throws).
//
// Hermetic — no engine boot, no network, no API key. Pure geometry over
// synthetic structures (the same fixtures U498 already proved doorThresholdCells
// against), so a failure here points at the transform itself, not fixture noise.

import test from 'node:test';
import assert from 'node:assert/strict';

import { doorThresholdCells, roomOfStructCell, roomRectCells, PLACE_WU as TAC_PLACE_WU } from '../engine/map/spatial/tacticalPos.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import {
  structCellToPlaceUnit, structCellToWu, placeUnitToWu,
} from '../public/map/worldSpace.js';

// A minimal world holding one structure at the home node (grid 0,0). Identical
// shape to U498's fixture — same door-direction geometry, so this test proves the
// RENDERER's projection of the SAME cells U498 already proved the engine grounds.
function makeWorld(structure) {
  return {
    meta: { seed: 'synth' },
    party: [{ id: 'party', pos: null }],
    scene: {},
    structures: { byId: { [structure.id]: structure } },
    map: {
      currentNodeId: structure.nodeId,
      nodes: [{ id: 'nHome', x: 0, y: 0, settlement: { npcs: [] } }],
    },
  };
}

// Reused verbatim from U498 — these four id sets are chosen so the seed-derived
// interior compass puts the entry room's door on a KNOWN outward face.
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

// A room's place-unit rect, footprint-centered at `anchor` — the SAME convention
// structCellToPlaceUnit/interiorRoomToPlaceUnit use (building world rect centered
// at anchor). Independent of the function under test (computed straight from the
// plan's own room.cx/cy/w/h and footprint), so this is a real cross-check.
function roomPlaceUnitRect(anchor, plan, roomId) {
  const room = plan.rooms.find(r => String(r.id) === String(roomId));
  const rw = (room.w || (room.r || 0) * 2) / 2, rh = (room.h || (room.r || 0) * 2) / 2;
  const fw = plan.footprint.w, fh = plan.footprint.h;
  const cx = anchor.ox + (room.cx - fw / 2), cy = anchor.oy + (room.cy - fh / 2);
  return { minX: cx - rw, maxX: cx + rw, minY: cy - rh, maxY: cy + rh };
}

// ── For a door facing each cardinal: the INSIDE cell (doorThresholdCells) projects
// ── into the entry room's place-unit rect ────────────────────────────────────────
for (const [wantDir, f] of Object.entries(DIR_FIXTURES)) {
  test(`U501: structCellToPlaceUnit lands the ${wantDir}-door's inside cell inside the entry room's place-unit rect`, () => {
    const st = fixtureStruct(f);
    const w = makeWorld(st);
    const th = doorThresholdCells(w, st.id);
    assert.ok(th, 'threshold resolves');
    assert.equal(th.dir, wantDir);

    const plan = floorPlan(st);
    // An arbitrary anchor (a building doesn't have to sit at the village origin) —
    // proves the transform actually USES the anchor, not a hardcoded (0,0).
    const anchor = { ox: 12.5, oy: -4.25 };
    const u = structCellToPlaceUnit(anchor, plan, th.inside.gx, th.inside.gy);
    assert.ok(Number.isFinite(u.ux) && Number.isFinite(u.uy), 'produces finite place-units');

    const rect = roomPlaceUnitRect(anchor, plan, roomOfStructCell(plan, th.inside.gx, th.inside.gy));
    assert.ok(u.ux >= rect.minX - 1e-9 && u.ux <= rect.maxX + 1e-9, `ux ${u.ux} within room X [${rect.minX}, ${rect.maxX}]`);
    assert.ok(u.uy >= rect.minY - 1e-9 && u.uy <= rect.maxY + 1e-9, `uy ${u.uy} within room Y [${rect.minY}, ${rect.maxY}]`);

    // The inside cell resolves to the entry room by construction (U498 already
    // proves this against the engine's own geometry) — reconfirm here so this
    // test is self-contained if U498's fixture ever drifts.
    assert.equal(roomOfStructCell(plan, th.inside.gx, th.inside.gy), f.entry);
  });
}

// ── structCellToPlaceUnit and structCellToWu agree: one cell math, two spaces ───
test('U501: structCellToPlaceUnit and structCellToWu agree (place-unit pushed through placeUnitToWu == the wu result)', () => {
  const st = fixtureStruct(DIR_FIXTURES.east);
  const w = makeWorld(st);
  const plan = floorPlan(st);
  const th = doorThresholdCells(w, st.id);
  const anchor = { ox: 3, oy: 7 };
  const node = { x: 0, y: 0 };
  const frame = { cx: 0, cy: 0 }; // degenerate village frame (no settlement layout)

  const u = structCellToPlaceUnit(anchor, plan, th.inside.gx, th.inside.gy);
  const viaPlaceUnit = placeUnitToWu(node, frame, u.ux, u.uy);
  const viaWu = structCellToWu(node, frame, anchor, plan, th.inside.gx, th.inside.gy);

  assert.ok(Math.abs(viaPlaceUnit.x - viaWu.wx) < 1e-9, `wx agrees (${viaPlaceUnit.x} vs ${viaWu.wx})`);
  assert.ok(Math.abs(viaPlaceUnit.y - viaWu.wy) < 1e-9, `wy agrees (${viaPlaceUnit.y} vs ${viaWu.wy})`);
});

// ── Determinism: two calls -> identical ──────────────────────────────────────────
test('U501: structCellToPlaceUnit is deterministic (two calls -> identical)', () => {
  const st = fixtureStruct(DIR_FIXTURES.south);
  const plan = floorPlan(st);
  const anchor = { ox: -2, oy: 9 };
  const a = structCellToPlaceUnit(anchor, plan, 5, -3);
  const b = structCellToPlaceUnit(anchor, plan, 5, -3);
  assert.deepEqual(a, b);
});

// ── Cell scale: PLACE_WU cells (worldSpace.js) matches TAC-1's own PLACE_WU ──────
test('U501: worldSpace.js re-derives PLACE_WU from tacticalPos.js — one pinned constant, not two', () => {
  // A cell one PLACE_WU away (== exactly one layout unit) must be exactly 1.0 lu
  // from the origin cell — proves TAC_CELLS_PER_LAYOUT_UNIT (imported read-only
  // from tacticalPos.js) is wired, not a second hardcoded scale.
  const st = fixtureStruct(DIR_FIXTURES.east);
  const plan = floorPlan(st);
  const anchor = { ox: 0, oy: 0 };
  const fw = plan.footprint.w, fh = plan.footprint.h;
  const origin = structCellToPlaceUnit(anchor, plan, 0, 0);
  const oneUnitOver = structCellToPlaceUnit(anchor, plan, TAC_PLACE_WU, 0);
  assert.ok(Math.abs((oneUnitOver.ux - origin.ux) - 1) < 1e-9,
    `${TAC_PLACE_WU} cells (one layout unit) of x maps to exactly 1.0 place-unit (got ${oneUnitOver.ux - origin.ux})`);
  void fw; void fh;
});

// ── Degrades sanely: null anchor -> building sits at its own footprint origin ────
test('U501: structCellToPlaceUnit tolerates a null/missing anchor (degrades to 0,0 origin)', () => {
  const st = fixtureStruct(DIR_FIXTURES.west);
  const plan = floorPlan(st);
  const withNull = structCellToPlaceUnit(null, plan, 4, -2);
  const withZero = structCellToPlaceUnit({ ox: 0, oy: 0 }, plan, 4, -2);
  assert.deepEqual(withNull, withZero, 'null anchor behaves exactly like {ox:0,oy:0}');
});
