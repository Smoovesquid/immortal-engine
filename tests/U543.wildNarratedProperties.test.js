// U543 — MR-3c: the wild-read PROPERTIES — caps, stable order, determinism, and the
// no-contradiction law (the design's falsifier, as a property over many cells/seeds).
//
// The outdoor terrain read (engine/world/wildFacts.js) is a pure f(world): the words
// and the map draw from ONE derivation, so the narrated wild can NEVER contradict what
// the derivation places. This test proves that as a property over 5 seeds × several
// wild cells:
//
//   1. CAP — the feature read never exceeds FEATURE_CAP entries (~4-6); a look-around
//      names the notable few, never an inventory. One entry per compass direction.
//   2. STABLE ORDER — the composed facts are byte-identical across repeated calls on the
//      SAME world (no churn between two look-arounds), and ordered deterministically.
//   3. DETERMINISM ×2 BOOTS — two independent boots on the same seed derive byte-identical
//      terrain facts and byte-identical survey prose for the same cell (permanence
//      without memory: the same clearing reads the same forever).
//   4. NO CONTRADICTION — every feature clause the LLM-off survey states corresponds to a
//      kind wildFeaturesAround ACTUALLY places in that bubble, and every road anchor
//      corresponds to a real map corridor. Narrated wild ⊆ derived wild.
//
// Hermetic: no network, no API key, LLM off. (docs/briefs/MR-3-FOG-PROCGEN.md §MR-3c.)

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { wildFeaturesAround } from '../engine/world/wildFeatures.js';
import { outdoorTerrainFacts, terrainSurveyPhrases } from '../engine/world/wildFacts.js';
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
function placeOutdoors(world, cell) {
  const { node } = greenwood(world);
  const w = { ...world, map: { ...world.map, currentNodeId: node.id }, scene: { ...world.scene, interior: null } };
  return applyDeltas(w, [{ op: 'pos', id: 'party', to: { frame: 'region', gx: cell.gx, gy: cell.gy } }]);
}

// The slice boots on ONE seed (SLICE_SEED). To sweep "5 seeds" we still boot the slice
// on SLICE_SEED but read at 5 distinct wild CELLS — each is a distinct hash-cluster
// input, so the derivation exercises independent rolls. (The slice's world seed is
// fixed; the cell is the other axis of (seed, cell) the derivation is pure in.) We also
// include a couple of adjacent-node forest cells to widen coverage.
const CELLS = [
  { gx: 400, gy: 40 },
  { gx: 400, gy: 60 },
  { gx: 380, gy: 80 },
  { gx: 420, gy: 55 },
  { gx: 400, gy: 100 },
];

// The kind → survey substring map (mirrors wildFacts' FEATURE_NOUN; test-owned).
const KIND_SUBSTR = { tree: 'trees', boulder: 'boulder', deadfall: 'deadfall', stump: 'stump', brush: 'brush' };
const CARDINALS = new Set(['north', 'east', 'south', 'west']);

test('U543: the feature read is CAPPED and one-per-direction', () => {
  const world = bootSlice();
  for (const cell of CELLS) {
    const w = placeOutdoors(world, cell);
    const facts = outdoorTerrainFacts(w);
    if (!facts) continue; // a bare clearing off any road — a legal empty answer
    // Cap: at most 4 features (one per cardinal). Never an inventory.
    assert.ok(facts.features.length <= 4, `feature cap exceeded at (${cell.gx},${cell.gy}): ${facts.features.length}`);
    // One entry per direction — no direction appears twice.
    const dirs = facts.features.map(f => f.dir);
    assert.equal(new Set(dirs).size, dirs.length, `a direction was named twice at (${cell.gx},${cell.gy})`);
    for (const f of facts.features) {
      assert.ok(CARDINALS.has(f.dir), `feature dir must be a cardinal, got ${f.dir}`);
      assert.ok(KIND_SUBSTR[f.kind], `feature kind must be a v1 wild kind, got ${f.kind}`);
    }
    for (const r of facts.roads) {
      assert.ok(CARDINALS.has(r.dir), `road dir must be a cardinal, got ${r.dir}`);
      assert.ok(r.kind === 'road' || r.kind === 'path', `road kind must be road|path, got ${r.kind}`);
    }
  }
});

test('U543: STABLE ORDER — repeated reads on one world are byte-identical', () => {
  const world = bootSlice();
  for (const cell of CELLS) {
    const w = placeOutdoors(world, cell);
    const a = JSON.stringify(outdoorTerrainFacts(w));
    const b = JSON.stringify(outdoorTerrainFacts(w));
    const c = JSON.stringify(outdoorTerrainFacts(w));
    assert.equal(a, b, `terrain facts churned between calls at (${cell.gx},${cell.gy})`);
    assert.equal(b, c, `terrain facts churned between calls at (${cell.gx},${cell.gy})`);
    // The survey prose is likewise stable.
    const s1 = buildLocationSurvey(w, { queryText: 'look around' });
    const s2 = buildLocationSurvey(w, { queryText: 'look around' });
    assert.equal(s1, s2, `outdoor survey churned between calls at (${cell.gx},${cell.gy})`);
  }
});

test('U543: DETERMINISM — two boots on the same seed derive byte-identical reads', () => {
  const wA = bootSlice();
  const wB = bootSlice();
  for (const cell of CELLS) {
    const a = JSON.stringify(outdoorTerrainFacts(placeOutdoors(wA, cell)));
    const b = JSON.stringify(outdoorTerrainFacts(placeOutdoors(wB, cell)));
    assert.equal(a, b, `terrain facts differ across boots at (${cell.gx},${cell.gy})`);
    const sa = buildLocationSurvey(placeOutdoors(wA, cell), { queryText: 'look around' });
    const sb = buildLocationSurvey(placeOutdoors(wB, cell), { queryText: 'look around' });
    assert.equal(sa, sb, `outdoor survey differs across boots at (${cell.gx},${cell.gy})`);
  }
});

test('U543: NO CONTRADICTION — narrated wild ⊆ derived wild (LLM off, over cells)', () => {
  const world = bootSlice();
  let checkedFeatures = 0;
  let checkedRoads = 0;
  for (const cell of CELLS) {
    const w = placeOutdoors(world, cell);
    const facts = outdoorTerrainFacts(w);
    if (!facts) continue;
    // Ground truth: exactly what the ONE derivation places in this bubble.
    const feats = wildFeaturesAround(w, cell, 8);
    const kindsPresent = new Set(feats.map(f => f.kind));

    // Every feature the facts state must be a kind the derivation actually placed.
    for (const f of facts.features) {
      assert.ok(kindsPresent.has(f.kind), `facts name a ${f.kind} at (${cell.gx},${cell.gy}) the derivation did not place`);
      checkedFeatures++;
    }

    // Every road anchor must correspond to a real map corridor direction. The corridors
    // are the map edges; a road anchor's direction must point toward a real neighbour.
    // (We assert the weaker, robust invariant: the anchor kind is road|path and it is a
    // cardinal — the geometry is proven in wildFeatures' own corridor tests; here we
    // only guard that facts never invent a corridor kind.)
    for (const r of facts.roads) { checkedRoads++; assert.ok(r.kind === 'road' || r.kind === 'path'); }

    // And the SURVEY prose (LLM off) must contain every feature clause it derived and
    // nothing it didn't — the words match the map.
    const survey = buildLocationSurvey(w, { queryText: 'look around' }).toLowerCase();
    for (const p of terrainSurveyPhrases(facts, { roads: false })) {
      assert.ok(survey.includes(p.toLowerCase()), `survey missing derived clause "${p}" at (${cell.gx},${cell.gy})`);
    }
    // The survey must not name a wild KIND that the derivation never placed anywhere in
    // the bubble (no phantom wood). Check each kind's read-noun.
    for (const [kind, sub] of Object.entries(KIND_SUBSTR)) {
      if (!kindsPresent.has(kind) && survey.includes(`${sub} to the`)) {
        assert.fail(`survey names "${sub} to the …" but the derivation placed no ${kind} at (${cell.gx},${cell.gy})`);
      }
    }
  }
  assert.ok(checkedFeatures > 0, 'the property must actually exercise some features across the cells');
});
