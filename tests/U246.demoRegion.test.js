// U246 — the locked demo region skeleton (DEMO_BUILD_PLAN D-A3).
// The walk-in demo rides one fixed, curated seed (engine/world/demoRegion.DEMO_SEED).
// This locks that region's structural shape — so authored content can be placed on
// known ground — and its replay-stability. Deterministic, LLM-off (beginAdventure's
// base path needs no API).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { biomeForNode } from '../engine/world/biome.js';
import { DEMO_SEED, DEMO_REGION_SPEC } from '../engine/world/demoRegion.js';
import { PACKS } from '../scripts/convergence/fixtures.mjs';

function demoWorld() {
  return beginAdventure(
    newWorld({ seed: DEMO_SEED, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }),
    PACKS
  ).world;
}

function adjacency(map) {
  const adj = new Map((map.nodes || []).map(n => [n.id, []]));
  for (const e of map.edges || []) {
    const a = e.a ?? e.from, b = e.b ?? e.to;
    if (adj.has(a) && adj.has(b)) { adj.get(a).push(b); adj.get(b).push(a); }
  }
  return adj;
}

test('U246 demo region — meets the structural spec (towns / dungeons present, fully reachable)', () => {
  const w = demoWorld();
  const nodes = w.map.nodes;
  const towns = nodes.filter(n => n.nodeType === 'settlement').length;
  const dungeons = nodes.filter(n => n.nodeType === 'dungeon_entrance').length;
  assert.ok(towns >= DEMO_REGION_SPEC.minSettlements, `expected >= ${DEMO_REGION_SPEC.minSettlements} settlements, got ${towns}`);
  assert.ok(dungeons >= DEMO_REGION_SPEC.minDungeons, `expected >= ${DEMO_REGION_SPEC.minDungeons} dungeon entrances, got ${dungeons}`);
  // a walkable valley: every node reachable from the start (no marooned content)
  const adj = adjacency(w.map);
  const seen = new Set([w.map.currentNodeId]);
  const q = [w.map.currentNodeId];
  while (q.length) { const c = q.shift(); for (const nb of adj.get(c) || []) if (!seen.has(nb)) { seen.add(nb); q.push(nb); } }
  assert.equal(seen.size, nodes.length, `every node must be reachable: ${seen.size}/${nodes.length}`);
});

test('U246 demo region — biome variety + bleed (DEMO_REGION §3: impossibly adjacent biomes)', () => {
  const w = demoWorld();
  const nodes = w.map.nodes, seed = w.meta.seed;
  const biomes = new Set(nodes.map(n => biomeForNode(seed, n)));
  assert.ok(biomes.size >= DEMO_REGION_SPEC.minBiomes, `expected >= ${DEMO_REGION_SPEC.minBiomes} biomes, got ${biomes.size} (${[...biomes]})`);
  // biome-bleed: contrasting biomes on adjacent nodes — the §3 symptom, made legible
  const id2 = new Map(nodes.map(n => [n.id, n]));
  let bleed = 0;
  for (const e of w.map.edges || []) {
    const a = id2.get(e.a ?? e.from), b = id2.get(e.b ?? e.to);
    if (a && b && biomeForNode(seed, a) !== biomeForNode(seed, b)) bleed++;
  }
  assert.ok(bleed >= DEMO_REGION_SPEC.minBleedEdges, `expected biome-bleed (>= ${DEMO_REGION_SPEC.minBleedEdges} contrasting adjacencies), got ${bleed}`);
});

test('U246 demo region — replay-stable (deterministic node set + positions)', () => {
  const a = demoWorld().map, b = demoWorld().map;
  assert.equal(a.nodes.length, b.nodes.length, 'same node count across builds');
  assert.equal(a.currentNodeId, b.currentNodeId, 'same start node across builds');
  const sig = m => m.nodes.map(n => `${n.id}:${n.nodeType}:${n.x},${n.y}`).sort().join('|');
  assert.equal(sig(a), sig(b), 'two builds of the demo region must be identical (replay-stable)');
});
