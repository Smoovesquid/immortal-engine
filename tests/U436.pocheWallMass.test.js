// U436 — FP-2 poché: walls read as MASS, not outlines
// (docs/briefs/FP-2-walls-with-mass.md #1-#2).
//
// The regression Tim saw ("boxes in boxes", "buildings took a huge step backwards")
// was 100% PAINT: the one-sheet plan band stroked each room as a thin empty box and
// left the wall band between rooms as blank paper. FP-1 (U429) already gives the
// honest geometry — rooms TILE, a doorway is a gap in the 0.12-lu shared-wall band.
// FP-2 fills that band as solid wall MASS. This test proves the DERIVED model the
// renderer paints has a real wall band (shell minus room floors > 0), that every
// floorPlan door pierces it (sits in the band between two rooms), that the room
// floors are carved inside the shell, and that it's deterministic ×2.
//
// Model-level (no canvas): pocheBand()/pointInWallBand() are the pure geometry the
// oneMap.js poché fill draws from. Pure, deterministic, read-only — no engine
// writes, no Math.random, no network, no API key. worldHash untouched.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { drawnStructureModel, pocheBand, pointInWallBand } from '../public/map/drawModel.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const COTTAGE = 'stgen:v27:n3_1515674724:0';

function cottageStruct(world) {
  const nodeId = String(world.map.currentNodeId);
  return drawnStructureModel(world, nodeId).structures.find(s => s.structureKey === COTTAGE);
}

test('U436-A: the tallow boot cottage draws a real wall BAND — shell minus room floors > 0 (the space between rooms is WALL, not void)', () => {
  const st = cottageStruct(boot());
  assert.ok(st, 'precondition: the boot cottage is in the drawn model');
  const band = pocheBand(st);
  assert.ok(band.shellArea > 0, 'the shell rect has positive area');
  assert.ok(band.roomsArea > 0, 'the rooms carve real floor area');
  // The wall band is a substantial fraction of the shell — not a hairline. The
  // FP-1 cottage bands are ~2.4ft walls around 3 rooms; the band is comfortably
  // > 10% of the shell (a "boxes-in-boxes" render would have ~0 band area).
  assert.ok(band.wallArea > band.shellArea * 0.10,
    `wall band (${band.wallArea.toFixed(2)}) must be a real mass, > 10% of shell (${band.shellArea.toFixed(2)})`);
  // And the rooms never exceed the shell (all floor is inside the building).
  assert.ok(band.roomsArea <= band.shellArea + 1e-6, 'room floors never exceed the shell area');
});

test('U436-B: every floorPlan door PIERCES the wall band (a doorway is a gap in the mass between two rooms)', () => {
  const st = cottageStruct(boot());
  assert.ok(st.doors && st.doors.length >= 1, 'precondition: the cottage has interior doors');
  for (const d of st.doors) {
    // A door center sits in the wall band: inside the shell, outside every room
    // floor — i.e. exactly ON the shared wall it opens through.
    assert.equal(pointInWallBand(st, d.wx, d.wy), true,
      `door ${d.a}->${d.b} (${d.dir}) must sit in the wall band it pierces`);
  }
});

test('U436-C: room floors are carved INSIDE the shell — a point at a room center is NOT wall', () => {
  const st = cottageStruct(boot());
  assert.ok(st.rooms.length >= 2, 'precondition: multiple rooms');
  for (const room of st.rooms) {
    // The room's own center is floor, never wall band.
    assert.equal(pointInWallBand(st, room.wx, room.wy), false,
      `room ${room.name} center must be carved floor (not wall)`);
    // And that center is inside the shell rect.
    assert.ok(room.wx >= st.rect.minX && room.wx <= st.rect.maxX && room.wy >= st.rect.minY && room.wy <= st.rect.maxY,
      `room ${room.name} center is inside the shell rect`);
  }
});

test('U436-D: deterministic ×2 — the same seed yields a byte-identical poché model (shell, rooms, doors, band area)', () => {
  const a = cottageStruct(boot());
  const b = cottageStruct(boot());
  assert.deepEqual(
    { rect: a.rect, rooms: a.rooms, doors: a.doors },
    { rect: b.rect, rooms: b.rooms, doors: b.doors },
    'shell/rooms/doors identical across two boots'
  );
  assert.deepEqual(pocheBand(a), pocheBand(b), 'the poché band geometry is identical across two boots');
});

test('U436-E: the poché derivation is PURE — worldHash is byte-unchanged by building the model', () => {
  const w = boot();
  const h0 = worldHash(w);
  const st = cottageStruct(w);
  pocheBand(st); pointInWallBand(st, st.rect.minX, st.rect.minY);
  drawnStructureModel(w, String(w.map.currentNodeId));
  assert.equal(worldHash(w), h0, 'deriving the poché model must never mutate anything worldHash covers');
});
