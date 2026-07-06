// U562 — PLAN-SPLIT-1: the catalog-fallback regression + golden stability
// (docs/briefs/PLAN-SPLIT-1-one-geometry.md).
//
// Two claims, sibling to U561's "one geometry for an engine-backed structure":
//   (A) a structure with NO drawable engine topology (floorPlan(st) returns an
//       empty room set — e.g. not yet generated, or a player-built shell with
//       topology:null, engine/structures/playerBuilt.js) still draws SOMETHING
//       real: the module falls back to getPlan(type)'s catalog plan, exactly as
//       it always did for a structure it can't ground in engine truth. This is
//       the ONLY case the catalog plan may still drive a real structure's ink
//       (the brief's own words: "catalog plans may remain ONLY for structures
//       that have no engine plan").
//   (B) the fix is a draw-side read — it must not perturb any of the SIX scenes
//       that never touch the wake settlement's real structure (the wild/combat
//       goldens have no engine-backed building in frame at all, so their raster
//       is byte-identical before and after). This is the packet's own
//       constraint ("the six committed goldens are law") restated as a test
//       rather than left to eyeballing `npm run playtest:screen`'s output.
//
// docs/MAP_REAL.md promise 3. Sibling: U561 (the one-geometry law itself).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';
import { getPlan } from '../public/map/plans/index.js';
import { buildScenes, drawnModel } from '../scripts/screenTruth.scenes.mjs';
import { rasterizeScene, toPGM, readGolden } from '../scripts/screenTruth.goldens.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  const w0 = newWorld({ seed: SLICE_SEED, fate: 0.2, campaignId: 'campaign-plan-split-1-u562', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  return beginAdventure(ensureWorld(w0), PACKS).world;
}

// ── (A) catalog fallback for a structure with no drawable engine topology ─────

test('U562-A: precondition — stripping a structure\'s topology makes floorPlan(st) return an EMPTY room set', () => {
  const world = bootSlice();
  const nodeId = world.map.currentNodeId;
  const st = Object.values(world.structures.byId).find(s => String(s?.nodeId || '') === String(nodeId));
  assert.ok(st, 'precondition: a real structure exists at the wake node');
  // Force the no-topology branch floorPlan.js's own header documents (a
  // structure whose topology is null — the exact shape engine/structures/
  // playerBuilt.js assigns to some player-built shells).
  st.topology = null;
  const fp = floorPlan(st);
  assert.deepEqual(fp.rooms, [], 'floorPlan on a topology-less structure returns an empty room set (never throws)');
});

test('U562-B: a structure with no drawable engine topology still draws the CATALOG plan, not an empty/missing building', () => {
  const world = bootSlice();
  const nodeId = world.map.currentNodeId;
  const st = Object.values(world.structures.byId).find(s => String(s?.nodeId || '') === String(nodeId));
  const type = st.buildingType;
  st.topology = null; // force floorPlan(st) empty — the engine-plan branch must degrade

  const place = placeFromWorldNode(world, nodeId);
  const drawn = (place.buildings || []).find(b => String(b?.structureKey || '') === String(st.id));
  assert.ok(drawn, 'the structure is STILL drawn (never silently dropped) once its engine plan is ungroundable');
  assert.ok(Array.isArray(drawn.plan.rooms) && drawn.plan.rooms.length > 0, 'the drawn plan has real rooms (the catalog fallback, not an empty shell)');

  // It is the CATALOG plan specifically (same room set getPlan(type) authors),
  // not a coincidental non-empty plan from elsewhere.
  const catalog = getPlan(type) || getPlan('cottage');
  assert.equal(drawn.plan.rooms.length, catalog.rooms.length, 'drawn plan room count matches the catalog plan (the documented fallback)');
  assert.equal(drawn.plan.rooms[0].cx, catalog.rooms[0].cx, 'drawn plan room geometry matches the catalog plan (not the engine\'s, which is empty here)');
});

test('U562-C: the player token still resolves to SOME finite place-unit position even when its own structure has no engine plan (never crashes, never NaN)', () => {
  const world = bootSlice();
  const nodeId = world.map.currentNodeId;
  const st = Object.values(world.structures.byId).find(s => String(s?.nodeId || '') === String(nodeId));
  st.topology = null;

  const place = placeFromWorldNode(world, nodeId);
  const tok = (place.tokens || []).find(t => t.type === 'player');
  assert.ok(tok, 'a player token is drawn');
  assert.ok(Number.isFinite(tok.ux) && Number.isFinite(tok.uy), 'the token position is finite (never NaN, never throws) even when its structure\'s engine plan is empty');
});

// ── (B) golden stability — the six pre-existing scenes' rasters are untouched ──

test('U562-D: the three wild/combat scenes (no engine-backed building at the wake settlement) render BYTE-IDENTICAL to their committed goldens', () => {
  // These three scenes never touch the wake settlement's real structure (two are
  // a different node entirely — the Greenwood; one is the tactical combat board,
  // which draws no settlement buildings at all) — the strongest possible
  // "this fix didn't leak" proof: their raster must be untouched, pixel for pixel.
  const untouched = ['wild_road_walking', 'deep_wild_fog_edge', 'combat_one_defeated'];
  for (const id of untouched) {
    const sc = buildScenes().find(s => s.id === id);
    assert.ok(sc, `scene ${id} exists`);
    const m = drawnModel(sc.world, sc.nodeId); m.__world = sc.world;
    const raster = rasterizeScene(m);
    const golden = readGolden(id);
    assert.ok(golden, `committed golden exists for ${id}`);
    assert.equal(raster.length, golden.data.length, `${id} raster is the pinned size`);
    for (let i = 0; i < raster.length; i++) {
      assert.equal(raster[i], golden.data[i], `${id} pixel ${i} is byte-identical to its committed golden — this packet's fix must not leak beyond the wake settlement`);
    }
  }
});

test('U562-E: all seven canonical scene goldens are committed on disk (the wake golden landed alongside the six pre-existing ones)', () => {
  const dir = path.join(__dirname, '..', 'tests', 'goldens', 'screen');
  for (const id of ['wake_interior', 'cottage_exterior', 'settlement_square_morning', 'settlement_square_evening', 'wild_road_walking', 'deep_wild_fog_edge', 'combat_one_defeated']) {
    assert.ok(fs.existsSync(path.join(dir, `${id}.pgm`)), `${id}.pgm is committed`);
  }
});
