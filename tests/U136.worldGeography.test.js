// U136 — M6 surface geography (docs/WORLD_AND_DUNGEONS.md Part A).
// The map's illustrated ground is a PURE, SEEDED projection of the LIVE biome
// truth (biomeForNode). These lock the contract: the painted biome AGREES with
// what the DM narrates, the generator is deterministic, set-pieces are all
// present, and the ocean/Heath never swallow a node. Client-side projection —
// nothing here is serialized or hashed, so worldHash is untouched by design.

import test from 'node:test';
import assert from 'node:assert/strict';
import { biomeForNode, BIOMES } from '../engine/world/biome.js';
import { NODE_WU, nodeToWu, biomeAtWorld } from '../public/map/worldSpace.js';
import { worldGeography, terrainStamps, inOcean, inHeath } from '../public/map/geography.js';

// A realistic spread of nodes (range mirrors a generated county: x≈[-13..8], y≈[-19..6]).
function synthNodes(seed = 'g') {
  const nodes = [];
  let i = 0;
  for (let x = -13; x <= 8; x += 3) for (let y = -19; y <= 6; y += 4) {
    nodes.push({ id: `${seed}_n${i++}`, x, y, nodeType: 'wilderness' });
  }
  return nodes;
}

test('U136-01: biomeAtWorld AGREES with biomeForNode at node positions (one truth)', () => {
  for (const seed of ['mira', 'blackvale', 'dragonspire']) {
    for (let x = -15; x <= 10; x += 1) for (let y = -15; y <= 10; y += 1) {
      const here = biomeAtWorld(seed, x * NODE_WU, y * NODE_WU);
      const dm = biomeForNode(seed, { x, y });
      assert.equal(here, dm, `seed ${seed} node (${x},${y}): map ${here} ≠ DM ${dm}`);
    }
  }
});

test('U136-02: biomeAtWorld is deterministic and always a known biome', () => {
  for (let i = 0; i < 60; i++) {
    const wx = (i * 137 - 4000), wy = (i * 311 - 9000);
    const b = biomeAtWorld('seed', wx, wy);
    assert.ok(BIOMES.includes(b), `unknown biome ${b}`);
    assert.equal(b, biomeAtWorld('seed', wx, wy));
  }
});

test('U136-03: worldGeography is fully deterministic for a seed + nodes', () => {
  const nodes = synthNodes();
  const a = worldGeography('mira', nodes);
  const b = worldGeography('mira', nodes);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  // a different seed yields a different world (not monotone).
  const c = worldGeography('blackvale', nodes);
  assert.notEqual(JSON.stringify(a), JSON.stringify(c));
});

test('U136-04: the ocean and the Heath never swallow a node', () => {
  for (const seed of ['mira', 'blackvale', 'dragonspire', 'thornwood', 'ember']) {
    const nodes = synthNodes(seed);
    const geo = worldGeography(seed, nodes);
    for (const n of nodes) {
      const p = nodeToWu(n);
      assert.ok(!inOcean(geo, p.x, p.y), `${seed}: node ${n.id} swallowed by the sea`);
      assert.ok(!inHeath(geo, p.x, p.y), `${seed}: node ${n.id} swallowed by the Heath`);
    }
  }
});

test('U136-05: every world has all the set-pieces, and the rect contains every node', () => {
  for (const seed of ['mira', 'blackvale', 'dragonspire', 'thornwood']) {
    const nodes = synthNodes(seed);
    const geo = worldGeography(seed, nodes);
    assert.ok(['E', 'W', 'N', 'S'].includes(geo.ocean.edge), 'ocean on a seeded edge');
    assert.ok(geo.ocean.coast.length > 8, 'ragged coastline present');
    assert.ok(geo.ocean.islands.length >= 1, 'offshore islands present');
    assert.ok(geo.range.peaks.length > 6, 'mountain range spine present');
    assert.ok(geo.heath.poly.length >= 3, 'blasted heath polygon present');
    assert.ok(geo.rivers.length >= 1, 'a river traces high→sea');
    assert.ok(Array.isArray(geo.lakes), 'lakes is an array (may be empty in dry country)');
    // the world rect frames the whole node cloud.
    for (const n of nodes) {
      const p = nodeToWu(n);
      assert.ok(p.x >= geo.rect.minX && p.x <= geo.rect.maxX, 'node x within rect');
      assert.ok(p.y >= geo.rect.minY && p.y <= geo.rect.maxY, 'node y within rect');
    }
  }
});

test('U136-06: terrainStamps are deterministic, biome-rich, and never sit in water/ash', () => {
  for (const seed of ['mira', 'blackvale']) {
    const nodes = synthNodes(seed);
    const geo = worldGeography(seed, nodes);
    const s1 = terrainStamps(seed, geo);
    const s2 = terrainStamps(seed, geo);
    assert.equal(JSON.stringify(s1), JSON.stringify(s2), 'stamps deterministic');
    assert.ok(s1.length > 500, 'a dense, wall-to-wall field');
    const kinds = new Set(s1.map(s => s.biome));
    assert.ok(kinds.size >= 5, `biome variety (got ${kinds.size}: ${[...kinds].join(',')})`);
    for (const st of s1) {
      assert.ok(BIOMES.includes(st.biome), `stamp biome ${st.biome} unknown`);
      assert.ok(!inOcean(geo, st.wx, st.wy) && !inHeath(geo, st.wx, st.wy), 'no land motif in sea/ash');
    }
  }
});

test('U136-07: inOcean / inHeath classify the obvious cases', () => {
  const nodes = synthNodes();
  const geo = worldGeography('mira', nodes);
  // the Heath centre is in the Heath; the node centroid is neither sea nor ash.
  assert.ok(inHeath(geo, geo.heath.cx, geo.heath.cy), 'heath centre is inside the heath');
  assert.ok(!inOcean(geo, 0, 0) && !inHeath(geo, 0, 0), 'the cloud centre is open land');
  // a point pushed well past the coast into open water reads as ocean.
  const o = geo.ocean;
  const deep = o.coastBaseWu + o.sign * 6 * NODE_WU;
  const px = o.axis === 'x' ? deep : 0, py = o.axis === 'y' ? deep : 0;
  assert.ok(inOcean(geo, px, py), 'a point far seaward is open water');
});
