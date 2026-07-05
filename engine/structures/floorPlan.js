/**
 * Floor plan — turns a structure's room graph into a PROPER floorplan.
 *
 * roomDetail.js says what each room IS (a nave, a kitchen, a cave den) and how
 * big and what shape. This module lays those rooms out into a building you could
 * recognize at a glance: irregular room sizes, round towers and curved apses,
 * a long nave vs. a wide market floor, an outer shell drawn in the building's
 * material. A church and a market come out looking nothing alike.
 *
 * FP-1 (Tim's ruling 2026-07-04): rooms are drawn like a real floorplan — they
 * TILE. Connected neighbours ABUT along a shared wall, and a DOORWAY is a gap in
 * that shared wall. There are no corridors: the old model padded a void between
 * every pair of rooms and bridged it with an auto-generated hallway strip, which
 * looked like a cluster of sheds joined by breezeways and contradicted the game's
 * own words ("you step through into the pantry", "a doorway leading deeper in").
 * A doorway now opens one room directly into the next, on the map, in the interior
 * view, and in the tactical positions the engine records.
 *
 * Connectivity stays honest. Rooms are placed on the engine's OWN compass graph
 * (interiorCompassLayout in topology.js) — the same graph movement uses — so the
 * room drawn to your north really is the one "go north" reaches. Each grid column
 * is as wide as its widest room and each row as tall as its tallest (a long nave
 * stretches its whole row while a closet stays a closet), and every room fills its
 * cell so adjacent cells share a wall with no void between them. A doorway sits on
 * the shared cell boundary the topology connection crosses.
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
 *   doors: [{ x, y, dir, a, b }],        // opening in the shared wall between two rooms
 *   corridors: []                        // ABOLISHED (FP-1) — always empty; rooms abut
 * }
 *
 * MR-2c (docs/briefs/MR-2-FUNCTIONAL-INK.md §MR-2c) — AUTHORED OVERRIDE. When a
 * structure carries `authoredPlan` (a plain data field set at materialization time
 * by applyGeneratedStructuresForNode.js / authoredPlans.js, from Tim's own
 * house-builder drawing), that geometry is returned VERBATIM instead of computed
 * from topology — what Tim drew is what everyone walks. This is a pure data check
 * (no new import, no I/O): authoredPlan is already a plain field on the structure
 * object by the time anything calls floorPlan(), so this branch is exactly as
 * browser-safe as every other read in this function.
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
  // MR-2c — AUTHORED OVERRIDE (see the module header). Tim's own drawn geometry
  // wins outright; the auto-tiler below never runs for this structure.
  if (structure && typeof structure === 'object' && structure.authoredPlan
    && typeof structure.authoredPlan === 'object') {
    return structure.authoredPlan;
  }
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
    // corridors ABOLISHED (FP-1): always empty — rooms abut and share walls, so
    // there is nothing to bridge. Kept as a stable [] so every renderer that maps
    // over it (planModel/handDrawnInterior/drawModel/oneMap) simply draws nothing.
    // nonAdjacent records cycle edges that couldn't tile (a triangle can't fully
    // wall-share on a square grid) — never hidden, flagged for the report.
    hull: null, rooms: [], doors: [], corridors: [], nonAdjacent: []
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

  // FP-1 — TILED cells. Each grid column is as wide as its widest room, each row
  // as tall as its tallest, and cells ABUT (no pad-void): the dominant room of a
  // building (nave, market floor, great hall) still stretches its whole row/column
  // and reads huge, while a closet stays a closet — but connected neighbours now
  // share a wall instead of floating apart. A thin WALL inset gives that shared
  // wall a drawn thickness (rooms fill their cell minus half the wall on each
  // side); it is a shrink of the room INSIDE its cell, never a gap BETWEEN cells,
  // so two adjacent cells' rooms still meet along one shared line.
  const WALL = 0.12; // shared-wall thickness in layout units (inset per room edge = WALL/2)
  const colW = new Map(), rowH = new Map();
  for (const r of rooms) {
    const id = String(r.id); const p = pos.get(id); const d = det.get(id);
    const w = (d.sizeW || 1), h = (d.sizeH || 1);
    if (!colW.has(p.gx) || w > colW.get(p.gx)) colW.set(p.gx, w);
    if (!rowH.has(p.gy) || h > rowH.get(p.gy)) rowH.set(p.gy, h);
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const { gx, gy } of pos.values()) {
    if (gx < minX) minX = gx; if (gx > maxX) maxX = gx;
    if (gy < minY) minY = gy; if (gy > maxY) maxY = gy;
  }
  // Cumulative cell offsets per column/row — cells butt directly against each
  // other (no PAD term), so cell boundaries are shared walls.
  const colX = new Map(); let accX = 0;
  for (let gx = minX; gx <= maxX; gx++) { colX.set(gx, accX); accX += (colW.get(gx) || 1); }
  const rowY = new Map(); let accY = 0;
  for (let gy = minY; gy <= maxY; gy++) { rowY.set(gy, accY); accY += (rowH.get(gy) || 1); }
  out.footprint = { w: accX, h: accY };

  // A room's CELL rect (the whole grid cell it owns) and the room box drawn inside
  // it (the cell minus a half-wall inset on every side, so the drawn walls of two
  // abutting rooms coincide along the shared cell boundary). Square rooms fill the
  // cell; round rooms inscribe a circle (radius = half the smaller inset span) and
  // meet a neighbour at the cell boundary the door gap crosses.
  const cellRect = (gx, gy) => {
    const x0 = (colX.get(gx) || 0), y0 = (rowY.get(gy) || 0);
    const cw = (colW.get(gx) || 1), ch = (rowH.get(gy) || 1);
    return { x0, y0, cw, ch };
  };

  const center = new Map();  // room id -> { cx, cy } (drawn box centre)
  const boxOf = new Map();   // room id -> { cx, cy, w, h } (drawn box, wall-inset)
  for (const r of rooms) {
    const id = String(r.id); const p = pos.get(id); const d = det.get(id);
    const { x0, y0, cw, ch } = cellRect(p.gx, p.gy);
    // Drawn box: fill the cell, inset by half a wall on each side so the shared
    // edge with a neighbour is one coincident line (walls butt, no void).
    const w = Math.max(0.2, cw - WALL);
    const h = Math.max(0.2, ch - WALL);
    const cx = x0 + cw / 2, cy = y0 + ch / 2;
    center.set(id, { cx, cy });
    boxOf.set(id, { cx, cy, w, h });
    out.rooms.push({
      id, role: d.role, name: d.name, shape: d.shape, dark: d.dark,
      isEntry: id === entryId, gx: p.gx, gy: p.gy, cx, cy, w, h,
      furniture: d.furniture
    });
  }

  // Building hull: the bounding box of every room box, so the renderer can trace
  // one continuous outer wall in the building's material — the single strongest
  // "this is a building, not scattered boxes" cue. With tiled rooms the hull now
  // hugs the abutting cells (no ballooning around pad-voids). `round` tells it to
  // draw a soft/organic outline (towers, caves, hives) vs a crisp one.
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

  // Doors from the compass graph (each undirected edge once). A doorway is a gap
  // in the SHARED WALL between the two abutting rooms. Its position and direction
  // are read from the ACTUAL grid delta the placement produced (NOT the compass
  // slot, which is an independent planar assignment that can disagree with the
  // grid on cycle edges) — so a drawn doorway always sits on a wall the two rooms
  // truly share, and "go north" opens the wall to the room drawn north. Corridors
  // are ABOLISHED (FP-1): rooms abut, so there is nothing to bridge — `out.corridors`
  // stays []. One topology can force a non-tileable adjacency: three rooms in a
  // cycle (a triangle) can't all pairwise-share walls on a square grid, so one
  // edge lands diagonal. We NEVER hide such an exit (movement still crosses it) —
  // the door is placed where the two rooms come closest and the pair is recorded
  // on out.nonAdjacent for the caller/report; we do not re-invent a corridor.
  const DELTA_DIR = { '1,0': 'east', '-1,0': 'west', '0,1': 'south', '0,-1': 'north' };
  for (const r of rooms) {
    const id = String(r.id);
    const ex = exits.get(id) || {};
    const boxA = boxOf.get(id), pa = pos.get(id); if (!boxA || !pa) continue;
    for (const dir of DIRS) {
      const nb = ex[dir];
      if (!nb || id >= nb) continue;            // once per pair
      const boxB = boxOf.get(nb), pb = pos.get(nb); if (!boxB || !pb) continue;
      const dgx = pb.gx - pa.gx, dgy = pb.gy - pa.gy;
      const orth = (Math.abs(dgx) + Math.abs(dgy) === 1); // orthogonally adjacent cells
      let doorDir, x, y;
      if (orth) {
        // The shared wall is the cell boundary these two cells straddle. The door
        // sits at the centre of the overlap of the two rooms' spans along it, so
        // it always lands on both rooms' real edges.
        doorDir = DELTA_DIR[`${dgx},${dgy}`] || dir;
        if (dgx !== 0) {
          x = dgx > 0 ? (boxA.cx + boxA.w / 2 + boxB.cx - boxB.w / 2) / 2
                      : (boxA.cx - boxA.w / 2 + boxB.cx + boxB.w / 2) / 2;
          const lo = Math.max(boxA.cy - boxA.h / 2, boxB.cy - boxB.h / 2);
          const hi = Math.min(boxA.cy + boxA.h / 2, boxB.cy + boxB.h / 2);
          y = (lo <= hi) ? (lo + hi) / 2 : (boxA.cy + boxB.cy) / 2;
        } else {
          y = dgy > 0 ? (boxA.cy + boxA.h / 2 + boxB.cy - boxB.h / 2) / 2
                      : (boxA.cy - boxA.h / 2 + boxB.cy + boxB.h / 2) / 2;
          const lo = Math.max(boxA.cx - boxA.w / 2, boxB.cx - boxB.w / 2);
          const hi = Math.min(boxA.cx + boxA.w / 2, boxB.cx + boxB.w / 2);
          x = (lo <= hi) ? (lo + hi) / 2 : (boxA.cx + boxB.cx) / 2;
        }
      } else {
        // Non-tileable cycle edge (diagonal cells): place the doorway where the two
        // rooms come closest — the corner they share — and keep the compass slot's
        // direction so movement and the door agree on the name of the exit. Flagged,
        // never hidden, never bridged by a corridor.
        (out.nonAdjacent || (out.nonAdjacent = [])).push({ a: id, b: nb, dir, dgx, dgy });
        doorDir = dir;
        x = (Math.max(boxA.cx - boxA.w / 2, boxB.cx - boxB.w / 2) + Math.min(boxA.cx + boxA.w / 2, boxB.cx + boxB.w / 2)) / 2;
        y = (Math.max(boxA.cy - boxA.h / 2, boxB.cy - boxB.h / 2) + Math.min(boxA.cy + boxA.h / 2, boxB.cy + boxB.h / 2)) / 2;
        if (!Number.isFinite(x)) x = (boxA.cx + boxB.cx) / 2;
        if (!Number.isFinite(y)) y = (boxA.cy + boxB.cy) / 2;
      }
      out.doors.push({ x, y, dir: doorDir, a: id, b: nb });
    }
  }

  return out;
}
