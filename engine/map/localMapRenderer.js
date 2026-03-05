import { projectEdgeInfrastructure } from './localProjection.js'
import { generateSettlementSpine, placeBuildingsAlongRoads } from './settlementMorphology.js'
import { generateSettlementDensity } from './settlementDensity.js'
import { generateDistricts } from './districtGenerator.js'
import { generateLandmarks } from './landmarkGenerator.js'
import { generateTerrainOverlay } from './terrainOverlay.js'

export function renderLocalMapProjection({
  seed,
  nodeId,
  regionId,
  packId,
  edges = [],
  settlementType = 'village'
}) {

  const infrastructure = edges
    .map(edgeId => projectEdgeInfrastructure(seed, edgeId))
    .sort((a,b) => a.edgeId.localeCompare(b.edgeId))

  const spine = generateSettlementSpine(seed, nodeId, regionId, packId)

  const roads = [
    spine.primary,
    ...spine.secondary
  ]

  const buildingsFromRoads =
    placeBuildingsAlongRoads(seed, nodeId, roads)

  const density =
    generateSettlementDensity(seed, nodeId, settlementType)

  const districts =
    generateDistricts(seed, nodeId)

  const landmarks =
    generateLandmarks(seed, nodeId)

  const terrain =
    generateTerrainOverlay(seed, nodeId)

  return {
    nodeId,
    infrastructure,
    roads,
    buildingsFromRoads,
    density,
    districts,
    landmarks,
    terrain
  }
}
