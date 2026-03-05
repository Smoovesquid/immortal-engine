export function projectEdgeInfrastructure(seed, edgeId) {
  const types = ['road','wall','river','bridge'];
  const idx = hash(seed + ':' + edgeId) % types.length;
  return { edgeId, type: types[idx] };
}

export function generateSettlementLayout(seed, nodeId, regionId, packId) {
  const base = hash(seed + ':' + nodeId + ':' + regionId + ':' + packId);
  const streets = (base % 5) + 3;
  return { nodeId, streets };
}

export function generateBuildings(seed, nodeId, density='village') {
  const ranges = {
    hamlet:[4,8],
    village:[8,15],
    town:[20,40],
    city:[60,120],
    ruin:[3,10]
  };
  const [min,max] = ranges[density] || ranges.village;
  const count = min + (hash(seed + ':' + nodeId) % (max-min+1));
  return { nodeId, count };
}

export function generateDistricts(seed, nodeId) {
  const districts = ['market','residential','military','religious','industrial','ruin'];
  const count = (hash(seed + ':' + nodeId) % 3) + 1;
  return districts.slice(0,count).map((d,i)=>({nodeId,type:d,order:i}));
}

export function generateTerrain(seed, nodeId) {
  const types = ['forest','cliff','marsh','fields','riverbank','hills'];
  const idx = hash(seed + ':' + nodeId) % types.length;
  return { nodeId, terrain: types[idx] };
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
