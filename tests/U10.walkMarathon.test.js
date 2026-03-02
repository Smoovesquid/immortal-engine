import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateWalk } from '../engine/simulateWalk.js';

test('U10: long walk is deterministic and stable', () => {
  const a = simulateWalk({ seed: 'U10-seed', steps: 5000 });
  const b = simulateWalk({ seed: 'U10-seed', steps: 5000 });

  assert.deepEqual(a.metrics, b.metrics);

  assert.ok(a.metrics.uniqueVisited > 50);
  assert.ok(a.metrics.revisits > 100);
});
