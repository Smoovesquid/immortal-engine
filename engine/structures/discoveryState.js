function isObject(x) { return x && typeof x === 'object'; }

function clampInt(n, lo, hi) {
  const v = Number.isFinite(+n) ? Math.floor(+n) : lo;
  return Math.max(lo, Math.min(hi, v));
}

function ensureStringSetRecord(x) {
  const obj = isObject(x) ? x : {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = String(k);
    if (!key) continue;
    out[key] = Boolean(v);
  }
  return out;
}

/**
 * Discovery v0:
 * - byNodeId[nodeId] => { structures: { [structureId]: true }, lastSeenTurn }
 * - byEdgeId["a|b"]  => { structures: { [structureId]: true }, lastSeenTurn }
 */
export function ensureStructureDiscovery(x) {
  const obj = isObject(x) ? x : {};
  const byNodeIdIn = isObject(obj.byNodeId) ? obj.byNodeId : {};
  const byEdgeIdIn = isObject(obj.byEdgeId) ? obj.byEdgeId : {};

  const byNodeId = {};
  for (const [nodeIdRaw, recRaw] of Object.entries(byNodeIdIn)) {
    const nodeId = String(nodeIdRaw);
    const rec = isObject(recRaw) ? recRaw : {};
    byNodeId[nodeId] = {
      structures: ensureStringSetRecord(rec.structures),
      lastSeenTurn: clampInt(rec.lastSeenTurn ?? 0, 0, 999999999)
    };
  }

  const byEdgeId = {};
  for (const [edgeIdRaw, recRaw] of Object.entries(byEdgeIdIn)) {
    const edgeId = String(edgeIdRaw);
    const rec = isObject(recRaw) ? recRaw : {};
    byEdgeId[edgeId] = {
      structures: ensureStringSetRecord(rec.structures),
      lastSeenTurn: clampInt(rec.lastSeenTurn ?? 0, 0, 999999999)
    };
  }

  return { byNodeId, byEdgeId };
}

export function edgeKey(aNodeId, bNodeId) {
  const a = String(aNodeId ?? '');
  const b = String(bNodeId ?? '');
  if (!a || !b) return '';
  return (a <= b) ? `${a}|${b}` : `${b}|${a}`;
}

export function markDiscoveredOnNode(discovery, { nodeId, structureId, turn }) {
  const d = ensureStructureDiscovery(discovery);
  const nid = String(nodeId ?? '');
  const sid = String(structureId ?? '');
  const t = clampInt(turn ?? 0, 0, 999999999);
  if (!nid || !sid) return d;

  const rec = d.byNodeId[nid] ?? { structures: {}, lastSeenTurn: 0 };
  const nextStructures = { ...rec.structures, [sid]: true };
  const nextRec = { structures: nextStructures, lastSeenTurn: Math.max(rec.lastSeenTurn, t) };

  return {
    byNodeId: { ...d.byNodeId, [nid]: nextRec },
    byEdgeId: d.byEdgeId
  };
}

export function markDiscoveredOnEdge(discovery, { aNodeId, bNodeId, structureId, turn }) {
  const d = ensureStructureDiscovery(discovery);
  const key = edgeKey(aNodeId, bNodeId);
  const sid = String(structureId ?? '');
  const t = clampInt(turn ?? 0, 0, 999999999);
  if (!key || !sid) return d;

  const rec = d.byEdgeId[key] ?? { structures: {}, lastSeenTurn: 0 };
  const nextStructures = { ...rec.structures, [sid]: true };
  const nextRec = { structures: nextStructures, lastSeenTurn: Math.max(rec.lastSeenTurn, t) };

  return {
    byNodeId: d.byNodeId,
    byEdgeId: { ...d.byEdgeId, [key]: nextRec }
  };
}
