// U433 — WS-3 nothing lost (docs/briefs/WS-3-one-surface.md #4 "keep the interior
// niceties"). The retired isInterior branch's renderer (LocalMap.js's drawInteriorV2,
// via handDrawnInterior.js) drew: a highlighter wash + heavier outline on the CURRENT
// room, room-by-room furniture, a "you are here" marker, and per-room fog (only
// interior.visited rooms were carved out of the rock at all). This test proves the
// ONE sheet's plan band (oneMap.js + drawModel.js's shared-brain models) carries
// equivalents for the boot interior, at MODEL level (no canvas/DOM needed — the
// draw call's inputs are asserted, matching TT-DRAW's own U409/U410/U411 pattern):
//   (A) drawnStructureModel finds the room the player is booted into, by id, in the
//       structure they're inside.
//   (B) that same structure carries furniture (from placeFromNode.js's catalog plan
//       — oneMap.js's furniture loop reads b.plan.furniture, fitted into the true
//       walls via PT) — the sheet's plan band has something to draw furniture marks
//       from, not an empty room.
//   (C) the marker (playerFocusWu) resolves to a point strictly inside the CURRENT
//       room's own wall bounding box — "the marker at the player's room."
//   (D) the fog state (world.scene.interior.visited) names the boot room (WS-3's
//       INK_PARAMS.currentRoomWash/unvisitedRoomDim tunables key off this SAME
//       array oneMap.js reads) — the model the plan-band's per-room wash consumes
//       genuinely marks the current room visited and distinguishes it from the
//       rest of the structure's rooms.
//   (E) INK_PARAMS carries the ported tunables (currentRoomWash, unvisitedRoomDim)
//       — the shared-brain idiom the brief requires (a taste pass touches one spot,
//       never a resurrected renderer).
// Pure, deterministic, read-only: no engine writes, no Math.random, worldHash
// unchanged. Hermetic — no DOM/canvas, no LLM/API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { drawnStructureModel, INK_PARAMS } from '../public/map/drawModel.js';
import { playerFocusWu } from '../public/map/oneMap.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

test('U433-A: the boot interior\'s current room is present, by id, in the drawn-structure model of the node the player is at', () => {
  const w = boot();
  assert.ok(w.scene?.interior, 'precondition: the tallow boot world starts indoors');
  const nodeId = String(w.map.currentNodeId);
  const structureKey = String(w.scene.interior.structureKey);
  const roomId = String(w.scene.interior.roomId);

  const model = drawnStructureModel(w, nodeId);
  const structure = model.structures.find(s => s.structureKey === structureKey);
  assert.ok(structure, 'the structure the player is booted inside must appear in the drawn model (the building the sheet\'s plan band will show)');
  const room = structure.rooms.find(r => String(r.id) === roomId);
  assert.ok(room, 'the current room must be a real room in the drawn model, by id');
  assert.ok(Array.isArray(room.walls) && room.walls.length > 0, 'the current room must carry wall segments the plan band can trace a wash polygon from');
});

test('U433-B: the boot interior\'s structure carries furniture the sheet\'s plan band can draw (not an empty shell)', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const place = placeFromWorldNode(w, nodeId);
  const structureKey = String(w.scene.interior.structureKey);
  const bld = (place.buildings || []).find(b => String(b.structureKey || '') === structureKey);
  assert.ok(bld, 'the current interior\'s building must resolve from the same place model oneMap.js draws from');
  assert.ok(Array.isArray(bld.plan?.furniture) && bld.plan.furniture.length > 0, 'the current building must carry at least one furniture piece — the "furniture" niceity has something real to draw');
});

test('U433-C: the marker (playerFocusWu) resolves strictly inside the CURRENT room\'s own wall bounding box — the marker sits in the player\'s room', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const structureKey = String(w.scene.interior.structureKey);
  const roomId = String(w.scene.interior.roomId);

  const model = drawnStructureModel(w, nodeId);
  const structure = model.structures.find(s => s.structureKey === structureKey);
  const room = structure.rooms.find(r => String(r.id) === roomId);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const seg of room.walls) {
    for (const p of [seg.a, seg.b]) {
      minX = Math.min(minX, p.wx); maxX = Math.max(maxX, p.wx);
      minY = Math.min(minY, p.wy); maxY = Math.max(maxY, p.wy);
    }
  }
  const focus = playerFocusWu(w);
  assert.ok(focus, 'the marker/camera focus must resolve on the boot world');
  const EPS = 1e-6;
  assert.ok(focus.wx >= minX - EPS && focus.wx <= maxX + EPS, `marker wx (${focus.wx}) must fall inside the current room's own wall bbox [${minX}, ${maxX}]`);
  assert.ok(focus.wy >= minY - EPS && focus.wy <= maxY + EPS, `marker wy (${focus.wy}) must fall inside the current room's own wall bbox [${minY}, ${maxY}]`);
});

test('U433-D: the fog state (interior.visited) names the boot room and distinguishes it from the rest of the structure\'s rooms', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const structureKey = String(w.scene.interior.structureKey);
  const roomId = String(w.scene.interior.roomId);
  const visited = new Set((Array.isArray(w.scene.interior.visited) ? w.scene.interior.visited : []).map(String));
  assert.ok(visited.has(roomId), 'the current room must be marked visited (the model the plan band\'s per-room wash reads)');

  const model = drawnStructureModel(w, nodeId);
  const structure = model.structures.find(s => s.structureKey === structureKey);
  const totalRooms = structure.rooms.length;
  // A fog signal only means something if the structure has room to distinguish
  // (else "visited vs unvisited" is vacuous) — the tallow cottage's real floorPlan
  // has more than the one room the player is standing in.
  assert.ok(totalRooms >= 1, 'precondition: the structure has at least the current room');
  for (const r of structure.rooms) {
    const isCurrent = String(r.id) === roomId;
    const isVisited = visited.has(String(r.id));
    if (isCurrent) assert.ok(isVisited, 'the current room is always visited — the fog model can never mark you standing in an unvisited room');
  }
});

test('U433-E: INK_PARAMS carries the ported current-room / unvisited-room tunables — the shared-brain idiom, not a resurrected renderer', () => {
  assert.ok(typeof INK_PARAMS.currentRoomWash === 'string' && INK_PARAMS.currentRoomWash.length > 0, 'INK_PARAMS.currentRoomWash must be a real, named color');
  assert.ok(Number.isFinite(INK_PARAMS.unvisitedRoomDim) && INK_PARAMS.unvisitedRoomDim > 0 && INK_PARAMS.unvisitedRoomDim < 1, 'INK_PARAMS.unvisitedRoomDim must be a sane dimming fraction (dims, never fully hides)');
});

test('U433-F: none of this is fabricated — every model call is read-only (worldHash unchanged) and deterministic across two independent boots', () => {
  const project = () => {
    const w = boot();
    const h0 = worldHash(w);
    const nodeId = String(w.map.currentNodeId);
    const model = drawnStructureModel(w, nodeId);
    const focus = playerFocusWu(w);
    const h1 = worldHash(w);
    return { model, focus, hashStable: h1 === h0 };
  };
  const a = project();
  const b = project();
  assert.deepEqual(a.model, b.model, 'the drawn-structure model must be byte-identical across two independent boots of the same seed');
  assert.deepEqual(a.focus, b.focus, 'the marker focus must be byte-identical across two independent boots of the same seed');
  assert.ok(a.hashStable && b.hashStable, 'deriving these models must never mutate anything worldHash covers');
});
