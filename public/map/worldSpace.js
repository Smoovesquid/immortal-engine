// ONE MAP — the world-space embedding (docs/ONE_MAP.md, the load-bearing 20%).
//
// One coordinate system, in world units (wu). Everything on the map gets an
// address in it; the camera (oneMap.js) just draws what's in frame. Pure and
// deterministic: same world, same addresses, forever. Client-side projection
// only — the engine's canon coordinates (node.x,y, place units, plan units)
// are untouched, and nothing here is ever serialized or hashed.

import { biomeForNode } from '../../engine/world/biome.js';
import { floorPlan } from '../../engine/structures/floorPlan.js';

export const NODE_WU = 1000;  // one node-lattice step ≈ 1 km (1 wu ≈ 1 m)
export const PLACE_WU = 4;    // one village place-unit ≈ 4 m (61-unit village ≈ 244 wu)

export const Z_MIN = 0.008;   // whole world in frame incl. the far Heath ("fit" button frames it all)
// TT-DRAW-2 — the zoom ceiling deepened so a true-scale building plan is
// actually legible (room names + door gaps readable), not just theoretically
// reachable: at Z_MAX a ~10 wu cottage (structureWorldRect scale, post TT-DRAW-2
// sizing-truth fix) spans well over half the shorter viewport axis across the
// realistic range of live map-panel widths (the play layout's main column is
// `minmax(0,1fr)` beside a fixed ~280-300px sidebar — see U417). Was 16 (only
// ~20-40% of frame on a true-scale building; wheel-in stalled short of
// plan-legible). Named constant, tunable in this ONE spot; the wall/label
// z-scale formulas downstream already saturate below this value (Math.min
// caps), so raising it deepens the zoom without blowing up line weights or
// font sizes.
export const Z_MAX = 60;      // building-plan band, 1 place-unit = 240 px

// Semantic LOD thresholds (px per wu). Representations fade in across an
// octave around these — the camera never cuts.
export const BAND = {
  region: 0.08,     // roads + all discovered nodes + names
  settlement: 0.5,  // village footprints with real layouts (M2)
  street: 4,        // walkable detail, tokens, interiors (M3)
  // WS-3 — the plan-scale default the camera snaps to on crossing the
  // indoor/outdoor threshold (docs/briefs/WS-3-one-surface.md): deep enough that
  // the roof-lift cutaway (fully resolved by BAND.street*1.8) has long since
  // opened, room names are legible (oneMap.js's z>=6 label threshold) and the
  // graph-paper quadrille (drawModel.js's gridFadeZEnd=16) is fully inked — but
  // short of Z_MAX so the room's own building (and a neighbor or two) still sit
  // in frame, not one room filling the whole canvas. Named + tunable in this ONE
  // spot, same idiom as every other band threshold here.
  plan: 32
};

/** Node lattice → world units. */
export function nodeToWu(node) {
  return { x: (Number(node?.x) || 0) * NODE_WU, y: (Number(node?.y) || 0) * NODE_WU };
}

/**
 * biomeAtWorld(seed, wx, wy) -> biome string. The `biomeForNode` projection in
 * world units: the ONE biome truth the map paints AND (later) the species/
 * travel-reaction logic reads. A node's wu position maps back through NODE_WU
 * to its exact node biome, so the painted ground AGREES with what the DM
 * narrates on arrival. Pure + deterministic; never serialized or hashed.
 */
export function biomeAtWorld(seed, wx, wy) {
  return biomeForNode(seed, { x: (Number(wx) || 0) / NODE_WU, y: (Number(wy) || 0) / NODE_WU });
}

/**
 * Village place-units → world units, centered on the node (M2 consumers).
 * `placeCenter` is the layout's own midpoint in place units.
 */
export function placeToWu(node, ux, uy, placeCenter = { x: 30.5, y: 30.5 }) {
  const c = nodeToWu(node);
  return {
    x: c.x + (Number(ux) - placeCenter.x) * PLACE_WU,
    y: c.y + (Number(uy) - placeCenter.y) * PLACE_WU
  };
}

/** Bounding box of the world's nodes in wu, with a margin. */
export function worldBounds(nodes, marginWu = 2 * NODE_WU) {
  const list = Array.isArray(nodes) ? nodes.filter(n => n && Number.isFinite(+n.x) && Number.isFinite(+n.y)) : [];
  if (!list.length) return { minX: -marginWu, minY: -marginWu, maxX: marginWu, maxY: marginWu };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of list) {
    const p = nodeToWu(n);
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX: minX - marginWu, minY: minY - marginWu, maxX: maxX + marginWu, maxY: maxY + marginWu };
}

/**
 * placeFrame(place) — the bounding frame of a placeFromWorldNode model in its
 * own place units, plus its midpoint. M2 anchors the midpoint on the node's
 * wu position; M4 will reuse this same frame as the position-unification
 * contract (one frame, one truth — keep this the only extent logic).
 */
export function placeFrame(place) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x, y) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };
  for (const b of (place?.buildings || [])) {
    for (const r of (b?.plan?.rooms || [])) {
      const rw = (r.w ?? (r.r ?? 1) * 2) / 2, rh = (r.h ?? (r.r ?? 1) * 2) / 2;
      grow(b.ox + r.cx - rw, b.oy + r.cy - rh);
      grow(b.ox + r.cx + rw, b.oy + r.cy + rh);
    }
  }
  for (const g of (place?.terrain?.groves || [])) {
    grow(g.cx - g.r, g.cy - g.r); grow(g.cx + g.r, g.cy + g.r);
  }
  for (const p of (place?.terrain?.paths || [])) {
    for (const [x, y] of (p?.pts || [])) grow(x, y);
  }
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 1; maxY = 1; }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

/** Place-units → wu for a model anchored midpoint-on-node. */
export function placeUnitToWu(node, frame, ux, uy) {
  const c = nodeToWu(node);
  return {
    x: c.x + (Number(ux) - frame.cx) * PLACE_WU,
    y: c.y + (Number(uy) - frame.cy) * PLACE_WU
  };
}

/** 0→1 fade as z crosses [a..b] (band transitions, never a pop). */
export function fadeIn(z, a, b) {
  if (z <= a) return 0;
  if (z >= b) return 1;
  return (z - a) / (b - a);
}

/** Discovery tiers: 'known' (discovered), 'rumor' (adjacent to known), 'dark'. */
export function discoveryTiers(map) {
  const known = new Set((Array.isArray(map?.discovered) ? map.discovered : []).map(String));
  const here = String(map?.currentNodeId || '');
  if (here) known.add(here);
  const rumor = new Set();
  for (const e of (Array.isArray(map?.edges) ? map.edges : [])) {
    const a = String(e?.a || ''), b = String(e?.b || '');
    if (known.has(a) && !known.has(b)) rumor.add(b);
    if (known.has(b) && !known.has(a)) rumor.add(a);
  }
  return { known, rumor };
}

// ── WS-1 — interiors + entities (MAP_PATH Phase 1.1, TABLETOP_MAP room-granular) ──
//
// The village embedding above (placeFrame/placeUnitToWu) anchors a settlement's
// BUILDINGS (via a `placeFromWorldNode`-shaped `place.buildings[]`, each carrying
// `{ox, oy, structureKey?}` in place-units — see public/map/placeFromNode.js). This
// section adds the missing rung: fitting a building's REAL interior — the engine's
// own room graph (`engine/structures/floorPlan.js`, the layout movement actually
// uses) — inside that building's footprint, and resolving any entity (player/NPC)
// to one `{wx, wy}` address whether it's outdoors (village walk-position) or indoors
// (room-granular — no 5-ft squares yet; that arrives with the TAC contract per the
// 2026-07-04 decision, docs/POSITION_AS_CANON.md). Pure + seeded: floorPlan() is a
// deterministic function of the structure's topology; nothing here writes engine
// state or is ever hashed.

/**
 * buildingAnchorInPlace(place, structureKey) -> {ox, oy} | null
 * Finds the building entry (place-units) for a real engine structure inside a
 * `placeFromWorldNode(world, nodeId)`-shaped place. `place` may be null (a lone
 * structure with no settlement layout) — callers degrade to `{ox:0, oy:0}` (the
 * building anchors at the village frame's own midpoint, i.e. the node center).
 */
export function buildingAnchorInPlace(place, structureKey) {
  const key = String(structureKey || '');
  if (!key) return null;
  const buildings = Array.isArray(place?.buildings) ? place.buildings : [];
  const b = buildings.find(x => String(x?.structureKey || '') === key);
  if (!b) return null;
  return { ox: Number(b.ox) || 0, oy: Number(b.oy) || 0 };
}

/**
 * interiorRoomToPlaceUnit(anchor, plan, roomId) -> {ux, uy} | null
 * A room's position in the VILLAGE's place-unit space: the floorPlan's own
 * footprint is recentered on its own midpoint (so the building's world rect is
 * centered at `anchor`, matching the `ox + (r.cx - frame.cx)` convention
 * `placeFrame`/`placeUnitToWu` already use for catalog-plan buildings), then
 * offset by the building's anchor. `plan` is a `floorPlan(structure)` result;
 * `anchor` is a `buildingAnchorInPlace` result (or `{ox:0,oy:0}` for the no-place
 * fallback). Returns null if the room isn't in the plan.
 */
export function interiorRoomToPlaceUnit(anchor, plan, roomId) {
  const a = anchor && typeof anchor === 'object' ? anchor : { ox: 0, oy: 0 };
  const rooms = Array.isArray(plan?.rooms) ? plan.rooms : [];
  const room = rooms.find(r => String(r?.id || '') === String(roomId || ''));
  if (!room) return null;
  const fw = Number(plan?.footprint?.w) || 1, fh = Number(plan?.footprint?.h) || 1;
  return {
    ux: (Number(a.ox) || 0) + (Number(room.cx) || 0) - fw / 2,
    uy: (Number(a.oy) || 0) + (Number(room.cy) || 0) - fh / 2
  };
}

/**
 * interiorRoomToWu(node, frame, anchor, plan, roomId) -> {wx, wy} | null
 * The full room -> world-unit projection: village place-unit (above) pushed
 * through `placeUnitToWu`. `frame` is the village's `placeFrame(place)` result
 * (or a degenerate `{cx:0, cy:0}` frame when there's no settlement layout, so the
 * building anchors directly at the node center).
 */
export function interiorRoomToWu(node, frame, anchor, plan, roomId) {
  const u = interiorRoomToPlaceUnit(anchor, plan, roomId);
  if (!u) return null;
  const f = frame && typeof frame === 'object' ? frame : { cx: 0, cy: 0 };
  const p = placeUnitToWu(node, f, u.ux, u.uy);
  return { wx: p.x, wy: p.y };
}

/**
 * structureWorldRect(node, frame, anchor, plan) -> {minX, minY, maxX, maxY}
 * The building's world-unit AABB (footprint centered at its anchor) — every room
 * this plan resolves via interiorRoomToWu MUST land inside this rect by
 * construction (U400's "interiors land INSIDE their building" proof).
 */
export function structureWorldRect(node, frame, anchor, plan) {
  const a = anchor && typeof anchor === 'object' ? anchor : { ox: 0, oy: 0 };
  const f = frame && typeof frame === 'object' ? frame : { cx: 0, cy: 0 };
  const fw = Number(plan?.footprint?.w) || 1, fh = Number(plan?.footprint?.h) || 1;
  const c = placeUnitToWu(node, f, Number(a.ox) || 0, Number(a.oy) || 0);
  const halfW = (fw / 2) * PLACE_WU, halfH = (fh / 2) * PLACE_WU;
  return { minX: c.x - halfW, minY: c.y - halfH, maxX: c.x + halfW, maxY: c.y + halfH };
}

/**
 * resolveEntityWu(ctx, loc) -> {wx, wy} | null
 * ONE address for any entity (player, NPC, monster, object), read-only over
 * engine-owned position fields. `ctx = { node, place, frame, plan }` carries the
 * node the entity is AT (`node`, the raw engine node record), its village
 * embedding (`place`/`frame` — either may be null for a non-settlement node,
 * degrading to node-center anchoring), and — for an indoor `loc` — the building's
 * `floorPlan(structure)` result (`plan`; resolveEntityWuFromWorld derives this for
 * you). `loc` is the entity's resolved location:
 *   outdoors: { nodeId, ux, uy }                      (village walk-position units)
 *   indoors:  { nodeId, structureKey, roomId }         (room-granular; no ux/uy)
 * Accepts either `structureKey` (world.scene.interior's field name) or
 * `structureId` (party[0].position.interior's field name) — same value, two
 * historical spellings (see docs/ONE_MAP.md M4b). Returns null if the node is
 * unknown or (indoors) the structure/room can't be resolved — never throws.
 */
export function resolveEntityWu(ctx, loc) {
  const node = ctx?.node;
  if (!node || !Number.isFinite(+node.x) || !Number.isFinite(+node.y)) return null;
  const structureKey = String(loc?.structureKey || loc?.structureId || '');
  if (structureKey) {
    const anchor = buildingAnchorInPlace(ctx?.place || null, structureKey) || { ox: 0, oy: 0 };
    const plan = ctx?.plan || null; // caller supplies floorPlan(structure) — see resolveEntityWuFromWorld
    if (!plan) return null;
    return interiorRoomToWu(node, ctx?.frame || null, anchor, plan, loc?.roomId);
  }
  if (Number.isFinite(+loc?.ux) && Number.isFinite(+loc?.uy) && ctx?.frame) {
    const p = placeUnitToWu(node, ctx.frame, +loc.ux, +loc.uy);
    return { wx: p.x, wy: p.y };
  }
  // No walk-position and no interior — the entity is present at the node but its
  // exact spot within it is unknown (e.g. a far node); anchor at the node center.
  const c = nodeToWu(node);
  return { wx: c.x, wy: c.y };
}

/**
 * resolveEntityWuFromWorld(world, place, frame, loc) -> {wx, wy} | null
 * Convenience wrapper for the common case: reads `world.structures.byId` to get
 * the real `floorPlan(structure)` for an indoor `loc`, then calls
 * resolveEntityWu. `place`/`frame` are the caller's already-computed village
 * embedding for `loc.nodeId` (e.g. oneMap.js's `layoutFor()` cache) — pass null
 * for a non-settlement node. Pure + read-only: `world.structures` is read, never
 * written.
 */
export function resolveEntityWuFromWorld(world, place, frame, loc) {
  const nodeId = String(loc?.nodeId || '');
  const node = (world?.map?.nodes || []).find(n => String(n?.id || '') === nodeId) || null;
  if (!node) return null;
  const structureKey = String(loc?.structureKey || loc?.structureId || '');
  let plan = null;
  if (structureKey) {
    const st = world?.structures?.byId?.[structureKey] || null;
    if (!st) return null;
    plan = floorPlan(st);
  }
  return resolveEntityWu({ node, place, frame, plan }, loc);
}
