import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRegion, biomeAt } from '../engine/world/regionGen.js';

const BIOMES = new Set(['water', 'mountains', 'forest', 'marsh', 'desert', 'plains']);

test('REG1: deterministic', () => {
  const a = generateRegion({ seed: 'shire' });
  const b = generateRegion({ seed: 'shire' });
  assert.deepEqual(a.biome, b.biome);
  assert.deepEqual(a.places, b.places);
  assert.deepEqual(a.roads, b.roads);
});

test('REG1: biome grid is complete and valid', () => {
  const r = generateRegion({ seed: 'shire' });
  assert.equal(r.biome.length, r.W * r.H);
  for (const b of r.biome) assert.ok(BIOMES.has(b), `bad biome ${b}`);
});

test('REG1: rivers flow downhill', () => {
  const r = generateRegion({ seed: 'shire' });
  assert.ok(r.riverSegs.length > 0, 'has a watershed');
  for (const [x1, y1, x2, y2] of r.riverSegs) {
    const up = r.elev[y1 * r.W + x1], down = r.elev[y2 * r.W + x2];
    assert.ok(up >= down - 1e-6, 'water never flows uphill');
  }
});

test('REG1: settlements sit on land with a geographic tier; one home', () => {
  const r = generateRegion({ seed: 'shire', places: 7 });
  assert.ok(r.places.length >= 4);
  const homes = r.places.filter(p => p.home);
  assert.equal(homes.length, 1, 'exactly one home');
  assert.equal(homes[0].tier, 1, 'home is tier 1 (safe)');
  for (const p of r.places) { assert.notEqual(biomeAt(r, p.x, p.y), 'water', 'no town in the sea'); assert.ok(p.tier >= 1 && p.tier <= 4); }
  assert.ok(r.places.some(p => p.tier >= 3), 'the edges are dangerous');
});

test('REG1: roads form a spanning tree and bridge the rivers', () => {
  const r = generateRegion({ seed: 'shire', places: 7 });
  assert.equal(r.roads.length, r.places.length - 1, 'connected tree of roads');
  for (const b of r.bridges) { const i = b.y * r.W + b.x; assert.ok(r.riverSet.has(i) || r.biome[i] === 'water', 'bridges only where a road meets water'); }
  // every place is touched by some road endpoint
  const onRoad = new Set();
  for (const rd of r.roads) { const a = rd.pts[0], z = rd.pts[rd.pts.length - 1]; onRoad.add(a[0] + ',' + a[1]); onRoad.add(z[0] + ',' + z[1]); }
  let touched = 0; for (const p of r.places) if (onRoad.has(p.x + ',' + p.y)) touched++;
  assert.ok(touched >= r.places.length - 1, 'roads reach the places');
});
