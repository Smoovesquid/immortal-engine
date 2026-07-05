// TAC-1 — position-as-canon: the pure tactical-position layer.
//
// Contract of record: docs/POSITION_AS_CANON.md (§1 frame model, §2 who has a
// position, §5 determinism/invariants/migration) + docs/briefs/TAC-1-position-schema.md.
//
// What this module owns:
//   • the PINNED unit constants (cell↔ft, floorPlan-unit↔cell, node-grid↔cell)
//     — declared ONCE here so no renderer or caller embeds its own conversion;
//   • the pure frame geometry (region-cell ↔ node projection; struct-cell ↔ room
//     rect) the invariants assert against;
//   • the deterministic seeded placement that ensureWorld/migration backfills.
//
// It is COMPLETELY DARK in TAC-1: nothing here is consumed by movement or the
// renderer. TAC-2 adds the movement verb (an { op:'pos' } delta through
// applyDeltas); TAC-4 snaps the renderer onto engine position. This module never
// mutates world state — it returns plain values; state.js writes them.
//
// Purity: every random choice derives from rng.js (seedFromString + makeRng) on a
// stream keyed by (worldSeed, entityId, frameId) — NEVER Math.random, and the
// placement is a pure function of the CURRENT frame context, so two consecutive
// ensureWorld calls on the same world return byte-identical results (idempotent),
// and replay is stable (worldHash includes pos).

import { seedFromString, makeRng } from '../../rng.js';
import { floorPlan } from '../../structures/floorPlan.js';

// ── Pinned constants (TAC-1) ────────────────────────────────────────────────
// Mirror of the "Pinned constants (TAC-1)" block in docs/POSITION_AS_CANON.md.
// Locked by tests/U415. Do NOT change a value without updating the contract block
// and re-running the determinism suite — every stored pos is denominated in these.

// One tactical cell is 5 feet (5e square). The atomic unit of the whole layer.
export const CELL_FT = 5;

// Interiors: floorPlan.js lays rooms into a building-local space in "layout units"
// (a room's cx/cy/w/h). One layout unit is PLACE_WU tactical cells — i.e. a
// layout unit is (PLACE_WU × CELL_FT) = 20 ft across. Chosen so typical rooms
// land at sane sizes: a taproom (w=1.6,h=1.3 layout units) is ~32×26 ft; a guest
// room (0.8) is ~16 ft; the smallest privy (0.4) is ~8 ft. PLACE_WU is the
// brief's floorPlan-grid subdivision.
export const PLACE_WU = 4; // cells per floorPlan layout unit

// The outdoor REGION SHEET anchors to the node grid (engine/map/embedding.js:
// every node carries integer node.x/node.y). One node-grid step is NODE_WU feet
// of world = (NODE_WU / CELL_FT) region cells. 1000 ft ≈ 305 m between adjacent
// grid cells suits the ~100 km² slice; a node's "area" on the sheet is a
// NODE_CELLS-wide neighbourhood around its projected centre.
export const NODE_WU = 1000; // feet per node-grid unit

// Derived (integer): region cells per node-grid step.
export const NODE_CELLS = NODE_WU / CELL_FT; // 200

// ── Unit conversions (exact, round-trippable — U415) ─────────────────────────

// floorPlan layout units → tactical cells (nearest integer cell).
export function layoutToCells(u) {
  return Math.round(Number(u) * PLACE_WU);
}

// A whole cell → feet, and feet → cells (exact multiples round-trip perfectly).
export function cellsToFt(cells) {
  return Number(cells) * CELL_FT;
}
export function ftToCells(ft) {
  return Number(ft) / CELL_FT;
}

// Region cell ↔ node-grid coordinate. A node at grid (nx,ny) projects to the
// region-cell centre (nx × NODE_CELLS, ny × NODE_CELLS). Exact both ways for the
// centre; cellToNodeGrid rounds an arbitrary cell to its owning grid coordinate.
export function nodeGridToRegionCell(nx, ny) {
  return { gx: nx * NODE_CELLS, gy: ny * NODE_CELLS };
}
export function regionCellToNodeGrid(gx, gy) {
  return { x: Math.round(gx / NODE_CELLS), y: Math.round(gy / NODE_CELLS) };
}

// ── Region-frame geometry ───────────────────────────────────────────────────

// The node whose projected region-cell centre is nearest a given region cell.
// Deterministic: ties break on the (sorted) node id. Returns the node id or ''
// when the map has no positioned nodes.
export function nearestNodeToRegionCell(map, gx, gy) {
  const nodes = Array.isArray(map?.nodes) ? map.nodes : [];
  let best = '';
  let bestD = Infinity;
  // Stable iteration order so ties are deterministic.
  const ordered = nodes
    .filter(n => n && Number.isInteger(n.x) && Number.isInteger(n.y))
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  for (const n of ordered) {
    const c = nodeGridToRegionCell(n.x, n.y);
    const dx = c.gx - gx;
    const dy = c.gy - gy;
    const d = dx * dx + dy * dy; // squared Euclidean — monotonic, integer
    if (d < bestD) {
      bestD = d;
      best = String(n.id);
    }
  }
  return best;
}

// The node object for an id (or null).
function nodeById(map, nodeId) {
  const nodes = Array.isArray(map?.nodes) ? map.nodes : [];
  return nodes.find(n => n && String(n.id) === String(nodeId)) || null;
}

// Whether a registered structure sits at the current node — the truthy at-node
// interior the PLAYER's frame is pinned to. Returns { structId, roomId } or null.
function playerAtNodeInterior(world, curNodeId, sceneInterior) {
  if (!sceneInterior || !sceneInterior.structureKey || !sceneInterior.roomId) return null;
  const structId = String(sceneInterior.structureKey);
  const st = world?.structures?.byId?.[structId] || null;
  if (!st) return null;
  if (curNodeId && st.nodeId != null && String(st.nodeId) !== '' && String(st.nodeId) !== curNodeId) {
    return null; // stale interior (elsewhere) — NODE-DESYNC-1 treats this as outdoors-here
  }
  return { structId, roomId: String(sceneInterior.roomId) };
}

// Whether a stored tactical pos is still VALID for the current frame context —
// consistent with map.currentNodeId, and (for the PLAYER) with the indoor/outdoor
// truth in scene.interior. Shared by the backfill (state.js: keep a consistent pos,
// re-derive a stale one) and the invariant (invariants.js: throw on inconsistency)
// so the two never drift. opts.isPlayer pins the frame to scene.interior (indoors →
// that struct's room; outdoors → region); NPCs (isPlayer falsy) are frame-agnostic
// (their own indoor/outdoor is their occupancy assignment — not re-derived here, and
// either frame projects to the current node while they stay put). null pos → always
// consistent (absent). Bare fixtures with no positioned nodes / no current node are
// tolerated — the invariant is likewise lenient there.
export function isTacticalPosConsistent(pos, world, curNodeId, opts = {}) {
  if (pos == null) return true;
  if (typeof pos !== 'object' || Array.isArray(pos)) return false;
  if (!Number.isInteger(pos.gx) || !Number.isInteger(pos.gy)) return false;
  const isPlayer = !!opts.isPlayer;
  const atNode = isPlayer ? playerAtNodeInterior(world, curNodeId, opts.sceneInterior) : null;
  const frame = String(pos.frame ?? '');
  const map = world?.map || {};
  if (frame === 'region') {
    // The player is only outdoors (region) when they have no at-node interior.
    if (isPlayer && atNode) return false;
    const nodes = Array.isArray(map.nodes) ? map.nodes : [];
    const anyPositioned = nodes.some(n => n && Number.isInteger(n.x) && Number.isInteger(n.y));
    if (!curNodeId || !anyPositioned) return true; // nothing to project against
    return nearestNodeToRegionCell(map, pos.gx, pos.gy) === curNodeId;
  }
  const m = /^struct:(.+)$/.exec(frame);
  if (!m) return false;
  const structId = m[1];
  const st = world?.structures?.byId?.[structId] || null;
  if (!st) return false;
  if (curNodeId && st.nodeId != null && String(st.nodeId) !== '' && String(st.nodeId) !== curNodeId) {
    return false;
  }
  const room = roomOfStructCell(floorPlan(st), pos.gx, pos.gy);
  if (!room) return false;
  // The player indoors must be in exactly the structure+room scene.interior names;
  // a player with no at-node interior must NOT be in a struct frame.
  if (isPlayer) {
    if (!atNode) return false;
    if (atNode.structId !== structId) return false;
    if (atNode.roomId !== room) return false;
  }
  return true;
}

// ── Struct-frame geometry ───────────────────────────────────────────────────

// The shared-wall band, in cells, reserved between abutting rooms (FP-1). Under
// the tiled floor plan connected rooms ABUT, so their layout boxes touch along a
// shared wall; quantized to cells at PLACE_WU, two touching boxes would otherwise
// claim the SAME boundary cell and roomOfStructCell would attribute it to whichever
// room sorts first — mislabelling a cell the other room owns and tripping the pos
// invariant on a room-to-room move. Insetting every room rect by one wall cell on
// each side keeps room territories DISJOINT: the boundary cell belongs to the wall
// (walkable by nobody), so a placed pos always resolves to exactly its own room.
const WALL_CELLS = 1;

// A room's cell-space rectangle, derived from its floorPlan layout box (cx,cy
// centre; w,h size, in layout units). Half-extents floor to at least 0, then inset
// by the shared-wall band so abutting rooms never share a boundary cell — but a
// room always keeps at least its centre cell (a tiny closet stays placeable, and a
// room too small to inset simply owns its single centre cell). Returns integer cell
// bounds (inclusive).
export function roomRectCells(room) {
  if (!room || typeof room !== 'object') return null;
  const cx = layoutToCells(room.cx);
  const cy = layoutToCells(room.cy);
  const halfW = Math.max(0, Math.floor(layoutToCells(room.w) / 2));
  const halfH = Math.max(0, Math.floor(layoutToCells(room.h) / 2));
  // Inset by the wall band, but never past the centre cell.
  const insetW = Math.min(WALL_CELLS, halfW);
  const insetH = Math.min(WALL_CELLS, halfH);
  return {
    id: String(room.id),
    cx, cy,
    minX: cx - halfW + insetW, maxX: cx + halfW - insetW,
    minY: cy - halfH + insetH, maxY: cy + halfH - insetH
  };
}

// Which room of a floorPlan contains a struct cell (gx,gy) — the projection the
// invariant checks against scene.interior. Rooms are scanned in sorted-id order
// so an overlap resolves deterministically. Returns the room id or '' if the cell
// lies in no room rect.
export function roomOfStructCell(plan, gx, gy) {
  const rooms = Array.isArray(plan?.rooms) ? plan.rooms : [];
  const ordered = rooms
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  for (const r of ordered) {
    const rect = roomRectCells(r);
    if (!rect) continue;
    if (gx >= rect.minX && gx <= rect.maxX && gy >= rect.minY && gy <= rect.maxY) {
      return rect.id;
    }
  }
  return '';
}

// ── Door thresholds (MR-1a) — the struct↔region cells a doorway maps ─────────
// docs/POSITION_AS_CANON.md §2 ("arrivals enter at the doorway/road edge they came
// by") + §3 ("stepping through an entry doorway swaps frame struct: ↔ region at the
// door's mapped cells"). This is the geometry the EGRESS path commits: stepping out
// must land the body on the DOORSTEP of the structure it left, not a re-seeded cell.
//
// A structure's floorPlan carries only room-to-room doors (each has room ids in
// a/b — see floorPlan.js) — there is NO explicit exterior door record. So the ENTRY
// ROOM (isEntry, where enterStructureInterior drops you) is the doorway to the
// outside, and the outside threshold is the region cell one doorstep beyond that
// room's OUTER edge. "Outer" is deterministic geometry: the dominant-axis cardinal
// of (entry-room-centre − building-footprint-centre) — the entry room sits on the
// building's perimeter, so that vector points away from the interior, out the front.
//
// Frame anchoring matches the probe's structFootprintRegionCells and the TAC-1
// unit block: a floorPlan layout coordinate L maps to the region cell
// (nodeCentre + L × PLACE_WU); struct-frame cells use layoutToCells(L) on the same
// scale. PLACE_WU is the one scale both frames share, so the inside/outside cells
// are a consistent doorstep across the frame swap.

// The node record for a structure (by its nodeId), or null.
function nodeForStruct(world, structure) {
  const nodes = Array.isArray(world?.map?.nodes) ? world.map.nodes : [];
  return nodes.find(n => n && String(n.id) === String(structure?.nodeId)) || null;
}

// The building-local footprint centre, in layout units: the mid of the bounding box
// of every room's drawn box. Mirrors the probe's midX/midY (kept in-sync with
// structFootprintRegionCells). Returns { cx, cy } or null when no room grounds.
function footprintCentreLayout(plan) {
  const rooms = Array.isArray(plan?.rooms) ? plan.rooms : [];
  if (!rooms.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rooms) {
    const rw = (r.w || (r.r ? r.r * 2 : 0)) / 2;
    const rh = (r.h || (r.r ? r.r * 2 : 0)) / 2;
    minX = Math.min(minX, r.cx - rw); maxX = Math.max(maxX, r.cx + rw);
    minY = Math.min(minY, r.cy - rh); maxY = Math.max(maxY, r.cy + rh);
  }
  if (!Number.isFinite(minX)) return null;
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

/**
 * doorThresholdCells(world, structId, doorId?) -> null | {
 *   inside:  { frame: 'struct:<id>', gx, gy },   // the doorway room's cell, struct frame
 *   outside: { frame: 'region', gx, gy },        // one doorstep beyond it, region frame
 *   dir      // the outward cardinal ('north'|'east'|'south'|'west')
 * }
 *
 * `doorId` selects a specific room-to-room door by its `a`/`b` room-pair id or index
 * when the caller entered by one; absent, the ENTRY room (isEntry) is the doorway.
 * Pure + deterministic (no rng, no LLM) — a function of the structure geometry and
 * the node anchor. Returns null when the structure/plan/node can't be grounded (the
 * caller then falls back to its existing handling — the seeded placement).
 */
export function doorThresholdCells(world, structId, doorId = null) {
  const st = world?.structures?.byId?.[String(structId)] || null;
  if (!st) return null;
  const node = nodeForStruct(world, st);
  if (!node || !Number.isInteger(node.x) || !Number.isInteger(node.y)) return null;
  const plan = floorPlan(st);
  const rooms = Array.isArray(plan?.rooms) ? plan.rooms : [];
  if (!rooms.length) return null;

  // The doorway room. A specific doorId (a room id the entrant used, or a door
  // index) selects the room on the near side; otherwise the entry room, else the
  // sorted-first room (matches floorPlan's entryId fallback).
  let doorRoom = null;
  if (doorId != null && String(doorId) !== '') {
    const doors = Array.isArray(plan.doors) ? plan.doors : [];
    const idx = Number(doorId);
    const byIdx = (Number.isInteger(idx) && idx >= 0 && idx < doors.length) ? doors[idx] : null;
    const wantId = String(doorId);
    // Prefer a room whose id matches; else the near room of the indexed door.
    doorRoom = rooms.find(r => String(r.id) === wantId)
      || (byIdx ? rooms.find(r => String(r.id) === String(byIdx.a)) : null)
      || null;
  }
  // MR-2a — CONSUME THE EXTERIOR DOOR RECORD (docs/briefs/MR-2-FUNCTIONAL-INK.md
  // §MR-2a). When the caller didn't pin a specific door room, prefer the canon
  // exterior-door RECORD (st.doors[].exterior — authored by ensureWorld's tail):
  // its `a` field IS the front-door room, so the doorstep is grounded on the door
  // the world records rather than re-derived from geometry. Read inline off the
  // plain structure array (no import of doors.js — that would cycle with this
  // module). The isEntry / sorted-first derivation BELOW stays as the LEGACY
  // FALLBACK for a structure with no doors[] yet (pre-v31 saves before the tail
  // authors them, or a roomless/ungroundable structure).
  if (!doorRoom) {
    const storedDoors = Array.isArray(st.doors) ? st.doors : [];
    const ext = storedDoors.find(d => d && d.exterior && String(d.a ?? '') !== '');
    if (ext) doorRoom = rooms.find(r => String(r.id) === String(ext.a)) || null;
  }
  if (!doorRoom) doorRoom = rooms.find(r => r.isEntry) || null;
  if (!doorRoom) {
    doorRoom = rooms.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))[0] || null;
  }
  if (!doorRoom) return null;

  const rect = roomRectCells(doorRoom);
  if (!rect) return null;

  // Inside cell: the doorway room's centre cell in the STRUCT frame (always inside
  // the room rect — roomRectCells keeps the centre even for a tiny room).
  const inside = { frame: `struct:${String(st.id)}`, gx: rect.cx, gy: rect.cy };

  // Outward direction: dominant cardinal of (entry-room-centre − footprint-centre).
  // Ties (a perfectly central single-room building) break to a stable default so the
  // result is deterministic; south is chosen so the doorstep sits "in front".
  const fc = footprintCentreLayout(plan) || { cx: doorRoom.cx, cy: doorRoom.cy };
  const vx = doorRoom.cx - fc.cx;
  const vy = doorRoom.cy - fc.cy;
  let dx = 0, dy = 0, dir;
  if (Math.abs(vx) >= Math.abs(vy) && Math.abs(vx) > 1e-9) {
    dx = vx > 0 ? 1 : -1; dir = vx > 0 ? 'east' : 'west';
  } else if (Math.abs(vy) > 1e-9) {
    dy = vy > 0 ? 1 : -1; dir = vy > 0 ? 'south' : 'north';
  } else {
    dy = 1; dir = 'south'; // central single-room building — step out the front (south)
  }

  // Outside cell: the region cell one doorstep beyond the doorway room's OUTER edge.
  // The room's outer edge, in region cells, is nodeCentre + (roomCentre ± halfSpan)
  // × PLACE_WU along the outward axis; +1 cell is the doorstep just past the wall.
  const centre = nodeGridToRegionCell(node.x, node.y);
  const halfWLayout = Math.max(0, (doorRoom.w || 0) / 2);
  const halfHLayout = Math.max(0, (doorRoom.h || 0) / 2);
  const edgeXLayout = doorRoom.cx + dx * halfWLayout;
  const edgeYLayout = doorRoom.cy + dy * halfHLayout;
  const gx = Math.round(centre.gx + edgeXLayout * PLACE_WU) + dx;
  const gy = Math.round(centre.gy + edgeYLayout * PLACE_WU) + dy;
  const outside = { frame: 'region', gx, gy };

  return { inside, outside, dir };
}

// ── MR-2a — struct walkable-mask helpers (the GEOMETRY_BREACH geometry) ───────
// docs/briefs/MR-2-FUNCTIONAL-INK.md §MR-2a. Walls block; the only room↔room
// crossings are DOORS. These pure helpers answer "did a committed struct move cross
// from one room into another the two rooms have no OPEN door between?" — the
// falsifier the position probe's GEOMETRY_BREACH assertion evaluates. Kept here
// (not doors.js) so tacticalPos owns the frame geometry and doors.js need not be
// imported (that would cycle). Door adjacency is read INLINE off the plain
// structure array (st.doors).
//
// Why room-PAIR adjacency, not door-cell-on-path: a room-to-room move is a
// TOPOLOGICAL transition that re-seeds the body's cell somewhere in the destination
// room (placementForWorld), NOT a cell walk along the door. So the straight line
// between the two seeded cells legitimately crosses the FP-1 wall band — the move
// is honest iff the two ENDPOINT rooms are joined by an open door. A same-room move
// (a tactical walk) that leaves the room's rect crosses a wall and IS a breach.

// The room a struct cell belongs to (roomRectCells territories are DISJOINT under
// the FP-1 wall band). Exported form of the module-internal projection, taking a
// structure (so callers work from world.structures.byId[...]).
export function roomOfStructCellForStruct(structure, gx, gy) {
  return roomOfStructCell(floorPlan(structure), gx, gy);
}

// The set of room PAIRS joined by an OPEN interior door (order-independent keys
// "a|b" sorted). Read inline from the structure's canon doors[] — NO import of
// doors.js (would cycle). Only an OPEN door is a passable crossing; a shut door is
// opened as part of a move (so a committed cross reads open), barred/locked block.
function openDoorRoomPairs(structure) {
  const doors = Array.isArray(structure?.doors) ? structure.doors : [];
  const pairs = new Set();
  for (const d of doors) {
    if (!d || d.exterior) continue;
    if (String(d.state) !== 'open') continue;
    const a = String(d.a ?? ''), b = String(d.b ?? '');
    if (!a || !b) continue;
    pairs.add([a, b].sort((x, y) => x.localeCompare(y)).join('|'));
  }
  return pairs;
}

/**
 * pathCrossesWallWithoutDoor(structure, from, to) -> boolean
 *
 * True when a committed struct move from `from` to `to` (both struct cells of
 * `structure`) crosses a wall the geometry forbids — a GEOMETRY BREACH (a body
 * walked through a wall). The rule:
 *   • same room (from and to resolve to the same room) → the walk stayed inside its
 *     room rect → clean (false). (A tactical walk that left the rect would land in
 *     the void/another room and be caught below.)
 *   • different rooms → LEGITIMATE iff an OPEN door joins those two rooms (the move
 *     went through that door, re-seeding the cell); otherwise a wall was crossed →
 *     breach (true).
 *   • an endpoint in NO room (the wall band / void / outside the plan) → breach: a
 *     committed body should never rest inside a wall.
 *
 * Pure integer geometry; no world, no rng. Byte-deterministic (probe GEOMETRY_BREACH).
 */
export function pathCrossesWallWithoutDoor(structure, from, to) {
  if (!from || !to || !Number.isInteger(from.gx) || !Number.isInteger(from.gy)
    || !Number.isInteger(to.gx) || !Number.isInteger(to.gy)) return false;
  const plan = floorPlan(structure);
  const roomFrom = roomOfStructCell(plan, from.gx, from.gy);
  const roomTo = roomOfStructCell(plan, to.gx, to.gy);
  // A committed body must rest in a real room, never inside a wall/void.
  if (roomTo === '') return true;
  if (roomFrom === '') return true;
  if (roomFrom === roomTo) return false; // stayed in one room — no wall crossed
  // Crossed into a different room: legal only through an OPEN door joining them.
  const pairKey = [roomFrom, roomTo].sort((x, y) => x.localeCompare(y)).join('|');
  return !openDoorRoomPairs(structure).has(pairKey);
}

// Cached floorPlan per structure id (floorPlan is a pure function of the
// structure, so this is a per-call memo, not stored state).
function planFor(structure, cache) {
  const id = String(structure?.id ?? '');
  if (cache && cache.has(id)) return cache.get(id);
  const plan = floorPlan(structure);
  if (cache) cache.set(id, plan);
  return plan;
}

// ── TAC-2 — the tactical move verb (the ≤6-cell pos walk) ────────────────────
// docs/POSITION_AS_CANON.md §3 THE MOVEMENT LAW. Self-powered movement is ≤ 6 cells
// (30 ft) per turn, ALWAYS — never node travel. resolveTacticalWalk is the pure
// f(world, {actorId,dir,cells}) the engine grounds a cardinal walk with: it clamps
// the ask to the budget, walks the actor's canonical `pos` greedily one cell at a
// time on the current frame's walkable cells, and STOPS HONESTLY at the frame edge
// (a room wall indoors; the node neighbourhood boundary outdoors — a same-node walk
// is intentionally small, so this never leaks the region cell to another node before
// the region-sheet packet lands). It NEVER crosses a doorway into another room — a
// cross-room move is a frame/room transition owned by the existing interior-move
// path (moveWithinInterior + the seeded re-placement), not this cell walk. Returns a
// plain result the caller commits via applyDeltas({op:'pos'}) — this module never
// mutates world state.

// The self-powered movement budget, in cells (30 ft). THE MOVEMENT LAW's flat v1
// value (speed stats come later); a clamp, never a target.
export const MAX_WALK_CELLS = 6;

// Cardinal → unit cell delta. North is up (−y), matching floorPlan/placeOnGrid and
// the interior compass. Only orthogonal cardinals in v1 (diagonals deferred, §3).
const DIR_VEC = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 }
};

// The room rect (roomRectCells) that CONTAINS a struct cell, or null. The walkable
// area for an in-room walk is exactly this rect — the FP-1 wall band already carved
// the inter-room void out of every rect, so "inside the current room's rect" is the
// walkable mask the walk honours (and roomOfStructCell of any in-rect cell returns
// this same room, keeping the pos invariant green by construction).
function roomRectContaining(plan, gx, gy) {
  const rooms = Array.isArray(plan?.rooms) ? plan.rooms : [];
  const ordered = rooms
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  for (const r of ordered) {
    const rect = roomRectCells(r);
    if (!rect) continue;
    if (gx >= rect.minX && gx <= rect.maxX && gy >= rect.minY && gy <= rect.maxY) {
      return rect;
    }
  }
  return null;
}

// Greedy straight walk from (gx,gy) by up to `steps` unit steps of (dx,dy), stopping
// at the last cell for which inBounds(cell) holds. Pure integer arithmetic — the same
// path every call. Returns { gx, gy, moved } (moved = cells actually advanced).
function walkWhile(gx, gy, dx, dy, steps, inBounds) {
  let cx = gx, cy = gy, moved = 0;
  for (let i = 0; i < steps; i++) {
    const nx = cx + dx, ny = cy + dy;
    if (!inBounds(nx, ny)) break;
    cx = nx; cy = ny; moved++;
  }
  return { gx: cx, gy: cy, moved };
}

/**
 * resolveTacticalWalk(world, { actorId, dir, cells }) -> null | {
 *   pos,          // the new pos to commit (same frame; { frame, gx, gy })
 *   from,         // the pos walked from (unchanged reference)
 *   dir,          // the normalized cardinal
 *   askedCells,   // cells requested, AFTER the budget clamp (≤ MAX_WALK_CELLS)
 *   movedCells,   // cells actually advanced (0 when already at the wall/edge)
 *   clampedToBudget, // true when the raw ask exceeded MAX_WALK_CELLS
 *   frame         // 'region' | 'struct:<id>'
 * }
 *
 * Returns null when there is nothing to resolve here (no actor pos, unknown/absent
 * direction, or an unrecognised frame) — the caller then falls back to its normal
 * handling. A valid result with movedCells === 0 is an HONEST no-progress walk (the
 * actor is already against the wall that way); the caller narrates the read and does
 * NOT commit a delta (pos is unchanged). Actor 'party' resolves to party[0].
 *
 * Pure + deterministic: no rng, no LLM, a function of the current frame geometry.
 */
export function resolveTacticalWalk(world, { actorId = 'party', dir, cells } = {}) {
  const d = String(dir || '').toLowerCase();
  const vec = DIR_VEC[d];
  if (!vec) return null; // not a cardinal we walk on

  // Resolve the actor's current pos. 'party' → party[0]; a named id → that party
  // member (NPC tactical walks are not a TAC-2 verb — the player drives this).
  const party = Array.isArray(world?.party) ? world.party : [];
  let actor = null;
  if (String(actorId) === 'party') actor = party[0] || null;
  else actor = party.find(m => String(m?.id) === String(actorId)) || null;
  const pos = actor?.pos;
  if (!pos || typeof pos !== 'object' || !Number.isInteger(pos.gx) || !Number.isInteger(pos.gy)) {
    return null; // no tactical pos to walk (absent from the layer)
  }

  // Clamp the ask to the budget. A missing/invalid cell count defaults to the full
  // budget (a bare "go east" = "cross the room", up to 30 ft).
  let asked = Number.isFinite(cells) ? Math.trunc(cells) : MAX_WALK_CELLS;
  if (asked < 0) asked = 0;
  const clampedToBudget = asked > MAX_WALK_CELLS;
  asked = Math.min(asked, MAX_WALK_CELLS);

  const frame = String(pos.frame || '');
  let landed;

  if (frame === 'region') {
    // Outdoors: walk on the region sheet, but keep the cell projecting to the
    // CURRENT node (the region-sheet packet owns crossing node neighbourhoods; a
    // ≤6-cell walk is far smaller than the node spacing, so this only bites at the
    // extreme edge). The invariant requires nearestNode(cell) === currentNodeId, so
    // the walk stops before it would flip the owning node.
    const map = world?.map || {};
    const curNodeId = String(map.currentNodeId ?? '');
    const nodes = Array.isArray(map.nodes) ? map.nodes : [];
    const anyPositioned = nodes.some(n => n && Number.isInteger(n.x) && Number.isInteger(n.y));
    const inBounds = (nx, ny) => {
      if (!curNodeId || !anyPositioned) return true; // nothing to project against
      return nearestNodeToRegionCell(map, nx, ny) === curNodeId;
    };
    landed = walkWhile(pos.gx, pos.gy, vec.dx, vec.dy, asked, inBounds);
  } else {
    const m = /^struct:(.+)$/.exec(frame);
    if (!m) return null;
    const structId = m[1];
    const st = world?.structures?.byId?.[structId] || null;
    if (!st) return null;
    const plan = floorPlan(st);
    const rect = roomRectContaining(plan, pos.gx, pos.gy);
    if (!rect) return null; // current cell isn't in a room rect — leave to the caller
    // Walk within the CURRENT room's rect only. Leaving the room means crossing a
    // doorway (an adjacent-room transition) — not this cell walk's job (§3).
    const inBounds = (nx, ny) =>
      nx >= rect.minX && nx <= rect.maxX && ny >= rect.minY && ny <= rect.maxY;
    landed = walkWhile(pos.gx, pos.gy, vec.dx, vec.dy, asked, inBounds);
  }

  return {
    pos: { frame: pos.frame, gx: landed.gx, gy: landed.gy },
    from: pos,
    dir: d,
    askedCells: asked,
    movedCells: landed.moved,
    clampedToBudget,
    frame: pos.frame
  };
}

// ── Deterministic seeded placement ──────────────────────────────────────────

// A stream keyed by the world seed, the entity, and the frame it is being placed
// into. Same inputs → same cell, every call, forever. frameId folds in the node /
// structure / room so a change of frame re-derives cleanly (still deterministic).
function placeStream(worldSeed, entityId, frameId) {
  return makeRng(seedFromString(`${worldSeed}|${entityId}|${frameId}|tacpos`));
}

// Place an entity inside a room rect: the room centre plus a seeded jitter that
// never leaves the rect. In-bounds + correct-room is all TAC-1 owes (walkable-mask
// validation arrives with TAC-2's movement).
function placeInRoomRect(rect, rng) {
  const spanX = rect.maxX - rect.minX;
  const spanY = rect.maxY - rect.minY;
  const gx = spanX > 0 ? rect.minX + rng.int(0, spanX) : rect.cx;
  const gy = spanY > 0 ? rect.minY + rng.int(0, spanY) : rect.cy;
  return { gx, gy };
}

// Place an entity outdoors near a node centre: within ± a quarter of the node
// spacing, so everyone at a node clusters around it but not all on one cell, and
// the cell always projects back to that same node (quarter-spacing < half-spacing
// keeps nearestNode stable).
const NODE_JITTER = Math.floor(NODE_CELLS / 4); // 50 cells
function placeNearNode(node, rng) {
  const centre = nodeGridToRegionCell(node.x, node.y);
  const gx = centre.gx + rng.int(-NODE_JITTER, NODE_JITTER);
  const gy = centre.gy + rng.int(-NODE_JITTER, NODE_JITTER);
  return { gx, gy };
}

// Build a struct-frame pos for an entity placed in (structureId, roomId), or null
// if that room can't be grounded in the structure's floorPlan.
function structPos(structure, roomId, worldSeed, entityId, cache) {
  const plan = planFor(structure, cache);
  const room = (plan.rooms || []).find(r => String(r.id) === String(roomId));
  if (!room) return null;
  const rect = roomRectCells(room);
  if (!rect) return null;
  const structId = String(structure.id);
  const rng = placeStream(worldSeed, entityId, `struct:${structId}|${roomId}`);
  const { gx, gy } = placeInRoomRect(rect, rng);
  return { frame: `struct:${structId}`, gx, gy };
}

// Build a region-frame pos for an entity placed outdoors at a node, or null if the
// node has no grid coordinate.
function regionPos(node, worldSeed, entityId) {
  if (!node || !Number.isInteger(node.x) || !Number.isInteger(node.y)) return null;
  const rng = placeStream(worldSeed, entityId, `region:${node.x},${node.y}`);
  const { gx, gy } = placeNearNode(node, rng);
  return { frame: 'region', gx, gy };
}

// Reuse the occupancy derivation so placed NPCs sit exactly where the game already
// says they are: outdoors, or inside a specific building+room at the node. Both
// helpers are pure reads over an already-ensured world (no ensureWorld, no
// circular import — roomOccupancy is deliberately import-light for this reason).
import { outdoorOccupants, occupantsOfRoom } from '../../structures/roomOccupancy.js';

// Buildings at the current node, sorted for stable indexing. Mirrors
// roomOccupancy.nodeBuildings — derived straight from world.structures, never
// through interiors.js (which calls ensureWorld and would recurse under us).
function buildingsAtNode(world, nodeId) {
  const byId = world?.structures?.byId || {};
  return Object.values(byId)
    .filter(s => s && String(s.nodeId ?? '') === String(nodeId))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

// The (structure, room) an indoor NPC occupies — inverted from the occupancy
// derivation: an NPC is in a structure's room iff occupantsOfRoom(...) for that
// room includes them. Returns { structure, roomId } or null (= outdoors / not
// placed in any building at this node).
function npcBuildingAtNode(world, npcId, structures, cache) {
  for (const st of structures) {
    const plan = planFor(st, cache);
    const rooms = Array.isArray(plan?.rooms) ? plan.rooms : [];
    if (!rooms.length) continue;
    const structId = String(st.id);
    for (const r of rooms) {
      const occ = occupantsOfRoom(world, structId, String(r.id));
      if (occ.some(n => String(n?.id || n?.name || '') === npcId)) {
        return { structure: st, roomId: String(r.id) };
      }
    }
  }
  return null;
}

/**
 * placementForWorld(world) -> Map<entityId, pos>
 *
 * The deterministic tactical placement for everyone who gets a position in TAC-1:
 *   • party[0] (the player) — in the wake room's rect if indoors (scene.interior),
 *     else on the region grid near the current node;
 *   • settlement NPCs present at the current node — indoors NPCs in their assigned
 *     building+room rect, outdoor NPCs on the region grid near the node.
 *
 * pos is only produced when it can be validly grounded; otherwise the entity is
 * simply absent from this map (the caller keeps pos = null, always a legal state).
 * Pure: no world mutation, rng.js only, a function of the CURRENT frame context.
 */
export function placementForWorld(world) {
  const out = new Map();
  const worldSeed = String(world?.meta?.seed ?? '');
  const map = world?.map || {};
  const curNodeId = String(map.currentNodeId ?? '');
  const planCache = new Map();

  // ── Party ──────────────────────────────────────────────────────────────
  const party = Array.isArray(world?.party) ? world.party : [];
  const player = party[0];
  if (player) {
    const pid = String(player.id || 'party');
    const interior = world?.scene?.interior;
    let placed = null;
    if (interior && typeof interior === 'object' && interior.structureKey && interior.roomId) {
      const st = world?.structures?.byId?.[String(interior.structureKey)];
      // Only place indoors when the interior's structure is at the current node
      // (composes with NODE-DESYNC-1: a stale interior never grounds a pos).
      if (st && String(st.nodeId ?? '') === curNodeId) {
        placed = structPos(st, String(interior.roomId), worldSeed, pid, planCache);
      }
    }
    if (!placed) {
      const node = nodeById(map, curNodeId);
      placed = regionPos(node, worldSeed, pid);
    }
    if (placed) out.set(pid, placed);
  }

  // ── Present NPCs (settlement roster at the current node) ──────────────────
  const node = nodeById(map, curNodeId);
  const roster = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
  if (roster.length) {
    const structures = buildingsAtNode(world, curNodeId);
    const outdoors = new Set(
      outdoorOccupants(world).map(n => String(n?.id || n?.name || ''))
    );
    for (const npc of roster) {
      const nid = String(npc?.id || npc?.name || '');
      if (!nid) continue;
      let placed = null;
      if (!outdoors.has(nid)) {
        const inBuilding = npcBuildingAtNode(world, nid, structures, planCache);
        if (inBuilding) {
          placed = structPos(inBuilding.structure, inBuilding.roomId, worldSeed, nid, planCache);
        }
      }
      if (!placed) {
        placed = regionPos(node, worldSeed, nid);
      }
      if (placed) out.set(nid, placed);
    }
  }

  return out;
}
