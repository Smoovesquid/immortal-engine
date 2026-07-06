// U582 — OCC-STORY-2 determinism + the boot wall. The thread-aware placement must not move the
// default boot (every boot thread is age-0, so no bias fires) and must replay byte-identical once
// threads DO go hot over real turns. Three walls:
//   1. BOOT WALL — the default fantasy/tallow boot worldHash is unchanged: it stays the exact MP-4
//      pin U454-E asserts. If a bias fired at boot it would move NPC positions (which worldHash
//      projects) and this would break — the canary that OCC-STORY-2 did NOT touch the boot.
//   2. GOLDEN WALL — the seven committed screen goldens still match the live render (they boot the
//      slice with age-0 threads, so the drawn people are byte-identical to OCC-STORY-1).
//   3. REPLAY WALL — a world driven through many worldTicks until its thread is HOT produces
//      byte-identical placement across two independent runs (the bias is a pure function of state).
// Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { worldTick } from '../engine/worldTick.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { placementFor } from '../engine/structures/storyAnchors.js';
import { outdoorOccupants, occupantsOfRoom } from '../engine/structures/roomOccupancy.js';
import { normalizeTopology } from '../engine/structures/topology.js';
import { buildScenes, drawnModel } from '../scripts/screenTruth.scenes.mjs';
import { rasterizeScene, checkGolden, goldenExists } from '../scripts/screenTruth.goldens.mjs';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const bootTallow = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

// The exact value U454-E pins after MP-4. OCC-STORY-2 must leave it untouched (no bias at age-0 boot).
const HASH_AFTER_MP4 = 'db503a117ea89fc1ca8191672257983781754223724c0a6492b0ee772bc6dcc3';

test('U582 (boot wall): the default tallow boot worldHash is UNCHANGED by thread-aware placement', () => {
  assert.equal(worldHash(bootTallow()), HASH_AFTER_MP4,
    'OCC-STORY-2 must not move the boot — every boot thread is age-0/cold, so no bias fires');
});

test('U582 (boot wall): the boot thread really is cold, so no onlooker bias is possible at boot', () => {
  const w = bootTallow();
  for (const t of (w.instrument.threads || [])) {
    assert.ok(Number(t.age) === 0, `boot thread ${t.label} is age-0 (found ${t.age})`);
  }
});

test('U582 (golden wall): all seven committed screen goldens still match the live render', () => {
  const passing = ['wake_interior', 'cottage_exterior', 'settlement_square_morning', 'settlement_square_evening', 'wild_road_walking', 'deep_wild_fog_edge', 'combat_one_defeated'];
  for (const sc of buildScenes()) {
    if (!passing.includes(sc.id)) continue;
    assert.ok(goldenExists(sc.id), `committed golden exists for ${sc.id}`);
    const m = drawnModel(sc.world, sc.nodeId); m.__world = sc.world;
    const status = checkGolden(sc.id, rasterizeScene(m));
    assert.equal(status.status, 'ok', `${sc.id} golden unchanged (Δ ${((status.fraction || 0) * 100).toFixed(2)}%)`);
  }
});

// Drive a world until its thread crosses the hot floor, snapshot every occupant's placement string.
function agedSnapshot(ticks) {
  let world = bootTallow();
  for (let i = 1; i <= ticks; i++) world = worldTick(world, `tallow|u582|${i}`);
  const nodeId = String(world.map.currentNodeId);
  const node = world.map.nodes.find(n => String(n.id) === nodeId);
  const npcs = (node?.settlement?.npcs) || [];
  const wakeKey = world.scene?.interior?.structureKey || '';
  return {
    world,
    thread: world.instrument.threads[0],
    lines: npcs.map(n => {
      const p = placementFor(world, n, { nodeId, seed: world.meta.seed, wakeKey });
      return `${n.name}:${p.where}:${p.key || '-'}:${p.reasonKind}`;
    }).join('|'),
  };
}

test('U582 (replay wall): a HOT-thread world replays byte-identical placement across two runs', () => {
  const a = agedSnapshot(8);
  const b = agedSnapshot(8);
  assert.ok(Number(a.thread.age) >= 6, `thread went hot over the ticks (age ${a.thread.age})`);
  assert.equal(a.lines, b.lines, 'two independent aged runs produce identical placement');
  // And the aged world hashes identically to itself (full determinism, not just placement strings).
  assert.equal(worldHash(a.world), worldHash(b.world), 'the aged world is deterministic ×2');
});

test('U582 (replay wall): placement + occupancy reads never mutate the aged world (pure derived)', () => {
  const { world } = agedSnapshot(8);
  const before = worldHash(world);
  // Exercise every occupancy read the game uses.
  outdoorOccupants(world);
  for (const st of Object.values(world.structures?.byId || {})) {
    const topo = normalizeTopology(st.topology);
    for (const r of (topo?.rooms || [])) occupantsOfRoom(world, String(st.id), String(r.id));
  }
  assert.equal(worldHash(world), before, 'reading placement/occupancy writes nothing back to the world');
});
