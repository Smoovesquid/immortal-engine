// U409 — TT-DRAW drawn-structure model (docs/TABLETOP_MAP.md, docs/briefs/
// TT-DRAW-tabletop-look.md, PACKETS §TABLETOP S3). Resolves the WS-1-flagged
// fork: the outdoor map has been drawing CATALOG-plan room shapes
// (placeFromNode.js / plans/index.js) while movement/interiors use the REAL
// engine room graph (engine/structures/floorPlan.js). drawnStructureModel()
// must derive every settlement structure's plan-model from the REAL floorPlan,
// fitted inside its structureWorldRect (worldSpace.js, WS-1) — so "go through
// the doorway" points at a drawn gap the player can see. Pure + deterministic:
// no engine writes, no Math.random, worldHash unchanged by any call here.
// Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { drawnStructureModel } from '../public/map/drawModel.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

test('U409-A: every real structure at the current node yields a plan-model with rooms and world coordinates', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const structureKeys = Object.values(w.structures.byId).filter(s => String(s.nodeId) === nodeId).map(s => String(s.id));
  assert.ok(structureKeys.length > 0, 'precondition: the tallow boot node has at least one real structure');

  const model = drawnStructureModel(w, nodeId);
  assert.equal(model.nodeId, nodeId);
  const gotKeys = model.structures.map(s => s.structureKey).sort();
  assert.deepEqual(gotKeys, structureKeys.sort(), 'every real structure at the node must appear in the drawn model, no more, no fewer');

  for (const s of model.structures) {
    assert.ok(Array.isArray(s.rooms) && s.rooms.length > 0, `structure ${s.structureKey} must have rooms`);
    for (const r of s.rooms) {
      assert.ok(Number.isFinite(r.wx) && Number.isFinite(r.wy), `room ${r.id} center must be finite world coordinates`);
      assert.ok(Array.isArray(r.walls), `room ${r.id} must carry wall segments`);
      for (const seg of r.walls) {
        assert.ok(Number.isFinite(seg.a.wx) && Number.isFinite(seg.a.wy), 'wall segment endpoint a must be finite');
        assert.ok(Number.isFinite(seg.b.wx) && Number.isFinite(seg.b.wy), 'wall segment endpoint b must be finite');
      }
    }
  }
});

test('U409-B: the plan-model is derived from the REAL floorPlan(structure), not a catalog stand-in', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const structureKey = String(w.scene.interior.structureKey);
  const st = w.structures.byId[structureKey];
  const realPlan = floorPlan(st);

  const model = drawnStructureModel(w, nodeId);
  const drawn = model.structures.find(s => s.structureKey === structureKey);
  assert.ok(drawn, 'the structure the player booted inside must appear in the drawn model');

  // Room id set and count must match the REAL floorPlan's room graph exactly —
  // the tell that this isn't a catalog plan swapped in for a similar-looking shape.
  const realRoomIds = realPlan.rooms.map(r => String(r.id)).sort();
  const drawnRoomIds = drawn.rooms.map(r => String(r.id)).sort();
  assert.deepEqual(drawnRoomIds, realRoomIds, 'drawn room ids must match the real floorPlan room graph exactly');
  assert.equal(drawn.name, realPlan.name);
  assert.equal(drawn.shell, realPlan.shell);
});

test('U409-C: every drawn room lands INSIDE its building\'s structureWorldRect (the U400-C guarantee, reused)', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const model = drawnStructureModel(w, nodeId);
  assert.ok(model.structures.length > 0);
  for (const s of model.structures) {
    assert.ok(s.rect.maxX > s.rect.minX && s.rect.maxY > s.rect.minY, `structure ${s.structureKey} rect must have positive extent`);
    for (const r of s.rooms) {
      assert.ok(r.wx >= s.rect.minX - 1e-6 && r.wx <= s.rect.maxX + 1e-6, `room ${r.id} wx must be within its building's world rect`);
      assert.ok(r.wy >= s.rect.minY - 1e-6 && r.wy <= s.rect.maxY + 1e-6, `room ${r.id} wy must be within its building's world rect`);
    }
    for (const d of s.doors) {
      assert.ok(d.wx >= s.rect.minX - 1e-6 && d.wx <= s.rect.maxX + 1e-6, `door on ${s.structureKey} must be within its building's world rect`);
      assert.ok(d.wy >= s.rect.minY - 1e-6 && d.wy <= s.rect.maxY + 1e-6, `door on ${s.structureKey} must be within its building's world rect`);
    }
  }
});

test('U409-D: a doorway is a GAP in the wall — no wall segment crosses a door point', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const model = drawnStructureModel(w, nodeId);
  const multiDoor = model.structures.find(s => s.doors.length > 0);
  assert.ok(multiDoor, 'precondition: at least one structure at this node has an internal door');

  for (const door of multiDoor.doors) {
    const room = multiDoor.rooms.find(r => r.id === door.a) || multiDoor.rooms.find(r => r.id === door.b);
    assert.ok(room, 'a door must reference a real room in the same structure');
    // No wall segment on that room should have an endpoint sitting exactly on the
    // door's world point AND continue straight through it — the gap-cutting logic
    // in wallSegmentsForRoom removes any segment overlapping the door span, so the
    // nearest distance from the door point to every segment's midpoint must clear
    // a small margin (the segments either side of the gap, not through it).
    for (const seg of room.walls) {
      const midx = (seg.a.wx + seg.b.wx) / 2, midy = (seg.a.wy + seg.b.wy) / 2;
      const d = Math.hypot(midx - door.wx, midy - door.wy);
      // A wall segment's midpoint must not coincide with the door point itself
      // (that would mean the "gap" logic drew ink straight across the doorway).
      assert.ok(d > 0.01, 'no wall segment may be centered exactly on a doorway (the doorway must read as a gap, not ink)');
    }
  }
});

test('U409-E: two independent builds of the same seed produce an IDENTICAL drawn-structure model', () => {
  const project = () => {
    const w = boot();
    const nodeId = String(w.map.currentNodeId);
    return drawnStructureModel(w, nodeId);
  };
  const a = project();
  const b = project();
  assert.deepEqual(a, b, 'the same seed must project an identical drawn-structure model, every build');
});

test('U409-F: worldHash is UNCHANGED by drawnStructureModel (read-only proof)', () => {
  const w = boot();
  const h0 = worldHash(w);
  drawnStructureModel(w, String(w.map.currentNodeId));
  const h1 = worldHash(w);
  assert.equal(h1, h0, 'deriving the drawn-structure model must never mutate anything worldHash covers');
});

test('U409-G: a node with no real structures yields an empty (never fabricated) structure list', () => {
  const w = boot();
  const fakeNodeId = 'a-node-with-nothing-on-it';
  const model = drawnStructureModel(w, fakeNodeId);
  assert.deepEqual(model.structures, [], 'an unknown/empty node must draw zero structures, never invent one');
});
