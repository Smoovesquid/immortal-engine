// U430 — FP-1 pos survival: a save whose tactical `pos` was seeded under the OLD
// (padded-and-corridored) floor-plan geometry must load through ensureWorld WITHOUT
// throwing, and the player's pos must end up in the SAME room scene.interior names —
// re-derived into that room's NEW rect when the stored cell has gone stale
// (docs/briefs/FP-1-proper-floorplans.md, §"load-bearing interplay").
//
// TAC-1 seeds `pos` into floorPlan room rects (engine/map/spatial/tacticalPos.js)
// and engine/invariants.js asserts roomOf(pos) consistency. FP-1 moved the walls, so
// the room rects moved. The least-destructive repair already lives in ensureWorld's
// backfill: a stored pos that is still consistent is kept, a stale one is re-derived
// into the correct room's new rect. This test proves old-geometry positions survive
// that repair (never throw), and that fresh seeding + replay stay deterministic with
// pos in the hash.
//
// Pure, deterministic, read-only fixtures — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { ensureWorld, newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { worldHash } from '../engine/worldHash.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { roomRectCells, roomOfStructCell } from '../engine/map/spatial/tacticalPos.js';
import { buildPreRolledCharacter } from '../engine/chargen/preRolled.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();

// The exact live indoor boot (mirrors U412's bootIndoors): a pre-rolled hero dropped
// INSIDE the wake room of the Aldermere slice.
function bootIndoors(seed = SLICE_SEED) {
  const pc = buildPreRolledCharacter({ id: 'bryn' });
  const w0 = newWorld({ seed, fate: 0.2, campaignId: `campaign-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const w1 = ensureWorld({ ...w0, party: [pc] });
  return beginAdventure(w1, PACKS).world;
}

// Deep clone so a fixture edit can't leak back into a shared object.
const clone = (x) => JSON.parse(JSON.stringify(x));

test('U430-01: precondition — the indoor boot places the player in a struct frame inside a multi-room building', () => {
  const w = bootIndoors();
  const p = w.party[0].pos;
  assert.ok(p && /^struct:/.test(String(p.frame)), `boot is indoors → struct pos (got ${p && p.frame})`);
  const st = w.structures.byId[String(w.scene.interior.structureKey)];
  assert.ok(floorPlan(st).rooms.length >= 2, 'the wake building has multiple rooms');
});

test('U430-02: an OLD-geometry pos (a cell that lands in a DIFFERENT room now) loads without throwing and re-derives into the room scene.interior names', () => {
  const w = bootIndoors();
  const structId = String(w.scene.interior.structureKey);
  const roomId = String(w.scene.interior.roomId);
  const st = w.structures.byId[structId];
  const fp = floorPlan(st);

  // Simulate a pos seeded under the OLD layout: put the player's cell squarely in
  // some OTHER room's current rect (the kind of drift moving the walls produces —
  // the old cell now belongs to a different room). ensureWorld must NOT throw; the
  // backfill must re-derive the pos back into the scene's room.
  const otherRoom = fp.rooms.find(r => String(r.id) !== roomId);
  assert.ok(otherRoom, 'a second room exists to drift into');
  const rect = roomRectCells(otherRoom);
  const drifted = { frame: `struct:${structId}`, gx: rect.cx, gy: rect.cy };
  // Sanity: the drifted cell really is in the OTHER room under current geometry.
  assert.equal(roomOfStructCell(fp, drifted.gx, drifted.gy), String(otherRoom.id), 'the drifted cell lands in the other room');

  const staged = clone(w);
  staged.party[0].pos = drifted;

  let healed;
  assert.doesNotThrow(() => { healed = ensureWorld(staged); }, 'an old-geometry pos must load through ensureWorld without throwing');
  const hp = healed.party[0].pos;
  assert.ok(hp && /^struct:/.test(String(hp.frame)), 'player still has a struct pos after repair');
  const healedRoom = roomOfStructCell(floorPlan(healed.structures.byId[structId]), hp.gx, hp.gy);
  assert.equal(healedRoom, roomId, 'the repaired pos lands in the SAME room scene.interior names');
});

test('U430-03: an OLD-geometry pos stranded in the new wall band (in NO room) also heals without throwing', () => {
  const w = bootIndoors();
  const structId = String(w.scene.interior.structureKey);
  const roomId = String(w.scene.interior.roomId);
  const st = w.structures.byId[structId];
  const fp = floorPlan(st);

  // Find a cell that lands in NO room under the new geometry (the reserved wall band
  // between two abutting rooms — exactly where an old padded-layout cell could fall).
  // Scan the footprint's cell span for an empty cell adjacent to the scene room.
  const room = fp.rooms.find(r => String(r.id) === roomId) || fp.rooms[0];
  const rc = roomRectCells(room);
  let wallCell = null;
  for (const [gx, gy] of [
    [rc.maxX + 1, rc.cy], [rc.minX - 1, rc.cy], [rc.cx, rc.maxY + 1], [rc.cx, rc.minY - 1]
  ]) {
    if (roomOfStructCell(fp, gx, gy) === '') { wallCell = { gx, gy }; break; }
  }
  // Some tiny plans may fully tile with no reachable empty cell adjacent — only run
  // the assertion when a genuine wall cell exists (else the case is vacuously safe).
  if (!wallCell) { assert.ok(true, 'no wall-band cell adjacent (fully tiled) — nothing to strand'); return; }

  const staged = clone(w);
  staged.party[0].pos = { frame: `struct:${structId}`, gx: wallCell.gx, gy: wallCell.gy };
  let healed;
  assert.doesNotThrow(() => { healed = ensureWorld(staged); }, 'a wall-band pos must heal without throwing');
  const hp = healed.party[0].pos;
  const healedRoom = roomOfStructCell(floorPlan(healed.structures.byId[structId]), hp.gx, hp.gy);
  assert.equal(healedRoom, roomId, 'the repaired pos lands back in the scene room');
});

test('U430-04: fresh seeding is deterministic — two boots of the same seed place every entity identically and hash identically', () => {
  const a = bootIndoors();
  const b = bootIndoors();
  assert.equal(worldHash(a), worldHash(b), 'two fresh boots of the same seed hash identically (pos is in the hash)');
  assert.equal(JSON.stringify(a.party[0].pos), JSON.stringify(b.party[0].pos), 'player pos identical across fresh boots');
});

test('U430-05: replay stays green with pos in the hash — a healed world re-ensures to a byte-identical, invariant-clean world', () => {
  const w = bootIndoors();
  const structId = String(w.scene.interior.structureKey);
  const otherRoom = floorPlan(w.structures.byId[structId]).rooms.find(r => String(r.id) !== String(w.scene.interior.roomId));
  const rect = roomRectCells(otherRoom);
  const staged = clone(w);
  staged.party[0].pos = { frame: `struct:${structId}`, gx: rect.cx, gy: rect.cy };

  const healed = ensureWorld(staged);
  assert.doesNotThrow(() => assertWorldInvariants(healed), 'the healed world is invariant-clean');
  // Idempotent: re-ensuring the healed world changes nothing (replay stability).
  const again = ensureWorld(healed);
  assert.equal(worldHash(again), worldHash(healed), 're-ensuring a healed world is byte-identical (replay-stable)');
});
