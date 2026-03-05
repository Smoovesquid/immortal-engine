export function sortRenderLayers(mapProjection) {

  const landmarks =
    [...(mapProjection.landmarks?.landmarks || [])]
      .sort((a,b)=>a.landmarkId-b.landmarkId)

  const infrastructure =
    [...(mapProjection.infrastructure || [])]
      .sort((a,b)=>a.edgeId.localeCompare(b.edgeId))

  const roads =
    [...(mapProjection.roads || [])]
      .sort((a,b)=>(a.angle||0)-(b.angle||0))

  const buildings =
    [...(mapProjection.buildingsFromRoads || [])]
      .sort((a,b)=>(a.roadIndex||0)-(b.roadIndex||0))

  const terrain =
    [...(mapProjection.terrain?.terrain || [])]
      .sort((a,b)=>a.terrainId-b.terrainId)

  return {
    landmarks,
    infrastructure,
    roads,
    buildings,
    terrain
  }
}
