// U533 — MR-3a: REPRODUCE FIRST (the failing test that names the feature).
//
// The fog hides a world that was always there. When MR-3b draws the wilderness,
// the minis need an ENGINE truth to draw from: a pure function that, given any
// region cell, answers "what stands here?" identically forever — trees dense in
// the forest, corridors kept clear along the roads, nothing invented at render
// time. This test asserts that function EXISTS and answers the two anchor cases:
//
//   1. In FOREST biome (the Greenwood at region cell ~(400,0)) it returns a
//      deterministic, NON-EMPTY feature set — there is a wood there.
//   2. ON A ROAD CORRIDOR cell (the town→Greenwood road runs along y≈0 between
//      cell (0,0) and (400,0)) it returns an EMPTY set — the road stays clear so
//      a traveller (and a journey arrival) never lands in a tree.
//
// Written BEFORE engine/world/wildFeatures.js exists, so it fails on import — the
// MR-3a falsifier, machine-printed, before a line of the derivation is written.
// Hermetic: no network, no API key, LLM off. (docs/briefs/MR-3-FOG-PROCGEN.md §MR-3a.)

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { wildFeaturesAround } from '../engine/world/wildFeatures.js';

// The one minimal pack the slice boot needs (mirrors scripts/positionProbe.mjs).
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

function bootSlice(seed = SLICE_SEED) {
  const w0 = newWorld({
    seed, fate: 0.2, campaignId: `campaign-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape',
  });
  return beginAdventure(ensureWorld(w0), PACKS).world;
}

// The Greenwood forest node sits at grid (2,0) → region cell (400,0) (NODE_CELLS=200).
// A cell well inside the forest neighbourhood, off the road that runs along y≈0.
const FOREST_CELL = { gx: 400, gy: 60 };
// A cell ON the town→Greenwood road corridor (the road runs along y≈0 between the
// two node centres at gx 0 and 400). Mid-way, dead on the centreline.
const ROAD_CELL = { gx: 200, gy: 0 };

test('U533 (reproduce): wildFeaturesAround EXISTS and is callable', () => {
  const world = bootSlice();
  assert.equal(typeof wildFeaturesAround, 'function', 'the derivation must be exported');
  const out = wildFeaturesAround(world, FOREST_CELL, 8);
  assert.ok(Array.isArray(out), 'wildFeaturesAround returns an array of features');
});

test('U533 (reproduce): the forest is NOT empty — a wood stands there', () => {
  const world = bootSlice();
  const feats = wildFeaturesAround(world, FOREST_CELL, 8);
  assert.ok(feats.length > 0, 'forest biome must yield at least one wild feature (trees, brush…)');
  // Every feature has the contracted shape.
  for (const f of feats) {
    assert.ok(f && typeof f === 'object', 'feature is an object');
    assert.ok(['tree', 'boulder', 'brush', 'deadfall', 'stump'].includes(f.kind), `kind is a v1 wild kind, got ${f.kind}`);
    assert.ok(f.cell && Number.isInteger(f.cell.gx) && Number.isInteger(f.cell.gy), 'feature has an integer cell');
    assert.equal(typeof f.blocking, 'boolean', 'feature has a boolean blocking flag');
  }
});

test('U533 (reproduce): the road corridor stays CLEAR — no feature on the road', () => {
  const world = bootSlice();
  const feats = wildFeaturesAround(world, ROAD_CELL, 2);
  const onRoad = feats.filter(f => f.cell.gx === ROAD_CELL.gx && f.cell.gy === ROAD_CELL.gy);
  assert.equal(onRoad.length, 0, 'the road centreline cell must carry no wild feature');
});
