import { ensureWorld } from '../state.js';
import { ensureMap } from '../map/mapState.js';
import { adjacentRooms, normalizeTopology, interiorExitsFrom } from './topology.js';

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

  const s = all.find(x => String(x.id).toLowerCase() === ref || String(x.kind).toLowerCase() === ref) || all[0];
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

export function resolveStructureSelection(world, structureRef = '') {
  return resolveStructureForEnter(world, structureRef);
}

export function enterStructureInterior(world, structureRef = '') {
  const w = ensureWorld(world);
  const sel = resolveStructureForEnter(w, structureRef);
  const st = sel.structure;
  if (!st) return w;

  const topo = structureTopology(st);
  const firstRoomId = String(topo.rooms[0]?.id || '');
  if (!firstRoomId) return w;

  return {
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

  return {
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
}

// interiorDirectionalExits(world) -> { north, east, south, west } room id or null
// for the room the player currently stands in. Built from the reciprocal interior
// compass so "south" only resolves when a south doorway genuinely exists.
export function interiorDirectionalExits(world) {
  const w = ensureWorld(world);
  const interior = (w.scene && typeof w.scene.interior === 'object' && w.scene.interior) ? w.scene.interior : null;
  if (!interior) return { north: null, east: null, south: null, west: null };
  const st = w.structures?.byId?.[String(interior.structureKey || '')];
  if (!st) return { north: null, east: null, south: null, west: null };
  return interiorExitsFrom(structureTopology(st), String(interior.roomId || ''));
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
  // Tag each doorway with the compass direction it leaves by, so the player-facing
  // "Exits: north, east" matches the direction that actually moves you there.
  const dirByRoom = interiorExitsFrom(topo, roomId);
  const ORDER = ['north', 'east', 'south', 'west'];
  const exits = adjacentRooms(topo, roomId)
    .map(id => ({ id, dir: ORDER.find(d => dirByRoom[d] === id) || '' }))
    .sort((a, b) => {
      const ai = a.dir ? ORDER.indexOf(a.dir) : 99;
      const bi = b.dir ? ORDER.indexOf(b.dir) : 99;
      return ai - bi || a.id.localeCompare(b.id);
    });

  return {
    active: true,
    structureKey,
    roomId,
    exits,
    surfaces: []
  };
}
