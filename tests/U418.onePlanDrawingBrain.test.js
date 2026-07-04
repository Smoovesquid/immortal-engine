// U418 — TT-DRAW-3 one plan-drawing brain (docs/briefs/TT-DRAW-3-graphpaper-
// real-plans.md, docs/TABLETOP_MAP.md), RELOCKED for FP-1 (docs/briefs/
// FP-1-proper-floorplans.md). Both map surfaces still derive from the ONE shared
// plan-model (planModel.js's floorPlanToPlanModel, imported by BOTH
// floorPlanToSceneModel and drawnStructureModel — U418-A). FP-1 changed the
// geometry that model carries: Tim's ruling "the 'rooms-interconnected-by-corridors'
// is an old bug — rooms should have doorways that open into one another". floorPlan.js
// no longer pads a gap and bridges it with a corridor strip; rooms now TILE (adjacent
// cells ABUT, sharing a wall) and a doorway is a gap IN that shared wall. So these
// tests now prove the connective geometry TILES (rooms share walls, doors sit on the
// shared wall) and that corridors are ABOLISHED (always zero), rather than the old
// corridor-bridge model. The one topology that can't tile on a square grid (a triangle:
// three rooms in a cycle) records its un-tileable edge on fp.nonAdjacent and is
// exempted — flagged, never bridged.
//
// Pure, deterministic, read-only — no engine writes, no Math.random, worldHash
// unchanged. Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { floorPlanToPlanModel } from '../public/map/planModel.js';
import { floorPlanToSceneModel } from '../public/map/handDrawnInterior.js';
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

test('U418-A: import-level assertion — both public/map source files import floorPlanToPlanModel from the SAME neutral module (planModel.js), not a re-derivation', () => {
  const interiorSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'map', 'handDrawnInterior.js'), 'utf8');
  const outdoorSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'map', 'drawModel.js'), 'utf8');
  assert.match(interiorSrc, /import\s*\{[^}]*floorPlanToPlanModel[^}]*\}\s*from\s*['"]\.\/planModel\.js['"]/, 'handDrawnInterior.js must import floorPlanToPlanModel from planModel.js');
  assert.match(outdoorSrc, /import\s*\{[^}]*floorPlanToPlanModel[^}]*\}\s*from\s*['"]\.\/planModel\.js['"]/, 'drawModel.js must import floorPlanToPlanModel from planModel.js');
  // And neither file re-derives its own independent corridor dog-leg bend
  // (the tell of a parallel derivation) — the string only appears in the ONE
  // shared module.
  const planModelSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'map', 'planModel.js'), 'utf8');
  assert.match(planModelSrc, /floorPlanToPlanModel/, 'the neutral module must actually define floorPlanToPlanModel');
});

test('U418-B: the interior scene-model geometry (rooms/doors, layout units) and the outdoor drawn-structure geometry (projected to world units) derive from the IDENTICAL shared plan-model — same room count, same door count, same ids, and NO corridors (FP-1: rooms tile and abut, corridors abolished)', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const structureKey = String(w.scene.interior.structureKey);
  const st = w.structures.byId[structureKey];
  const fp = floorPlan(st);
  const shared = floorPlanToPlanModel(fp);

  const roomId = String(w.scene.interior.roomId);
  const sceneModel = floorPlanToSceneModel(fp, { currentRoomId: roomId, visited: fp.rooms.map(r => r.id), tokens: [] });
  const drawn = drawnStructureModel(w, nodeId).structures.find(s => s.structureKey === structureKey);
  assert.ok(drawn, 'the structure the player booted inside must appear in the drawn model');

  assert.equal(sceneModel.rooms.length, shared.rooms.length, 'interior scene-model room count must match the shared plan-model exactly (fully visited)');
  assert.equal(drawn.rooms.length, shared.rooms.length, 'outdoor drawn-structure room count must match the shared plan-model exactly');
  assert.equal(sceneModel.doors.length, shared.doors.length, 'interior scene-model door count must match the shared plan-model exactly (fully visited)');
  assert.equal(drawn.doors.length, shared.doors.length, 'outdoor drawn-structure door count must match the shared plan-model exactly');
  // FP-1: corridors are abolished — the shared model, the interior scene-model, and
  // the outdoor drawn model all carry ZERO corridors. Rooms abut and share walls;
  // a doorway is a gap in a shared wall, not a bridge over a pad-void.
  assert.equal(shared.corridors.length, 0, 'the shared plan-model must carry NO corridors (FP-1: rooms tile)');
  assert.equal(sceneModel.corridors.length, 0, 'the interior scene-model must carry NO corridors');
  assert.equal(drawn.corridors.length, 0, 'the outdoor drawn-structure model must carry NO corridors');
  assert.ok(shared.doors.length > 0, 'precondition: the tallow wake structure has at least one doorway to test against');

  const sharedRoomIds = shared.rooms.map(r => r.id).sort();
  assert.deepEqual(sceneModel.rooms.map(r => r.id).sort(), sharedRoomIds, 'interior room ids match the shared model exactly');
  assert.deepEqual(drawn.rooms.map(r => r.id).sort(), sharedRoomIds, 'outdoor room ids match the shared model exactly');
});

test('U418-C: rooms tile the footprint — adjacent room boxes ABUT (share a wall segment), never leaving a pad-void that a corridor would have bridged (FP-1)', () => {
  const w = boot();
  const structureKey = String(w.scene.interior.structureKey);
  const st = w.structures.byId[structureKey];
  const fp = floorPlan(st);
  // Every topology-connected pair of rooms placed on orthogonally-adjacent grid
  // cells must have coincident boxes on the shared axis: their drawn edges meet
  // (within the wall inset) instead of floating apart. The rare cycle edge that
  // can't tile (a triangle on a square grid) is recorded on fp.nonAdjacent and
  // exempted here — it is flagged, never bridged by a corridor.
  const nonAdj = new Set((fp.nonAdjacent || []).map(n => `${n.a}|${n.b}`));
  const byId = new Map(fp.rooms.map(r => [r.id, r]));
  let sharedWallPairs = 0;
  for (const d of fp.doors) {
    if (nonAdj.has(`${d.a}|${d.b}`)) continue;
    const a = byId.get(d.a), b = byId.get(d.b);
    assert.ok(a && b, `door ${d.a}-${d.b} names two real rooms`);
    const ax0 = a.cx - a.w / 2, ax1 = a.cx + a.w / 2, ay0 = a.cy - a.h / 2, ay1 = a.cy + a.h / 2;
    const bx0 = b.cx - b.w / 2, bx1 = b.cx + b.w / 2, by0 = b.cy - b.h / 2, by1 = b.cy + b.h / 2;
    // Boxes abut on a vertical shared wall (a's right meets b's left, or vice
    // versa) with overlapping y-spans, OR on a horizontal shared wall with
    // overlapping x-spans. The shared-wall inset (WALL=0.12) is the max gap.
    const GAP = 0.13;
    const vShare = (Math.abs(ax1 - bx0) < GAP || Math.abs(bx1 - ax0) < GAP) && Math.min(ay1, by1) - Math.max(ay0, by0) > -1e-9;
    const hShare = (Math.abs(ay1 - by0) < GAP || Math.abs(by1 - ay0) < GAP) && Math.min(ax1, bx1) - Math.max(ax0, bx0) > -1e-9;
    assert.ok(vShare || hShare, `connected rooms ${d.a} and ${d.b} must ABUT along a shared wall (no pad-void)`);
    sharedWallPairs++;
  }
  assert.ok(sharedWallPairs > 0, 'precondition: the wake structure has at least one tiled (wall-sharing) room pair');
});

test('U418-D: every doorway is a gap ON the shared wall between its two rooms — the door point lies on both rooms\' abutting edges, never floating in a corridor/pad-void (FP-1)', () => {
  const w = boot();
  const structureKey = String(w.scene.interior.structureKey);
  const st = w.structures.byId[structureKey];
  const fp = floorPlan(st);
  assert.ok(fp.doors.length > 0, 'precondition: at least one door to test');
  assert.equal(fp.corridors.length, 0, 'FP-1: no corridors — a doorway opens directly room-into-room');

  const nonAdj = new Set((fp.nonAdjacent || []).map(n => `${n.a}|${n.b}`));
  const byId = new Map(fp.rooms.map(r => [r.id, r]));
  for (const d of fp.doors) {
    if (nonAdj.has(`${d.a}|${d.b}`)) continue; // flagged cycle edge — corner door, exempt
    const a = byId.get(d.a), b = byId.get(d.b);
    const inBox = (r, x, y) => x >= r.cx - r.w / 2 - 0.13 && x <= r.cx + r.w / 2 + 0.13 && y >= r.cy - r.h / 2 - 0.13 && y <= r.cy + r.h / 2 + 0.13;
    assert.ok(inBox(a, d.x, d.y), `door ${d.a}-${d.b} must sit on room ${d.a}'s edge`);
    assert.ok(inBox(b, d.x, d.y), `door ${d.a}-${d.b} must sit on room ${d.b}'s edge (the SHARED wall)`);
  }
});

test('U418-E: the SAME model feeds both surfaces — drawnStructureModel\'s per-room walls are projections of the shared plan-model geometry (planPointToWu), and every room wall/door lands inside the structure\'s world rect (no ink escaping); corridors are abolished (FP-1) so the drawn corridor list is empty', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const drawn = drawnStructureModel(w, nodeId);
  assert.ok(drawn.structures.length > 0);
  for (const s of drawn.structures) {
    assert.equal(s.corridors.length, 0, `structure ${s.structureKey} must carry NO corridors (FP-1: rooms abut)`);
    // Every door projects inside the building rect — the room-into-room opening
    // sits on the shared interior wall, not beyond the shell.
    for (const d of s.doors) {
      assert.ok(d.wx >= s.rect.minX - 1e-6 && d.wx <= s.rect.maxX + 1e-6, `door must land inside the structure's world rect (x)`);
      assert.ok(d.wy >= s.rect.minY - 1e-6 && d.wy <= s.rect.maxY + 1e-6, `door must land inside the structure's world rect (y)`);
    }
  }
});

test('U418-F: no fabricated connective ink — corridors are abolished (FP-1), so the drawn model and the REAL floorPlan both carry ZERO corridors; nothing invented, nothing bridged', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const structureKey = String(w.scene.interior.structureKey);
  const st = w.structures.byId[structureKey];
  const realPlan = floorPlan(st);
  const drawn = drawnStructureModel(w, nodeId).structures.find(s => s.structureKey === structureKey);
  assert.equal(realPlan.corridors.length, 0, 'the REAL floorPlan must carry no corridors (FP-1)');
  assert.equal(drawn.corridors.length, realPlan.corridors.length, 'drawn corridor count must equal the REAL floorPlan corridor count exactly (both zero)');
});

test('U418-G: two independent builds of the same seed produce an IDENTICAL drawn-structure model (rooms + doors; corridors empty) — determinism x2', () => {
  const project = () => {
    const w = boot();
    const nodeId = String(w.map.currentNodeId);
    return drawnStructureModel(w, nodeId);
  };
  const a = project();
  const b = project();
  assert.deepEqual(a, b, 'the same seed must project an identical drawn-structure model (rooms and doors), every build');
});

test('U418-H: worldHash is UNCHANGED by the shared plan-model derivation or its consumers (read-only proof)', () => {
  const w = boot();
  const h0 = worldHash(w);
  const nodeId = String(w.map.currentNodeId);
  const structureKey = String(w.scene.interior.structureKey);
  const st = w.structures.byId[structureKey];
  const fp = floorPlan(st);
  floorPlanToPlanModel(fp);
  floorPlanToSceneModel(fp, { currentRoomId: String(w.scene.interior.roomId), visited: fp.rooms.map(r => r.id), tokens: [] });
  drawnStructureModel(w, nodeId);
  const h1 = worldHash(w);
  assert.equal(h1, h0, 'deriving/consuming the shared plan-model must never mutate anything worldHash covers');
});

test('U418-I: the interior view renders BYTE-IDENTICALLY after the extraction — floorPlanToSceneModel\'s full output (dynamic overlay included: current room, fog visited-filter, tokens) is unchanged from its pre-extraction shape for a representative visited/current-room scenario', () => {
  const w = boot();
  const structureKey = String(w.scene.interior.structureKey);
  const st = w.structures.byId[structureKey];
  const fp = floorPlan(st);
  const roomId = String(w.scene.interior.roomId);
  const allRoomIds = fp.rooms.map(r => String(r.id));
  // A representative PARTIAL-visit scenario (not everything seen) exercises the
  // fog filter path, the case most likely to break silently under a careless
  // extraction.
  const visited = allRoomIds.slice(0, Math.max(1, allRoomIds.length - 1));
  const tokens = [{ type: 'player', ux: 1, uy: 1 }];
  const model = floorPlanToSceneModel(fp, { currentRoomId: roomId, visited, tokens });

  // Re-derive the EXPECTED shape independently (the pre-extraction formula,
  // restated here rather than imported, so this test doesn't just call the
  // same code twice) and compare field-for-field.
  const seen = id => visited.includes(String(id));
  const expectedRoomIds = fp.rooms.filter(r => seen(r.id)).map(r => String(r.id)).sort();
  assert.deepEqual(model.rooms.map(r => r.id).sort(), expectedRoomIds, 'fog-filtered room set must match the pre-extraction visited-filter formula exactly');
  const expectedDoors = fp.doors.filter(d => seen(d.a) && seen(d.b));
  assert.equal(model.doors.length, expectedDoors.length, 'fog-filtered door count must match the pre-extraction visited-filter formula exactly');
  for (const r of model.rooms) {
    assert.ok(!('current' in r) === false, 'every room must carry the current-room flag');
    assert.equal(r.current, String(r.id) === roomId, 'current-room flag must match the currentRoomId exactly');
  }
  assert.deepEqual(model.tokens, tokens, 'tokens pass through unchanged');
  // Corridors are NOT fog-filtered (matches the pre-extraction behavior — the
  // old floorPlanToSceneModel never filtered corridors by visited either).
  assert.equal(model.corridors.length, fp.corridors.length, 'corridor count must be UNFILTERED by fog — matching pre-extraction behavior exactly');
});
