// U542 — MR-3c: REPRODUCE FIRST (the failing test that names the feature).
//
// The engine KNOWS what stands in the wild (MR-3a, wildFeaturesAround) and the map is
// being taught to DRAW it (MR-3b). This slice makes the WORDS read the SAME world: an
// outdoor look-around must name the derived features standing in the player's bubble —
// "a stand of trees to the north", "a boulder cluster to the east" — never a blank
// "you're in a wilderness" that ignores the wood the derivation (and the map) place
// right there. That gap IS the design's falsifier: narrated wild that contradicts the
// derivation (here, by omission — the survey saw no features at all).
//
// This test places the player OUTDOORS at a forest region cell and asserts the outdoor
// look composition (buildLocationSurvey, LLM off) names features that wildFeaturesAround
// ACTUALLY derives for that bubble (kind + rough direction). Before MR-3c the outdoor
// survey read zero features, so this FAILS on the current build — the falsifier,
// machine-printed, before the composition seam is wired.
//
// Hermetic: no network, no API key, LLM off. (docs/briefs/MR-3-FOG-PROCGEN.md §MR-3c.)

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { wildFeaturesAround } from '../engine/world/wildFeatures.js';
import { outdoorTerrainFacts } from '../engine/world/wildFacts.js';
import { buildLocationSurvey } from '../engine/grace/gracefulAdjudication.js';
import { nodeGridToRegionCell } from '../engine/map/spatial/tacticalPos.js';

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
function greenwood(world) {
  const gw = world.map.nodes.find(n => n.name === 'The Greenwood');
  return { node: gw, centre: nodeGridToRegionCell(gw.x, gw.y) };
}
// Place the player OUTDOORS at a region cell of the Greenwood node (same pattern as
// U536): set the current node and commit a region-frame pos through the sole mutation
// path, clearing any interior so the outdoor branch of the survey runs.
function placePlayerOutdoors(world, cell) {
  const { node } = greenwood(world);
  const w = { ...world, map: { ...world.map, currentNodeId: node.id }, scene: { ...world.scene, interior: null } };
  return applyDeltas(w, [{ op: 'pos', id: 'party', to: { frame: 'region', gx: cell.gx, gy: cell.gy } }]);
}

// The read-noun the survey uses for each wild kind → the substring the survey line must
// contain when that kind is the notable feature in some direction. (These mirror
// wildFacts' FEATURE_NOUN; a test-owned copy so the assertion is explicit, not circular.)
const KIND_SUBSTR = {
  tree: 'trees',
  boulder: 'boulder',
  deadfall: 'deadfall',
  stump: 'stump',
  brush: 'brush',
};

test('U542 (reproduce): the derivation EXISTS and the composer consumes it', () => {
  assert.equal(typeof outdoorTerrainFacts, 'function', 'outdoorTerrainFacts must be exported');
  const world = bootSlice();
  const { centre } = greenwood(world);
  const w = placePlayerOutdoors(world, { gx: centre.gx, gy: centre.gy + 60 });
  const facts = outdoorTerrainFacts(w);
  assert.ok(facts && typeof facts === 'object', 'a forest position yields non-null terrain facts');
  assert.ok(Array.isArray(facts.features) && facts.features.length > 0, 'the forest read carries at least one feature');
});

test('U542 (reproduce): the outdoor look NAMES the wild the derivation places there', () => {
  const world = bootSlice();
  const { centre } = greenwood(world);
  // Deep in the wood, off the road that runs along y≈0 — a bubble full of trees.
  const cell = { gx: centre.gx, gy: centre.gy + 60 };
  const w = placePlayerOutdoors(world, cell);

  // Ground truth: the features the derivation ACTUALLY places in this bubble.
  const feats = wildFeaturesAround(w, cell, 8);
  assert.ok(feats.length > 0, 'precondition: the derivation places features in this forest bubble');
  const kindsPresent = new Set(feats.map(f => f.kind));

  // The composed outdoor look (LLM OFF — buildLocationSurvey is the deterministic base).
  const survey = buildLocationSurvey(w, { queryText: 'look around' });

  // THE FALSIFIER: the survey must name the wild. Before MR-3c it read only
  // "You're in The Greenwood, a wilderness. A path leads …" — no feature at all.
  const namesSomeFeature = [...kindsPresent].some(k => survey.toLowerCase().includes(KIND_SUBSTR[k]));
  assert.ok(
    namesSomeFeature,
    `the outdoor look must name a derived wild feature (one of ${[...kindsPresent].join(', ')}), got: "${survey}"`
  );

  // And it must not CONTRADICT the derivation by naming a kind that isn't there in a
  // "to the <dir>" clause — every feature clause the survey states must correspond to a
  // kind the derivation actually placed in the bubble.
  const facts = outdoorTerrainFacts(w);
  for (const f of facts.features) {
    assert.ok(kindsPresent.has(f.kind), `survey names a ${f.kind} the derivation did not place in the bubble`);
    const clause = `${KIND_SUBSTR[f.kind]}`;
    assert.ok(survey.toLowerCase().includes(clause), `survey should contain the "${clause}" read it derived`);
  }
});
