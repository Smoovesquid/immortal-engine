/**
 * Floor plan — turns a structure's room graph into real architecture.
 *
 * roomDetail.js says what each room IS (a nave, a kitchen, a cave den) and how
 * big and what shape. This module lays those rooms out into a building you could
 * recognize at a glance: irregular room sizes, round towers and curved apses,
 * a long nave vs. a wide market floor, an outer shell drawn in the building's
 * material. A church and a market come out looking nothing alike.
 *
 * Connectivity stays honest. We place rooms using the engine's OWN compass graph
 * (interiorCompassLayout in topology.js) — the same graph movement uses — so the
 * room drawn to your north really is the one "go north" reaches. We get variety
 * not by moving doorways around but by sizing and shaping the rooms: each grid
 * column takes the width of its widest room, each row the height of its tallest,
 * so a long nave stretches its whole row while a closet stays a closet.
 *
 * PURE + DETERMINISTIC (everything derives from the structure/room ids), so it
 * adds nothing to world shape and is safe to call from the browser renderer.
 *
 * floorPlan(structure) -> {
 *   type, name, shell, dark,
 *   footprint: { w, h },                 // in layout units; renderer scales uniformly
 *   rooms: [{ id, role, name, shape, dark, isCurrent?, isEntry,
 *             cx, cy, w, h,              // center + size, same units as footprint
 *             furniture: [...] }],
 *   doors: [{ x, y, dir, a, b }],        // opening on the boundary between two rooms
 *   corridors: [{ ax, ay, bx, by }]      // floor strips linking connected rooms
 * }
 */

import { interiorCompassLayout } from './topology.js';
import { roomDetail, buildingTypeFor } from './roomDetail.js';
import { SHELL_BY_TYPE } from './structureMaterial.js';

const DIRS = ['north', 'east', 'south', 'west'];
const VEC = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const BUILDING_NAME = {
  chapel: 'Chapel', tavern: 'Tavern', market: 'Market Hall', keep: 'Keep',
  cottage: 'Cottage', longhouse: 'Longhouse', lair: 'Lair', tower: 'Arcane Tower', hive: 'Hive'
};
// Shell material now lives in structureMaterial.js (ROM-0) so the drawn map and
// the prose stack read ONE table — values byte-identical to the historical local
// map (chapel:'stone', cottage/tavern/longhouse:'timber', …). U348 asserts the
// alignment.
const BUILDING_SHELL = SHELL_BY_TYPE;
const DARK_BUILDINGS = new Set(['lair', 'hive']);

function structIdOf(structure) {
  return String(structure?.id || structure?.key || 'structure');
}

// Walk the compass graph from the entry room, assigning each room an integer
// grid cell (gx,gy). north = up, south = down. On a collision (the graph isn't
// always planar) spiral out to the nearest free cell so rooms never stack.
function placeOnGrid(rooms, exits, entryId) {
  const pos = new Map();
  const occ = new Set();
  const key = (x, y) => `${x},${y}`;
  const taken = (x, y) => occ.has(key(x, y));
  const put = (id, x, y) => { pos.set(id, { gx: x, gy: y }); occ.add(key(x, y)); };
  const nearestFree = (x, y) => {
    if (!taken(x, y)) return [x, y];
    for (let r = 1; r < 24; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          if (!taken(x + dx, y + dy)) return [x + dx, y + dy];
        }
      }
    }
    return [x, y];
  };

  const queue = [];
  if (entryId) { put(entryId, 0, 0); queue.push(entryId); }
  while (queue.length) {
    const id = queue.shift();
    const here = pos.get(id);
    const ex = exits.get(id) || {};
    for (const dir of DIRS) {
      const nb = ex[dir];
      if (!nb || pos.has(nb)) continue;
      const [vx, vy] = VEC[dir];
      const [fx, fy] = nearestFree(here.gx + vx, here.gy + vy);
      put(nb, fx, fy);
      queue.push(nb);
    }
  }
  // Disconnected rooms: drop into a trailing row so they still appear.
  let stray = 0;
  for (const r of rooms) {
    const id = String(r?.id || '');
    if (id && !pos.has(id)) { const [fx, fy] = nearestFree(stray++, 99); put(id, fx, fy); }
  }
  return pos;
}

export function floorPlan(structure) {
  const topo = structure?.topology && typeof structure.topology === 'object' ? structure.topology : null;
  const rooms = (Array.isArray(topo?.rooms) ? topo.rooms : []).filter(r => r && r.id != null);
  const structId = structIdOf(structure);
  // A structure may declare its kind (e.g. the player's home cottage); otherwise
  // it's derived from the id hash.
  const forcedType = (structure?.buildingType && BUILDING_NAME[structure.buildingType]) ? structure.buildingType : null;
  const type = forcedType || buildingTypeFor(structId);
  const out = {
    type, name: BUILDING_NAME[type] || 'Building', shell: BUILDING_SHELL[type] || 'stone',
    dark: DARK_BUILDINGS.has(type) ? 1 : 0, footprint: { w: 1, h: 1 },
    hull: null, rooms: [], doors: [], corridors: []
  };
  if (!rooms.length) return out;

  // Entry = the room tagged 'entry', else lexicographically first (matches the
  // engine's enterStructureInterior, which drops you in rooms[0]).
  const sortedIds = rooms.map(r => String(r.id)).sort((a, b) => a.localeCompare(b));
  const entryRoom = rooms.find(r => (r.tags || []).map(t => String(t).toLowerCase()).includes('entry'));
  const entryId = String(entryRoom?.id || sortedIds[0] || '');

  const exits = interiorCompassLayout(topo);
  const pos = placeOnGrid(rooms, exits, entryId);

  // Per-room detail (role, shape, size weight, furniture).
  const det = new Map();
  for (const r of rooms) det.set(String(r.id), roomDetail(r, forcedType));

  // Non-uniform table sizing: each column is as wide as its widest room, each
  // row as tall as its tallest. A `pad` of empty space frames every cell so the
  // walls and doorways have room to breathe.
  const PAD = 0.34; // extra cell padding in layout units (wall + corridor gap)
  const colW = new Map(), rowH = new Map();
  for (const r of rooms) {
    const id = String(r.id); const p = pos.get(id); const d = det.get(id);
    const w = (d.sizeW || 1) + PAD, h = (d.sizeH || 1) + PAD;
    if (!colW.has(p.gx) || w > colW.get(p.gx)) colW.set(p.gx, w);
    if (!rowH.has(p.gy) || h > rowH.get(p.gy)) rowH.set(p.gy, h);
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const { gx, gy } of pos.values()) {
    if (gx < minX) minX = gx; if (gx > maxX) maxX = gx;
    if (gy < minY) minY = gy; if (gy > maxY) maxY = gy;
  }
  // Cumulative offsets per column/row.
  const colX = new Map(); let accX = 0;
  for (let gx = minX; gx <= maxX; gx++) { colX.set(gx, accX); accX += (colW.get(gx) || (1 + PAD)); }
  const rowY = new Map(); let accY = 0;
  for (let gy = minY; gy <= maxY; gy++) { rowY.set(gy, accY); accY += (rowH.get(gy) || (1 + PAD)); }
  out.footprint = { w: accX, h: accY };

  const cellCenter = (gx, gy) => ({
    cx: (colX.get(gx) || 0) + (colW.get(gx) || (1 + PAD)) / 2,
    cy: (rowY.get(gy) || 0) + (rowH.get(gy) || (1 + PAD)) / 2
  });

  const center = new Map();
  for (const r of rooms) {
    const id = String(r.id); const p = pos.get(id); const d = det.get(id);
    const { cx, cy } = cellCenter(p.gx, p.gy);
    center.set(id, { cx, cy });
    out.rooms.push({
      id, role: d.role, name: d.name, shape: d.shape, dark: d.dark,
      isEntry: id === entryId, gx: p.gx, gy: p.gy, cx, cy, w: d.sizeW || 1, h: d.sizeH || 1,
      furniture: d.furniture
    });
  }

  // Building hull: the bounding box of every room box, so the renderer can trace
  // one continuous outer wall in the building's material — the single strongest
  // "this is a building, not scattered boxes" cue. `round` tells it to draw a
  // soft/organic outline (towers, caves, hives) vs a crisp one (stone, fortified).
  {
    let hx0 = Infinity, hy0 = Infinity, hx1 = -Infinity, hy1 = -Infinity;
    for (const r of out.rooms) {
      hx0 = Math.min(hx0, r.cx - r.w / 2); hx1 = Math.max(hx1, r.cx + r.w / 2);
      hy0 = Math.min(hy0, r.cy - r.h / 2); hy1 = Math.max(hy1, r.cy + r.h / 2);
    }
    if (Number.isFinite(hx0)) {
      out.hull = {
        x: hx0, y: hy0, w: hx1 - hx0, h: hy1 - hy0,
        round: out.shell === 'round' || out.shell === 'cave' || out.shell === 'chitin'
      };
    }
  }

  // Doors + corridors from the compass graph (each undirected edge once).
  for (const r of rooms) {
    const id = String(r.id);
    const ex = exits.get(id) || {};
    const A = center.get(id); if (!A) continue;
    for (const dir of DIRS) {
      const nb = ex[dir];
      if (!nb || id >= nb) continue;            // once per pair
      const B = center.get(nb); if (!B) continue;
      out.corridors.push({ ax: A.cx, ay: A.cy, bx: B.cx, by: B.cy });
      out.doors.push({ x: (A.cx + B.cx) / 2, y: (A.cy + B.cy) / 2, dir, a: id, b: nb });
    }
  }

  return out;
}
