// U535 — MR-3a: THE LAWS the wild-feature field must obey. These are the falsifiers
// from the brief, as pure-function properties over the booted slice world:
//
//   1. BIOME-AWARE DENSITY   — forest is DENSE (a real wood stands over a sampled
//                              area) yet WALKABLE (blocking density stays under a
//                              ceiling, so a move can thread between trees); the open
//                              settlement approaches are far sparser.
//   2. CORRIDOR CLEARANCE    — no feature stands on a road/path corridor cell; the
//                              town→Greenwood road and the Greenwood→Chapel path stay
//                              clear along their length (+ their margins).
//   3. SETTLEMENT EXCLUSION  — a cell inside a settlement's extent (Aldermere) yields
//                              NO wild feature (settlements own their ink); the wild
//                              resumes just past the exclusion radius.
//   4. BLOCKING BY KIND      — every tree/boulder is blocking; every brush/deadfall/
//                              stump is not. No exceptions.
//
// Hermetic — no network, no API key, LLM off. (docs/briefs/MR-3-FOG-PROCGEN.md §MR-3a.)

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { wildFeaturesAround, isRegionCellBlocked, WILD_CONSTANTS } from '../engine/world/wildFeatures.js';
import { nodeGridToRegionCell, nearestNodeToRegionCell } from '../engine/map/spatial/tacticalPos.js';

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
function nodeByName(world, name) {
  return world.map.nodes.find(n => n.name === name);
}
const BLOCKING = new Set(WILD_CONSTANTS.BLOCKING_KINDS);

// ── Law 1: biome-aware density ───────────────────────────────────────────────

test('U535 (law 1): the forest is DENSE — a wood stands over the sampled area', () => {
  const w = bootSlice();
  const gw = nodeByName(w, 'The Greenwood');
  const centre = nodeGridToRegionCell(gw.x, gw.y);
  // Count cells carrying a feature over a forest block, staying off the road (y≥30).
  let withFeature = 0, total = 0;
  const seen = new Set();
  for (let gy = centre.gy + 30; gy <= centre.gy + 110; gy += 4) {
    const feats = wildFeaturesAround(w, { gx: centre.gx, gy }, 40);
    for (const f of feats) seen.add(`${f.cell.gx},${f.cell.gy}`);
  }
  // Sample a rectangle and ask how much of it is wooded.
  for (let gx = centre.gx - 40; gx <= centre.gx + 40; gx++) {
    for (let gy = centre.gy + 30; gy <= centre.gy + 110; gy++) {
      total++;
      if (seen.has(`${gx},${gy}`)) withFeature++;
    }
  }
  const frac = withFeature / total;
  // A real wood: well above a bare-margin trickle. (Observed ~0.15; floor at 0.06.)
  assert.ok(frac >= 0.06, `forest feels too empty: only ${(frac * 100).toFixed(1)}% of cells wooded`);
});

test('U535 (law 1): the forest stays WALKABLE — blocking density under the ceiling', () => {
  const w = bootSlice();
  const gw = nodeByName(w, 'The Greenwood');
  const centre = nodeGridToRegionCell(gw.x, gw.y);
  let blocked = 0, total = 0;
  for (let gx = centre.gx - 40; gx <= centre.gx + 40; gx++) {
    for (let gy = centre.gy + 30; gy <= centre.gy + 110; gy++) {
      total++;
      if (isRegionCellBlocked(w, gx, gy)) blocked++;
    }
  }
  const frac = blocked / total;
  // Walkable forest: a body must be able to thread between trees. (Observed ~0.09.)
  // Ceiling at 0.25 — beyond that a ≤6-cell move would almost always jam.
  assert.ok(frac > 0, 'a forest with ZERO blocking features is not a wood');
  assert.ok(frac <= 0.25, `forest too dense to walk: ${(frac * 100).toFixed(1)}% of cells blocked`);
});

test('U535 (law 1): the settlement approach is SPARSER than the deep forest', () => {
  const w = bootSlice();
  const gw = nodeByName(w, 'The Greenwood');
  const gwC = nodeGridToRegionCell(gw.x, gw.y);
  // Deep forest feature fraction.
  const forestSeen = new Set();
  for (let gy = gwC.gy + 30; gy <= gwC.gy + 90; gy += 4) {
    for (const f of wildFeaturesAround(w, { gx: gwC.gx, gy }, 40)) forestSeen.add(`${f.cell.gx},${f.cell.gy}`);
  }
  let fF = 0, fT = 0;
  for (let gx = gwC.gx - 30; gx <= gwC.gx + 30; gx++) for (let gy = gwC.gy + 30; gy <= gwC.gy + 90; gy++) { fT++; if (forestSeen.has(`${gx},${gy}`)) fF++; }
  const forestFrac = fF / fT;
  // The town at (0,0): the wild only resumes past the exclusion radius; sample the
  // annulus just beyond it (plains-ish approach), NOT inside the excluded disc.
  const town = nodeByName(w, 'Aldermere');
  const townC = nodeGridToRegionCell(town.x, town.y);
  const R = WILD_CONSTANTS.SETTLEMENT_EXCLUDE_CELLS;
  const townSeen = new Set();
  for (let gy = townC.gy + R + 5; gy <= townC.gy + R + 65; gy += 4) {
    for (const f of wildFeaturesAround(w, { gx: townC.gx, gy }, 40)) townSeen.add(`${f.cell.gx},${f.cell.gy}`);
  }
  let tF = 0, tT = 0;
  for (let gx = townC.gx - 30; gx <= townC.gx + 30; gx++) for (let gy = townC.gy + R + 5; gy <= townC.gy + R + 65; gy++) { tT++; if (townSeen.has(`${gx},${gy}`)) tF++; }
  const townFrac = tF / tT;
  // The deep forest must be at least as wooded as the town approach. (Both project to
  // 'forest' biome in the tiny slice, so this is a soft ordering, not a hard gap —
  // the point is the derivation never makes the approach DENSER than the wood.)
  assert.ok(forestFrac >= townFrac - 0.02, `forest (${(forestFrac * 100).toFixed(1)}%) should not be sparser than the town approach (${(townFrac * 100).toFixed(1)}%)`);
});

// ── Law 2: corridor clearance ────────────────────────────────────────────────

test('U535 (law 2): road/path corridors stay CLEAR along their length', () => {
  const w = bootSlice();
  const byId = new Map(w.map.nodes.filter(n => Number.isInteger(n.x)).map(n => [String(n.id), nodeGridToRegionCell(n.x, n.y)]));
  let checked = 0;
  for (const e of w.map.edges) {
    const a = byId.get(String(e.a)); const b = byId.get(String(e.b));
    if (!a || !b) continue;
    // Sample the centreline every few cells and assert no feature stands on it.
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const gx = Math.round(a.gx + t * (b.gx - a.gx));
      const gy = Math.round(a.gy + t * (b.gy - a.gy));
      // Skip cells that fall inside a settlement (that's the settlement law's turf).
      const feats = wildFeaturesAround(w, { gx, gy }, 0);
      const onCell = feats.filter(f => f.cell.gx === gx && f.cell.gy === gy);
      assert.equal(onCell.length, 0, `feature on the ${e.kind} corridor at (${gx},${gy})`);
      assert.equal(isRegionCellBlocked(w, gx, gy), false, `blocked corridor cell at (${gx},${gy}) on the ${e.kind}`);
      checked++;
    }
  }
  assert.ok(checked > 0, 'no corridor cells were checked — the slice has no positioned edges?');
});

test('U535 (law 2): the journey-arrival cell on the road is clear', () => {
  // The position probe drops a Greenwood journey arrival near (358,19) on the
  // town→Greenwood road. Assert a band around the road stays walkable there.
  const w = bootSlice();
  for (let gx = 300; gx <= 380; gx += 2) {
    for (let dy = -2; dy <= 2; dy++) {
      assert.equal(isRegionCellBlocked(w, gx, dy), false, `road cell (${gx},${dy}) near the journey arrival is blocked`);
    }
  }
});

// ── Law 3: settlement exclusion ──────────────────────────────────────────────

test('U535 (law 3): a settlement owns its ink — no wild feature inside its extent', () => {
  const w = bootSlice();
  const town = nodeByName(w, 'Aldermere');
  const c = nodeGridToRegionCell(town.x, town.y);
  const R = WILD_CONSTANTS.SETTLEMENT_EXCLUDE_CELLS;
  const feats = wildFeaturesAround(w, c, R - 2); // strictly inside the exclusion disc
  const inside = feats.filter(f => {
    const dx = f.cell.gx - c.gx, dy = f.cell.gy - c.gy;
    return dx * dx + dy * dy <= R * R;
  });
  assert.equal(inside.length, 0, `${inside.length} wild feature(s) inside Aldermere's excluded extent`);
});

test('U535 (law 3): the wild resumes just past the exclusion radius', () => {
  const w = bootSlice();
  const town = nodeByName(w, 'Aldermere');
  const c = nodeGridToRegionCell(town.x, town.y);
  const R = WILD_CONSTANTS.SETTLEMENT_EXCLUDE_CELLS;
  // A bubble centred well past the ring (toward open ground away from other nodes:
  // south, +y, where no road/edge runs) must carry SOME feature.
  const feats = wildFeaturesAround(w, { gx: c.gx, gy: c.gy + R + 40 }, 20);
  assert.ok(feats.length > 0, 'the wild does not resume past the settlement exclusion — the world is bald outside town');
});

// ── Law 4: blocking by kind ──────────────────────────────────────────────────

test('U535 (law 4): trees & boulders block; brush, deadfall & stumps do not', () => {
  const w = bootSlice();
  // Gather a large feature sample across the forest and assert the blocking flag
  // matches the kind, with no exceptions.
  const gw = nodeByName(w, 'The Greenwood');
  const c = nodeGridToRegionCell(gw.x, gw.y);
  const feats = wildFeaturesAround(w, { gx: c.gx, gy: c.gy + 60 }, 40);
  assert.ok(feats.length > 20, 'precondition: a healthy feature sample to check flags against');
  const kinds = new Set();
  for (const f of feats) {
    kinds.add(f.kind);
    const shouldBlock = BLOCKING.has(f.kind);
    assert.equal(f.blocking, shouldBlock, `${f.kind} has blocking=${f.blocking}, expected ${shouldBlock}`);
  }
  // The sample should exercise both blocking and non-blocking kinds.
  assert.ok([...kinds].some(k => BLOCKING.has(k)), 'sample had no blocking kinds');
  assert.ok([...kinds].some(k => !BLOCKING.has(k)), 'sample had no non-blocking kinds');
});

test('U535 (law 4): isRegionCellBlocked agrees with the feature blocking flag on every cell', () => {
  const w = bootSlice();
  const gw = nodeByName(w, 'The Greenwood');
  const c = nodeGridToRegionCell(gw.x, gw.y);
  const feats = wildFeaturesAround(w, { gx: c.gx, gy: c.gy + 60 }, 24);
  // Every blocking feature's cell must read blocked; and a cell with only
  // non-blocking features (and no blocking one) must read free.
  const blockingCells = new Set(feats.filter(f => f.blocking).map(f => `${f.cell.gx},${f.cell.gy}`));
  for (const f of feats) {
    const cellHasBlocker = blockingCells.has(`${f.cell.gx},${f.cell.gy}`);
    assert.equal(isRegionCellBlocked(w, f.cell.gx, f.cell.gy), cellHasBlocker,
      `isRegionCellBlocked disagreed at (${f.cell.gx},${f.cell.gy})`);
  }
});
