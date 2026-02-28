import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSurfaceCandidate } from '../engine/csl/grammar.js';
import { forestDomain } from '../engine/csl/domains/forest.js';

test('same seed + domain + index => identical surface', () => {
  const a = generateSurfaceCandidate({
    seed: 'alpha',
    domain: forestDomain,
    index: 0
  });

  const b = generateSurfaceCandidate({
    seed: 'alpha',
    domain: forestDomain,
    index: 0
  });

  assert.deepEqual(a, b);
});

test('different seed => structural variation', () => {
  const a = generateSurfaceCandidate({
    seed: 'alpha',
    domain: forestDomain,
    index: 0
  });

  const b = generateSurfaceCandidate({
    seed: 'beta',
    domain: forestDomain,
    index: 0
  });

  assert.notDeepEqual(a, b);
});
