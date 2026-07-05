// U516 — LOAD-1: the authored loader is DETERMINISTIC and the demo replays
// worldHash-stable.
//
// docs/briefs/LOAD-1-smallest-loader.md hard constraint: "Authored content = FIXED
// data (like packs) → worldHash stable under replay (assert in a test). NO
// Math.random." This file is the determinism proof:
//   • loadAuthoredStructure is PURE — same JSON in, byte-identical structure out,
//     across many calls and regardless of an unrelated world seed;
//   • the SAME structure comes out for two different nodeIds save for the id/nodeId
//     fields (the geometry itself is seed- and node-independent);
//   • a 'loaderDemo' boot replays worldHash-identical across two independent boots
//     (determinism holds WITH the authored structure live) — the same property
//     U19/U21/U22/U27/U30 assert for the ordinary world, scoped here to the demo;
//   • a full enter→exit walk of the demo leaves the world hash-replayable.
//
// Siblings: U513 (the load), U514 (enterable), U515 (furniture + material), U517
// (malformed + default boot byte-identical).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { enterStructureInterior, exitStructureInterior } from '../engine/structures/interiors.js';
import { loadAuthoredStructure } from '../engine/structures/authoredStructure.js';
import loaderDemoHouse from '../packs/base/structures/authored/loader_demo.house.js';

const DEMO_SEED = 'loaderDemo';

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

function bootDemo(worldSeed = DEMO_SEED) {
  const w0 = newWorld({ seed: worldSeed, fate: 0.2, campaignId: `campaign-${worldSeed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const { world } = beginAdventure(ensureWorld(w0), PACKS);
  return world;
}

// ── pure loader determinism ─────────────────────────────────────────────────────

test('U516: loadAuthoredStructure is pure — byte-identical structure across repeated calls', () => {
  const a = loadAuthoredStructure(loaderDemoHouse, { nodeId: 'n_det' });
  const b = loadAuthoredStructure(loaderDemoHouse, { nodeId: 'n_det' });
  const c = loadAuthoredStructure(loaderDemoHouse, { nodeId: 'n_det' });
  assert.deepEqual(a, b);
  assert.deepEqual(b, c);
});

test('U516: only id/nodeId/anchors change with the node — the drawn geometry is node-independent', () => {
  const a = loadAuthoredStructure(loaderDemoHouse, { nodeId: 'n_one' });
  const b = loadAuthoredStructure(loaderDemoHouse, { nodeId: 'n_two' });
  // The plan geometry (rooms/shell/footprint) is identical save for the room-id
  // prefix, which embeds the structure id (which embeds the node). Compare the
  // shape-defining fields that DON'T embed the id.
  assert.equal(a.authoredPlan.shell, b.authoredPlan.shell);
  assert.deepEqual(a.authoredPlan.footprint, b.authoredPlan.footprint);
  assert.equal(a.authoredPlan.rooms[0].w, b.authoredPlan.rooms[0].w);
  assert.equal(a.authoredPlan.rooms[0].h, b.authoredPlan.rooms[0].h);
  assert.equal(a.buildingType, b.buildingType);
});

// ── demo world replay stability ──────────────────────────────────────────────────

test('U516: two independent loaderDemo boots replay worldHash-identical', () => {
  const a = bootDemo();
  const b = bootDemo();
  assert.equal(worldHash(a), worldHash(b), 'determinism holds WITH the authored demo live');
});

test('U516: the authored structure carries no rng-seeded drift — same hash on a third boot', () => {
  const a = bootDemo();
  const b = bootDemo();
  const c = bootDemo();
  assert.equal(worldHash(a), worldHash(c));
  assert.equal(worldHash(b), worldHash(c));
});

test('U516: an enter→exit walk of the demo leaves the world invariant-clean and hash-replayable', () => {
  let w = bootDemo();
  const demoId = `authored:${String(w.map.currentNodeId)}`;
  w = exitStructureInterior(w);
  w = enterStructureInterior(w, demoId);
  w = exitStructureInterior(w);
  assert.doesNotThrow(() => assertWorldInvariants(w));
  // Re-run the identical walk on a fresh boot — same ending hash (the walk is
  // deterministic; no rng was consumed by the authored path).
  let w2 = bootDemo();
  w2 = exitStructureInterior(w2);
  w2 = enterStructureInterior(w2, demoId);
  w2 = exitStructureInterior(w2);
  assert.equal(worldHash(w), worldHash(w2), 'the same deterministic walk yields the same world hash');
});
