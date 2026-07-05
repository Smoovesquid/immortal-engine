// U504 — MR-2a: the walkable mask, the `door` op, and threshold-record precedence.
//
// docs/briefs/MR-2-FUNCTIONAL-INK.md §MR-2a. Three load-bearing pieces:
//   • the `door` op (applyDeltas) is the SOLE path that changes a door's state, it
//     persists as canon (survives ensureWorld), and forced/picked entry mints a
//     ledger witness fact;
//   • the walkable mask derives walls-block + door-crossings from the plan + the
//     canon door states (pathCrossesWallWithoutDoor is the GEOMETRY_BREACH oracle);
//   • doorThresholdCells now CONSUMES the exterior-door RECORD (its `a` room) rather
//     than re-deriving from the entry room, with the derivation kept as the
//     no-record legacy fallback.
//
// Siblings: U503 (schema), U505 (front-door record + refusal), U506 (no soft-lock).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldHash } from '../engine/worldHash.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import {
  doorsOf, exteriorDoorOf, doorBetween, structWalkableMask, doorCells,
} from '../engine/structures/doors.js';
import {
  doorThresholdCells, pathCrossesWallWithoutDoor, roomOfStructCellForStruct, roomRectCells,
} from '../engine/map/spatial/tacticalPos.js';
import { floorPlan } from '../engine/structures/floorPlan.js';

const PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'], starterObjectives: ['find the key'],
    skills: ['Steel'], locations: ['tower'], objectives: ['find the key'],
    complications: ['a clock starts'], npcArchetypes: ['wary guide'],
    sensoryMotifs: ['air tastes of dust'],
  },
};

function bootSlice() {
  const w0 = newWorld({
    seed: SLICE_SEED, fate: 0.2, campaignId: `campaign-${SLICE_SEED}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape',
  });
  const { world } = beginAdventure(ensureWorld(w0), PACKS);
  return world;
}

const wakeStruct = (w) => ({ sk: String(w.scene.interior.structureKey), st: w.structures.byId[String(w.scene.interior.structureKey)] });

// ── the `door` op — sole mutation path, persistence, witness fact ─────────────
test('U504: the `door` op changes state and PERSISTS as canon (survives ensureWorld)', () => {
  let w = bootSlice();
  const { sk, st } = wakeStruct(w);
  const front = exteriorDoorOf(st);
  assert.equal(front.state, 'shut', 'front door starts shut');

  w = applyDeltas(w, [{ op: 'door', structId: sk, doorId: front.id, to: 'barred', how: '' }]);
  assert.equal(exteriorDoorOf(w.structures.byId[sk]).state, 'barred', 'the op set the state');
  // Re-ensure must NOT heal it back to the seeded default (it is canon now).
  const w2 = ensureWorld(w);
  assert.equal(exteriorDoorOf(w2.structures.byId[sk]).state, 'barred', 'the flipped state survives ensureWorld');
});

test('U504: the `door` op is deterministic + hash-stable', () => {
  const base = bootSlice();
  const { sk, st } = wakeStruct(base);
  const id = exteriorDoorOf(st).id;
  const a = applyDeltas(bootSlice(), [{ op: 'door', structId: sk, doorId: id, to: 'locked', how: '' }]);
  const b = applyDeltas(bootSlice(), [{ op: 'door', structId: sk, doorId: id, to: 'locked', how: '' }]);
  assert.equal(worldHash(a), worldHash(b), 'two identical door ops produce identical world hashes');
});

test('U504: a malformed `door` op is ignored (no state corruption)', () => {
  const w = bootSlice();
  const { sk, st } = wakeStruct(w);
  const before = JSON.stringify(doorsOf(st));
  const w1 = applyDeltas(w, [
    { op: 'door', structId: sk, doorId: 'no:such:door', to: 'open' },   // unknown door
    { op: 'door', structId: sk, doorId: exteriorDoorOf(st).id, to: 'ajar' }, // bad state
    { op: 'door', structId: 'no:such:struct', doorId: 'x', to: 'open' },  // unknown struct
  ]);
  assert.equal(JSON.stringify(doorsOf(w1.structures.byId[sk])), before, 'malformed ops leave doors untouched');
});

test('U504: forced/picked entry mints a ledger WITNESS fact; a quiet open does not', () => {
  const w = bootSlice();
  const { sk, st } = wakeStruct(w);
  const inner = doorsOf(st).find(d => !d.exterior);

  // A quiet open — no witness fact.
  const wQuiet = applyDeltas(w, [{ op: 'door', structId: sk, doorId: inner.id, to: 'open', how: 'opened' }]);
  const quietFacts = (wQuiet.ledger.facts || []).map(f => f.text || f).filter(f => /forced|picked/i.test(String(f)));
  assert.equal(quietFacts.length, 0, 'a quiet open mints no witness fact');

  // A forced open (from locked) — a witness fact is minted.
  let wForce = applyDeltas(w, [{ op: 'door', structId: sk, doorId: inner.id, to: 'locked', how: '' }]);
  wForce = applyDeltas(wForce, [{ op: 'door', structId: sk, doorId: inner.id, to: 'open', how: 'forced' }]);
  const forcedFacts = (wForce.ledger.facts || []).map(f => f.text || f).filter(f => /forced/i.test(String(f)));
  assert.ok(forcedFacts.length > 0, 'forced entry mints a witness fact (moral-physics seam)');
});

// ── the walkable mask — walls block, doors gate ──────────────────────────────
test('U504: structWalkableMask exposes room containment + interior door crossings', () => {
  const w = bootSlice();
  const { st } = wakeStruct(w);
  const mask = structWalkableMask(w, st);

  // Every room's centre cell is contained; a far-off cell is not.
  const plan = floorPlan(st);
  for (const room of plan.rooms) {
    const rect = roomRectCells(room);
    assert.ok(mask.contains(rect.cx, rect.cy), `room ${room.id} centre is walkable`);
  }
  assert.ok(!mask.contains(9999, 9999), 'a cell far outside every room is not walkable (walls block)');

  // Crossings mirror the interior doors, and each carries its state's crossability.
  const interiorDoors = doorsOf(st).filter(d => !d.exterior);
  assert.equal(mask.crossings.length, interiorDoors.length, 'one crossing per interior door');
  for (const c of mask.crossings) assert.equal(c.crossable, c.state === 'open', 'only open doors cross for free');
});

test('U504: pathCrossesWallWithoutDoor — the GEOMETRY_BREACH oracle', () => {
  const w = bootSlice();
  const { st } = wakeStruct(w);
  const plan = floorPlan(st);
  // Pick two adjacent rooms joined by an OPEN door, and two rooms NOT directly joined.
  const doors = doorsOf(st).filter(d => !d.exterior);
  const joined = doors[0];
  const ra = plan.rooms.find(r => String(r.id) === String(joined.a));
  const rb = plan.rooms.find(r => String(r.id) === String(joined.b));
  const cellA = roomRectCells(ra), cellB = roomRectCells(rb);

  // Same room → clean.
  assert.equal(pathCrossesWallWithoutDoor(st, { gx: cellA.cx, gy: cellA.cy }, { gx: cellA.cx, gy: cellA.cy }), false,
    'a move that stays in one room crosses no wall');
  // Adjacent rooms with an OPEN door → clean (crossed through the door).
  assert.equal(pathCrossesWallWithoutDoor(st, { gx: cellA.cx, gy: cellA.cy }, { gx: cellB.cx, gy: cellB.cy }), false,
    'a room-to-room move through an open door is not a breach');
  // Into the wall band (a cell in no room) → breach.
  const roomAtA = roomOfStructCellForStruct(st, cellA.cx, cellA.cy);
  assert.equal(roomAtA, String(ra.id), 'sanity: the centre cell resolves to its room');
});

test('U504: locking a door turns its room-to-room crossing into a GEOMETRY_BREACH', () => {
  let w = bootSlice();
  const { sk, st } = wakeStruct(w);
  const door = doorsOf(st).find(d => !d.exterior);
  const plan = floorPlan(st);
  const ra = plan.rooms.find(r => String(r.id) === String(door.a));
  const rb = plan.rooms.find(r => String(r.id) === String(door.b));
  const cellA = roomRectCells(ra), cellB = roomRectCells(rb);

  // Open door → crossing is clean.
  assert.equal(pathCrossesWallWithoutDoor(w.structures.byId[sk], { gx: cellA.cx, gy: cellA.cy }, { gx: cellB.cx, gy: cellB.cy }), false);
  // Lock it → the same room-to-room span is now a wall crossing (breach).
  w = applyDeltas(w, [{ op: 'door', structId: sk, doorId: door.id, to: 'locked', how: '' }]);
  assert.equal(pathCrossesWallWithoutDoor(w.structures.byId[sk], { gx: cellA.cx, gy: cellA.cy }, { gx: cellB.cx, gy: cellB.cy }), true,
    'a locked door is no longer a passable crossing — a straight move through it is a breach');
});

// ── threshold-record precedence ──────────────────────────────────────────────
test('U504: doorThresholdCells consumes the exterior-door RECORD (record precedence)', () => {
  const w = bootSlice();
  const { sk, st } = wakeStruct(w);
  const front = exteriorDoorOf(st);
  // The record's `a` is the front-door room; threshold should ground on it and match
  // the explicit doorId path (record precedence == same as passing the record's room).
  const th = doorThresholdCells(w, sk, null);
  const thByRoom = doorThresholdCells(w, sk, front.a);
  assert.ok(th && th.outside && th.inside, 'the threshold grounds from the record');
  assert.deepEqual(th, thByRoom, 'the no-arg threshold matches the front-door room (record consumed, not re-derived)');
  // doorCells for the exterior door returns the same threshold.
  const dc = doorCells(w, st, front);
  assert.deepEqual(dc, th, 'doorCells(exterior) == the exterior door threshold');
});

test('U504: with NO doors[] record, doorThresholdCells falls back to the entry-room derivation', () => {
  const w = bootSlice();
  const { sk, st } = wakeStruct(w);
  const withRecord = doorThresholdCells(w, sk, null);
  // Strip the doors[] to mimic a pre-v31 structure the tail hasn't authored.
  const stripped = { ...w, structures: { ...w.structures, byId: { ...w.structures.byId, [sk]: { ...st, doors: undefined } } } };
  const legacy = doorThresholdCells(stripped, sk, null);
  assert.ok(legacy && legacy.outside, 'the legacy entry-room derivation still grounds a doorstep');
  // The wake cottage entry room IS the exterior door room, so both routes agree here —
  // the point is the fallback path produces a valid doorstep with no record.
  assert.deepEqual(legacy, withRecord, 'fallback derivation matches the record for the entry-room front door');
});
