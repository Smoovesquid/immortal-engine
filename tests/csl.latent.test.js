import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSurfaceCandidate } from '../engine/csl/grammar.js';
import { forestDomain } from '../engine/csl/domains/forest.js';
import { projectLatentSurface, canonizeSurface } from '../engine/csl/latent.js';

test('latent surface is not canonical initially', () => {
  const base = generateSurfaceCandidate({
    seed: 'alpha',
    domain: forestDomain,
    index: 0
  });

  const latent = projectLatentSurface(base);

  assert.equal(latent.canonical, false);
});

test('canonization emits deterministic event', () => {
  const base = generateSurfaceCandidate({
    seed: 'alpha',
    domain: forestDomain,
    index: 0
  });

  const latent = projectLatentSurface(base);

  const a = canonizeSurface(latent, {
    seed: 'alpha',
    actionKey: 'examine'
  });

  const b = canonizeSurface(latent, {
    seed: 'alpha',
    actionKey: 'examine'
  });

  assert.deepEqual(a.events, b.events);
  assert.equal(a.surface.canonical, true);
});

test('no canon event without contact', () => {
  const base = generateSurfaceCandidate({
    seed: 'alpha',
    domain: forestDomain,
    index: 0
  });

  const latent = projectLatentSurface(base);

  assert.equal(latent.canonical, false);
});
