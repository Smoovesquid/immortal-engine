export function alignMapHierarchy(seed, regionId, nodes) {
  const aligned = nodes.map((nodeId, i) => {
    const h = hash(seed + ':' + regionId + ':' + nodeId);

    return {
      nodeId,
      x: (h % 1000) / 1000,
      y: ((h >> 5) % 1000) / 1000,
      order: i
    };
  });

  return {
    regionId,
    nodes: aligned
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
