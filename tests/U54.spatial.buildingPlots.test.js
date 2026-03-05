import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBuildingPlots } from '../engine/map/spatial/buildingPlots.js';

test('Gate S3: same seed+node+roads => identical building plots', () => {
  const roads = [
    { type: 'primary', angle: 1.234 },
    { type: 'secondary', angle: 2.345 },
    { type: 'secondary', angle: 0.345 }
  ];

  const a = generateBuildingPlots({ seed: 'cheese', nodeId: 'n-1', settlementType: 'village', roads });
  const b = generateBuildingPlots({ seed: 'cheese', nodeId: 'n-1', settlementType: 'village', roads });

  assert.deepEqual(a, b);
  assert.ok(a.buildingsCount > 0);
});

test('Gate S3: nodeId change => deterministic divergence', () => {
  const roads = [
    { type: 'primary', angle: 0.5 },
    { type: 'secondary', angle: 1.5 }
  ];

  const a = generateBuildingPlots({ seed: 'cheese', nodeId: 'n-1', settlementType: 'village', roads });
  const b = generateBuildingPlots({ seed: 'cheese', nodeId: 'n-2', settlementType: 'village', roads });

  assert.notDeepEqual(a, b);
});
