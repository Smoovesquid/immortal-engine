// U365 — ROM-3 (docs/briefs/ROOM_OCCUPANCY_MODEL.md §2/§3): the judge/gate canon
// feed carried npcsPresent (the WHOLE settlement roster) and no room dimension at
// all, so a person voiced/placed in the wrong room read to the judge as
// "consistent with canon NPC" — a feed gap before a rubric gap (§1a-7: "the judge
// is structurally blind... the audit's 'gate is blind to coherence' is not a
// rubric gap first, it is a feed gap"). buildCanonGroundTruth is the ONE oracle
// shared by scripts/dm-playtest.mjs (the gate), engine/ref/index.js (the live
// Ref), and engine/harness/oracles.js — enriching it here feeds every consumer,
// and every dm-playtest.mjs JSONL turn record persists this bundle verbatim as
// `canon` (dm-playtest.mjs:536,546,593), so the gate's audit trail carries the
// room dimension on every turn without touching the gate script itself.
//
// These tests pin:
//   1. inside a structure: interior{roomId,roomName}, roomOccupants (from
//      occupantsOfRoom — may legitimately be EMPTY, per the brief's own tallow
//      wake-room example), material.shell, all present and correctly shaped.
//   2. outdoors: interior is null (no room), roomOccupants falls through to
//      outdoorOccupants (who's actually near the player, never invented),
//      material.shell is null (no structure).
//   3. purity — the derivation never mutates the world and worldHash stays
//      byte-identical (ROM's determinism contract; no WORLD_VERSION bump, no
//      engine-behavior change, matches U348's pattern for this same façade).
//   4. a minimal/no-structure world (the U242 Ref-review fixture shape) degrades
//      safely — never throws, interior:null, roomOccupants:[], material.shell:null.
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
import { occupantsOfRoom } from '../engine/structures/roomOccupancy.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

test('U365a: inside a structure — canon carries interior{roomId,roomName}, roomOccupants, material.shell', () => {
  const w = boot();
  assert.ok(w.scene?.interior?.structureKey, 'precondition: tallow boots inside a structure');
  const truth = buildCanonGroundTruth(w);

  assert.ok(truth.interior && typeof truth.interior === 'object', 'interior is present when inside');
  assert.equal(truth.interior.roomId, String(w.scene.interior.roomId), 'interior.roomId matches the engine\'s own room canon');
  assert.equal(typeof truth.interior.roomName, 'string', 'interior.roomName is a prose-ready name');
  assert.ok(truth.interior.roomName.length > 0, 'interior.roomName is non-empty');

  assert.ok(Array.isArray(truth.roomOccupants), 'roomOccupants is present and an array');
  const expected = occupantsOfRoom(w, w.scene.interior.structureKey, w.scene.interior.roomId)
    .map(p => String(p?.name || ''));
  const got = truth.roomOccupants.map(p => p.name);
  assert.deepEqual(got, expected, 'roomOccupants matches occupantsOfRoom\'s own derivation exactly (the ROM façade, not a re-derivation)');
  // The brief's own documented ground truth (§1a-1): the tallow wake room's
  // occupancy is EMPTY while npcsPresent still lists the whole 5-person roster —
  // that gap is the entire C1 bug. Pin it so a future regression (e.g. someone
  // accidentally wiring roomOccupants back to the roster) is caught here.
  assert.deepEqual(truth.roomOccupants, [], 'the tallow wake room is empty — the exact feed gap ROM-3 closes');
  assert.ok(truth.npcsPresent.length > truth.roomOccupants.length,
    'npcsPresent (settlement-wide) stays a strict superset of roomOccupants (this room) — the two axes the judge previously conflated');

  assert.ok(truth.material && typeof truth.material === 'object', 'material is present');
  assert.equal(truth.material.shell, 'timber', 'the tallow wake cottage is timber (matches U348e)');
});

test('U365b: outdoors — interior is null, roomOccupants falls through to outdoorOccupants, material.shell is null', () => {
  let w = boot();
  w = playerMove(w, PACKS, 'I step back outside').world;
  assert.equal(Boolean(w.scene?.interior), false, 'precondition: the exit gesture leaves the building');

  const truth = buildCanonGroundTruth(w);
  assert.equal(truth.interior, null, 'no room to report outdoors');
  assert.ok(Array.isArray(truth.roomOccupants), 'roomOccupants stays an array outdoors (never undefined)');
  assert.ok(truth.material && truth.material.shell === null, 'material.shell is null outdoors — no structure, no material fact');
});

test('U365c: purity — the derivation never mutates the world, and worldHash is byte-identical (ROM determinism contract)', () => {
  const w = boot();
  const before = JSON.stringify(w);
  const h0 = worldHash(w);

  const t1 = buildCanonGroundTruth(w);
  const t2 = buildCanonGroundTruth(w);
  assert.deepEqual(t1.interior, t2.interior, 'interior is deterministic — same world, same answer');
  assert.deepEqual(t1.roomOccupants, t2.roomOccupants, 'roomOccupants is deterministic');
  assert.deepEqual(t1.material, t2.material, 'material is deterministic');

  assert.equal(JSON.stringify(w), before, 'buildCanonGroundTruth never mutates the world (HARD INVARIANT 1: read-only over the world)');
  assert.equal(worldHash(w), h0, 'worldHash byte-identical — the room fields are pure reads over already-hashed inputs, no new stored state');
});

test('U365d: a minimal/no-structure world degrades safely — never throws, empty/null room fields', () => {
  // The exact fixture shape U242.refReview.test.js's tinyWorld() uses (a world
  // with no world.structures, no world.scene.interior) — buildCanonGroundTruth
  // must stay safe over it, since engine/ref/index.js's live Ref calls this
  // bundle on every narration review.
  const tiny = {
    map: { currentNodeId: 'n1', nodes: [{ id: 'n1', name: 'Test', kind: 'settlement', settlement: { npcs: [{ name: 'Mira', role: 'baker' }] } }] },
    party: [{ level: 1, wounds: 0, maxWounds: 3 }],
    ledger: { facts: [] },
    meta: {},
  };
  const truth = buildCanonGroundTruth(tiny);
  assert.equal(truth.interior, null, 'no interior on a structure-less world (never throws resolving one)');
  // No buildings exist at this node, so roomOccupancy's own derivation places
  // every NPC 'outdoors' unconditionally (roomOccupancy.js:36 — an empty
  // buildingIds list short-circuits to outdoors). roomOccupants correctly
  // mirrors that: it degrades to "everyone's outdoors", not an empty array —
  // the empty-array case is U365a's populated-but-vacant ROOM, a different fact.
  assert.ok(Array.isArray(truth.roomOccupants), 'roomOccupants degrades to an array, never throws');
  assert.deepEqual(truth.roomOccupants.map(p => p.name), ['Mira'], 'with no buildings, roomOccupancy places the NPC outdoors — consistent, not a crash');
  assert.equal(truth.material.shell, null, 'material.shell degrades to null, never throws');
  // The pre-existing fields must still work — this change must not regress them.
  assert.equal(truth.npcsPresent.length, 1, 'npcsPresent is unaffected by the room-dimension addition');
});
