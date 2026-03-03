import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { exportWorld, importWorld } from '../engine/save.js';

test('U40: Gate 3.1 Regions Scaffold — deterministic by seed and stable across export/import', () => {
  const seed = 'u40_regions_seed';

  const a = newWorld({ seed, fate: 0.2, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });
  const b = newWorld({ seed, fate: 0.9, campaignId: 'c2', pack: { primaryId: 'fantasy', mixerId: null } });

  // Regions must exist and be deterministic by seed (independent of fate/campaignId).
  assert.ok(Array.isArray(a.regions), 'regions missing on newWorld()');
  assert.ok(Array.isArray(b.regions), 'regions missing on newWorld()');
  assert.equal(a.regions.length, 5, 'expected 5 regions (tiers origin/mid/mid/high/anomaly)');
  assert.deepEqual(a.regions, b.regions, 'regions must be identical for same seed');

  const roundtrip = importWorld(exportWorld(a));
  assert.deepEqual(roundtrip.regions, a.regions, 'regions changed across export/import roundtrip');
});
