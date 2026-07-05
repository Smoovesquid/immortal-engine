// U534 — MR-3a: DETERMINISM. The wild is a pure function of (worldSeed, region
// cell): permanence WITHOUT memory. Walking back to the same clearing shows the same
// trees — forever, with nothing stored. This test proves the law two ways:
//
//   • SAME SEED, TWO BOOTS → byte-identical feature sets across a sampled grid (and
//     across whole bubbles). Two independent worlds on seed 'aldermere' derive the
//     exact same wood.
//   • DIFFERENT SEED → a DIFFERENT wood (the derivation actually depends on the seed,
//     not a constant field).
//
// Plus the purity guarantees: zero Math.random anywhere in the module, and repeated
// calls are referentially transparent (call N times, same answer every time).
// Hermetic — no network, no API key, LLM off. (docs/briefs/MR-3-FOG-PROCGEN.md §MR-3a.)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { wildFeaturesAround, isRegionCellBlocked } from '../engine/world/wildFeatures.js';

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

// The Greenwood forest neighbourhood (region cell ~400,0) — a sampled grid of query
// centres well inside the wood.
const FOREST_GRID = [];
for (let gx = 360; gx <= 440; gx += 8) for (let gy = 30; gy <= 110; gy += 8) FOREST_GRID.push({ gx, gy });

test('U534: same seed, two boots → byte-identical feature sets across a sampled grid', () => {
  const a = bootSlice();
  const b = bootSlice();
  for (const c of FOREST_GRID) {
    const fa = JSON.stringify(wildFeaturesAround(a, c, 6));
    const fb = JSON.stringify(wildFeaturesAround(b, c, 6));
    assert.equal(fa, fb, `feature set diverged at (${c.gx},${c.gy}) across two boots of the same seed`);
  }
});

test('U534: same seed, two boots → identical over a whole bubble (radius 24)', () => {
  const a = bootSlice();
  const b = bootSlice();
  const fa = JSON.stringify(wildFeaturesAround(a, { gx: 400, gy: 60 }, 24));
  const fb = JSON.stringify(wildFeaturesAround(b, { gx: 400, gy: 60 }, 24));
  assert.equal(fa, fb, 'a full forest bubble is not byte-identical across two boots');
});

test('U534: different seed → a different wood (the field depends on the seed)', () => {
  const a = bootSlice(SLICE_SEED);
  const b = bootSlice('a-totally-different-seed');
  // Both are forest by biome, but the arrangement must differ across a big bubble.
  const fa = JSON.stringify(wildFeaturesAround(a, { gx: 400, gy: 60 }, 24));
  const fb = JSON.stringify(wildFeaturesAround(b, { gx: 400, gy: 60 }, 24));
  assert.notEqual(fa, fb, 'two different seeds produced the SAME wood — the derivation ignores the seed');
});

test('U534: referential transparency — N calls, identical answer every time', () => {
  const w = bootSlice();
  const center = { gx: 400, gy: 60 };
  const first = JSON.stringify(wildFeaturesAround(w, center, 10));
  for (let i = 0; i < 8; i++) {
    assert.equal(JSON.stringify(wildFeaturesAround(w, center, 10)), first, `call ${i} differed — not a pure function`);
  }
  // And the blocking mask is likewise stable per cell.
  const cellFirst = isRegionCellBlocked(w, 400, 60);
  for (let i = 0; i < 8; i++) {
    assert.equal(isRegionCellBlocked(w, 400, 60), cellFirst, 'isRegionCellBlocked is not stable per cell');
  }
});

test('U534 (purity): the module makes no Math.random CALL', () => {
  const src = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'engine', 'world', 'wildFeatures.js'), 'utf8');
  // Match an actual call `Math.random(` (the header comment mentions the words
  // "Math.random" as a prohibition — that's documentation, not a call). Strip line
  // comments first so a comment can never trip or mask the check.
  const code = src.replace(/\/\/[^\n]*/g, '');
  assert.ok(!/Math\s*\.\s*random\s*\(/.test(code), 'wildFeatures.js must never CALL Math.random — hash only');
});
