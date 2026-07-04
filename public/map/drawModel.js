/**
 * drawModel — TT-DRAW (docs/TABLETOP_MAP.md, docs/briefs/TT-DRAW-tabletop-look.md).
 *
 * The one rule: structure is DRAWN, entities are PLACED. This module derives the
 * pure MODELS both layers need at the local (settlement/street) band — no canvas,
 * no DOM, no engine writes. Renderer code (oneMap.js / a lab page) turns these
 * models into ink; this file only computes WHERE the ink goes.
 *
 * Resolves the fork WS-1 flagged (PACKETS §TABLETOP S2): the outdoor map has been
 * drawing catalog-plan room shapes (placeFromNode.js / plans/index.js ALL_PLANS)
 * while movement/interiors read the REAL engine room graph
 * (engine/structures/floorPlan.js). drawnStructureModel() below fits the REAL
 * floorPlan(structure) into the building's world rect (worldSpace.js's
 * structureWorldRect/interiorRoomToWu, WS-1) — so a doorway drawn on the map is
 * the doorway "go through the door" actually opens.
 *
 * Every export here is a pure function of (world, nodeId): same input, same
 * output, forever. Nothing here is Math.random (jit reuses the same FNV-hash
 * technique handDrawnPlace.js/handDrawnInterior.js already use for wobble), and
 * nothing here is ever serialized or hashed — client-side view only, same
 * discipline as worldSpace.js.
 */

import { floorPlan } from '../../engine/structures/floorPlan.js';
import { outdoorOccupants } from '../../engine/structures/roomOccupancy.js';
import { placeFromWorldNode } from './placeFromNode.js';
import {
  PLACE_WU,
  nodeToWu, placeFrame, placeUnitToWu, buildingAnchorInPlace, structureWorldRect
} from './worldSpace.js';

// ── ink parameters — ONE place to tune the local-band look (line weights, haze
// density, token sizing). Renderers (oneMap.js, a lab page) read these constants
// rather than hard-coding their own so a single taste pass touches one spot. ──
export const INK_PARAMS = Object.freeze({
  wallWeight: { stone: 3.0, fortified: 3.4, timber: 2.6, cave: 2.4, chitin: 2.4 },
  doorGapWu: 1.1,          // width of the wall gap a doorway carves, in world units
  roadBandWu: 1.4,         // ruled-road ink width, in world units (unscaled by z)
  waterBandWu: 1.6,
  treeRadiusWu: 0.7 * PLACE_WU, // a token's footprint radius, matching the old ground-ink tree size
  tokenBaseRadiusWu: 0.34 * PLACE_WU, // standing-token base ring radius
  hazeAlpha: 0.46          // unexplored-cell overlay opacity (matches handDrawnPlace.js's fog wash)
});

function isFiniteNum(n) { return typeof n === 'number' && Number.isFinite(n); }

function nodesOf(world) {
  return Array.isArray(world?.map?.nodes) ? world.map.nodes : [];
}

function findNode(world, nodeId) {
  const id = String(nodeId ?? world?.map?.currentNodeId ?? '');
  return nodesOf(world).find(n => n && String(n.id) === id) || null;
}

/** Every real engine structure standing at this node (world.structures.byId, nodeId-filtered). */
function structuresAtNode(world, nodeId) {
  const byId = (world && world.structures && world.structures.byId) || {};
  return Object.values(byId)
    .filter(s => s && String(s.nodeId || '') === String(nodeId))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

/**
 * A plan-local point (x,y in floorPlan layout units, footprint-centered) pushed
 * through the SAME anchor/frame/node chain worldSpace.interiorRoomToPlaceUnit
 * uses for room centers — reused here for wall corners and door centers so
 * every ink coordinate on a building shares one projection. Mirrors
 * interiorRoomToPlaceUnit's formula exactly (footprint recentred on its own
 * midpoint, then offset by the building's anchor).
 */
function planPointToWu(node, frame, anchor, plan, x, y) {
  const a = anchor && typeof anchor === 'object' ? anchor : { ox: 0, oy: 0 };
  const fw = Number(plan?.footprint?.w) || 1, fh = Number(plan?.footprint?.h) || 1;
  const ux = (Number(a.ox) || 0) + (Number(x) || 0) - fw / 2;
  const uy = (Number(a.oy) || 0) + (Number(y) || 0) - fh / 2;
  const f = frame && typeof frame === 'object' ? frame : { cx: 0, cy: 0 };
  const p = placeUnitToWu(node, f, ux, uy);
  return { wx: p.x, wy: p.y };
}

/** Rectangle corners for a rect room (or a bounding square for a round room), in plan-local units. */
function roomLocalCorners(room) {
  const isRound = room?.shape === 'round';
  const w = isRound ? (Number(room.r) || 0.5) * 2 : (Number(room.w) || 1);
  const h = isRound ? (Number(room.r) || 0.5) * 2 : (Number(room.h) || 1);
  const cx = Number(room?.cx) || 0, cy = Number(room?.cy) || 0;
  return { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2, cx, cy, w, h, round: isRound };
}

/**
 * wallsForRoom(node, frame, anchor, plan, room, doorsOnRoom) -> [{a:{wx,wy}, b:{wx,wy}}]
 * The four (or, for a round room, one circular) wall segments of a room, each
 * projected to world units — WITH a gap left open wherever a door/mouth sits on
 * that edge (a doorway is drawn as a GAP in the wall, per the tabletop spec, not
 * an ink line straight through it).
 */
function wallSegmentsForRoom(node, frame, anchor, plan, room, doorsOnRoom) {
  const segs = [];
  if (room.round) {
    // Round rooms: draw as a ring of short chord segments so a door gap can still
    // carve a bite out of the circle without special-casing the renderer.
    const N = 24;
    const cx = room.cx, cy = room.cy, r = (room.x1 - room.x0) / 2;
    const doorAngles = doorsOnRoom.map(d => Math.atan2(d.y - cy, d.x - cx));
    const gapHalf = (0.5 / Math.max(r, 0.1)); // radians subtended by ~half the door gap width
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
      const mid = (a0 + a1) / 2;
      const gapped = doorAngles.some(da => Math.abs(angleDelta(mid, da)) < gapHalf);
      if (gapped) continue;
      const p0 = planPointToWu(node, frame, anchor, plan, cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
      const p1 = planPointToWu(node, frame, anchor, plan, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
      segs.push({ a: p0, b: p1 });
    }
    return segs;
  }
  const corners = [[room.x0, room.y0], [room.x1, room.y0], [room.x1, room.y1], [room.x0, room.y1]];
  for (let e = 0; e < 4; e++) {
    const [ax, ay] = corners[e], [bx, by] = corners[(e + 1) % 4];
    const horiz = ay === by;
    // Split the edge at any door that sits on it, leaving a INK_PARAMS.doorGapWu-wide
    // gap in PLAN-LOCAL units centered on the door.
    const onEdge = doorsOnRoom.filter(d => horiz ? (Math.abs(d.y - ay) < 1e-6 && d.x >= Math.min(ax, bx) - 1e-6 && d.x <= Math.max(ax, bx) + 1e-6)
      : (Math.abs(d.x - ax) < 1e-6 && d.y >= Math.min(ay, by) - 1e-6 && d.y <= Math.max(ay, by) + 1e-6));
    if (!onEdge.length) {
      segs.push({ a: planPointToWu(node, frame, anchor, plan, ax, ay), b: planPointToWu(node, frame, anchor, plan, bx, by) });
      continue;
    }
    const gapLocal = 0.55; // half-gap, in plan-local (footprint) units — matches floorPlan's PAD scale
    const cuts = onEdge.map(d => horiz ? d.x : d.y).sort((x, y) => x - y);
    let cur = horiz ? Math.min(ax, bx) : Math.min(ay, by);
    const end = horiz ? Math.max(ax, bx) : Math.max(ay, by);
    for (const c of cuts) {
      const gapStart = c - gapLocal, gapEnd = c + gapLocal;
      if (gapStart > cur) {
        segs.push(horiz
          ? { a: planPointToWu(node, frame, anchor, plan, cur, ay), b: planPointToWu(node, frame, anchor, plan, gapStart, ay) }
          : { a: planPointToWu(node, frame, anchor, plan, ax, cur), b: planPointToWu(node, frame, anchor, plan, ax, gapStart) });
      }
      cur = Math.max(cur, gapEnd);
    }
    if (cur < end) {
      segs.push(horiz
        ? { a: planPointToWu(node, frame, anchor, plan, cur, ay), b: planPointToWu(node, frame, anchor, plan, end, ay) }
        : { a: planPointToWu(node, frame, anchor, plan, ax, cur), b: planPointToWu(node, frame, anchor, plan, ax, end) });
    }
  }
  return segs;
}

function angleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * drawnStructureModel(world, nodeId) -> {
 *   nodeId, structures: [{
 *     structureKey, name, shell, dark,
 *     rect: {minX,minY,maxX,maxY},                 // structureWorldRect — LOD/culling box
 *     rooms: [{ id, name, isEntry, wx, wy, walls:[{a,b}] }],
 *     doors: [{ wx, wy, a, b }]
 *   }]
 * }
 *
 * U409's contract: every settlement structure at this node yields a plan-model
 * derived from the REAL floorPlan(structure), fitted inside its
 * structureWorldRect. Pure, deterministic, read-only (structures/floorPlan are
 * both read-only inputs — nothing here writes world state or touches worldHash).
 */
export function drawnStructureModel(world, nodeId) {
  const node = findNode(world, nodeId);
  if (!node) return { nodeId: String(nodeId || ''), structures: [] };
  const id = String(node.id);
  const structs = structuresAtNode(world, id);
  const place = node.settlement ? placeFromWorldNode(world, id) : null;
  const frame = place ? placeFrame(place) : null;

  const structures = [];
  for (const st of structs) {
    const structureKey = String(st.id);
    const plan = floorPlan(st);
    if (!plan.rooms.length) continue; // no topology — nothing to draw (never fabricate a room)
    const anchor = buildingAnchorInPlace(place, structureKey) || { ox: 0, oy: 0 };
    const rect = structureWorldRect(node, frame, anchor, plan);

    const doorsByRoom = new Map();
    for (const d of (plan.doors || [])) {
      if (!doorsByRoom.has(d.a)) doorsByRoom.set(d.a, []);
      if (!doorsByRoom.has(d.b)) doorsByRoom.set(d.b, []);
      doorsByRoom.get(d.a).push({ x: d.x, y: d.y });
      doorsByRoom.get(d.b).push({ x: d.x, y: d.y });
    }

    const rooms = plan.rooms.map(r => {
      const corners = roomLocalCorners(r);
      const doorsOnRoom = doorsByRoom.get(r.id) || [];
      const walls = wallSegmentsForRoom(node, frame, anchor, plan, corners, doorsOnRoom);
      const center = planPointToWu(node, frame, anchor, plan, r.cx, r.cy);
      return { id: r.id, name: r.name || r.role || r.id, shape: r.shape === 'round' ? 'round' : 'rect', isEntry: !!r.isEntry, wx: center.wx, wy: center.wy, walls };
    });

    const doors = (plan.doors || []).map(d => {
      const p = planPointToWu(node, frame, anchor, plan, d.x, d.y);
      return { wx: p.wx, wy: p.wy, dir: d.dir, a: d.a, b: d.b };
    });

    structures.push({
      structureKey, name: plan.name, shell: plan.shell, dark: !!plan.dark,
      rect, rooms, doors
    });
  }

  return { nodeId: id, structures };
}

/**
 * placedTokenModel(world, nodeId) -> {
 *   nodeId,
 *   people: [{ id, name, role, wx, wy, hostile }],   // outdoorOccupants truth, at THIS node only
 *   trees:  [{ wx, wy, r }],                          // terrain groves/tree props, as PLACED tokens
 *   livestock: [{ wx, wy, kind }]                     // only ever populated from real data — none
 *                                                      // exists at the settlement-node level today,
 *                                                      // so this is always [] (never fabricate).
 * }
 *
 * U410's contract: the token set is the occupancy TRUTH (MAP-OCC-1's rule — only
 * the current node ever gets a people token set; see placeFromNode.js), and trees
 * move from ground-ink (the old grove ellipse) to placed tokens, one per actual
 * grove tree. Determinism: identical (seed, occupancy, terrain) yields identical
 * tokens — same guarantee U398/U399 already prove for placeFromWorldNode.
 */
export function placedTokenModel(world, nodeId) {
  const node = findNode(world, nodeId);
  if (!node) return { nodeId: String(nodeId || ''), people: [], trees: [], livestock: [] };
  const id = String(node.id);
  const isCurrentNode = id === String(world?.map?.currentNodeId || '');
  const place = node.settlement ? placeFromWorldNode(world, id) : null;
  const frame = place ? placeFrame(place) : null;

  const people = [];
  if (isCurrentNode && place) {
    // Re-derive world addresses from the SAME outdoorOccupants() truth
    // placeFromWorldNode already tokenized (MAP-OCC-1) — reuse ITS token
    // placement (ux,uy) rather than re-running the seeded scatter a second time,
    // so this can never drift from what placeFromWorldNode already drew.
    const trueOutdoor = new Map(outdoorOccupants(world).map(n => [String(n?.name || ''), n]));
    for (const t of (place.tokens || [])) {
      if (t?.type !== 'npc') continue;
      const p = placeUnitToWu(node, frame, t.ux, t.uy);
      const npc = t.npc || {};
      const known = trueOutdoor.get(String(npc.name || ''));
      people.push({
        id: String(npc.id || ''), name: String(npc.name || t.label || '?'),
        role: (known && known.role) || npc.role || '', wx: p.x, wy: p.y,
        hostile: npc.name === '?' // MAP-OCC-1 masks hostiles' identity but keeps them placed
      });
    }
  }

  const trees = [];
  if (place) {
    for (const g of (place.terrain?.groves || [])) {
      // Deterministic per-tree scatter WITHIN the grove — same FNV-hash technique
      // handDrawnPlace.js already uses (no Math.random), so re-deriving here
      // yields the IDENTICAL tree set the old ground-ink grove drew, now as
      // individually placed tokens instead of one ellipse of paint.
      const n = Number(g.n) || 0;
      for (let k = 0; k < n; k++) {
        const a = (h32(`grv${g.cx}_${g.cy}_${k}`) % 1000 / 1000) * Math.PI * 2;
        const rad = (h32(`grr${g.cx}_${g.cy}_${k}`) % 1000 / 1000) * (Number(g.r) || 1);
        const ux = g.cx + Math.cos(a) * rad, uy = g.cy + Math.sin(a) * rad;
        const p = placeUnitToWu(node, frame, ux, uy);
        trees.push({ wx: p.x, wy: p.y, r: INK_PARAMS.treeRadiusWu });
      }
    }
    for (const prop of (place.terrain?.props || [])) {
      if (prop?.type !== 'tree') continue;
      const p = placeUnitToWu(node, frame, prop.ux, prop.uy);
      trees.push({ wx: p.x, wy: p.y, r: (Number(prop.r) || 0.7) * PLACE_WU });
    }
  }

  return { nodeId: id, people, trees, livestock: [] };
}

// Same FNV-1a hash handDrawnPlace.js's grove scatter uses (h32), reimplemented
// here so this module has no DOM/canvas dependency — pure, no Math.random.
function h32(s) {
  let h = 2166136261;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * fogMask(world, nodeId?) -> {
 *   currentNodeId, explored: string[], unexplored: string[],   // node ids
 *   isExplored(id) -> boolean
 * }
 *
 * U411's contract: a fresh boot marks only the starting area explored (the
 * current node plus whatever discoverNode/seeNode already added to
 * world.map.discovered); a world with extra visit stamps
 * (world.map.memory.visitedTurnByNodeId) reveals exactly those extra nodes.
 * Pure function of world — no engine writes. Reads engine/structures/
 * discoveryState.js's shape (world.structures.discovery) READ-ONLY where a
 * caller has populated it (it exists today as unwired, pure helper functions —
 * see docs/briefs/TT-DRAW-tabletop-look.md; this fog mask never requires it and
 * degrades to the live map.discovered/visitedTurnByNodeId truth when absent).
 */
export function fogMask(world) {
  const m = world?.map || {};
  const discovered = new Set((Array.isArray(m.discovered) ? m.discovered : []).map(String));
  const visited = (m.memory && typeof m.memory === 'object' && m.memory.visitedTurnByNodeId && typeof m.memory.visitedTurnByNodeId === 'object')
    ? m.memory.visitedTurnByNodeId : {};
  for (const nid of Object.keys(visited)) discovered.add(String(nid));

  // Read-only structure-discovery pass-through: if a caller has ever populated
  // world.structures.discovery (engine/structures/discoveryState.js's shape),
  // any node it names is folded in too — but this module never writes it.
  const structDiscovery = world?.structures?.discovery;
  if (structDiscovery && typeof structDiscovery === 'object' && structDiscovery.byNodeId && typeof structDiscovery.byNodeId === 'object') {
    for (const nid of Object.keys(structDiscovery.byNodeId)) discovered.add(String(nid));
  }

  const allNodeIds = nodesOf(world).map(n => String(n.id));
  const unexplored = allNodeIds.filter(id => !discovered.has(id));
  const explored = allNodeIds.filter(id => discovered.has(id));

  return {
    currentNodeId: String(m.currentNodeId || ''),
    explored,
    unexplored,
    isExplored(nodeId) { return discovered.has(String(nodeId)); }
  };
}
