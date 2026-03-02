export function computeWalkMetrics(history) {
  const visited = new Set();
  let revisits = 0;
  let last = null;
  let bounceCount = 0;

  for (const step of history) {
    const id = step.nodeId;
    if (visited.has(id)) revisits++;
    visited.add(id);

    if (last && last === id) bounceCount++;
    last = id;
  }

  return {
    totalSteps: history.length,
    uniqueVisited: visited.size,
    revisits,
    bounceCount
  };
}
