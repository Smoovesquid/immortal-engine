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

// A room's cell-space rectangle, derived from its floorPlan layout box
// (cx,cy centre; w,h size, in layout units). Half-extents floor to at least 0 so
// even a tiny room owns its centre cell. Returns integer cell bounds (inclusive).
export function roomRectCells(room) {
  if (!room || typeof room !== 'object') return null;
  const cx = layoutToCells(room.cx);
  const cy = layoutToCells(room.cy);
  const halfW = Math.max(0, Math.floor(layoutToCells(room.w) / 2));
  const halfH = Math.max(0, Math.floor(layoutToCells(room.h) / 2));
  return {
    id: String(room.id),
    cx, cy,
    minX: cx - halfW, maxX: cx + halfW,
    minY: cy - halfH, maxY: cy + halfH
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

// Cached floorPlan per structure id (floorPlan is a pure function of the
// structure, so this is a per-call memo, not stored state).
function planFor(structure, cache) {
  const id = String(structure?.id ?? '');
  if (cache && cache.has(id)) return cache.get(id);
  const plan = floorPlan(structure);
  if (cache) cache.set(id, plan);
  return plan;
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
