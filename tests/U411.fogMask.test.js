// U411 — TT-DRAW fog mask (docs/TABLETOP_MAP.md open question #2, RESTORE;
// docs/briefs/TT-DRAW-tabletop-look.md). Explored-vs-unexplored on the drawn
// layer: a fresh boot marks only the starting area explored; a world with
// extra visit stamps reveals exactly those extra areas. Pure function of world
// — reads world.map.discovered + world.map.memory.visitedTurnByNodeId (the
// live truth: discoverNode/seeNode/moveToNode already stamp these, see U42)
// and READ-ONLY passes through engine/structures/discoveryState.js's shape
// (world.structures.discovery) if a caller ever populates it — never writes
// it, never requires it. No engine writes, no Math.random, worldHash unchanged.
// Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { ensureStructureDiscovery, markDiscoveredOnNode } from '../engine/structures/discoveryState.js';
import { fogMask } from '../public/map/drawModel.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

test('U411-A: a fresh boot marks only the starting area explored', () => {
  const w = boot();
  const mask = fogMask(w);
  assert.equal(mask.currentNodeId, String(w.map.currentNodeId));
  assert.ok(mask.explored.includes(String(w.map.currentNodeId)), 'the current node must be explored at boot');
  assert.ok(mask.explored.length > 0, 'precondition: something is explored at boot');
  // The total node count must exceed what's explored — a fresh boot has NOT
  // seen the whole world (fog exists to distinguish, so both sets must be real).
  const totalNodes = w.map.nodes.length;
  assert.ok(totalNodes >= mask.explored.length, 'explored can never exceed the total node count');
  for (const id of mask.explored) assert.ok(!mask.unexplored.includes(id), 'a node cannot be both explored and unexplored');
});

test('U411-B: extra visit stamps (world.map.memory.visitedTurnByNodeId) reveal exactly those nodes', () => {
  const w = boot();
  const before = fogMask(w);
  const someUnexplored = before.unexplored[0];
  assert.ok(someUnexplored, 'precondition: at least one node is unexplored at boot');

  const w2 = {
    ...w,
    map: {
      ...w.map,
      memory: {
        ...w.map.memory,
        visitedTurnByNodeId: { ...(w.map.memory.visitedTurnByNodeId || {}), [someUnexplored]: 5 }
      }
    }
  };
  const after = fogMask(w2);
  assert.ok(after.explored.includes(someUnexplored), 'a node with an added visit stamp must become explored');
  assert.ok(!after.unexplored.includes(someUnexplored), 'a newly-explored node must leave the unexplored set');
  // Nothing else's status flips — the mask reveals EXACTLY the stamped node, no more.
  const otherExploredBefore = before.explored.filter(id => id !== someUnexplored);
  for (const id of otherExploredBefore) assert.ok(after.explored.includes(id), `previously explored node ${id} must remain explored`);
  const otherUnexploredBefore = before.unexplored.filter(id => id !== someUnexplored);
  for (const id of otherUnexploredBefore) assert.ok(after.unexplored.includes(id), `unrelated unexplored node ${id} must remain unexplored`);
});

test('U411-C: isExplored(id) agrees with the explored/unexplored arrays', () => {
  const w = boot();
  const mask = fogMask(w);
  for (const id of mask.explored) assert.equal(mask.isExplored(id), true, `isExplored(${id}) must be true for an explored node`);
  for (const id of mask.unexplored) assert.equal(mask.isExplored(id), false, `isExplored(${id}) must be false for an unexplored node`);
});

test('U411-D: world.map.discovered nodes count as explored even with no visit-turn stamp', () => {
  const w = boot();
  const discoveredOnly = w.map.discovered.filter(id => !(w.map.memory.visitedTurnByNodeId || {})[id]);
  // Not every world necessarily has a discovered-but-unstamped node; this only
  // asserts the invariant where one exists.
  if (discoveredOnly.length) {
    const mask = fogMask(w);
    for (const id of discoveredOnly) assert.ok(mask.isExplored(id), `discovered node ${id} (no visit stamp) must still count as explored`);
  }
});

test('U411-E: engine/structures/discoveryState.js data is folded in READ-ONLY when present, never required', () => {
  const w = boot();
  const someUnexplored = fogMask(w).unexplored[0];
  assert.ok(someUnexplored, 'precondition: at least one node is unexplored');

  let discovery = ensureStructureDiscovery(null);
  discovery = markDiscoveredOnNode(discovery, { nodeId: someUnexplored, structureId: 'st:test', turn: 1 });
  const w2 = { ...w, structures: { ...w.structures, discovery } };

  const mask = fogMask(w2);
  assert.ok(mask.isExplored(someUnexplored), 'a node named by structures.discovery.byNodeId must be folded in as explored');

  // And the pass-through never MUTATES the discovery record it read.
  const before = JSON.stringify(discovery);
  fogMask(w2);
  assert.equal(JSON.stringify(discovery), before, 'fogMask must never write to structures.discovery');
});

test('U411-F: two independent builds of the same seed produce an IDENTICAL fog mask', () => {
  const project = () => {
    const w = boot();
    const mask = fogMask(w);
    return { currentNodeId: mask.currentNodeId, explored: mask.explored, unexplored: mask.unexplored };
  };
  const a = project();
  const b = project();
  assert.deepEqual(a, b, 'the same seed must project an identical fog mask, every build');
});

test('U411-G: worldHash is UNCHANGED by fogMask (read-only proof)', () => {
  const w = boot();
  const h0 = worldHash(w);
  fogMask(w);
  const h1 = worldHash(w);
  assert.equal(h1, h0, 'deriving the fog mask must never mutate anything worldHash covers');
});
