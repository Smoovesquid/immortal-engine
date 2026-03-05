import { ensureWorld } from '../state.js';
import { ensureMap } from '../map/mapState.js';
import { adjacentRooms, normalizeTopology } from './topology.js';

function clampInt(n, lo, hi) {
  const v = Number.isFinite(+n) ? Math.floor(+n) : lo;
  return Math.max(lo, Math.min(hi, v));
}

function sortedStructuresAtNode(world) {
  const w = ensureWorld(world);
  const nodeId = String(w.map?.currentNodeId || '');
  const byId = w.structures?.byId || {};
  return Object.values(byId)
    .filter(s => String(s?.nodeId || '') === nodeId)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function parseSelectionIndex(ref) {
  const s = String(ref || '').trim();
  if (!s) return null;
  const m = s.match(/^#?(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

function normalizedKindForMatch(s) {
  const t = Array.isArray(s?.tags) ? s.tags.map(x => String(x).toLowerCase()) : [];
  const direct = String(s?.kind || '').toLowerCase();
  if (direct) return direct;
  for (const tag of t) {
    if (tag.startsWith('kind:')) return tag.slice(5);
  }
  return 'building';
}

function resolveStructureForEnter(world, structureRef = '') {
  const all = sortedStructuresAtNode(world);
  if (!all.length) return { structure: null, reason: 'none-available' };

  const rawRef = String(structureRef || '').trim();
  const ref = rawRef.toLowerCase();
  if (!ref) return { structure: all[0], reason: 'matched' };

  const idx = parseSelectionIndex(rawRef);
  if (idx !== null) {
    const s = all[idx - 1] || null;
    return s ? { structure: s, reason: 'matched' } : { structure: null, reason: 'index-out-of-range' };
  }

  const s = all.find(x => String(x.id).toLowerCase() === ref || normalizedKindForMatch(x) === ref) || all[0];
  return { structure: s, reason: 'matched' };
}

function structureTopology(structure) {
  const sid = String(structure?.id || 'structure');
  return normalizeTopology(structure?.topology) || {
    kind: 'rooms',
    rooms: [{ id: `room:${sid}:entry`, tags: ['entry'] }],
    edges: []
  };
}

function ensureDiscoveryRecord(x) {
  const rec = x && typeof x === 'object' ? x : {};
  return {
    enteredTurn: clampInt(rec.enteredTurn ?? 0, 0, 999999999),
    seenRoomIds: { ...(rec.seenRoomIds && typeof rec.seenRoomIds === 'object' ? rec.seenRoomIds : {}) },
    visitedRoomIds: { ...(rec.visitedRoomIds && typeof rec.visitedRoomIds === 'object' ? rec.visitedRoomIds : {}) },
    inspectedSurfaceIds: { ...(rec.inspectedSurfaceIds && typeof rec.inspectedSurfaceIds === 'object' ? rec.inspectedSurfaceIds : {}) },
    lastRoomId: String(rec.lastRoomId ?? '')
  };
}

function withDiscoveryStamp(world, { structureId, roomId, turn, entered = false, surfaceId = '' }) {
  const w = ensureWorld(world);
  const sid = String(structureId || '');
  const rid = String(roomId || '');
  if (!sid || !rid) return w;

  const t = clampInt(turn ?? 0, 0, 999999999);
  const base = w.structures?.interiorDiscovery?.byStructureId || {};
  const prev = ensureDiscoveryRecord(base[sid]);

  const seenRoomIds = { ...prev.seenRoomIds };
  const visitedRoomIds = { ...prev.visitedRoomIds };
  const inspectedSurfaceIds = { ...prev.inspectedSurfaceIds };

  if (seenRoomIds[rid] === undefined) seenRoomIds[rid] = t;
  if (visitedRoomIds[rid] === undefined) visitedRoomIds[rid] = t;

  const surfaceKey = String(surfaceId || '').trim();
  if (surfaceKey && inspectedSurfaceIds[surfaceKey] === undefined) inspectedSurfaceIds[surfaceKey] = t;

  const nextRec = {
    enteredTurn: entered ? (prev.enteredTurn === 0 ? t : Math.min(prev.enteredTurn, t)) : prev.enteredTurn,
    seenRoomIds,
    visitedRoomIds,
    inspectedSurfaceIds,
    lastRoomId: rid
  };

  return {
    ...w,
    structures: {
      ...w.structures,
      interiorDiscovery: {
        byStructureId: {
          ...base,
          [sid]: nextRec
        }
      }
    }
  };
}

function hash32(s) {
  let h = 2166136261;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function deterministicRoomSurfaces({ seed, structureKey, roomId }) {
  const s = String(seed || 'seed');
  const st = String(structureKey || 'st');
  const room = String(roomId || 'room');
  const base = `${s}|${st}|${room}`;
  const kinds = ['cache', 'clue', 'hazard', 'object', 'trace'];
  const labels = ['cabinet', 'chalk marks', 'broken beam', 'work table', 'faded sigil', 'hidden niche'];

  const count = 1 + (hash32(base + '|count') % 3);
  const out = [];
  for (let i = 0; i < count; i++) {
    const kind = kinds[hash32(base + `|kind|${i}`) % kinds.length];
    const label = labels[hash32(base + `|label|${i}`) % labels.length];
    const idPart = hash32(base + `|id|${i}`).toString(16).padStart(8, '0');
    out.push({ id: `rs:${st}:${room}:${idPart}`, kind, label, tags: [kind, 'room-surface'] });
  }
  out.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return out;
}

export function resolveStructureSelection(world, structureRef = '') {
  return resolveStructureForEnter(world, structureRef);
}

export function enterStructureInterior(world, structureRef = '') {
  const w = ensureWorld(world);
  const sel = resolveStructureForEnter(w, structureRef);
  const st = sel.structure;
  if (!st) return w;

  const topo = structureTopology(st);
  const entryRoom = (topo.rooms || []).find(r => Array.isArray(r?.tags) && r.tags.includes('entry')) || topo.rooms[0];
  const firstRoomId = String(entryRoom?.id || '');
  if (!firstRoomId) return w;

  const w1 = {
    ...w,
    map: {
      ...ensureMap(w.map),
      currentStructureId: String(st.id),
      currentRoomId: firstRoomId
    },
    scene: {
      ...w.scene,
      interior: {
        structureKey: String(st.id),
        roomId: firstRoomId
      }
    }
  };

  return withDiscoveryStamp(w1, {
    structureId: st.id,
    roomId: firstRoomId,
    turn: Number(w.time?.turn ?? 0),
    entered: true
  });
}

export function exitStructureInterior(world) {
  const w = ensureWorld(world);
  if (!w.scene?.interior) return w;
  return {
    ...w,
    map: {
      ...ensureMap(w.map),
      currentStructureId: '',
      currentRoomId: ''
    },
    scene: {
      ...w.scene,
      interior: null
    }
  };
}

export function moveWithinInterior(world, toRoomId) {
  const w = ensureWorld(world);
  const interior = w.scene?.interior;
  if (!interior || typeof interior !== 'object') return w;

  const structureKey = String(interior.structureKey || '');
  const fromRoomId = String(interior.roomId || '');
  const targetRoomId = String(toRoomId || '').trim();
  if (!structureKey || !fromRoomId || !targetRoomId) return w;

  const st = w.structures?.byId?.[structureKey];
  if (!st) return w;

  const exits = adjacentRooms(structureTopology(st), fromRoomId);
  if (!exits.includes(targetRoomId)) return w;

  const w1 = {
    ...w,
    map: {
      ...ensureMap(w.map),
      currentStructureId: structureKey,
      currentRoomId: targetRoomId
    },
    scene: {
      ...w.scene,
      interior: {
        structureKey,
        roomId: targetRoomId
      }
    }
  };

  return withDiscoveryStamp(w1, {
    structureId: structureKey,
    roomId: targetRoomId,
    turn: Number(w.time?.turn ?? 0)
  });
}

export function inspectInteriorSurface(world, surfaceId) {
  const w = ensureWorld(world);
  const interior = w.scene?.interior;
  if (!interior || typeof interior !== 'object') return { world: w, ok: false };

  const structureKey = String(interior.structureKey || '');
  const roomId = String(interior.roomId || '');
  const sid = String(surfaceId || '').trim();
  if (!structureKey || !roomId || !sid) return { world: w, ok: false };

  const view = getInteriorView(w);
  const found = (view.surfaces || []).find(s => String(s.id) === sid);
  if (!found) return { world: w, ok: false };

  const w1 = withDiscoveryStamp(w, {
    structureId: structureKey,
    roomId,
    turn: Number(w.time?.turn ?? 0),
    surfaceId: sid
  });
  return { world: w1, ok: true, surface: found };
}

export function getInteriorView(world) {
  const w = ensureWorld(world);
  const interior = (w.scene && typeof w.scene.interior === 'object' && w.scene.interior) ? w.scene.interior : null;

  if (!interior) {
    return {
      active: false,
      structures: sortedStructuresAtNode(w).map((s, i) => ({ id: s.id, kind: s.kind, index: i + 1 }))
    };
  }

  const structureKey = String(interior.structureKey || '');
  const roomId = String(interior.roomId || '');
  const st = w.structures?.byId?.[structureKey];
  if (!st) return { active: false, structures: [] };

  const topo = structureTopology(st);
  const exits = adjacentRooms(topo, roomId).map(id => ({ id })).sort((a, b) => a.id.localeCompare(b.id));
  const surfaces = deterministicRoomSurfaces({ seed: w.meta.seed, structureKey, roomId });

  return {
    active: true,
    structureKey,
    roomId,
    exits,
    surfaces
  };
}
