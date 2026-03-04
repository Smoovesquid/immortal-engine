import { normalizeAnchor } from './anchors.js';
import { normalizeTopology } from './topology.js';

function uniqStrings(arr) {
  const out = [];
  const seen = new Set();
  for (const v of (Array.isArray(arr) ? arr : [])) {
    const s = String(v);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

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

  const anchors = normalizeAnchor(x.anchors);
  const topology = normalizeTopology(x.topology);

  const surfaces = (x.surfaces && typeof x.surfaces === 'object') ? x.surfaces : {};
  const tags = uniqStrings(x.tags).sort((a, b) => a.localeCompare(b));

  return {
    id,
    kind,
    nodeId,
    anchors,
    topology,
    surfaces,
    tags
  };
}

function clampInt(n, lo, hi) {
  const v = Number.isFinite(+n) ? Math.floor(+n) : lo;
  return Math.max(lo, Math.min(hi, v));
}
