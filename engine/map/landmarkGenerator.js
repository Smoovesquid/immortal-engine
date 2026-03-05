export function generateLandmarks(seed, nodeId) {
  const landmarkTypes = [
    'castle',
    'tower',
    'cathedral',
    'arena',
    'port',
    'fort',
    'ancient_ruin'
  ];

  const base = hash(seed + ':' + nodeId);

  const count = (base % 3) + 1;

  const landmarks = [];

  for (let i = 0; i < count; i++) {
    const h = hash(seed + ':' + nodeId + ':' + i);

    landmarks.push({
      landmarkId: i,
      type: landmarkTypes[h % landmarkTypes.length],
      priority: i
    });
  }

  return {
    nodeId,
    count,
    landmarks
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
