export function generateTerrainOverlay(seed, nodeId) {
  const terrainTypes = [
    'forest',
    'cliff',
    'marsh',
    'fields',
    'riverbank',
    'hills'
  ];

  const base = hash(seed + ':' + nodeId);

  const count = (base % 3) + 1;

  const terrain = [];

  for (let i = 0; i < count; i++) {
    const h = hash(seed + ':' + nodeId + ':' + i);

    terrain.push({
      terrainId: i,
      type: terrainTypes[h % terrainTypes.length],
      x: (h % 100) / 100,
      y: ((h >> 3) % 100) / 100
    });
  }

  return {
    nodeId,
    count,
    terrain
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
