// U547 — FURN-1: the position probe grows a FURNITURE_BLOCK assertion.
//
// docs/MAP_REAL.md promise 1 + docs/PACKETS.md FURN-1. The position-truth probe
// (scripts/positionProbe.mjs, wired into `npm run check` via playtest:position) now
// asserts a committed struct-frame pos never sits ON a furniture cell — the machine
// witness for "nobody stands inside the bed". This test proves the assertion helper
// does its job on fixtures AND that the real boot-and-transition sequence runs CLEAN
// of furniture findings, byte-deterministically.
//
//   1. The helper FLAGS a body parked on a furniture cell (a synthetic world whose
//      player pos is forced onto the wake bed's cell), and is SILENT on a free cell.
//   2. The real runSequence produces ZERO FURNITURE_BLOCK findings (the seeded wake +
//      re-enter + interior-move all land the body on free cells).
//   3. The probe is byte-deterministic: two runs → identical findings (incl. the new
//      class), so wiring it into `npm run check` keeps the check reproducible.
//
// Sibling: U496 (probe assertion helpers on fixtures), U497 (the real sequence).
// Hermetic — no network, no API key, LLM off.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  runSequence, bootSlice, playerPos,
  assertStructPosNotOnFurniture, FINDING_CLASSES,
} from '../scripts/positionProbe.mjs';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { structCellFree, roomRectCells } from '../engine/map/spatial/tacticalPos.js';

// The wake structure + its wake room, for building furniture-cell fixtures.
function wakeStructAndRoom(world) {
  const interior = world.scene.interior;
  const st = world.structures.byId[String(interior.structureKey)];
  const plan = floorPlan(st);
  const room = plan.rooms.find(r => String(r.id) === String(interior.roomId));
  return { st, plan, room };
}

// A struct cell of the wake structure that IS a furniture cell (not free), searched
// across every room's rect. Returns { structId, gx, gy } or null.
function aFurnitureCell(world) {
  const { st, plan } = wakeStructAndRoom(world);
  for (const room of plan.rooms) {
    const rect = roomRectCells(room);
    if (!rect) continue;
    for (let gy = rect.minY; gy <= rect.maxY; gy++) {
      for (let gx = rect.minX; gx <= rect.maxX; gx++) {
        if (!structCellFree(st, gx, gy)) return { structId: String(st.id), gx, gy };
      }
    }
  }
  return null;
}

// Place the player's pos at a struct cell (a synthetic edit — the probe reads pos).
function withPlayerAt(world, structId, gx, gy) {
  const party = world.party.slice();
  party[0] = { ...party[0], pos: { frame: `struct:${structId}`, gx, gy } };
  return { ...world, party };
}

// ── 1. the helper flags a body on furniture, and is silent on a free cell ──────
test('U547: assertStructPosNotOnFurniture FLAGS a body parked on a furniture cell', () => {
  const world = bootSlice();
  const furn = aFurnitureCell(world);
  assert.ok(furn, 'precondition: the wake structure has at least one furniture cell');
  const bad = withPlayerAt(world, furn.structId, furn.gx, furn.gy);
  const findings = assertStructPosNotOnFurniture(bad, 'test');
  assert.equal(findings.length, 1, `a body on a furniture cell should produce exactly one finding; got ${JSON.stringify(findings)}`);
  assert.equal(findings[0].class, 'FURNITURE_BLOCK', 'the finding is a FURNITURE_BLOCK');
});

test('U547: assertStructPosNotOnFurniture is SILENT when the body is on a free cell', () => {
  const world = bootSlice();
  // The real seeded wake pos is furniture-free after the fix.
  const findings = assertStructPosNotOnFurniture(world, 'test');
  assert.deepEqual(findings, [], `a free wake cell should produce no findings; got ${JSON.stringify(findings)}`);
  // And an explicitly free cell of the wake structure is silent too.
  const { st, plan } = wakeStructAndRoom(world);
  let freeCell = null;
  for (const room of plan.rooms) {
    const rect = roomRectCells(room);
    if (!rect) continue;
    for (let gy = rect.minY; gy <= rect.maxY && !freeCell; gy++)
      for (let gx = rect.minX; gx <= rect.maxX && !freeCell; gx++)
        if (structCellFree(st, gx, gy)) freeCell = { gx, gy };
    if (freeCell) break;
  }
  assert.ok(freeCell, 'the wake structure has at least one free cell');
  const onFree = withPlayerAt(world, String(st.id), freeCell.gx, freeCell.gy);
  assert.deepEqual(assertStructPosNotOnFurniture(onFree, 'test'), [], 'a free cell must not be flagged');
});

test('U547: a non-struct (outdoor / absent) pos is skipped by the furniture check', () => {
  const world = bootSlice();
  const outdoors = { ...world, party: [{ ...world.party[0], pos: { frame: 'region', gx: 0, gy: 0 } }] };
  assert.deepEqual(assertStructPosNotOnFurniture(outdoors, 'test'), [], 'an outdoor pos is a different mask — skip');
});

// ── 2. the real sequence runs CLEAN of furniture findings ──────────────────────
test('U547: runSequence produces ZERO FURNITURE_BLOCK findings (wake/re-enter/interior-move land free)', () => {
  const r = runSequence();
  const furnFindings = r.findings.filter(f => f.class === 'FURNITURE_BLOCK');
  assert.deepEqual(furnFindings, [], `the sequence put a body on furniture: ${JSON.stringify(furnFindings)}`);
});

test('U547: FURNITURE_BLOCK is a registered finding class in the probe', () => {
  assert.ok('FURNITURE_BLOCK' in FINDING_CLASSES, 'FURNITURE_BLOCK must be a named finding class');
  assert.match(FINDING_CLASSES.FURNITURE_BLOCK, /furniture/i, 'the class description mentions furniture');
});

// ── 3. the probe is byte-deterministic (safe to wire into `npm run check`) ─────
test('U547: two runSequence runs produce byte-identical findings (probe determinism)', () => {
  const a = runSequence();
  const b = runSequence();
  assert.deepEqual(a.findings, b.findings, 'the probe findings diverged across two runs');
  // And specifically the furniture class is stable across runs.
  const furn = (res) => res.findings.filter(f => f.class === 'FURNITURE_BLOCK');
  assert.deepEqual(furn(a), furn(b), 'FURNITURE_BLOCK findings diverged across runs');
});
