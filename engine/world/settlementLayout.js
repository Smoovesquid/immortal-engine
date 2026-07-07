// MAP-EGRESS-1 — the settlement layout, engine-owned (docs/MAP_REAL.md).
//
// THE DRAWN WORLD IS THE SIMULATED WORLD. A settlement's buildings scatter along a
// gently curved road (the P-81b organic layout). Historically that scatter lived
// ONLY in the renderer (public/map/placeFromNode.js), so the engine's egress math
// (engine/map/spatial/tacticalPos.js doorThresholdCells) had no idea where a
// building was actually DRAWN — it computed "just outside the front door" as if every
// building sat at the node CENTRE. The two disagreed, so "go outside" teleported the
// body across the settlement (77 m from its own drawn door).
//
// This module is the single source of the layout. It computes, for a node, the placed
// position (ox/oy, place-unit space) of every building AND the settlement frame (the
// bounding box the renderer anchors on), so BOTH the renderer (which draws) and the
// engine egress (which lands the doorstep) read ONE geometry. This is the DEC-1 move
// (footprint sizes -> engine, renderer consumes) applied one level up: the whole-
// settlement scatter.
//
// PURITY / BYTE-STABILITY (the prime constraint): the emitted ox/oy for every building
// on every seed is IDENTICAL to the pre-extraction renderer output. The entry order
// (real structs first, then decorative settlement buildings), the rng draw order, and
// the rejection-sampling sequence are preserved EXACTLY. rng.js is the only randomness.
// This module reads world state and returns plain values; it never mutates and is never
// serialized or hashed.
//
// PLAN RESOLUTION is engine-only here (no public/ import): a real structure's geometry
// comes from floorPlan(st); a decorative building from syntheticPlanForBuilding(name).
// The renderer re-derives its RICHER draw-plan (engineBackedPlan, which adds flattened
// furniture) from the SAME floorPlan, so its extent — the only thing that drives ox/oy —
// is byte-identical to the plan this module scatters. (The old getPlan(type) catalog
// fallback for a structure with NO topology is retired in favour of the engine-native
// synthetic footprint; no live world has a topology-less structure, so no ox/oy moves.)

import { makeRng, seedFromString } from '../rng.js';
import { exitsFrom, ensureMap } from '../map/mapState.js';
import { floorPlan } from '../structures/floorPlan.js';
import { buildingTypeFor } from '../structures/roomDetail.js';
import { syntheticPlanForBuilding } from '../structures/settlementFootprint.js';
import { NODE_CELLS } from '../map/spatial/tacticalPos.js';

// The renderer's place<->world scale, mirrored here so the frame -> region-cell
// conversion below is engine-owned (public/map/worldSpace.js carries the identical
// constants for the render side; U633 proves the frames agree byte-for-byte).
//   PLACE_WU_WU     — world-units per village place-unit (worldSpace.PLACE_WU).
//   REGION_WU_PER_CELL — world-units per region cell (worldSpace's NODE_WU / NODE_CELLS).
// NOTE these are NOT tacticalPos.PLACE_WU (which is cells-per-layout-unit — same value
// 4, different meaning). Named locally so the distinction is explicit.
export const PLACE_WU_WU = 4;
// == NODE_WU (1000) / NODE_CELLS (200) = 5 wu/cell. A LITERAL, not `1000 / NODE_CELLS`,
// because this line runs at MODULE EVALUATION — and the tacticalPos import (which owns
// NODE_CELLS) is CYCLIC, so referencing NODE_CELLS here would read it before it is
// initialised. (NODE_CELLS is used below only inside runtime functions, which is safe.)
export const REGION_WU_PER_CELL = 5;

// ── ROADS-1 — buildings & props never share squares with a road ──────────────
// (moved verbatim from placeFromNode.js; the corridor is the road polyline swept
// to half-width + a clearance margin.)
const ROAD_HALF_LU = 0.7;
const ROAD_CLEAR_LU = 1.3;
export const CORRIDOR_LU = ROAD_HALF_LU + ROAD_CLEAR_LU; // ~2.0 lu each side of centerline

// planExtent(plan) — the bbox of every room's drawn box, in layout units.
export function planExtent(plan) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const r of (plan.rooms || [])) { const rw = (r.w || r.r * 2) / 2, rh = (r.h || r.r * 2) / 2; minX = Math.min(minX, r.cx - rw); maxX = Math.max(maxX, r.cx + rw); minY = Math.min(minY, r.cy - rh); maxY = Math.max(maxY, r.cy + rh); }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

// Distance from a point to a segment [a..b] (all layout units).
function distPointSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const vv = vx * vx + vy * vy;
  let t = vv > 0 ? (wx * vx + wy * vy) / vv : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + t * vx, cy = ay + t * vy;
  return Math.hypot(px - cx, py - cy);
}

// Shortest distance from a point to a polyline set (array of {pts:[[x,y],...]}).
export function distPointToRoads(px, py, roads) {
  let best = Infinity;
  for (const r of roads) {
    const pts = r.pts || [];
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distPointSeg(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      if (d < best) best = d;
    }
  }
  return best;
}

// The closest point on the road polyline set to (px,py) — the anchor a projected
// footprint pushes directly away from.
function nearestOnRoads(px, py, roads) {
  let best = Infinity, bx = px, by = py;
  for (const r of roads) {
    const pts = r.pts || [];
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], ay = pts[i][1], cx = pts[i + 1][0], cy = pts[i + 1][1];
      const vx = cx - ax, vy = cy - ay, vv = vx * vx + vy * vy;
      let t = vv > 0 ? ((px - ax) * vx + (py - ay) * vy) / vv : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = ax + t * vx, qy = ay + t * vy;
      const d = Math.hypot(px - qx, py - qy);
      if (d < best) { best = d; bx = qx; by = qy; }
    }
  }
  return { x: bx, y: by };
}

// Does a segment [a..b] come within `half` of an AABB (the road ribbon, swept to
// `half`, overlaps the rect)? True if either endpoint is inside the grown rect, or
// the segment crosses any of the grown rect's four edges.
function segNearAabb(ax, ay, bx, by, r, half) {
  const gx0 = r.minX - half, gy0 = r.minY - half, gx1 = r.maxX + half, gy1 = r.maxY + half;
  const inside = (x, y) => x >= gx0 && x <= gx1 && y >= gy0 && y <= gy1;
  if (inside(ax, ay) || inside(bx, by)) return true;
  const segHit = (cx, cy, dx, dy) => {
    const d1x = bx - ax, d1y = by - ay, d2x = dx - cx, d2y = dy - cy;
    const den = d1x * d2y - d1y * d2x;
    if (den === 0) return false;
    const t = ((cx - ax) * d2y - (cy - ay) * d2x) / den;
    const u = ((cx - ax) * d1y - (cy - ay) * d1x) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };
  return segHit(gx0, gy0, gx1, gy0) || segHit(gx1, gy0, gx1, gy1) ||
         segHit(gx1, gy1, gx0, gy1) || segHit(gx0, gy1, gx0, gy0);
}

// Does an AABB intrude into the road corridor? Tests every road segment swept to
// `half` against the rect.
export function aabbHitsCorridor(a, roads, half) {
  for (const rd of roads) {
    const pts = rd.pts || [];
    for (let i = 0; i < pts.length - 1; i++) {
      if (segNearAabb(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], a, half)) return true;
    }
  }
  return false;
}

// The layout entries for a node: the player's REAL structures first (each with its
// engine geometry from floorPlan), then the settlement's decorative buildings (each
// with a true-footprint synthetic plan). This is the ENTRY ORDER that drives the rng
// draw order — preserved EXACTLY from the pre-extraction renderer.
//
// Real structs use floorPlan(st) (the same room graph the renderer's engineBackedPlan
// wraps — identical rooms, identical extent). A struct with no drawable topology (no
// live world today) falls to a synthetic footprint by its building type; the old
// getPlan(type) catalog fallback is retired (engine can't import the public catalog,
// and the synthetic footprint is the more honest size). Each entry carries `meta`
// naming the building (structureKey for a real struct, buildingName for a decorative).
export function settlementEntries(world, nodeId) {
  const id = String(nodeId || (world && world.map && world.map.currentNodeId) || '');
  const structs = Object.values((world && world.structures && world.structures.byId) || {}).filter(s => String(s && s.nodeId || '') === id);
  const nodes = (world && world.map && world.map.nodes) || [];
  const node = nodes.find(n => String(n.id) === id);
  const sbld = Array.isArray(node && node.settlement && node.settlement.buildings) ? node.settlement.buildings : [];

  const entries = [];
  for (const st of structs) {
    const type = st.buildingType || buildingTypeFor(String(st.id || ''));
    let plan = null;
    try { plan = floorPlan(st); } catch { plan = null; }
    if (!plan || !Array.isArray(plan.rooms) || !plan.rooms.length) {
      // Topology-less struct (never in a live world) — engine-native synthetic footprint.
      plan = syntheticPlanForBuilding(type);
    }
    if (plan && plan.rooms) entries.push({ plan, meta: { structureKey: st.id, name: type } });
  }
  for (const b of sbld) {
    const plan = syntheticPlanForBuilding(String(b && b.name || ''));
    if (plan && plan.rooms) entries.push({ plan, meta: { buildingName: b.name } });
  }
  return entries;
}

/**
 * settlementLayout(world, nodeId) -> null | {
 *   buildings: [{ structureKey?, name?, buildingName?, plan, ox, oy }],  // drawn positions (place-units)
 *   terrain:   { paths, groves, props },                                 // the road ribbon, groves, the well
 *   frame:     { minX, minY, maxX, maxY, cx, cy },                       // settlement bbox (== worldSpace.placeFrame)
 *   extent:    { minX, minY, maxX, maxY },                               // building bbox only
 *   span, endX, footprintW,                                              // scalars the renderer reuses
 *   roadY,                                                               // the road curve fn (for the npc scatter)
 *   rng                                                                  // the live rng, at its POST-scatter state
 * }
 *
 * Returns null when the node has no drawable settlement (no structs + no decorative
 * buildings) — the caller then generates a procedural place. Pure + deterministic
 * (rng.js only); never mutates world, never hashed.
 *
 * The returned `rng` is intentionally live: the renderer's outdoor-NPC scatter draws
 * from the SAME stream immediately after the layout, so returning the handle keeps the
 * npc positions byte-identical to the pre-extraction single-function version. The
 * frame is computed here (identical logic to public/map/worldSpace.js placeFrame) so
 * the engine egress can project the drawn door into a region cell WITHOUT importing
 * the public renderer.
 */
export function settlementLayout(world, nodeId) {
  const nodes = (world && world.map && world.map.nodes) || [];
  const id = String(nodeId || (world && world.map && world.map.currentNodeId) || '');
  const node = nodes.find(n => String(n.id) === id);
  if (!node) return null;
  const seed = `${(world && world.meta && world.meta.seed) || 'seed'}|${id}`;

  const entries = settlementEntries(world, id);
  if (!entries.length) return null;

  // P-81b — ORGANIC town layout: buildings scatter along a gently CURVED road.
  const rng = makeRng(seedFromString(`${seed}|placelayout`));
  const span = Math.max(16, 8 + entries.length * 2.4);
  const pathY = 12;

  const amp = 2.2 + rng.nextFloat() * 3.2;
  const phase = rng.nextFloat() * Math.PI * 2;
  const freq = 0.16 + rng.nextFloat() * 0.12;
  const roadY = (x) => pathY + amp * Math.sin(x * freq + phase);

  const exits = exitsFrom(ensureMap(world && world.map), id);
  const midX = span / 2;
  const spurEnd = 12;
  const spurTest = 40;
  const spineX0 = -10, spineX1 = span + 10;
  const spineSeg = [];
  for (let x = spineX0; x <= spineX1; x += 2) spineSeg.push([x, roadY(x)]);
  spineSeg.push([spineX1, roadY(spineX1)]);
  const northDx = (rng.nextFloat() - 0.5) * 4;
  const southDx = (rng.nextFloat() - 0.5) * 4;
  const corridor = [{ pts: spineSeg }];
  if (exits.north) corridor.push({ pts: [[midX, roadY(midX)], [midX + northDx, pathY - spurTest]] });
  if (exits.south) corridor.push({ pts: [[midX, roadY(midX)], [midX + southDx, pathY + spurTest]] });

  const buildings = [];
  const placed = [];
  const hits = (a) => placed.some(b => !(a.maxX + 1 < b.minX || a.minX - 1 > b.maxX || a.maxY + 1 < b.minY || a.minY - 1 > b.maxY));
  const bad = (a) => hits(a) || aabbHitsCorridor(a, corridor, CORRIDOR_LU);
  const shift = (a, dx, dy) => ({ minX: a.minX + dx, minY: a.minY + dy, maxX: a.maxX + dx, maxY: a.maxY + dy });
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const e of entries) {
    const ext = planExtent(e.plan);
    const extHW = (ext.maxX - ext.minX) / 2, extHH = (ext.maxY - ext.minY) / 2;
    const rectAt = (x, y) => ({ minX: x - extHW, minY: y - extHH, maxX: x + extHW, maxY: y + extHH });
    let cxp = span / 2, cyp = pathY, aabb = rectAt(cxp, cyp);
    for (let tries = 0; tries < 48; tries++) {
      const along = 2 + rng.nextFloat() * (span - 4);
      const side = rng.nextFloat() < 0.5 ? -1 : 1;
      const off = (2 + rng.nextFloat() * rng.nextFloat() * 8) * side;
      cxp = along + (rng.nextFloat() - 0.5) * 1.6;
      cyp = roadY(along) + off;
      aabb = rectAt(cxp, cyp);
      if (!bad(aabb)) break;
    }
    if (bad(aabb)) {
      for (let step = 0; step < 800 && bad(aabb); step++) {
        const cx = (aabb.minX + aabb.maxX) / 2, cy = (aabb.minY + aabb.maxY) / 2;
        let dx = 0, dy = 0;
        if (aabbHitsCorridor(aabb, corridor, CORRIDOR_LU)) {
          const np = nearestOnRoads(cx, cy, corridor);
          dx = cx - np.x; dy = cy - np.y;
        } else {
          const nb = placed.find(b => !(aabb.maxX + 1 < b.minX || aabb.minX - 1 > b.maxX || aabb.maxY + 1 < b.minY || aabb.minY - 1 > b.maxY));
          if (nb) { dx = cx - (nb.minX + nb.maxX) / 2; dy = cy - (nb.minY + nb.maxY) / 2; }
        }
        let len = Math.hypot(dx, dy);
        if (len < 1e-6) { dx = 0; dy = 1; len = 1; }
        const sx = (dx / len) * 0.5, sy = (dy / len) * 0.5;
        aabb = shift(aabb, sx, sy); cxp += sx; cyp += sy;
      }
    }
    placed.push(aabb);
    minX = Math.min(minX, aabb.minX); maxX = Math.max(maxX, aabb.maxX);
    minY = Math.min(minY, aabb.minY); maxY = Math.max(maxY, aabb.maxY);
    const ox = cxp - (ext.minX + ext.maxX) / 2, oy = cyp - (ext.minY + ext.maxY) / 2;
    buildings.push({ plan: e.plan, ox, oy, ...e.meta });
  }
  if (!Number.isFinite(minX)) { minX = 0; maxX = span; minY = pathY - 6; maxY = pathY + 6; }
  const endX = Math.max(8, maxX + 2);

  const x0 = exits.west ? minX - 4 : Math.max(0, minX - 1);
  const x1 = exits.east ? endX + 3 : endX;
  const roadPts = [];
  for (let x = x0; x <= x1; x += 2) roadPts.push([x, roadY(x)]);
  roadPts.push([x1, roadY(x1)]);
  const paths = [{ pts: roadPts, w: 1.4 }];
  if (exits.north) paths.push({ pts: [[midX, roadY(midX)], [midX + northDx, Math.min(pathY - spurEnd, minY - 6)]], w: 1.1 });
  if (exits.south) paths.push({ pts: [[midX, roadY(midX)], [midX + southDx, Math.max(pathY + spurEnd, maxY + 6)]], w: 1.1 });

  const wellSide = (roadY(midX) > (minY + maxY) / 2) ? -1 : 1;
  const wellX = midX + span * 0.12;
  let wellY = roadY(wellX) + wellSide * (CORRIDOR_LU + 0.9);
  for (let step = 0; step < 60 && distPointToRoads(wellX, wellY, paths) < CORRIDOR_LU + 0.4; step++) wellY += wellSide * 0.4;

  const terrain = {
    paths,
    groves: [{ cx: minX - 1.5, cy: maxY + 2, r: 2.2, n: 9 }, { cx: endX - 2, cy: minY - 1.5, r: 1.8, n: 6 }],
    props: [{ type: 'well', ux: wellX, uy: wellY }]
  };

  const frame = placeFrameOf(buildings, terrain);
  // `placed` is the resolved building-AABB set (post ROADS-1 projection) — returned
  // so the renderer's outdoor-NPC scatter can exclude tokens from building footprints
  // (TT-OCC) against the SAME rects, no re-derivation.
  return { buildings, placed, terrain, frame, extent: { minX, minY, maxX, maxY }, span, endX, footprintW: endX, roadY, rng };
}

// placeFrameOf(buildings, terrain) — the settlement's bounding frame in place-units,
// plus its midpoint. IDENTICAL logic to public/map/worldSpace.js placeFrame (which
// takes the assembled `place`); kept here so the engine can derive the frame from its
// own layout without importing the renderer. U633 asserts the two agree byte-for-byte.
export function placeFrameOf(buildings, terrain) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x, y) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };
  for (const b of (buildings || [])) {
    for (const r of (b?.plan?.rooms || [])) {
      const rw = (r.w ?? (r.r ?? 1) * 2) / 2, rh = (r.h ?? (r.r ?? 1) * 2) / 2;
      grow(b.ox + r.cx - rw, b.oy + r.cy - rh);
      grow(b.ox + r.cx + rw, b.oy + r.cy + rh);
    }
  }
  for (const g of (terrain?.groves || [])) {
    grow(g.cx - g.r, g.cy - g.r); grow(g.cx + g.r, g.cy + g.r);
  }
  for (const p of (terrain?.paths || [])) {
    for (const [x, y] of (p?.pts || [])) grow(x, y);
  }
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 1; maxY = 1; }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

/**
 * placeUnitToRegionCell(node, frame, ux, uy) -> { gx, gy }
 * The inverse-composition of worldSpace.js's placeUnitToWu -> regionCellToWu: a village
 * place-unit point projected to the engine's REGION-cell frame, WITHOUT going through
 * world units. This is the bridge the egress uses to land the doorstep on the DRAWN
 * building. `node` carries integer node.x/node.y (the region-cell anchor); `frame` is a
 * settlementLayout frame. Pure; degrades to the node's own region-cell centre when the
 * node has no grid coordinate. Returns FRACTIONAL cells — the caller rounds.
 */
export function placeUnitToRegionCell(node, frame, ux, uy) {
  const nx = Number(node && node.x) || 0, ny = Number(node && node.y) || 0;
  const f = frame && typeof frame === 'object' ? frame : { cx: 0, cy: 0 };
  const k = PLACE_WU_WU / REGION_WU_PER_CELL; // 4/5 — place-unit delta -> region-cell delta
  return {
    gx: nx * NODE_CELLS + ((Number(ux) || 0) - f.cx) * k,
    gy: ny * NODE_CELLS + ((Number(uy) || 0) - f.cy) * k,
  };
}

// buildingAnchorFromLayout(layout, structureKey) -> { ox, oy } | null
// The drawn place-unit anchor of a real structure in a settlementLayout, or null when
// the structure isn't drawn in this settlement (a far node, or a lookup miss). Mirrors
// public/map/worldSpace.js buildingAnchorInPlace but over the engine layout.
export function buildingAnchorFromLayout(layout, structureKey) {
  const key = String(structureKey || '');
  if (!key) return null;
  const b = (layout && Array.isArray(layout.buildings) ? layout.buildings : []).find(x => String(x && x.structureKey || '') === key);
  if (!b) return null;
  return { ox: Number(b.ox) || 0, oy: Number(b.oy) || 0 };
}
