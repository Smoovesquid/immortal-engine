/**
 * Structural Density Metrics (U8 instrumentation)
 * Pure read-only metrics.
 * No mutation. No side effects.
 */

function computeDensity(world) {
  const nodes = world?.map?.nodes || [];
  const edges = world?.map?.edges || [];

  const totalNodes = nodes.length;
  const totalEdges = edges.length;

  const canonNodes = nodes.filter(n => n.canonical === true).length;

  const totalSockets = nodes.reduce((acc, n) => {
    if (!Array.isArray(n.sockets)) return acc;
    return acc + n.sockets.length;
  }, 0);

  const resolvedSockets = nodes.reduce((acc, n) => {
    if (!Array.isArray(n.sockets)) return acc;
    return acc + n.sockets.filter(s => s.state === 'resolved').length;
  }, 0);

  const latentSockets = totalSockets - resolvedSockets;

  const branchingFactor =
    totalNodes === 0 ? 0 : Number((totalEdges / totalNodes).toFixed(6));

  return {
    totalNodes,
    totalEdges,
    canonNodes,
    totalSockets,
    resolvedSockets,
    latentSockets,
    branchingFactor
  };
}

export { computeDensity };
