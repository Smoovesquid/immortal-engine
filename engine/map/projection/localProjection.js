import { generateSettlementRoadGraph } from "../spatial/roadGraph.js";
import { generateBuildingPlots } from "../spatial/buildingPlots.js";
import { generateNodeSpatial } from "../spatial/nodeSpatial.js";

export function buildLocalProjection(world, nodeId, nodeType = 'settlement') {
  const seed = world.seed;

  const terrain = generateNodeSpatial(seed, nodeId, nodeType);

  // wilderness and dungeon_entrance nodes have no road grid or buildings
  if (nodeType === 'wilderness' || nodeType === 'dungeon_entrance') {
    return { nodeId, nodeType, terrain, roads: [], buildingsFromRoads: { buildingsCount: 0, buildings: [] } };
  }

  // landmark nodes get terrain only — one significant structure, no road grid
  if (nodeType === 'landmark') {
    return { nodeId, nodeType, terrain, roads: [], buildingsFromRoads: { buildingsCount: 0, buildings: [] } };
  }

  // settlement: full road graph + building plots
  const roads = generateSettlementRoadGraph({ seed, nodeId });
  const buildingsFromRoads = generateBuildingPlots({ seed, nodeId, roads });
  return { nodeId, nodeType, terrain, roads, buildingsFromRoads };
}
