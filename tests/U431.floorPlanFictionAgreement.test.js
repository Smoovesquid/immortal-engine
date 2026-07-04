// U431 — FP-1 fiction agreement: the drawn floorplan and the DM's words describe the
// SAME doorways (docs/briefs/FP-1-proper-floorplans.md). The map may never show a
// doorway movement can't take, nor hide one it can — so for the room the player is in,
// the count of drawn door-gaps equals the topology's exit count for that room, which
// is exactly the set getRoomState/movement reads. What you see and what the DM says
// are one thing.
//
// The whole point of the packet: the fiction already behaved correctly ("you step
// through into the pantry", "a doorway leading deeper in"); only the geometry lied
// (padded voids bridged by corridors). This proves they now agree at the seam.
//
// Pure, deterministic, read-only — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { adjacentRooms, interiorExitsFrom } from '../engine/structures/topology.js';
import { getRoomState } from '../engine/structures/roomState.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const bootTallow = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

// Count the drawn door-gaps touching a room in the floor plan.
function drawnDoorsForRoom(fp, roomId) {
  return fp.doors.filter(d => String(d.a) === String(roomId) || String(d.b) === String(roomId)).length;
}

test('U431-A: the drawn door-gaps for the CURRENT room equal the room\'s topology exits — the map hides no walkable doorway and invents none', () => {
  const w = bootTallow();
  const st = w.structures.byId[String(w.scene.interior.structureKey)];
  const fp = floorPlan(st);
  const roomId = String(w.scene.interior.roomId);

  const drawn = drawnDoorsForRoom(fp, roomId);
  const exits = adjacentRooms(st.topology, roomId).length;
  assert.equal(drawn, exits, `drawn door-gaps (${drawn}) must equal topology exits (${exits}) for the current room`);
});

test('U431-B: agreement holds for EVERY room of the wake structure, not just the entry', () => {
  const w = bootTallow();
  const st = w.structures.byId[String(w.scene.interior.structureKey)];
  const fp = floorPlan(st);
  for (const r of fp.rooms) {
    const drawn = drawnDoorsForRoom(fp, r.id);
    const exits = adjacentRooms(st.topology, r.id).length;
    assert.equal(drawn, exits, `room ${r.id}: drawn door-gaps (${drawn}) must equal topology exits (${exits})`);
  }
});

test('U431-C: getRoomState\'s doorway prose is present exactly when the room has exits — the DM describes a way on iff one is drawn', () => {
  const w = bootTallow();
  const st = w.structures.byId[String(w.scene.interior.structureKey)];
  const fp = floorPlan(st);
  const rs = getRoomState(w);
  assert.equal(rs.inside, true, 'the boot is inside a building');

  const roomId = String(w.scene.interior.roomId);
  const exits = adjacentRooms(st.topology, roomId).length;
  const drawn = drawnDoorsForRoom(fp, roomId);
  // The DM's doorway description is non-empty iff the room actually has a way on;
  // and the map draws the same number of openings.
  const hasProse = Array.isArray(rs.doorways) && rs.doorways.length > 0;
  assert.equal(hasProse, exits > 0, 'getRoomState narrates a doorway iff the room has an exit');
  assert.equal(drawn, exits, 'the drawn opening count equals the exit count the prose describes');
});

test('U431-D: after a real room-to-room move, the NEW current room still agrees (drawn gaps == exits)', () => {
  let w = bootTallow();
  const st = w.structures.byId[String(w.scene.interior.structureKey)];
  const startRoom = String(w.scene.interior.roomId);
  // Take any real compass exit from the wake room.
  const ex = interiorExitsFrom(st.topology, startRoom);
  const dir = ['north', 'east', 'south', 'west'].find(d => ex[d]);
  assert.ok(dir, 'the wake room has at least one compass exit to walk through');

  const res = playerMove(w, `go ${dir}`);
  w = res.world;
  // Movement may or may not land us in a different room depending on adjudication,
  // but wherever we now are inside, the agreement must hold.
  if (w.scene && w.scene.interior) {
    const st2 = w.structures.byId[String(w.scene.interior.structureKey)];
    const fp2 = floorPlan(st2);
    const roomId2 = String(w.scene.interior.roomId);
    const drawn = drawnDoorsForRoom(fp2, roomId2);
    const exits = adjacentRooms(st2.topology, roomId2).length;
    assert.equal(drawn, exits, `after moving ${dir}, room ${roomId2}: drawn gaps (${drawn}) must equal exits (${exits})`);
  }
});
