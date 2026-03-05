import { generateSettlementRoadGraph } from "../spatial/roadGraph.js";
import { generateBuildingPlots } from "../spatial/buildingPlots.js";
import { generateNodeSpatial } from "../spatial/nodeSpatial.js";

export function buildLocalProjection(world, nodeId) {
  const seed = world.seed;

  const terrain = generateNodeSpatial(seed, nodeId);
  const roads = generateSettlementRoadGraph({ seed, nodeId });
  const buildingsFromRoads = generateBuildingPlots({ seed, nodeId, roads });
  return {
    nodeId,
    terrain,
    roads,
    buildingsFromRoads
  };
}
