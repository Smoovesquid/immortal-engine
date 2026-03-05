import { ensureWorld } from '../state.js';
import { getInteriorView } from './interiors.js';

function hash32(s) {
  let h = 2166136261;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clampInt(n, lo, hi) {
  const v = Number.isFinite(+n) ? Math.floor(+n) : lo;
  return Math.max(lo, Math.min(hi, v));
}

function cellKey(x, y) {
  return `${x},${y}`;
}

/**
 * B1 — Tactical Projection inside Interiors (pure)
 *
 * Returns a projection-only tactical view for the current interior room.
 * - No world mutation.
 * - No Date.now / Math.random.
 * - Deterministic from (seed + structureKey + roomId).
 *
 * Shape:
 * {
 *   ok: boolean,
 *   structureKey, roomId,
 *   grid: { w, h },
 *   footprint: { blocked: string[] },      // "x,y"
 *   obstacles: { cells: string[] },        // "x,y"
 *   pois: { doors: [{ id }], surfaces: [{ id, kind, label }] }
 * }
 */
export function projectInteriorTactical(world) {
  const w = ensureWorld(world);
  const view = getInteriorView(w);
  const structureKey = String(view?.structureKey || '');
  const roomId = String(view?.roomId || '');
  if (!structureKey || !roomId) {
    return {
      ok: false,
      structureKey: '',
      roomId: '',
      grid: { w: 0, h: 0 },
      footprint: { blocked: [] },
      obstacles: { cells: [] },
      pois: { doors: [], surfaces: [] }
    };
  }

  const seed = String(w?.meta?.seed || 'seed');
  const base = `${seed}|${structureKey}|${roomId}`;

  // Small deterministic grid. Keep bounded for perf + UI.
  const gw = clampInt(11 + (hash32(base + '|w') % 6), 11, 16);
  const gh = clampInt(11 + (hash32(base + '|h') % 6), 11, 16);

  // Footprint mask: border walls always blocked.
  const blocked = [];
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (x === 0 || y === 0 || x === gw - 1 || y === gh - 1) blocked.push(cellKey(x, y));
    }
  }

  // Doors/Exits: map exits deterministically onto border cells.
  const exits = Array.isArray(view?.exits) ? view.exits : [];
  const doors = exits.map(e => ({ id: String(e?.id || '') })).filter(d => d.id);
  doors.sort((a, b) => a.id.localeCompare(b.id));

  // Reserve door cells as passable openings: we remove them from blocked.
  // Place each door at a deterministic border position.
  const doorCells = new Set();
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i];
    const h = hash32(base + `|door|${d.id}|${i}`);
    const side = h % 4; // 0 top, 1 right, 2 bottom, 3 left
    const span = (side === 0 || side === 2) ? (gw - 2) : (gh - 2);
    const off = 1 + (Math.floor(h / 97) % Math.max(1, span));
    let x = 0, y = 0;
    if (side === 0) { x = off; y = 0; }
    else if (side === 1) { x = gw - 1; y = off; }
    else if (side === 2) { x = off; y = gh - 1; }
    else { x = 0; y = off; }
    doorCells.add(cellKey(x, y));
  }

  const blockedSet = new Set(blocked);
  for (const dc of doorCells) blockedSet.delete(dc);
  const blockedOut = Array.from(blockedSet).sort((a, b) => a.localeCompare(b));

  // Obstacles: deterministic interior clutter, never on blocked/door.
  const maxObs = clampInt(4 + (hash32(base + '|obsN') % 8), 4, 12);
  const obs = new Set();
  for (let i = 0; i < maxObs * 4; i++) {
    if (obs.size >= maxObs) break;
    const h = hash32(base + `|obs|${i}`);
    const x = 1 + (h % Math.max(1, gw - 2));
    const y = 1 + (Math.floor(h / 131) % Math.max(1, gh - 2));
    const k = cellKey(x, y);
    if (blockedSet.has(k)) continue;
    if (doorCells.has(k)) continue;
    obs.add(k);
  }
  const obstacles = Array.from(obs).sort((a, b) => a.localeCompare(b));

  // Points of interest: surfaces from interior view (already deterministic).
  const surfacesIn = Array.isArray(view?.surfaces) ? view.surfaces : [];
  const surfaces = surfacesIn.map(s => ({
    id: String(s?.id || ''),
    kind: String(s?.kind || ''),
    label: String(s?.label || '')
  })).filter(x => x.id);
  surfaces.sort((a, b) => a.id.localeCompare(b.id));

  return {
    ok: true,
    structureKey,
    roomId,
    grid: { w: gw, h: gh },
    footprint: { blocked: blockedOut },
    obstacles: { cells: obstacles },
    pois: { doors, surfaces }
  };
}
