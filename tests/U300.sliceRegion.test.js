// U300 — SL-1: the authored four-place slice region.
//
// Guards the scope-lock (docs/PACKETS.md SL-1): the slice is exactly four authored
// places (town · forest · bandit camp · haunted chapel), deterministic, fully
// reachable, with the chapel a real distance past the woods — AND it rides its own
// seed so the procedural path and the 'tallow' demo are untouched (opt-in only).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { SLICE_SEED, SLICE_REGION_SPEC, buildSliceRegion } from '../engine/world/sliceRegion.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const manifest = normalizeManifest(
    JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8'))
  );
  const byId = {};
  for (const p of manifest.packs) {
    byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  }
  return byId;
}
const PACKS = loadPacks();

const byName = (map, name) => map.nodes.find(n => n.name === name);
const tileDist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function reachableCount(map) {
  const adj = new Map(map.nodes.map(n => [n.id, []]));
  for (const e of map.edges) {
    adj.get(e.a)?.push(e.b);
    adj.get(e.b)?.push(e.a);
  }
  const seen = new Set([map.currentNodeId]);
  const queue = [map.currentNodeId];
  while (queue.length) {
    const cur = queue.shift();
    for (const nb of (adj.get(cur) || [])) {
      if (!seen.has(nb)) { seen.add(nb); queue.push(nb); }
    }
  }
  return seen.size;
}

test('U300: the slice region is exactly four typed places', () => {
  const map = buildSliceRegion({ seed: SLICE_SEED, packId: 'fantasy' });
  assert.equal(map.nodes.length, SLICE_REGION_SPEC.totalNodes, 'four nodes');
  const count = (t) => map.nodes.filter(n => n.nodeType === t).length;
  assert.equal(count('settlement'), SLICE_REGION_SPEC.settlements, 'town + camp');
  assert.equal(count('wilderness'), SLICE_REGION_SPEC.wilderness, 'the forest');
  assert.equal(count('dungeon_entrance'), SLICE_REGION_SPEC.dungeonEntrances, 'the chapel');
  // The four named places exist.
  for (const name of ['Aldermere', 'The Greenwood', 'Crowfoot Camp', 'The Hollowed Chapel']) {
    assert.ok(byName(map, name), `${name} present`);
  }
});

test('U300: start is the town, and discovered[0] === currentNodeId', () => {
  const map = buildSliceRegion({});
  const start = map.nodes.find(n => n.id === map.currentNodeId);
  assert.equal(start.name, 'Aldermere', 'wake in town');
  assert.equal(start.nodeType, 'settlement');
  assert.equal(map.discovered[0], map.currentNodeId);
});

test('U300: fully reachable from the start town', () => {
  const map = buildSliceRegion({});
  assert.ok(SLICE_REGION_SPEC.fullyReachable);
  assert.equal(reachableCount(map), map.nodes.length, 'every place reachable from town');
});

test('U300: the chapel is a real distance past the woods (a couple km out)', () => {
  const map = buildSliceRegion({});
  const town = byName(map, 'Aldermere');
  const forest = byName(map, 'The Greenwood');
  const chapel = byName(map, 'The Hollowed Chapel');
  assert.ok(
    tileDist(town, chapel) > tileDist(town, forest),
    'chapel↔town > forest↔town'
  );
});

test('U300: deterministic — same seed yields an identical region', () => {
  const a = buildSliceRegion({ seed: SLICE_SEED, packId: 'fantasy' });
  const b = buildSliceRegion({ seed: SLICE_SEED, packId: 'fantasy' });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('U300: beginAdventure boots the slice when invoked with SLICE_SEED', () => {
  const { world } = beginAdventure(
    newWorld({ seed: SLICE_SEED, fate: 0.2, pack: { primaryId: 'fantasy', mixerId: null } }),
    PACKS
  );
  assert.equal(world.map.nodes.length, 4, 'four authored places');
  const cur = world.map.nodes.find(n => n.id === world.map.currentNodeId);
  assert.equal(cur.name, 'Aldermere', 'player wakes in the town');
  assert.equal(cur.nodeType, 'settlement');
});

test('U300: opt-in only — a non-slice seed still uses the procedural generator', () => {
  const { world } = beginAdventure(
    newWorld({ seed: 'tallow', fate: 0.2, pack: { primaryId: 'fantasy', mixerId: null } }),
    PACKS
  );
  // tallow is the procedural demo (8 settlements / many nodes); the slice opt-in
  // must not have collapsed it to four.
  assert.ok(world.map.nodes.length > 4, 'tallow region untouched by the slice path');
});
