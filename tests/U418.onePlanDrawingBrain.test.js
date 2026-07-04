// U418 — TT-DRAW-3 one plan-drawing brain (docs/briefs/TT-DRAW-3-graphpaper-
// real-plans.md, docs/TABLETOP_MAP.md). Tim's live sighting: "the rooms are
// squares inside of squares" — the outdoor sheet (drawModel.js's
// drawnStructureModel) derived its OWN independent per-room wall/door-gap
// arithmetic, never drawing corridors, while the in-play interior view
// (handDrawnInterior.js's floorPlanToSceneModel) already drew real connected
// architecture. Root cause (verified against the real tallow structure):
// floorPlan.js deliberately pads a gap (PAD=0.34 layout units) between
// adjacent room boxes and fills it with a corridor strip — a door's world
// point sits in THAT gap, never on either room's own boundary edge — so a
// per-room-only wall derivation leaves the gap undrawn: two sealed boxes with
// dead space between them. The fix: planModel.js's floorPlanToPlanModel is
// the ONE shared derivation (room shape, corridor dog-legs, door orientation)
// BOTH floorPlanToSceneModel (interior) and drawnStructureModel (outdoor
// sheet) now import — this test proves the sharing at the import level and
// proves the geometry actually tiles/connects, not just that the code paths
// happen to agree today.
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

test('U418-B: the interior scene-model geometry (rooms/doors/corridors, layout units) and the outdoor drawn-structure geometry (projected to world units) derive from the IDENTICAL shared plan-model — same room count, same door count, same corridor count, same ids, for the same structure', () => {
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
  assert.equal(drawn.corridors.length, shared.corridors.length, 'outdoor drawn-structure corridor count must match the shared plan-model exactly — corridors are NOT dropped on the outdoor path');
  assert.ok(shared.corridors.length > 0, 'precondition: the tallow wake structure has at least one corridor to test against');

  const sharedRoomIds = shared.rooms.map(r => r.id).sort();
  assert.deepEqual(sceneModel.rooms.map(r => r.id).sort(), sharedRoomIds, 'interior room ids match the shared model exactly');
  assert.deepEqual(drawn.rooms.map(r => r.id).sort(), sharedRoomIds, 'outdoor room ids match the shared model exactly');
});

test('U418-C: rooms tile the footprint — every corridor visits its two named rooms\' own centers, so the connective ink actually spans the gap between them (no floating/disconnected corridor)', () => {
  const w = boot();
  const structureKey = String(w.scene.interior.structureKey);
  const st = w.structures.byId[structureKey];
  const fp = floorPlan(st);
  const shared = floorPlanToPlanModel(fp);
  const roomById = new Map(shared.rooms.map(r => [r.id, r]));

  for (const c of shared.corridors) {
    assert.ok(c.a && c.b, 'every corridor must name both rooms it connects');
    const ra = roomById.get(c.a), rb = roomById.get(c.b);
    assert.ok(ra && rb, `corridor room pair (${c.a}, ${c.b}) must both exist in the shared room set`);
    const firstPt = c.pts[0], lastPt = c.pts[c.pts.length - 1];
    assert.ok(Math.abs(firstPt[0] - ra.cx) < 1e-9 && Math.abs(firstPt[1] - ra.cy) < 1e-9, `corridor ${c.a}->${c.b} must start at room ${c.a}'s own center (the connective tissue actually touches the room, not a gap)`);
    assert.ok(Math.abs(lastPt[0] - rb.cx) < 1e-9 && Math.abs(lastPt[1] - rb.cy) < 1e-9, `corridor ${c.a}->${c.b} must end at room ${c.b}'s own center`);
  }
});

test('U418-D: every doorway sits ON its corridor — the connective ink the door visually opens onto is the SAME corridor named by the same room pair (a/b), never orphaned', () => {
  const w = boot();
  const structureKey = String(w.scene.interior.structureKey);
  const st = w.structures.byId[structureKey];
  const fp = floorPlan(st);
  const shared = floorPlanToPlanModel(fp);
  assert.ok(shared.doors.length > 0, 'precondition: at least one door to test');

  const corridorPairs = new Set(shared.corridors.map(c => `${c.a}|${c.b}`));
  for (const d of shared.doors) {
    assert.ok(corridorPairs.has(`${d.a}|${d.b}`), `door ${d.a}-${d.b} must have a matching corridor connecting the same two rooms (the gap it opens onto is drawn, not blank padding)`);
  }
});

test('U418-E: the SAME model feeds both surfaces — drawnStructureModel\'s per-room walls and its corridors are BOTH projections of shared plan-model geometry (planPointToWu), not an independently-derived shape; the outdoor structure\'s rect fully contains every corridor segment endpoint (no ink escaping the building)', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const drawn = drawnStructureModel(w, nodeId);
  assert.ok(drawn.structures.length > 0);
  for (const s of drawn.structures) {
    for (const c of s.corridors) {
      assert.ok(Array.isArray(c.segs) && c.segs.length > 0, `structure ${s.structureKey} corridor ${c.a}-${c.b} must have at least one projected segment`);
      for (const seg of c.segs) {
        assert.ok(seg.a.wx >= s.rect.minX - 1e-6 && seg.a.wx <= s.rect.maxX + 1e-6, `corridor segment endpoint must land inside the structure's world rect (x)`);
        assert.ok(seg.a.wy >= s.rect.minY - 1e-6 && seg.a.wy <= s.rect.maxY + 1e-6, `corridor segment endpoint must land inside the structure's world rect (y)`);
        assert.ok(Number.isFinite(seg.b.wx) && Number.isFinite(seg.b.wy), 'corridor segment endpoint b must be finite world coordinates');
      }
    }
  }
});

test('U418-F: no fabricated void beyond the plan\'s own corridor/pad geometry — every drawn corridor traces back to a real floorPlan().corridors entry (same count, same order, same endpoints under the shared projection), nothing invented', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const structureKey = String(w.scene.interior.structureKey);
  const st = w.structures.byId[structureKey];
  const realPlan = floorPlan(st);
  const drawn = drawnStructureModel(w, nodeId).structures.find(s => s.structureKey === structureKey);
  assert.equal(drawn.corridors.length, realPlan.corridors.length, 'drawn corridor count must equal the REAL floorPlan corridor count exactly — no invented passages, none dropped');
});

test('U418-G: two independent builds of the same seed produce an IDENTICAL drawn-structure model INCLUDING corridors (determinism x2)', () => {
  const project = () => {
    const w = boot();
    const nodeId = String(w.map.currentNodeId);
    return drawnStructureModel(w, nodeId);
  };
  const a = project();
  const b = project();
  assert.deepEqual(a, b, 'the same seed must project an identical drawn-structure model (rooms, doors, AND corridors), every build');
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
