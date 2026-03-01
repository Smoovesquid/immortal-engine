import test from 'node:test';
import assert from 'node:assert/strict';

import { computeDensity } from '../engine/metrics/density.js';
import { createWorld, worldTick } from '../engine/world/minimalWorld.js';

/**
 * U8 Density Instrumentation Test
 *
 * Goal:
 * - Density must grow or remain stable under deterministic progression.
 * - Replay with same seed must produce identical density metrics.
 */

function runSimulation(seed, turns) {
  let world = createWorld({ seed });

  const snapshots = [];

  for (let i = 0; i < turns; i++) {
    world = worldTick(world, { seed });
    snapshots.push(computeDensity(world));
  }

  return snapshots;
}

test('U8: density grows deterministically over 50 turns', () => {
  const seed = 'U8-density-seed';

  const runA = runSimulation(seed, 50);
  const runB = runSimulation(seed, 50);

  // Deterministic replay check
  assert.deepEqual(runA, runB);

  const first = runA[0];
  const last = runA[49];

  // Structural monotonicity checks
  assert.ok(last.totalNodes >= first.totalNodes);
  assert.ok(last.canonNodes >= first.canonNodes);
  assert.ok(last.totalSockets >= first.totalSockets);

  // No negative metrics
  assert.ok(last.totalNodes >= 0);
  assert.ok(last.totalEdges >= 0);
  assert.ok(last.totalSockets >= 0);
});
