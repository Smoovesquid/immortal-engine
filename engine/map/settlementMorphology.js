export function generateSettlementSpine(seed, nodeId, regionId, packId) {
  const base = hash(seed + ':' + nodeId + ':' + regionId + ':' + packId);

  const primaryAngle = (base % 360);
  const secondaryCount = (base % 4) + 2;

  const primary = {
    type: 'primary',
    angle: primaryAngle
  };

  const secondary = [];

  for (let i = 0; i < secondaryCount; i++) {
    const h = hash(seed + ':' + nodeId + ':' + i);
    secondary.push({
      type: 'secondary',
      angle: (h % 360)
    });
  }

  return {
    nodeId,
    primary,
    secondary
  };
}

export function placeBuildingsAlongRoads(seed, nodeId, roads) {
  const buildings = [];

  roads.forEach((road, i) => {
    const count = (hash(seed + ':' + nodeId + ':' + i) % 6) + 2;

    for (let j = 0; j < count; j++) {
      const h = hash(seed + ':' + nodeId + ':' + i + ':' + j);
      buildings.push({
        roadIndex: i,
        offset: (h % 100) / 100
      });
    }
  });

  return buildings;
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
