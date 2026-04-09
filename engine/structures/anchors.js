function clampInt(n, lo, hi) {
  const v = Number.isFinite(+n) ? Math.floor(+n) : lo;
  return Math.max(lo, Math.min(hi, v));
}

function isObject(x) { return x && typeof x === 'object'; }

export function normalizeAnchor(anchor) {
  const a = isObject(anchor) ? anchor : {};
  const kind = String(a.kind ?? 'node');

  if (kind === 'edge') {
    const aId = String(a.aNodeId ?? '');
    const bId = String(a.bNodeId ?? '');
    const [lo, hi] = (aId <= bId) ? [aId, bId] : [bId, aId];
    return { kind: 'edge', aNodeId: lo, bNodeId: hi };
  }

  if (kind === 'coord') {
    const nodeId = String(a.nodeId ?? '');
    const x = clampInt(a.x ?? 0, -1000000, 1000000);
    const y = clampInt(a.y ?? 0, -1000000, 1000000);
    return { kind: 'coord', nodeId, x, y };
  }

  const nodeId = String(a.nodeId ?? '');
  return { kind: 'node', nodeId };
}

export function anchorToNode(nodeId) {
  return normalizeAnchor({ kind: 'node', nodeId: String(nodeId ?? '') });
}

export function anchorToEdge(aNodeId, bNodeId) {
  return normalizeAnchor({ kind: 'edge', aNodeId: String(aNodeId ?? ''), bNodeId: String(bNodeId ?? '') });
}

export function anchorToCoord(nodeId, x, y) {
  return normalizeAnchor({ kind: 'coord', nodeId: String(nodeId ?? ''), x, y });
}
