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
// Windows are CANON, not decoration (FP-2 #3): roomWindows.js is the pure per-room
// derivation the FICTION already uses (climb out, night locks, shutter toggles are
// timeline canon). Read-only engine import — this module never writes engine state.
import { roomWindows, roomWindowFacings } from '../../engine/structures/roomWindows.js';
import { outdoorOccupants } from '../../engine/structures/roomOccupancy.js';
import { placeFromWorldNode } from './placeFromNode.js';
import { floorPlanToPlanModel } from './planModel.js';
import { CELL_FT } from '../../engine/map/spatial/tacticalPos.js';
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
  hazeAlpha: 0.46,         // unexplored-cell overlay opacity (matches handDrawnPlace.js's fog wash)
  // TT-DRAW-2 — one sizing truth: an unentered (roofed) building draws its roof
  // fill sized to its TRUE structureWorldRect (no art may exceed the rect). A
  // subtle roof-line stays visible so a roofed building still reads as a roof,
  // not a bare block — but the line sits INSET from the rect edge, never on or
  // outside it (default keep, per the brief; Tim answers on roof STYLE later).
  roofLineInsetWu: 0.35,   // inset of the roof ridge-line from the true rect edge, in world units
  roofLineWeight: 1.1,     // ridge-line stroke weight (unscaled by z, kept subtle at any zoom)
  // TT-DRAW-3 — the graph paper at closest view: a 5-ft quadrille fades in over
  // this z band (same fadeIn(z,a,b) idiom worldSpace.js already uses for every
  // other band crossing — never a pop). Named tunables so a taste pass touches
  // one spot; the grid PITCH itself is never tunable here — it is CELL_FT (see
  // wuToFt below), pinned by TAC-1 and asserted exact by U419.
  gridFadeZStart: 8,       // z at which the quadrille begins to appear (BAND.street=4 already shows tokens/interiors; the grid resolves a beat deeper, once individual 5-ft squares would be legible rather than a moiré)
  gridFadeZEnd: 16,        // z at which the quadrille is fully opaque
  gridMinorAlpha: 0.20,    // teal grid-rule alpha at full fade-in (matches handDrawnInterior.js's GMIN/GMAJ idiom)
  gridMajorAlpha: 0.40,    // every 5th line (a 25-ft "major" rule), matching the interior map's minor/major convention
  gridRGB: '92,134,120',   // the teal quadrille rule's RGB triplet (GRAPH_PAPER_UI.md's --grid-minor/--grid-major hue, handDrawnInterior.js's GMIN/GMAJ) — final alpha composed by quadrilleStroke(), never string-hacked
  // WS-3 (docs/briefs/WS-3-one-surface.md #4) — the niceties the retired
  // isInterior branch (LocalMap.js's highlighter wash + "You are here" dot)
  // drew per-room, ported here so the ONE sheet's plan band carries the same
  // signal: a highlighter-yellow wash on the room you're CURRENTLY standing in
  // (matches LocalMap.js's PAPER.highlight hue/feel), and a dimming wash over
  // any room in the SAME open building you have not yet visited (interior.visited)
  // — mirrors the old renderer's `drooms` filter (undiscovered rooms drew nothing
  // at all; here they still show as walls/shape — this is presentation-only, not
  // a spoiler-grade withhold — just dimmed, never fully hidden, since the true
  // floor plan is already visible once the roof is lifted).
  currentRoomWash: 'rgba(248,226,120,0.34)',
  unvisitedRoomDim: 0.4,
  // FP-2 (docs/briefs/FP-2-walls-with-mass.md) — the plan band draws walls as MASS
  // (poché), not thin outlines: the wall band (building shell minus the room floor
  // polys) fills in the material's ink with a hatch, doorways pierce it and swing,
  // and windows the engine already treats as canon (roomWindows.js) draw on the
  // rooms' EXTERIOR walls. These are the tunables that language needs — one place,
  // so a taste pass touches one spot (Tim tunes by eye later). Ported from the
  // retired handDrawnInterior.js MATERIALS/window/furniture vocabulary onto FP-1's
  // honest tiled geometry (floorPlan.js WALL=0.12 shared-wall band, locked by U429).
  //
  // Poché wall-mass ink + hatch character, keyed by shell material (mirrors
  // handDrawnInterior.js's MATERIALS: stone crisp diag, fortified cross-hatch,
  // timber warm-brown diag, cave stipple). `fill` is the solid wall body; `ink`
  // is the bold outline stroke on the wall/floor boundary; `hatch` selects the
  // character; `hatchAlpha` scales the hatch overlay so it reads as texture, not noise.
  // Keyed by the RAW floorPlan shell (structureMaterial.js emits stone/timber/open/
  // fortified/cave/round/chitin). `open`/`round` alias to stone and `chitin` to the
  // cave look — the SAME collapse planModel.js's SHELL_TO_MATERIAL uses for the
  // interior view, so a building's map poché matches the material it draws inside.
  pocheByShell: {
    stone:     { fill: 'rgba(70,78,98,0.30)',  ink: 'rgba(18,26,48,0.96)', hatch: 'diag',    hatchAlpha: 0.32 },
    fortified: { fill: 'rgba(54,58,70,0.40)',  ink: 'rgba(14,20,40,0.98)', hatch: 'cross',   hatchAlpha: 0.34 },
    timber:    { fill: 'rgba(120,86,52,0.30)', ink: 'rgba(74,52,30,0.95)', hatch: 'diag',    hatchAlpha: 0.24 },
    cave:      { fill: 'rgba(50,54,64,0.34)',  ink: 'rgba(30,34,44,0.95)', hatch: 'stipple', hatchAlpha: 0.30 },
    chitin:    { fill: 'rgba(50,54,64,0.34)',  ink: 'rgba(30,34,44,0.95)', hatch: 'stipple', hatchAlpha: 0.30 },
    open:      { fill: 'rgba(70,78,98,0.30)',  ink: 'rgba(18,26,48,0.96)', hatch: 'diag',    hatchAlpha: 0.32 }, // market hall — stone shell
    round:     { fill: 'rgba(70,78,98,0.30)',  ink: 'rgba(18,26,48,0.96)', hatch: 'diag',    hatchAlpha: 0.32 }  // round tower — stone shell
  },
  wallInkWeight: { stone: 2.4, fortified: 2.8, timber: 2.2, cave: 2.0, chitin: 2.0, open: 2.4, round: 2.4 }, // bold wall/floor boundary stroke (px, scaled by z)
  doorGapLu: 0.34,          // width of the doorway gap carved through the wall band, in LAYOUT units (≈0.3 lu, tuned by eye)
  doorSwingMul: 1.0,        // door-leaf length / swing radius as a multiple of the gap width (a door swings its own width — arc stays inside a room)
  windowLenLu: 0.34,        // drawn length of a casement window along its wall, in layout units
  windowInsetLu: 0.09,      // how far the window sits proud of / centered in the exterior wall, in layout units (≈ WALL/2 + a touch)
  labelPlanBandZ: 6         // room-name labels draw only at/above this z (the plan band, roof lifted); never at street/settlement zoom where they collide (LOD nit, FP-2 #6)
});

/**
 * quadrilleStroke(major, fadeAlpha) -> 'rgba(92,134,120,X)'
 * The final stroke color for one grid line: the pinned teal RGB triplet
 * (INK_PARAMS.gridRGB) at either the minor or major per-line alpha, scaled by
 * the current fade-in progress (quadrilleAlpha(z)). Kept as one small pure
 * function (not a string-replace on a baked rgba literal) so the composition
 * is explicit and testable.
 */
export function quadrilleStroke(major, fadeAlpha) {
  const perLine = major ? INK_PARAMS.gridMajorAlpha : INK_PARAMS.gridMinorAlpha;
  return `rgba(${INK_PARAMS.gridRGB},${perLine * fadeAlpha})`;
}

// ── the ONE wu↔ft mapping (TT-DRAW-3) ───────────────────────────────────────
// worldSpace.js's PLACE_WU (wu per floorPlan layout unit — the SAME constant
// interiorRoomToWu/structureWorldRect already use to place a building's rooms
// in world units, no separate scale) composed with TAC-1's pinned CELL_FT
// (feet per tactical cell, engine/map/spatial/tacticalPos.js) yields an EXACT
// identity: one floorPlan layout unit is tacticalPos.PLACE_WU (4) cells ×
// CELL_FT (5) = 20 ft, and that SAME layout unit is worldSpace.PLACE_WU (4) wu
// — so 1 wu = (20 ft / 4) = CELL_FT ft, exactly. This is not a new conversion;
// it is the two ALREADY-PINNED constants (tacticalPos.js's CELL_FT, this
// module's own PLACE_WU) composed, asserted exact + round-trip by U419.
export function wuToFt(wu) { return Number(wu) * CELL_FT; }
export function ftToWu(ft) { return Number(ft) / CELL_FT; }

/**
 * quadrilleAlpha(z) -> 0..1
 * Pure function of zoom: the graph-paper grid is invisible until the deep
 * zoom band, then fades in (never pops) to fully opaque by INK_PARAMS.gridFadeZEnd.
 * Same fadeIn(a,b) shape worldSpace.js uses for every other band crossing.
 */
export function quadrilleAlpha(z) {
  const a = INK_PARAMS.gridFadeZStart, b = INK_PARAMS.gridFadeZEnd;
  const zz = Number(z) || 0;
  if (zz <= a) return 0;
  if (zz >= b) return 1;
  return (zz - a) / (b - a);
}

function isFiniteNum(n) { return typeof n === 'number' && Number.isFinite(n); }

// ── FP-2 poché geometry (pure) ───────────────────────────────────────────────
// The wall band a building draws as solid MASS = its shell rect MINUS the room
// floor polygons (the space BETWEEN rooms is wall, no longer dead paper). These
// pure helpers let the renderer fill the band (even-odd) and let U436 assert the
// band exists and a doorway pierces it — all without a canvas.

/** Signed-area magnitude of a closed polygon of [x,y] points (world units). */
function polygonArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
}

/** A room's drawn box as a closed [x,y] world-unit polygon, from its wall segments. */
function roomPolyFromWalls(room) {
  const segs = room && Array.isArray(room.walls) ? room.walls : [];
  if (!segs.length) return [];
  const pts = [[segs[0].a.wx, segs[0].a.wy]];
  for (const s of segs) pts.push([s.b.wx, s.b.wy]);
  return pts;
}

/** Is world point (x,y) inside the given closed polygon? (ray-cast; world units). */
function pointInPoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi)) inside = !inside;
  }
  return inside;
}

/**
 * pocheBand(structure) -> { shellArea, roomsArea, wallArea, shell:{minX,minY,maxX,maxY}, rooms:[[[x,y]...]] }
 * The poché wall band of one drawnStructureModel structure, in WORLD units: the
 * shell rect, each room's drawn-box polygon, and the wall-band area (shell minus
 * rooms). `wallArea > 0` is the FP-2 proof that the space between rooms is WALL,
 * not void. Pure — geometry only, no canvas/DOM.
 */
export function pocheBand(structure) {
  const rect = structure && structure.rect ? structure.rect : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const shellArea = Math.max(0, (rect.maxX - rect.minX)) * Math.max(0, (rect.maxY - rect.minY));
  const rooms = (Array.isArray(structure?.rooms) ? structure.rooms : []).map(roomPolyFromWalls).filter(p => p.length >= 3);
  const roomsArea = rooms.reduce((sum, p) => sum + polygonArea(p), 0);
  return { shellArea, roomsArea, wallArea: Math.max(0, shellArea - roomsArea), shell: rect, rooms };
}

/** True if a world point lies in the wall band (inside the shell rect, outside every room). */
export function pointInWallBand(structure, x, y) {
  const rect = structure && structure.rect;
  if (!rect) return false;
  if (x < rect.minX || x > rect.maxX || y < rect.minY || y > rect.maxY) return false;
  for (const room of (Array.isArray(structure?.rooms) ? structure.rooms : [])) {
    const poly = roomPolyFromWalls(room);
    if (poly.length >= 3 && pointInPoly(poly, x, y)) return false; // in a room floor, not wall
  }
  return true;
}

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

/**
 * roomWallSegments(node, frame, anchor, plan, room) -> [{a:{wx,wy}, b:{wx,wy}}]
 * The four (or, for a round room, one circular) wall segments of a room's OWN
 * drawn box, projected to world units. FP-1 (U429) tiled the rooms: a room's box
 * is its grid cell inset by half the shared-wall band (floorPlan.js WALL=0.12), so
 * two connected rooms' boxes ABUT — the band BETWEEN two abutting boxes IS the
 * shared wall, and a doorway is a gap ON it (floorPlan().doors sit on that shared
 * centerline). FP-2 draws that band as solid wall MASS (poché): the renderer fills
 * the structure shell (rect) minus the room floor polys these segments outline, so
 * the space between rooms reads as wall, and each door gap pierces it with a swing.
 * This is the shared plan-model's room SHAPE (floorPlanToPlanModel, planModel.js)
 * projected to world units — no independent per-room wall derivation, no invented
 * gap logic. Corridors are ABOLISHED (FP-1); corridorSegmentsInWu below maps over
 * the always-empty corridor list and is a no-op kept only for shape stability.
 */
function roomWallSegments(node, frame, anchor, plan, room) {
  if (room.shape === 'round') {
    const N = 24;
    const cx = room.cx, cy = room.cy, r = room.r;
    const segs = [];
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
      const p0 = planPointToWu(node, frame, anchor, plan, cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
      const p1 = planPointToWu(node, frame, anchor, plan, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
      segs.push({ a: p0, b: p1 });
    }
    return segs;
  }
  const x0 = room.cx - room.w / 2, y0 = room.cy - room.h / 2, x1 = room.cx + room.w / 2, y1 = room.cy + room.h / 2;
  const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const segs = [];
  for (let e = 0; e < 4; e++) {
    const [ax, ay] = corners[e], [bx, by] = corners[(e + 1) % 4];
    segs.push({ a: planPointToWu(node, frame, anchor, plan, ax, ay), b: planPointToWu(node, frame, anchor, plan, bx, by) });
  }
  return segs;
}

/**
 * corridorSegmentsInWu(node, frame, anchor, plan, corridor) -> [{a:{wx,wy}, b:{wx,wy}}]
 * A corridor's dog-legged polyline (planModel.js's floorPlanToPlanModel output,
 * plan-local layout units), projected to world units as consecutive wall-style
 * segments — the SAME projection every room-wall segment uses (planPointToWu),
 * so a corridor's ink sits in exactly the frame its two rooms do. This is the
 * connective tissue that bridges floorPlan's own PAD gap between adjacent room
 * boxes ("squares inside of squares" — TT-DRAW-3's root fix): the interior view
 * draws this same polyline as a floor-strip "void" alongside the rooms; the
 * outdoor sheet draws it the same way, so a doorway opens onto a visible
 * passage instead of blank padding between two sealed boxes.
 */
function corridorSegmentsInWu(node, frame, anchor, plan, corridor) {
  const pts = Array.isArray(corridor?.pts) ? corridor.pts : [];
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    segs.push({ a: planPointToWu(node, frame, anchor, plan, ax, ay), b: planPointToWu(node, frame, anchor, plan, bx, by) });
  }
  return segs;
}

/**
 * catalogPlanBoundsInPlaceUnits(b) -> {minX, minY, maxX, maxY}
 * A catalog building entry's (placeFromNode.js's `place.buildings[]` shape —
 * `{ plan, ox, oy, ... }`) own bounding box in VILLAGE place-units, covering
 * both its room shapes AND its furniture (furniture anchors are ABSOLUTE
 * catalog-local coordinates, not room-relative, so a fixture near a plan's
 * edge — e.g. the wattle cottage's bed/shelf — can sit outside the room-only
 * bbox otherwise). `b.ox`/`b.oy` are baked in so this lands in the SAME frame
 * every catalog draw call already uses (`b.ox + r.cx`, `b.ox + f.ux`, …).
 */
export function catalogPlanBoundsInPlaceUnits(b) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const ox = Number(b?.ox) || 0, oy = Number(b?.oy) || 0;
  for (const r of (b?.plan?.rooms || [])) {
    const rw = (r.w ?? (r.r ?? 1) * 2), rh = (r.h ?? (r.r ?? 1) * 2);
    minX = Math.min(minX, ox + r.cx - rw / 2); maxX = Math.max(maxX, ox + r.cx + rw / 2);
    minY = Math.min(minY, oy + r.cy - rh / 2); maxY = Math.max(maxY, oy + r.cy + rh / 2);
  }
  for (const f of (b?.plan?.furniture || [])) {
    minX = Math.min(minX, ox + (Number(f.ux) || 0)); maxX = Math.max(maxX, ox + (Number(f.ux) || 0) + (Number(f.uw) || 0));
    minY = Math.min(minY, oy + (Number(f.uy) || 0)); maxY = Math.max(maxY, oy + (Number(f.uy) || 0) + (Number(f.uh) || 0));
  }
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 1; maxY = 1; }
  return { minX, minY, maxX, maxY };
}

/**
 * fitCatalogPointToRect(catalogBounds, trueRect, px, py) -> {wx, wy}
 * TT-DRAW-2 — the ONE-sizing-truth fit transform: re-maps a point inside a
 * catalog building's own place-unit bounding box (`catalogPlanBoundsInPlaceUnits`)
 * onto the SAME relative position inside the building's TRUE world-unit rect
 * (`structureWorldRect`, via drawnStructureModel's `.rect`). Same relative
 * layout, true absolute scale — so furniture/room-name positions the catalog
 * plan authored stay INSIDE the real floorPlan walls drawnStructureModel already
 * ink at true size, instead of the inflated catalog-art footprint (the root of
 * the roof-overhang class this packet retires). `(px, py)` is in the SAME
 * place-unit frame as `catalogBounds` (i.e. already `b.ox + local` — see
 * catalogPlanBoundsInPlaceUnits). Pure, no canvas/DOM.
 */
export function fitCatalogPointToRect(catalogBounds, trueRect, px, py) {
  const catW = Math.max(1e-6, catalogBounds.maxX - catalogBounds.minX);
  const catH = Math.max(1e-6, catalogBounds.maxY - catalogBounds.minY);
  const trueW = trueRect.maxX - trueRect.minX, trueH = trueRect.maxY - trueRect.minY;
  return {
    wx: trueRect.minX + ((px - catalogBounds.minX) / catW) * trueW,
    wy: trueRect.minY + ((py - catalogBounds.minY) / catH) * trueH
  };
}

// FP-2 — EXTERIOR-WALL derivation (pure geometry). A room's box has four sides; a
// side is EXTERIOR when its outer face lies on the building hull boundary (there is
// no room beyond it). Windows may sit on exterior walls ONLY (never on a shared /
// interior wall — floorPlan.js's shared-wall band is where doorways live). The hull
// is floorPlan().hull (bbox of all room boxes); a side counts as exterior when its
// face is within EXT_EPS layout-units of the hull edge on that side. EXT_EPS spans
// the shared-wall inset (WALL/2 = 0.06) with headroom, so a room flush to the shell
// reads exterior and one tucked behind a neighbour does not.
const EXT_EPS = 0.18;
const OPP = { north: 'south', south: 'north', east: 'west', west: 'east' };

/** exteriorSidesOf(hull, room) -> { north, east, south, west } booleans. */
function exteriorSidesOf(hull, room) {
  if (!hull) return { north: true, east: true, south: true, west: true };
  const x0 = room.cx - room.w / 2, x1 = room.cx + room.w / 2;
  const y0 = room.cy - room.h / 2, y1 = room.cy + room.h / 2;
  const HX0 = hull.x, HY0 = hull.y, HX1 = hull.x + hull.w, HY1 = hull.y + hull.h;
  return {
    west: Math.abs(x0 - HX0) < EXT_EPS,
    east: Math.abs(x1 - HX1) < EXT_EPS,
    north: Math.abs(y0 - HY0) < EXT_EPS,
    south: Math.abs(y1 - HY1) < EXT_EPS
  };
}

/**
 * placeWindowsOnExteriorWalls(want, ext) -> string[] of facings (length == want.length)
 * Snaps each canon window facing (roomWindowFacings) onto an EXTERIOR wall: if the
 * wanted facing is already exterior, keep it; else snap to the opposite exterior
 * wall, then to any exterior wall, spreading across sides so two windows rarely
 * stack. Guarantees every returned facing is exterior (never a shared wall — FP-2
 * #3) while preserving the canon COUNT. Returns [] if the room has no exterior wall
 * (never happens for a lit room — it's on the hull by construction). Pure.
 */
function placeWindowsOnExteriorWalls(want, ext) {
  const extSides = ['north', 'east', 'south', 'west'].filter(s => ext[s]);
  if (!extSides.length) return [];
  const used = new Map(); // facing -> count, to spread windows across free exterior sides
  const out = [];
  for (const f of want) {
    let side = ext[f] ? f : (ext[OPP[f]] ? OPP[f] : null);
    // Prefer an exterior side not yet used; fall back to the chosen/opposite; then any.
    const free = extSides.find(s => !used.has(s));
    if (side == null) side = free != null ? free : extSides[0];
    else if (used.has(side) && free != null) side = free;
    used.set(side, (used.get(side) || 0) + 1);
    out.push(side);
  }
  return out;
}

/**
 * structureWindowModel(world, nodeId) -> {
 *   nodeId, byKey: { [structureKey]: { [roomId]: [{ wx, wy, dir, orient, shuttered, style }] } }
 * }
 *
 * The CANON windows (FP-2 #3), placed for drawing. For every OPEN building's every
 * room, roomWindows() gives the count + shuttered state and roomWindowFacings() the
 * compass facings — both PURE engine derivations the fiction already binds (climb
 * out the east window, shutters lock at night). Each window is snapped onto the
 * room's EXTERIOR wall (never a shared wall) and its center projected to world
 * units. Dark rooms (cellars/pantries) draw NONE — the engine already says so
 * (roomWindows returns count 0). `style` is 'casement' (glazed double-tick when
 * open) — the authored slit/barred vocabulary (plans/races.js) is for hand-authored
 * plans; the procedural floorPlan buildings read as glazed casements. Pure,
 * deterministic, read-only — no engine writes, worldHash untouched.
 */
// windowsForStructure(world, structureKey, plan, node, frame, anchor) ->
//   { [roomId]: [{ wx, wy, dir, orient, shuttered, style }] }
// The per-structure window map — shared by structureWindowModel (standalone) and
// drawnStructureModel (folded into each structure). `plan` is the caller's
// floorPlan(st) (reused, never re-derived). Pure, read-only.
function windowsForStructure(world, structureKey, plan, node, frame, anchor) {
  const rooms = {};
  if (!plan || !plan.hull || !Array.isArray(plan.rooms)) return rooms;
  for (const room of plan.rooms) {
    const interior = { structureKey, roomId: room.id };
    const win = roomWindows(world, interior);
    if (!win.count) continue; // dark / windowless room → no windows drawn
    const facings = placeWindowsOnExteriorWalls(roomWindowFacings(world, interior), exteriorSidesOf(plan.hull, room));
    if (!facings.length) continue;
    const list = [];
    for (const dir of facings) {
      // The window sits on the named exterior wall, centered along it, set a hair
      // proud of the wall face (windowInsetLu) so it reads ON the shell edge.
      const x0 = room.cx - room.w / 2, x1 = room.cx + room.w / 2;
      const y0 = room.cy - room.h / 2, y1 = room.cy + room.h / 2;
      let lx = room.cx, ly = room.cy, orient = 'h';
      if (dir === 'west') { lx = x0 - INK_PARAMS.windowInsetLu; ly = room.cy; orient = 'v'; }
      else if (dir === 'east') { lx = x1 + INK_PARAMS.windowInsetLu; ly = room.cy; orient = 'v'; }
      else if (dir === 'north') { lx = room.cx; ly = y0 - INK_PARAMS.windowInsetLu; orient = 'h'; }
      else if (dir === 'south') { lx = room.cx; ly = y1 + INK_PARAMS.windowInsetLu; orient = 'h'; }
      const p = planPointToWu(node, frame, anchor, plan, lx, ly);
      list.push({ wx: p.wx, wy: p.wy, dir, orient, shuttered: !!win.shuttered, style: 'casement' });
    }
    if (list.length) rooms[String(room.id)] = list;
  }
  return rooms;
}

export function structureWindowModel(world, nodeId) {
  const node = findNode(world, nodeId);
  if (!node) return { nodeId: String(nodeId || ''), byKey: {} };
  const id = String(node.id);
  const structs = structuresAtNode(world, id);
  const place = node.settlement ? placeFromWorldNode(world, id) : null;
  const frame = place ? placeFrame(place) : null;

  const byKey = {};
  for (const st of structs) {
    const structureKey = String(st.id);
    const plan = floorPlan(st);
    if (!plan.rooms.length || !plan.hull) continue;
    const anchor = buildingAnchorInPlace(place, structureKey) || { ox: 0, oy: 0 };
    const rooms = windowsForStructure(world, structureKey, plan, node, frame, anchor);
    if (Object.keys(rooms).length) byKey[structureKey] = rooms;
  }
  return { nodeId: id, byKey };
}

/**
 * drawnStructureModel(world, nodeId) -> {
 *   nodeId, structures: [{
 *     structureKey, name, shell, dark,
 *     rect: {minX,minY,maxX,maxY},                 // structureWorldRect — LOD/culling box
 *     rooms: [{ id, name, isEntry, wx, wy, walls:[{a,b}] }],
 *     doors: [{ wx, wy, a, b }],
 *     windows: { [roomId]: [{ wx, wy, dir, orient, shuttered, style }] },  // FP-2 — canon windows, exterior walls only
 *     corridors: [{ a, b, segs:[{a:{wx,wy},b:{wx,wy}}] }]   // FP-1: abolished — always empty
 *   }]
 * }
 *
 * U409's contract: every settlement structure at this node yields a plan-model
 * derived from the REAL floorPlan(structure), fitted inside its
 * structureWorldRect. TT-DRAW-3 (U418): the room/door SHAPE comes from the ONE
 * shared plan-model (planModel.js's floorPlanToPlanModel — the SAME derivation
 * handDrawnInterior.js's floorPlanToSceneModel uses for the in-play interior),
 * projected here into world units. FP-1 (U429) tiled the rooms so connected
 * neighbours ABUT along a shared wall and a doorway is a gap ON it; FP-2 draws
 * that between-rooms band as solid wall MASS (poché — see oneMap.js) and adds
 * the canon `windows` (structureWindowModel, exterior walls only). Corridors are
 * ABOLISHED (FP-1) — the corridor list is always empty, kept only for shape
 * stability. Pure, deterministic, read-only (structures/floorPlan are both
 * read-only inputs — nothing here writes world state or touches worldHash).
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

    // The ONE shared plan-model — same derivation the in-play interior view
    // consumes (handDrawnInterior.js's floorPlanToSceneModel), in plan-local
    // layout units. This module only projects it into world units.
    const shape = floorPlanToPlanModel(plan);

    const rooms = shape.rooms.map(r => {
      const walls = roomWallSegments(node, frame, anchor, plan, r);
      const center = planPointToWu(node, frame, anchor, plan, r.cx, r.cy);
      const isEntry = plan.rooms.find(pr => String(pr.id) === r.id)?.isEntry;
      return { id: r.id, name: r.name, shape: r.shape, isEntry: !!isEntry, wx: center.wx, wy: center.wy, walls };
    });

    // dir is the original compass direction (floorPlan.js's d.dir), looked up
    // by room pair rather than reconstructed from orient ('h'/'v' collapses
    // north/south and east/west) — a lossless read of the same source doors.
    const dirByPair = new Map((plan.doors || []).map(d => [`${d.a}|${d.b}`, d.dir]));
    const doors = shape.doors.map(d => {
      const p = planPointToWu(node, frame, anchor, plan, d.x, d.y);
      return { wx: p.wx, wy: p.wy, dir: dirByPair.get(`${d.a}|${d.b}`) || '', a: d.a, b: d.b };
    });

    const corridors = shape.corridors.map(c => ({
      a: c.a, b: c.b, segs: corridorSegmentsInWu(node, frame, anchor, plan, c)
    }));

    // FP-2 — canon windows (structureWindowModel's per-structure map), on exterior
    // walls only, dark rooms none. Reuses this call's plan/anchor/frame (no second
    // floorPlan()).
    const windows = windowsForStructure(world, structureKey, plan, node, frame, anchor);

    structures.push({
      structureKey, name: plan.name, shell: plan.shell, dark: !!plan.dark,
      rect, rooms, doors, windows, corridors
    });
  }

  return { nodeId: id, structures };
}

/**
 * decorativeBuildingRects(world, nodeId) -> {
 *   nodeId,
 *   buildings: [{ key, name, shell, rect:{minX,minY,maxX,maxY}, index }]
 * }
 *
 * DEC-1 (docs/briefs/DEC-1-structure-back-decoratives.md) — the true world-unit
 * rect for every DECORATIVE settlement building at this node (a `place.buildings`
 * entry with NO `structureKey` — a well, a workshop, a smithy with no
 * `world.structures.byId` record). drawnStructureModel above is, by contract
 * (U409), REAL structures only (they have interiors: rooms + walls + doors); this
 * is its sibling for the buildings that are PLOTS, not enterable structures.
 *
 * The rect comes from the SAME sizing math a real structure uses —
 * structureWorldRect over the building's footprint — the footprint being the true
 * per-type one placeFromNode seated via settlementFootprint.js's
 * syntheticPlanForBuilding, so a decorative building draws at the SAME scale a
 * real one of that type would (a well ≈ 2×2 wu, not the old 36×20 catalog-bbox
 * balloon). `rooms` are intentionally absent — a decorative building has no
 * interior to draw (never fabricated). `index` is the building's position in
 * `place.buildings` (a stable, deterministic id); `key` is `deco:<index>`.
 *
 * Pure, deterministic, read-only — same discipline as drawnStructureModel;
 * nothing here writes world state or is ever hashed.
 */
export function decorativeBuildingRects(world, nodeId) {
  const node = findNode(world, nodeId);
  if (!node) return { nodeId: String(nodeId || ''), buildings: [] };
  const id = String(node.id);
  const place = node.settlement ? placeFromWorldNode(world, id) : null;
  if (!place) return { nodeId: id, buildings: [] };
  const frame = placeFrame(place);

  const buildings = [];
  (place.buildings || []).forEach((b, i) => {
    if (b && b.structureKey) return;        // real structures → drawnStructureModel
    const plan = b?.plan;
    if (!plan || !plan.footprint) return;   // never fabricate a footprint
    const anchor = { ox: Number(b.ox) || 0, oy: Number(b.oy) || 0 };
    const rect = structureWorldRect(node, frame, anchor, plan);
    buildings.push({
      key: `deco:${i}`, index: i,
      name: String(b.buildingName || plan.name || ''),
      shell: String(plan.material || 'timber'),
      rect
    });
  });

  return { nodeId: id, buildings };
}

// TT-PROPS furniture kinds worth a standing mini (matches the 2-D sheet's own
// furniture palette, oneMap.js's SKIP_FURN/STONE_FURN sets) — big built-in
// fixtures (hearth, altar, statue, column, brazier — masonry, part of the
// room's shell) and 'rug'/'bars' are excluded: the decision rule is "if you
// could pick it up off the table → mini" and a hearth is not picked up.
// BUILDER-OBJ-2 — every kind propArt.js can hand a confirmed GLB to (minus
// 'rack', whose art lives on the lazy miniLibrary loader, not the eager
// treeAssets preload buildPropMini consumes — parked, not wired). A kind
// entering this set with no GLB yet and no procedural PROP_PALETTE fallback
// still just draws nothing (buildPropMini returns null, caller skips it) —
// never a fabricated placeholder shape.
const PROP_MINI_KINDS = new Set(['barrel', 'bed', 'chest', 'dresser', 'hearth', 'table', 'chair', 'cookpot', 'rug']);

/**
 * placedTokenModel(world, nodeId) -> {
 *   nodeId,
 *   people: [{ id, name, role, wx, wy, hostile }],   // outdoorOccupants truth, at THIS node only
 *   trees:  [{ wx, wy, r }],                          // terrain groves/tree props, as PLACED tokens
 *   props:  [{ wx, wy, kind }],                       // TT-PROPS: barrels/beds/dressers/chests as minis
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
 *
 * TT-PROPS (docs/briefs/TT-WORLD-paper-world.md Stage 3): `props` reuses the
 * EXACT same furniture data + fitting math the 2-D sheet's furniture ink
 * already uses (b.plan.furniture, catalogPlanBoundsInPlaceUnits +
 * fitCatalogPointToRect — TT-DRAW-2's "one sizing truth", U416-tested) rather
 * than inventing a new derivation — this file only stops at the world-unit
 * point (fitCatalogPointToRect's {wx,wy}) instead of projecting on through
 * toPx to pixels. Gated to the SAME "open" condition oneMap.js's furniture ink
 * uses (the structure you're standing IN, or your home) — a closed building's
 * furniture isn't visible from outside, on the sheet or as minis.
 */
export function placedTokenModel(world, nodeId) {
  const node = findNode(world, nodeId);
  if (!node) return { nodeId: String(nodeId || ''), people: [], trees: [], props: [], livestock: [] };
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
        hostile: npc.name === '?', // MAP-OCC-1 masks hostiles' identity but keeps them placed
        dead: Boolean(t.dead), // CORPSE-TRUTH-1b — rides the token flag; 3D lays the figure down
        // CORPSE-TRUTH-1 finish — persisted corpse identity rides through to the
        // 3D scene: corpseKey selects the authored corpse GLB (the SAME hash the
        // combat board used), archetype the toppled-figure fallback family.
        archetype: t.archetype ? String(t.archetype) : null,
        corpseKey: t.corpseKey ? String(t.corpseKey) : null
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

  const props = [];
  if (place) {
    const homeNodeId = String(world?.meta?.homeNodeId || '');
    const interiorKey = String(world?.scene?.interior?.structureKey || '');
    const drawnStructures = new Map((drawnStructureModel(world, id)?.structures || []).map(s => [s.structureKey, s]));
    for (const b of (place.buildings || [])) {
      const structureKey = b?.structureKey;
      const realPlan = structureKey ? drawnStructures.get(String(structureKey)) : null;
      // Same "open" gate the 2-D sheet's furniture ink uses (oneMap.js): only the
      // structure you're standing IN, or your own home — never a stranger's
      // closed roof (the map is no spoiler).
      const openable = structureKey && (String(structureKey) === interiorKey || id === homeNodeId);
      if (!openable || !realPlan) continue;
      const catBounds = catalogPlanBoundsInPlaceUnits(b);
      const ox = Number(b?.ox) || 0, oy = Number(b?.oy) || 0;
      for (const f of (b.plan?.furniture || [])) {
        const kind = String(f?.type || '');
        if (!PROP_MINI_KINDS.has(kind)) continue;
        // Furniture rect center, in the SAME building-offset-inclusive place-unit
        // space catalogPlanBoundsInPlaceUnits itself uses (ox+f.ux, oy+f.uy — see
        // that function's own bounds accumulation just above) -> fitted into the
        // TRUE world-unit rect (fitCatalogPointToRect — the SAME TT-DRAW-2
        // "one sizing truth" the 2-D sheet's furniture ink uses, stopping one
        // step short of that call's toPx pixel projection). Omitting +ox/+oy here
        // was a live-caught bug (U480): the point then compared against catBounds
        // in two DIFFERENT coordinate origins, so the fit could land a piece
        // outside its own structure's true rect.
        const cx = ox + (Number(f.ux) || 0) + (Number(f.uw) || 0.6) / 2;
        const cy = oy + (Number(f.uy) || 0) + (Number(f.uh) || 0.6) / 2;
        const fitted = fitCatalogPointToRect(catBounds, realPlan.rect, cx, cy);
        // OBJ-HOLD-6A (release correction) — the flattened plan already applied the
        // identity projection (held items never reach here; placed items arrive at
        // their live coordinates); carry the canonical objectId onto the mini so the
        // 3D scene keys props by identity, not by kind-at-a-position.
        props.push({ wx: fitted.wx, wy: fitted.wy, kind, ...(f.objectId ? { objectId: String(f.objectId) } : {}) });
      }
    }
  }

  return { nodeId: id, people, trees, props, livestock: [] };
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
