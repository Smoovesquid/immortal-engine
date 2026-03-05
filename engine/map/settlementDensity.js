export function generateSettlementDensity(seed, nodeId, type='village') {
  const ranges = {
    hamlet: [4,8],
    village: [8,15],
    town: [20,40],
    city: [60,120],
    ruin: [3,10]
  };

  const [min,max] = ranges[type] || ranges.village;

  const count = min + (hash(seed + ':' + nodeId + ':' + type) % (max - min + 1));

  const buildings = [];

  for (let i = 0; i < count; i++) {
    const h = hash(seed + ':' + nodeId + ':' + i);
    buildings.push({
      buildingId: i,
      cluster: h % 4
    });
  }

  return {
    nodeId,
    type,
    count,
    buildings
  };
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
