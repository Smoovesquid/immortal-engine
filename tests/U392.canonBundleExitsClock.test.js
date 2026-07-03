// U392 — CG-P4 (docs/briefs/COHERENCE_GATE.md §7 "CG-P4 — bundle enrichment:
// exits + clock"): buildCanonGroundTruth gains two READ-ONLY views the
// deliberately-dormant CG-2b (invented exit/stair/door) and CG-6 (temporal
// desync) comparators need to activate:
//
//   - roomExits — the current room's REAL compass exits (direction -> adjacent
//     room name), sourced from engine/structures/topology.js's own
//     interiorExitsFrom (the SAME reciprocal compass the live interior
//     movement code walks) + roomDetail (the SAME room-naming façade
//     getRoomState already uses for `interior.roomName`). null outside a known
//     interior.
//   - clock — the world's time-of-day, computed IDENTICALLY to the live "what
//     time is it" meta-answer (engine/grace/gracefulAdjudication.js META_TIME
//     branch), over the existing, always-present `world.time.hours` counter.
//     Never absent (defaults to day 1 morning on a fresh world).
//
// This test pins:
//   1. inside a structure with a real adjacent room: roomExits carries at
//      least one direction, each value a non-empty room name matching the
//      structure's own topology (cross-checked against interiorExitsFrom +
//      roomDetail directly, not re-derived by this test).
//   2. outdoors / no interior: roomExits is null.
//   3. clock is always present, shaped {hours, day, segment}, and its
//      `segment` is one of the five canonical buckets CG-6 compares against.
//   4. purity — the derivation never mutates the world, and worldHash stays
//      byte-identical across repeated calls (HARD INVARIANT 1 + the ROM-3/
//      U348/U365 determinism precedent this packet follows exactly).
//   5. bundle stays compact — the enrichment adds a small, bounded number of
//      characters to the serialized bundle (the judge reads this too; token
//      budget), not a second copy of the whole topology.
//   6. a minimal/no-structure world (U242/U365d's tinyWorld shape) degrades
//      safely — never throws, roomExits null, clock still present.
//
// Hermetic: pure functions over a booted world; no LLM, no network.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { buildCanonGroundTruth } from '../engine/ref/rubric.js';
import { normalizeTopology, interiorExitsFrom } from '../engine/structures/topology.js';
import { roomDetail, buildingTypeFor } from '../engine/structures/roomDetail.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

const CANON_SEGMENTS = ['the small hours', 'morning', 'afternoon', 'evening', 'deep night'];

test('U392a: inside a structure — roomExits carries real compass exits matching the structure\'s own topology', () => {
  const w = boot();
  assert.ok(w.scene?.interior?.structureKey, 'precondition: tallow boots inside a structure');

  const truth = buildCanonGroundTruth(w);
  assert.ok(truth.roomExits && typeof truth.roomExits === 'object', 'roomExits is present when inside');

  const st = w.structures.byId[w.scene.interior.structureKey];
  const topo = normalizeTopology(st?.topology);
  const type = buildingTypeFor(w.scene.interior.structureKey);
  const dirs = interiorExitsFrom(topo, w.scene.interior.roomId);
  const byId = new Map(topo.rooms.map(r => [r.id, r]));

  const expectedDirs = ['north', 'east', 'south', 'west'].filter(d => dirs[d]);
  assert.ok(expectedDirs.length > 0, 'precondition: this room has at least one real exit to check');

  for (const d of expectedDirs) {
    assert.ok(d in truth.roomExits, `roomExits carries the real "${d}" exit`);
    const expectedName = roomDetail(byId.get(dirs[d]), type)?.name;
    assert.equal(truth.roomExits[d], expectedName, `roomExits.${d} names the SAME adjacent room roomDetail resolves, not a re-derivation`);
    assert.equal(typeof truth.roomExits[d], 'string', `roomExits.${d} is a prose-ready name`);
    assert.ok(truth.roomExits[d].length > 0, `roomExits.${d} is non-empty`);
  }
  // No direction claims a room that isn't real: every key in roomExits must be
  // one of the four compass words and match interiorExitsFrom exactly.
  for (const d of Object.keys(truth.roomExits)) {
    assert.ok(['north', 'east', 'south', 'west'].includes(d), `roomExits key "${d}" is a real compass direction`);
    assert.ok(dirs[d], `roomExits.${d} corresponds to a real doorway in the topology`);
  }
});

test('U392b: outdoors — roomExits is null (no interior to report exits for)', () => {
  let w = boot();
  w = playerMove(w, PACKS, 'I step back outside').world;
  assert.equal(Boolean(w.scene?.interior), false, 'precondition: the exit gesture leaves the building');

  const truth = buildCanonGroundTruth(w);
  assert.equal(truth.roomExits, null, 'no interior room to report exits for outdoors');
});

test('U392c: clock is always present, shaped {hours, day, segment}, segment is one of the five canonical buckets', () => {
  const w = newWorld({ seed: 'aldermere' });
  const truth = buildCanonGroundTruth(w);
  assert.ok(truth.clock && typeof truth.clock === 'object', 'clock is present on a fresh world');
  assert.equal(typeof truth.clock.hours, 'number', 'clock.hours is a number');
  assert.equal(typeof truth.clock.day, 'number', 'clock.day is a number');
  assert.ok(CANON_SEGMENTS.includes(truth.clock.segment), `clock.segment "${truth.clock.segment}" is one of the five canonical buckets`);
  // A fresh world's time.hours defaults to 0 -> day 1, morning (journeys start
  // at first light per gracefulAdjudication.js's own comment).
  assert.equal(truth.clock.hours, 0);
  assert.equal(truth.clock.day, 1);
  assert.equal(truth.clock.segment, 'morning');
});

test('U392d: clock advances the SAME way the live "what time is it" answer computes it (day/segment math matches)', () => {
  const w = newWorld({ seed: 'aldermere' });
  w.time.hours = 30; // day 2, hour 6 -> "the small hours" bucket boundary check
  const truth = buildCanonGroundTruth(w);
  assert.equal(truth.clock.hours, 30);
  assert.equal(truth.clock.day, Math.floor(30 / 24) + 1, 'day math matches gracefulAdjudication.js exactly');
  const hourOfDay = (6 + (30 % 24)) % 24;
  const expectedSegment = hourOfDay < 6 ? 'the small hours' : hourOfDay < 12 ? 'morning' : hourOfDay < 17 ? 'afternoon' : hourOfDay < 21 ? 'evening' : 'deep night';
  assert.equal(truth.clock.segment, expectedSegment, 'segment bucketing matches the live meta-answer\'s own math exactly');
});

test('U392e: purity — roomExits/clock never mutate the world, and worldHash is byte-identical (HARD INVARIANT 1)', () => {
  const w = boot();
  const before = JSON.stringify(w);
  const h0 = worldHash(w);

  const t1 = buildCanonGroundTruth(w);
  const t2 = buildCanonGroundTruth(w);
  assert.deepEqual(t1.roomExits, t2.roomExits, 'roomExits is deterministic — same world, same answer');
  assert.deepEqual(t1.clock, t2.clock, 'clock is deterministic');

  assert.equal(JSON.stringify(w), before, 'buildCanonGroundTruth never mutates the world (HARD INVARIANT 1: read-only over the world)');
  assert.equal(worldHash(w), h0, 'worldHash byte-identical — roomExits/clock are pure reads over already-hashed inputs, no new stored state, no WORLD_VERSION bump');
});

test('U392f: bundle stays compact — the enrichment adds a small, bounded number of characters', () => {
  const w = boot();
  const truth = buildCanonGroundTruth(w);
  const { roomExits, clock, ...rest } = truth;
  const beforeSize = JSON.stringify(rest).length;
  const afterSize = JSON.stringify(truth).length;
  const delta = afterSize - beforeSize;
  assert.ok(delta > 0, 'the two new fields do add SOME bytes (they are genuinely present)');
  // Generous but real ceiling: a handful of directions + a compact clock
  // object, not a second copy of the room graph or a prose paragraph.
  assert.ok(delta < 400, `bundle growth from CG-P4 should be small — got +${delta} chars (before ${beforeSize}, after ${afterSize})`);
});

test('U392g: a minimal/no-structure world degrades safely — never throws, roomExits null, clock still present', () => {
  // The exact fixture shape U242.refReview.test.js's tinyWorld() / U365d uses.
  const tiny = {
    map: { currentNodeId: 'n1', nodes: [{ id: 'n1', name: 'Test', kind: 'settlement', settlement: { npcs: [{ name: 'Mira', role: 'baker' }] } }] },
    party: [{ level: 1, wounds: 0, maxWounds: 3 }],
    ledger: { facts: [] },
    meta: {},
  };
  const truth = buildCanonGroundTruth(tiny);
  assert.equal(truth.roomExits, null, 'no interior on a structure-less world — never throws resolving exits');
  assert.ok(truth.clock && typeof truth.clock === 'object', 'clock still computed even with no world.time at all');
  assert.equal(truth.clock.hours, 0, 'missing world.time.hours degrades to 0, never throws');
  assert.equal(truth.clock.segment, 'morning', 'degrades to the day-1 default segment');
  // Pre-existing fields must still work — this change must not regress them.
  assert.equal(truth.npcsPresent.length, 1, 'npcsPresent is unaffected by the CG-P4 addition');
});
