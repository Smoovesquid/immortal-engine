// U536 — MR-3a: MOVEMENT INTEGRATION + hash invariance. The blocking half of the
// wild joins the region-frame walkable picture, so a tactical move STOPS HONESTLY at
// a tree — exactly like a wall — and the committed body is never inside a tree. And
// because the derivation is a pure READ (nothing stored), no number of derivation
// calls can move worldHash.
//
//   1. A move toward a tree STOPS ADJACENT, never lands on it — driven through the
//      real resolver (resolveTacticalWalk) and committed through the sole mutation
//      path (applyDeltas { op:'pos' }). The committed cell is FREE; the next cell
//      toward the tree is the blocker.
//   2. PARTIAL PROGRESS is honest: with clear ground then a tree, the walk advances
//      as far as it can and stops one cell short (movedCells > 0, < the ask).
//   3. worldHash is UNCHANGED by any number of wildFeaturesAround / isRegionCellBlocked
//      calls (pure reads — no stored fields, no applyDeltas writes).
//   4. The determinism suite's contract holds: a committed tactical walk near a tree
//      re-derives byte-identically on replay (same seed, same deltas → same pos).
//
// Hermetic — no network, no API key, LLM off. (docs/briefs/MR-3-FOG-PROCGEN.md §MR-3a.)

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldHash } from '../engine/worldHash.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { wildFeaturesAround, isRegionCellBlocked } from '../engine/world/wildFeatures.js';
import {
  resolveTacticalWalk, regionWalkCellFree,
  nodeGridToRegionCell, nearestNodeToRegionCell,
} from '../engine/map/spatial/tacticalPos.js';

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

// Find, inside the Greenwood neighbourhood, a start cell S heading EAST with a BLOCKER
// at S+k: cells S..S+k-1 are all free (and project to Greenwood) and S+k is a blocking
// feature. A greedy east walk from S then advances exactly k-1 cells and stops adjacent
// to the tree (verified in the probe). Returns {gx,gy,k} or null. k must be ≥ 1.
function findRunToTree(world, k) {
  const { node, centre } = greenwood(world);
  for (let gy = centre.gy - 40; gy <= centre.gy + 40; gy++) {
    for (let gx = centre.gx - 40; gx <= centre.gx + 40; gx++) {
      let ok = true;
      for (let i = 0; i < k; i++) {
        if (isRegionCellBlocked(world, gx + i, gy) || nearestNodeToRegionCell(world.map, gx + i, gy) !== node.id) { ok = false; break; }
      }
      if (!ok) continue;
      if (isRegionCellBlocked(world, gx + k, gy) && nearestNodeToRegionCell(world.map, gx + k, gy) === node.id) {
        return { gx, gy, k };
      }
    }
  }
  return null;
}

// Place the player outdoors at a region cell of the Greenwood node.
function placePlayer(world, cell) {
  const { node } = greenwood(world);
  const w = { ...world, map: { ...world.map, currentNodeId: node.id } };
  return applyDeltas(w, [{ op: 'pos', id: 'party', to: { frame: 'region', gx: cell.gx, gy: cell.gy } }]);
}

test('U536 (integration): a committed tactical move toward a tree stops ADJACENT, never on it', () => {
  const world = bootSlice();
  // Blocker at S+3: a walk east of budget 6 advances 3-1 = 2 cells and stops, the
  // tree blocking the cell just past the stop.
  const run = findRunToTree(world, 3);
  assert.ok(run, 'precondition: a clear run ending at a tree exists in the Greenwood');
  let w = placePlayer(world, { gx: run.gx, gy: run.gy });
  const res = resolveTacticalWalk(w, { actorId: 'party', dir: 'east', cells: 6 });
  assert.ok(res, 'the resolver returned a walk result outdoors');
  // Commit through the sole mutation path.
  w = applyDeltas(w, [{ op: 'pos', id: 'party', to: res.pos }]);
  const pos = w.party[0].pos;
  // The committed cell must be FREE (never inside the tree).
  assert.equal(isRegionCellBlocked(w, pos.gx, pos.gy), false, 'committed pos landed ON a blocking feature');
  assert.equal(regionWalkCellFree(w, pos.gx, pos.gy), true, 'committed pos is not free per the mask predicate');
  // It stopped exactly adjacent: the next cell east is the blocker.
  assert.equal(isRegionCellBlocked(w, pos.gx + 1, pos.gy), true, 'the cell just past the stop is not the blocking tree — did not stop adjacent');
});

test('U536 (integration): partial progress is honest — advance as far as clear, stop one short', () => {
  const world = bootSlice();
  const run = findRunToTree(world, 3); // S,S+1,S+2 free; S+3 a tree → walk advances 2
  assert.ok(run, 'precondition: a run to a tree at offset 3 exists');
  const w = placePlayer(world, { gx: run.gx, gy: run.gy });
  const res = resolveTacticalWalk(w, { actorId: 'party', dir: 'east', cells: 6 });
  // A blocker at S+3 caps a budget-6 ask at 2 cells of progress (stop one short of the tree).
  assert.equal(res.movedCells, 2, `expected 2 cells of progress before the tree at S+3, got ${res.movedCells}`);
  assert.ok(res.movedCells < res.askedCells, 'the walk should be capped below the ask by the tree');
  assert.equal(res.pos.gx, run.gx + 2, 'the walk did not stop one cell short of the tree');
});

test('U536 (integration): a walk with a tree immediately ahead makes ZERO honest progress', () => {
  const world = bootSlice();
  const run = findRunToTree(world, 1); // the very next cell east (S+1) is a tree
  assert.ok(run, 'precondition: a start cell with a tree immediately east exists');
  const w = placePlayer(world, { gx: run.gx, gy: run.gy });
  const res = resolveTacticalWalk(w, { actorId: 'party', dir: 'east', cells: 6 });
  assert.equal(res.movedCells, 0, 'a body against a tree should not advance');
  // pos unchanged — an honest no-progress walk (the caller narrates the read, commits nothing).
  assert.equal(res.pos.gx, run.gx, 'no-progress walk moved the body anyway');
  assert.equal(res.pos.gy, run.gy, 'no-progress walk moved the body anyway');
});

test('U536 (hash): worldHash is UNCHANGED by any number of derivation calls', () => {
  const world = bootSlice();
  const { centre } = greenwood(world);
  const before = worldHash(world);
  for (let i = 0; i < 200; i++) {
    wildFeaturesAround(world, { gx: centre.gx, gy: centre.gy + (i % 120) }, 12);
    isRegionCellBlocked(world, centre.gx + (i % 80), centre.gy);
    regionWalkCellFree(world, centre.gx, centre.gy + (i % 80));
  }
  const after = worldHash(world);
  assert.equal(after, before, 'derivation calls mutated the world — they must be pure reads');
});

test('U536 (replay): a committed walk near a tree re-derives byte-identically', () => {
  // Same seed + same deltas → same committed pos (the walk is a pure f(world,intent)).
  const runOf = () => {
    const world = bootSlice();
    const run = findRunToTree(world, 3);
    let w = placePlayer(world, { gx: run.gx, gy: run.gy });
    const res = resolveTacticalWalk(w, { actorId: 'party', dir: 'east', cells: 6 });
    w = applyDeltas(w, [{ op: 'pos', id: 'party', to: res.pos }]);
    return { pos: w.party[0].pos, hash: worldHash(w) };
  };
  const a = runOf();
  const b = runOf();
  assert.deepEqual(a.pos, b.pos, 'the committed walk pos diverged across two replays');
  assert.equal(a.hash, b.hash, 'worldHash diverged across two replays of the same committed walk');
});
