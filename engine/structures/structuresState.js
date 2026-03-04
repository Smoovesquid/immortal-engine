export function ensureStructures(x) {
  const obj = x && typeof x === 'object' ? x : {};
  const byIdIn = (obj.byId && typeof obj.byId === 'object') ? obj.byId : {};
  const byId = {};

  for (const [k, v] of Object.entries(byIdIn)) {
    const s = ensureStructure(v, k);
    if (s) byId[s.id] = s;
  }

  const nextId = clampInt(obj.nextId ?? 1, 1, 1000000000);

  return { byId, nextId };
}

function ensureStructure(v, fallbackId) {
  const x = v && typeof v === 'object' ? v : {};
  const id = String(x.id ?? fallbackId ?? '');
  if (!id) return null;

  const kind = String(x.kind ?? 'building');
  const nodeId = String(x.nodeId ?? '');

  return {
    id,
    kind,
    nodeId,
    anchors: (x.anchors && typeof x.anchors === 'object') ? x.anchors : {},
    topology: (x.topology && typeof x.topology === 'object') ? x.topology : null,
    surfaces: (x.surfaces && typeof x.surfaces === 'object') ? x.surfaces : {},
    tags: Array.isArray(x.tags) ? x.tags.map(String) : []
  };
}

function clampInt(n, lo, hi) {
  const v = Number.isFinite(+n) ? Math.floor(+n) : lo;
  return Math.max(lo, Math.min(hi, v));
}
