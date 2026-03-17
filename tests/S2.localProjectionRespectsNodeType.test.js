/**
 * Gate S2 — Local Projection Respects Node Type
 *
 * The projection for a node must match its type.
 * wilderness  → no roads, no buildings
 * landmark    → no roads, no buildings
 * dungeon_entrance → no roads, no buildings
 * settlement  → roads present, buildings present (≥ 2)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLocalProjection } from '../engine/map/projection/localProjection.js';

const world = { seed: 's2-test' };

test('S2: wilderness node produces no buildings and no roads', () => {
  const p = buildLocalProjection(world, 'n0', 'wilderness');
  assert.equal(p.roads.length, 0, 'wilderness should have no roads');
  assert.equal(p.buildingsFromRoads.buildingsCount, 0, 'wilderness should have no buildings');
});

test('S2: landmark node produces no roads and no buildings', () => {
  const p = buildLocalProjection(world, 'n1', 'landmark');
  assert.equal(p.roads.length, 0, 'landmark should have no roads');
  assert.equal(p.buildingsFromRoads.buildingsCount, 0, 'landmark should have no buildings');
});

test('S2: dungeon_entrance node produces no roads and no buildings', () => {
  const p = buildLocalProjection(world, 'n2', 'dungeon_entrance');
  assert.equal(p.roads.length, 0, 'dungeon_entrance should have no roads');
  assert.equal(p.buildingsFromRoads.buildingsCount, 0, 'dungeon_entrance should have no buildings');
});

test('S2: settlement node produces roads and at least 2 buildings', () => {
  const p = buildLocalProjection(world, 'n3', 'settlement');
  assert.ok(p.roads.length > 0, 'settlement should have roads');
  assert.ok(p.buildingsFromRoads.buildingsCount >= 2, 'settlement should have at least 2 buildings');
});

test('S2: projection nodeType field matches the input type', () => {
  for (const t of ['wilderness', 'landmark', 'dungeon_entrance', 'settlement']) {
    const p = buildLocalProjection(world, `n-${t}`, t);
    assert.equal(p.nodeType, t, `projection nodeType should be ${t}`);
  }
});

test('S2: settlement projection is deterministic across calls', () => {
  const a = buildLocalProjection(world, 'n-settle', 'settlement');
  const b = buildLocalProjection(world, 'n-settle', 'settlement');
  assert.deepEqual(a, b);
});

test('S2: wilderness projection is deterministic across calls', () => {
  const a = buildLocalProjection(world, 'n-wild', 'wilderness');
  const b = buildLocalProjection(world, 'n-wild', 'wilderness');
  assert.deepEqual(a, b);
});
