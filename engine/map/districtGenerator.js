export function generateDistricts(seed, nodeId) {
  const districtTypes = [
    'market',
    'residential',
    'military',
    'religious',
    'industrial',
    'ruin'
  ];

  const base = hash(seed + ':' + nodeId);

  const districtCount = (base % 4) + 2;

  const districts = [];

  for (let i = 0; i < districtCount; i++) {
    const h = hash(seed + ':' + nodeId + ':' + i);

    districts.push({
      districtId: i,
      type: districtTypes[h % districtTypes.length],
      center: {
        x: (h % 100) / 100,
        y: ((h >> 3) % 100) / 100
      }
    });
  }

  return {
    nodeId,
    districtCount,
    districts
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
