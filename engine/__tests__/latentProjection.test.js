import test from 'node:test';
import assert from 'node:assert/strict';
import { forestDomain } from '../csl/domains/forest.js';
import { generateLatentSurfacesForNode } from '../scene/latentProjection.js';

test('latent projection deterministic for same seed + node', () => {
  const a = generateLatentSurfacesForNode({
    seed: 'alpha',
    domain: forestDomain,
    nodeId: 'node-1',
    count: 3
  });

  const b = generateLatentSurfacesForNode({
    seed: 'alpha',
    domain: forestDomain,
    nodeId: 'node-1',
    count: 3
  });

  assert.deepEqual(a, b);
});

test('latent surfaces are not canonical initially', () => {
  const surfaces = generateLatentSurfacesForNode({
    seed: 'alpha',
    domain: forestDomain,
    nodeId: 'node-1',
    count: 3
  });

  for (const s of surfaces) {
    assert.equal(s.canonical, false);
  }
});
