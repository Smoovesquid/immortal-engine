import { generateSettlementDensity } from './settlementDensity.js';
import { generateDistricts } from './districtGenerator.js';
import { generateLandmarks } from './landmarkGenerator.js';
import { generateTerrainOverlay } from './terrainOverlay.js';

export function runProjectionStressTest(seed) {
  const nodes = 200;
  const buildingsPerNode = 120;

  const start = performance.now();

  const result = [];

  for (let n = 0; n < nodes; n++) {
    const nodeId = 'node_' + n;

    const density = generateSettlementDensity(seed, nodeId, 'city');
    const districts = generateDistricts(seed, nodeId);
    const landmarks = generateLandmarks(seed, nodeId);
    const terrain = generateTerrainOverlay(seed, nodeId);

    result.push({
      nodeId,
      density,
      districts,
      landmarks,
      terrain
    });
  }

  const end = performance.now();

  return {
    projectionTimeMs: end - start,
    nodes,
    buildingsPerNode,
    result
  };
}
