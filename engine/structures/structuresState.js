import { normalizeAnchor } from './anchors.js';
import { normalizeTopology } from './topology.js';

function ensureInteriorDiscovery(x) {
  const obj = x && typeof x === 'object' ? x : {};
  const byStructureIdIn = (obj.byStructureId && typeof obj.byStructureId === 'object') ? obj.byStructureId : {};
  const byStructureId = {};

  for (const [sidRaw, recRaw] of Object.entries(byStructureIdIn)) {
    const sid = String(sidRaw);
    if (!sid) continue;
    const rec = recRaw && typeof recRaw === 'object' ? recRaw : {};
    const seenRoomIdsIn = (rec.seenRoomIds && typeof rec.seenRoomIds === 'object') ? rec.seenRoomIds : {};
    const visitedRoomIdsIn = (rec.visitedRoomIds && typeof rec.visitedRoomIds === 'object') ? rec.visitedRoomIds : {};
    const inspectedSurfaceIdsIn = (rec.inspectedSurfaceIds && typeof rec.inspectedSurfaceIds === 'object') ? rec.inspectedSurfaceIds : {};

    const seenRoomIds = {};
    const visitedRoomIds = {};
    const inspectedSurfaceIds = {};
    for (const [rid, turn] of Object.entries(seenRoomIdsIn)) {
      const key = String(rid);
      if (!key) continue;
      seenRoomIds[key] = clampInt(turn ?? 0, 0, 999999999);
    }
    for (const [rid, turn] of Object.entries(visitedRoomIdsIn)) {
      const key = String(rid);
      if (!key) continue;
      visitedRoomIds[key] = clampInt(turn ?? 0, 0, 999999999);
    }
    for (const [sid2, turn] of Object.entries(inspectedSurfaceIdsIn)) {
      const key = String(sid2);
      if (!key) continue;
      inspectedSurfaceIds[key] = clampInt(turn ?? 0, 0, 999999999);
    }

    byStructureId[sid] = {
      enteredTurn: clampInt(rec.enteredTurn ?? 0, 0, 999999999),
      seenRoomIds,
      visitedRoomIds,
      inspectedSurfaceIds,
      lastRoomId: String(rec.lastRoomId ?? '')
    };
  }

  return { byStructureId };
}

const ALLOWED_STRUCTURE_KINDS = new Set(['road', 'building', 'wall', 'bridge', 'ruin', 'tower', 'shrine']);

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
  const interiorDiscovery = ensureInteriorDiscovery(obj.interiorDiscovery);

  return { byId, nextId, interiorDiscovery };
}

function ensureStructure(v, fallbackId) {
  const x = v && typeof v === 'object' ? v : {};
  const id = String(x.id ?? fallbackId ?? '');
  if (!id) return null;

  const tags = uniqStrings(x.tags).sort((a, b) => a.localeCompare(b));
  const kind = normalizeKind(x.kind, tags);
  const nodeId = String(x.nodeId ?? '');

  const anchors = normalizeAnchor(x.anchors);
  const topology = normalizeTopology(x.topology);

  const surfaces = (x.surfaces && typeof x.surfaces === 'object') ? x.surfaces : {};

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

function normalizeKind(kind, tags) {
  const k = String(kind ?? '').trim().toLowerCase();
  if (ALLOWED_STRUCTURE_KINDS.has(k)) return k;

  for (const t0 of (Array.isArray(tags) ? tags : [])) {
    const t = String(t0).toLowerCase();
    if (t.startsWith('kind:')) {
      const v = t.slice(5);
      if (ALLOWED_STRUCTURE_KINDS.has(v)) return v;
    }
    if (ALLOWED_STRUCTURE_KINDS.has(t)) return t;
  }

  return 'building';
}

function clampInt(n, lo, hi) {
  const v = Number.isFinite(+n) ? Math.floor(+n) : lo;
  return Math.max(lo, Math.min(hi, v));
}
