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

    const seenRoomIds = {};
    const visitedRoomIds = {};
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

    byStructureId[sid] = {
      enteredTurn: clampInt(rec.enteredTurn ?? 0, 0, 999999999),
      seenRoomIds,
      visitedRoomIds,
      lastRoomId: String(rec.lastRoomId ?? '')
    };
  }

  return { byStructureId };
}

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

  const kind = String(x.kind ?? 'building');
  const nodeId = String(x.nodeId ?? '');

  const anchors = normalizeAnchor(x.anchors);
  const topology = normalizeTopology(x.topology);

  const surfaces = (x.surfaces && typeof x.surfaces === 'object') ? x.surfaces : {};
  const tags = uniqStrings(x.tags).sort((a, b) => a.localeCompare(b));
  // Optional declared building type (e.g. the player's home cottage). Only kept
  // when set so other structures' shape — and their worldHash — is unchanged.
  const buildingType = (typeof x.buildingType === 'string' && x.buildingType) ? x.buildingType : null;
  // P-72 — provenance for player-built structures (lean-to, palisade…). Like
  // buildingType, kept only when set so existing structures' shape and hash are
  // untouched (no WORLD_VERSION bump: old saves carry no player builds).
  const build = ensureBuild(x.build);

  return {
    id,
    kind,
    nodeId,
    anchors,
    topology,
    surfaces,
    tags,
    ...(buildingType ? { buildingType } : {}),
    ...(build ? { build } : {})
  };
}

// P-72 — normalize a player-built structure's provenance. quality is the
// material+skill+time outcome; restBand is the rest payoff (shelters only);
// labor records the moral fork (solo/hired/coerced); materials is the bill.
function ensureBuild(b) {
  if (!b || typeof b !== 'object') return null;
  const plan = String(b.plan ?? '');
  if (!plan) return null;
  const quality = ['poor', 'sound', 'fine'].includes(b.quality) ? b.quality : 'sound';
  const labor = ['solo', 'hired', 'coerced'].includes(b.labor) ? b.labor : 'solo';
  const builtDay = clampInt(b.builtDay ?? 0, 0, 999999999);
  const restBand = ['short', 'good', 'long'].includes(b.restBand) ? b.restBand : null;
  const matsIn = (b.materials && typeof b.materials === 'object') ? b.materials : {};
  const materials = {};
  for (const k of Object.keys(matsIn).sort((a, c) => a.localeCompare(c))) {
    const v = clampInt(matsIn[k] ?? 0, 0, 1000000000);
    if (v > 0) materials[String(k)] = v;
  }
  return {
    plan,
    quality,
    ...(restBand ? { restBand } : {}),
    labor,
    builtDay,
    materials
  };
}

function clampInt(n, lo, hi) {
  const v = Number.isFinite(+n) ? Math.floor(+n) : lo;
  return Math.max(lo, Math.min(hi, v));
}
