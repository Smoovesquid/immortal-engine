/**
 * placeFromNode — the bridge from the engine's world to a walkable place.
 *
 * Turns an overworld node into the seed/type/tier for generatePlace, so the live
 * game can render the node as a walkable fog-of-war place instead of an abstract
 * dot. Tier is GEOGRAPHIC: the further a node sits from your home, the more
 * dangerous (and rewarding) — your "islands of safety, danger at the edges" rule,
 * deterministic so the same node always generates the same place.
 *
 * The app shell calls renderPlace(placeModelFromNode(world, nodeId)); wiring that
 * into v1.js is the one step that needs the running game to verify.
 */

import { generatePlace } from './generatePlace.js';
import { getPlan } from './plans/index.js';
import { buildingTypeFor } from '../../engine/structures/roomDetail.js';
import { exitsFrom, ensureMap } from '../../engine/map/mapState.js';
import { makeRng, seedFromString } from '../../engine/rng.js';
import { outdoorOccupants } from '../../engine/structures/roomOccupancy.js';
import { syntheticPlanForBuilding } from '../../engine/structures/settlementFootprint.js';
// MR-1b — the player token reads the engine's canonical tactical `pos` instead of
// a fixed lane-entry seed. floorPlan is the REAL engine room graph for a
// struct-frame pos (NOT the catalog `getPlan()` plan this module draws buildings
// from — see the note above playerTokenPlaceUnit below); structCellToPlaceUnit is
// worldSpace.js's frame transform, factored out of structCellToWu so this
// place-unit-space renderer can consume the SAME pinned cell math oneMap.js's
// wu-space renderer already uses (one sizing truth, two output spaces).
import { floorPlan } from '../../engine/structures/floorPlan.js';
import { structCellToPlaceUnit } from './worldSpace.js';

const TIER_STEP = 5; // grid-distance per danger rung

// DEC-1 — settlement building name → true footprint now lives in ONE place:
// engine/structures/settlementFootprint.js (syntheticPlanForBuilding). The old
// name→catalog-plan map here sized decorative buildings by an authored ROOM bbox
// (a well became a whole cottage); it is retired.
//
// PLAN-SPLIT-1 — a REAL structure (has a world.structures record) now resolves
// its plan from the ENGINE's own floorPlan(st) (see engineBackedPlan below), not
// getPlan(buildingType)'s catalog art — the catalog plan survives ONLY as the
// no-topology fallback (a structure with no rooms yet, or a lookup failure).
// This is the actual fix for the wake-token-off-its-building bug (the oracle's
// PROJECTION_EQUALITY red): the building WALLS this file draws (handDrawnPlace.js
// reads b.plan.rooms directly) and the player TOKEN (playerTokenPlaceUnit, above)
// must come from the SAME plan, or the token measurably sits off its own ink.

// engineBackedPlan(st) -> a plan-shaped object `{ rooms, footprint, furniture }`
// wrapping floorPlan(st) for this module's building loop, or null if the
// structure has no drawable topology (the caller falls back to the catalog).
// `rooms` is floorPlan's own array — already `{ id, cx, cy, w, h, ... }`, the
// EXACT shape planExtent()/handDrawnPlace.js expect from a catalog plan's rooms
// (no `.r` radius field; engine/structures/floorPlan.js), so no reshape there.
// `furniture` is synthesized (flattenRoomFurniture below): floorPlan's rooms
// carry per-room, NORMALIZED (fx/fy in [0,1] of the room box) furniture — a
// different shape/frame than the catalog's absolute ABSOLUTE-anchor
// `{type,ux,uy,uw,uh}` array (TT-DRAW-2's catalogPlanBoundsInPlaceUnits /
// fitCatalogPointToRect and oneMap.js's outdoor-silhouette furniture loop read
// exactly that catalog shape) — flattening to the SAME absolute shape keeps
// those call sites working unchanged, now sized/positioned from the real room
// graph instead of an unrelated catalog cottage's fixtures.
function flattenRoomFurniture(rooms) {
  const out = [];
  for (const r of (rooms || [])) {
    for (const f of (r.furniture || [])) {
      // A circular piece (barrel, pillar, sarcophagus, …) carries `r` (radius)
      // instead of w/h — roomDetail.js's FURN table, same `.r ? .r*2 : w/h`
      // convention this file's own planExtent()/generatePlace already use for
      // room shapes. Without this, every circular item flattens to a w=0,h=0
      // point (still a valid, if degenerate, AABB — but not its true footprint).
      const w = Number(f.w) || (Number(f.r) ? Number(f.r) * 2 : 0);
      const h = Number(f.h) || (Number(f.r) ? Number(f.r) * 2 : 0);
      const fx = Number.isFinite(f.fx) ? f.fx : 0.5, fy = Number.isFinite(f.fy) ? f.fy : 0.5;
      const cx = r.cx - r.w / 2 + fx * r.w, cy = r.cy - r.h / 2 + fy * r.h;
      out.push({ type: String(f.kind || f.type || 'prop'), ux: cx - w / 2, uy: cy - h / 2, uw: w, uh: h });
    }
  }
  return out;
}

function engineBackedPlan(st) {
  let fp; try { fp = floorPlan(st); } catch { return null; }
  if (!fp || !Array.isArray(fp.rooms) || !fp.rooms.length) return null;
  return { rooms: fp.rooms, doors: fp.doors || [], footprint: fp.footprint, material: fp.shell, furniture: flattenRoomFurniture(fp.rooms) };
}

function planExtent(plan) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const r of (plan.rooms || [])) { const rw = (r.w || r.r * 2) / 2, rh = (r.h || r.r * 2) / 2; minX = Math.min(minX, r.cx - rw); maxX = Math.max(maxX, r.cx + rw); minY = Math.min(minY, r.cy - rh); maxY = Math.max(maxY, r.cy + rh); }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

// ── ROADS-1 THE RULE — buildings & props never share squares with a road ──
// The road corridor is the road polyline(s) swept to half-width + a clearance
// margin (covers the DRAWN ribbon incl. its stroke). All geometry is in the
// place's own layout units (the same units the footprints use); pure + seeded.

// ROAD_HALF_LU — the ribbon's centerline-to-edge half-width in layout units
// (the live draw uses path.w=1.4 → ~0.7 lu each side). ROAD_CLEAR_LU — the extra
// breathing margin a footprint must keep from that ribbon edge (covers the
// z-scaled stroke plane and reads as a real setback, not a graze). One place to
// tune the setback by eye later.
const ROAD_HALF_LU = 0.7;
const ROAD_CLEAR_LU = 1.3;
const CORRIDOR_LU = ROAD_HALF_LU + ROAD_CLEAR_LU; // ~2.0 lu each side of centerline

// ── TT-OCC THE RULE — no outdoor mini ever stands inside ink that isn't theirs ──
// Tim's ruling (2026-07-05, docs/MAP_REAL.md): floorplans stay ALWAYS-OPEN
// (roofless DM-screen look, locked), so a strict placement margin is the ONLY
// defense against a figure reading as "in the bedroom" when the engine says
// they're outdoors. NPC_MARGIN_LU is derived from the two things that actually
// eat into the visual gap between a token's coordinate and "clearly outside the
// wall": the wall stroke itself, and the token's own drawn footprint — not
// imported (drawModel.js imports FROM this file; importing back would cycle),
// but pinned to the same numbers so a future taste pass on either stays honest:
//   wall stroke:  INK_PARAMS.wallWeight.fortified = 3.4 world-units (widest of
//                 the five shells) ÷ PLACE_WU (4 wu/lu, worldSpace.js) = 0.85 lu
//   token base:   INK_PARAMS.tokenBaseRadiusWu = 0.34*PLACE_WU wu ÷ PLACE_WU
//                 = 0.34 lu (a token isn't a point; its own ring must clear too)
// Sum, rounded up a hair for a real setback rather than a graze: 1.2 lu. This is
// the exact class of miss that let Galen's 0.72-lu-from-cottage scatter point
// (aldermere boot, node n0_2935788122) pass a bare rect-edge check while still
// reading on screen as standing inside the wake cottage.
export const NPC_MARGIN_LU = 1.2;

// True if point (px,py) falls inside any rect in `rects`, each grown by `margin`
// on every side. Rects are the SAME `placed` AABBs the building-scatter loop
// above already computed (post ROADS-1 projection) — one footprint truth, no
// re-derivation. Exported (with pushClearOfBuildings below) so tests can drive
// the exclusion directly against synthetic tight-packed geometry, not just
// indirectly through a full settlement boot.
export function insideAnyRect(px, py, rects, margin) {
  for (const r of rects) {
    if (px >= r.minX - margin && px <= r.maxX + margin && py >= r.minY - margin && py <= r.maxY + margin) return true;
  }
  return false;
}

// Deterministically relocate (x,y) to the nearest point clear of every
// building rect (+margin) — a fixed ring/angle SPIRAL SEARCH outward from the
// original point, not a repulsion vector-field.
//
// Why a spiral and not "push away from the nearest/summed rect": a first draft
// tried exactly that (push directly away from whichever rect's centre — or
// nearest edge, or the summed away-vector of every claiming rect — was
// nearest), mirroring ROADS-1's buildings-vs-road projection. It broke on a
// realistic tight-packed village (several buildings only ~1-2 lu apart,
// margin-inflated zones overlapping in the gap between them): the point
// oscillates between two neighbours' opposing pulls, or settles into a stable
// EQUILIBRIUM where multiple rects' push vectors exactly cancel — a known
// failure mode of potential-field navigation, not a rare edge case (an
// adversarial-fixture sweep hit it on ~40-75% of trials). A vector field can
// get stuck; an exhaustive search cannot. Walking outward ring by ring and
// taking the FIRST clear point found is instead a monotonic search — no
// equilibrium is possible because nothing is being followed, every candidate
// point is independently tested. Verified against the same adversarial
// checkerboard (0/300 failures, vs. the vector approaches' 40-75%) plus a
// realistic 2-lu-gap grid and a "deep inside one giant building" case.
//
// Deterministic and pure: same (x,y,rects,margin) always yields the same
// escape point, no rng, nothing here reads world state. `angleSteps` scales
// with ring number so the arc-length between samples stays roughly bounded as
// the radius grows (a fixed angle count would under-sample a narrow clear
// wedge far out); `maxRadius`/`ringStep` cap the search — the country is
// unbounded off any settlement, so a clear point always exists well within
// range, and the cap only protects against a pathological caller.
export function pushClearOfBuildings(x, y, rects, margin, maxRadius = 200, ringStep = 0.5, angleSteps = 24) {
  if (!insideAnyRect(x, y, rects, margin)) return { x, y }; // already clear — most calls, zero work
  for (let ring = 1; ring * ringStep <= maxRadius; ring++) {
    const r = ring * ringStep;
    const steps = Math.min(angleSteps * ring, 720);
    for (let a = 0; a < steps; a++) {
      const theta = (a / steps) * Math.PI * 2;
      const px = x + Math.cos(theta) * r, py = y + Math.sin(theta) * r;
      if (!insideAnyRect(px, py, rects, margin)) return { x: px, y: py };
    }
  }
  return { x, y }; // exhausted maxRadius — never hit in practice (see module doc); returns the original point rather than fabricating one
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
function distPointToRoads(px, py, roads) {
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
// footprint pushes directly away from (so it escapes perpendicular to whatever
// segment is nearest, spine or spur).
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

// Does a segment [a..b] come within `half` of an AABB (i.e. the road ribbon,
// swept to `half`, overlaps the rect)? True if either endpoint is inside the
// grown rect, or the segment crosses any of the grown rect's four edges. This
// catches the case a point-sample misses: the centerline passing straight
// THROUGH a footprint wider than the corridor (a building astride the road).
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
// `half` against the rect — endpoint-inside OR edge-crossing, so a footprint
// spanning the ribbon is caught even when its sampled points sit outside the
// half-width band. `half` is the corridor half-width (centerline-to-footprint).
function aabbHitsCorridor(a, roads, half) {
  for (const rd of roads) {
    const pts = rd.pts || [];
    for (let i = 0; i < pts.length - 1; i++) {
      if (segNearAabb(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], a, half)) return true;
    }
  }
  return false;
}

// MR-1b — the player token's place-unit position, read from the engine's
// canonical tactical `pos` (docs/POSITION_AS_CANON.md) instead of a fixed seed.
//
//   pos.frame === 'struct:<id>'  → project the cell into the SAME building this
//     village drew, via the frame transform (worldSpace.js's structCellToPlaceUnit)
//     — but grounded against the REAL engine plan (floorPlan(structure)), not the
//     catalog `getPlan()` plan the building entry carries for drawing. This mirrors
//     oneMap.js's resolveEntityWuFromWorld exactly (its plan is likewise re-derived
//     from world.structures, never the caller's drawn-plan reference) — one
//     projection contract, two output spaces (wu there, place-units here).
//   pos.frame === 'region'       → outdoors at this node. This module's village
//     layout is an independently-seeded micro-scatter (its own road spine, its own
//     local origin) with NO shared coordinate lattice against the engine's region
//     cells (unlike oneMap.js's wu space, which anchors everything to nodeToWu) —
//     there is no canonical sub-node point to project a region cell onto here, so
//     outdoors resolves to the fallback (documented, not a bug: "somewhere outside,
//     near the village entrance" is the honest resolution this layout can offer).
//   no pos / ungroundable pos    → the fallback (legacy lane-entry seed).
//
// Precedence vs. TT-OCC's no-foreign-ink rule (NPC_MARGIN_LU, above): the player
// is exempt from that exclusion by design (see the comment at the token push
// below) — but even so, a struct-frame projection can NEVER land in a room whose
// ink isn't the engine's own claim: the pos invariant (engine/map/spatial/
// tacticalPos.js's isTacticalPosConsistent) already guarantees
// roomOfStructCell(pos) === scene.interior.roomId BEFORE this function ever runs,
// and structCellToPlaceUnit performs a pure linear rescale of that SAME cell —
// it does not re-derive room ownership, so it cannot disagree with the engine's
// own room claim. The DOOR/doorstep cell (MR-1a's egress fix) is by construction
// the room the engine says you're in, so it always wins; there is no live case
// where this projection and the engine's room claim diverge.
//
// Pure: no mutation, no rng. Never throws — any lookup failure degrades to the
// fallback, matching every other projector in this file/worldSpace.js.
export function playerTokenPlaceUnit(world, buildings, fallback) {
  const pos = world?.party?.[0]?.pos;
  if (!pos || typeof pos !== 'object' || !Number.isInteger(pos.gx) || !Number.isInteger(pos.gy)) {
    return fallback;
  }
  const m = /^struct:(.+)$/.exec(String(pos.frame || ''));
  if (!m) return fallback; // region frame (or an unrecognized frame) — see note above
  const structId = m[1];
  const bld = (buildings || []).find(b => String(b?.structureKey || '') === structId);
  if (!bld) return fallback; // the pos's building isn't drawn in this village (e.g. a far node)
  const st = world?.structures?.byId?.[structId] || null;
  if (!st) return fallback;
  let plan; try { plan = floorPlan(st); } catch { return fallback; }
  if (!plan || !plan.footprint) return fallback;
  const u = structCellToPlaceUnit({ ox: bld.ox, oy: bld.oy }, plan, pos.gx, pos.gy);
  if (!Number.isFinite(u?.ux) || !Number.isFinite(u?.uy)) return fallback;
  return u;
}

// placeFromWorldNode — build a walkable place from the node's ACTUAL contents:
// the real structures (your home cottage), the settlement's buildings, and its
// people. So the village you see IS the village that's there. Deterministic.
export function placeFromWorldNode(world, nodeId) {
  const nodes = (world && world.map && world.map.nodes) || [];
  const id = String(nodeId || (world && world.map && world.map.currentNodeId) || '');
  const node = nodes.find(n => String(n.id) === id);
  if (!node) return null;
  const seed = `${(world && world.meta && world.meta.seed) || 'seed'}|${id}`;

  const structs = Object.values((world && world.structures && world.structures.byId) || {}).filter(s => String(s && s.nodeId || '') === id);
  const sbld = Array.isArray(node.settlement && node.settlement.buildings) ? node.settlement.buildings : [];
  // MAP-OCC-1: the outdoor token set is LINE OF SIGHT, never the whole settlement roster.
  // outdoorOccupants(world) is the same occupancy model the DM's presence logic reads
  // (engine/structures/roomOccupancy.js) — it derives who is truly out in the open from
  // world.map.currentNodeId, so it's only valid for the node the player is actually AT.
  // For any other node (the overworld map draws every settlement's layout at once via
  // oneMap.js), we cannot correctly ask "who's outdoors there" without touching the
  // engine's occupancy module for an arbitrary node — so those draw no roster-scatter
  // NPCs at all (never-wrong-by-omission beats fabricating people who aren't there).
  const isCurrentNode = id === String((world && world.map && world.map.currentNodeId) || '');
  const outdoorNpcs = isCurrentNode ? outdoorOccupants(world) : [];

  const buildings = [], tokens = [];
  const pathY = 12;

  // Collect every building (the player's real structures first, then the
  // settlement's). Count varies by size tier now (M7-S3), so a hamlet is a couple
  // of roofs and the city seat is dozens.
  //
  // PLAN-SPLIT-1 — a real structure draws from engineBackedPlan(st) (the ENGINE's
  // own floorPlan), never getPlan(type)'s catalog art. Falls back to the catalog
  // ONLY when the structure has no drawable topology yet (never throws).
  const entries = [];
  for (const st of structs) {
    const type = st.buildingType || buildingTypeFor(String(st.id || ''));
    const plan = engineBackedPlan(st) || getPlan(type) || getPlan('cottage');
    if (plan && plan.rooms) entries.push({ plan, meta: { structureKey: st.id, name: type } });
  }
  for (const b of sbld) {
    // DEC-1 — a decorative-only settlement building (no world.structures record)
    // gets a TRUE-footprint synthetic plan from the ONE footprint table
    // (engine/structures/settlementFootprint.js), NOT the old inflated catalog
    // plan (which sized a building by its authored ROOM bbox — ~5× per axis too
    // big, and mapped a "well" to a whole cottage). Its drawn size is now the
    // true footprint, and drawModel.decorativeBuildingRects derives the same rect
    // from the same footprint, so the decorative set finally reads at one scale
    // with its neighbours.
    const plan = syntheticPlanForBuilding(String(b && b.name || ''));
    if (plan && plan.rooms) entries.push({ plan, meta: { buildingName: b.name } });
  }
  if (!entries.length) return generatePlace({ seed, nodeType: nodeTypeFor(node), tier: tierForNode(world, node) });

  // P-81b — ORGANIC town layout: buildings scatter along a gently CURVED road,
  // clustered and irregular (terrain-following), never a lattice. Deterministic:
  // a seeded RNG places each building near the road by rejection-sampling against
  // already-placed footprints, so the same node always yields the same village.
  const rng = makeRng(seedFromString(`${seed}|placelayout`));
  const span = Math.max(16, 8 + entries.length * 2.4);   // road length grows with size

  // The road spine: a gentle seeded curve about pathY (a lane that bends, not a
  // ruler-straight street). roadY(x) is reused to seat buildings and the well.
  const amp = 2.2 + rng.nextFloat() * 3.2;
  const phase = rng.nextFloat() * Math.PI * 2;
  const freq = 0.16 + rng.nextFloat() * 0.12;
  const roadY = (x) => pathY + amp * Math.sin(x * freq + phase);

  // ROADS-1 — the corridor buildings must avoid, known BEFORE any building seats.
  // The spine is fully determined up front (roadY over the lane's along-range);
  // the N/S exit spurs leave the lane midpoint straight out to a fixed reach, so
  // their corridor is knowable now too (they only extend AWAY from the built
  // cluster). midX is the lane midpoint; spurEnd is how far a spur pokes out.
  const exits = exitsFrom(ensureMap(world && world.map), id);
  const midX = span / 2;
  const spurEnd = 12;                                      // drawn spur's minimum reach beyond the lane band (lu)
  // The TESTED spur runs far enough to superset the DRAWN spur (whose end is
  // max(pathY±spurEnd, cluster edge ±6) below); no building ever seats 40 lu off
  // the lane, so testing to ±40 guarantees the corridor tested ⊇ the line drawn.
  const spurTest = 40;
  // Test the spine over a range that SUPERSETS the drawn polyline (x0..x1 below
  // extends only a few lu past the built cluster, which lives in [2, span-2]). A
  // margin of 10 lu each end guarantees a building can never lap the drawn tail
  // that this corridor didn't test — the corridor tested and the line drawn are
  // the same curve (roadY), just sampled over a wider x here.
  const spineX0 = -10, spineX1 = span + 10;
  const spineSeg = [];
  for (let x = spineX0; x <= spineX1; x += 2) spineSeg.push([x, roadY(x)]);
  spineSeg.push([spineX1, roadY(spineX1)]);
  // The wander of each spur is seeded up front so the corridor tested against and
  // the polyline drawn are the SAME line.
  const northDx = (rng.nextFloat() - 0.5) * 4;
  const southDx = (rng.nextFloat() - 0.5) * 4;
  const corridor = [{ pts: spineSeg }];
  if (exits.north) corridor.push({ pts: [[midX, roadY(midX)], [midX + northDx, pathY - spurTest]] });
  if (exits.south) corridor.push({ pts: [[midX, roadY(midX)], [midX + southDx, pathY + spurTest]] });

  // Scatter the buildings: along the road, offset to one side, clustered near it,
  // rejecting overlaps with placed footprints AND the road corridor. Each
  // footprint is an AABB (+1u breathing gap between buildings).
  const placed = [];
  const hits = (a) => placed.some(b => !(a.maxX + 1 < b.minX || a.minX - 1 > b.maxX || a.maxY + 1 < b.minY || a.minY - 1 > b.maxY));
  const bad = (a) => hits(a) || aabbHitsCorridor(a, corridor, CORRIDOR_LU);
  const shift = (a, dx, dy) => ({ minX: a.minX + dx, minY: a.minY + dy, maxX: a.maxX + dx, maxY: a.maxY + dy });
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const e of entries) {
    const ext = planExtent(e.plan);
    // The footprint the sheet DRAWS is the plan re-centered so its CENTRE lands at
    // (cxp,cyp) (see ox/oy below: ox = cxp - extMidX). The collision AABB must be
    // that SAME rect — a half-width box about (cxp,cyp) — or we'd test one rect and
    // draw another (the bug that let an off-centre plan, e.g. the cottage, lap the
    // road while its collision box sat clear). extHalf is the plan's half-size.
    const extHW = (ext.maxX - ext.minX) / 2, extHH = (ext.maxY - ext.minY) / 2;
    const rectAt = (x, y) => ({ minX: x - extHW, minY: y - extHH, maxX: x + extHW, maxY: y + extHH });
    let cxp = span / 2, cyp = pathY, aabb = rectAt(cxp, cyp);
    for (let tries = 0; tries < 48; tries++) {
      const along = 2 + rng.nextFloat() * (span - 4);              // position down the lane
      const side = rng.nextFloat() < 0.5 ? -1 : 1;
      const off = (2 + rng.nextFloat() * rng.nextFloat() * 8) * side; // clustered near the road, tail outward
      cxp = along + (rng.nextFloat() - 0.5) * 1.6;
      cyp = roadY(along) + off;
      aabb = rectAt(cxp, cyp);
      if (!bad(aabb)) break;                                        // found a clear spot
    }
    // ROADS-1 — NO give-up-and-overlap. If sampling exhausted with the candidate
    // still touching the corridor or a neighbour, PROJECT it to the nearest clear
    // seat: repeatedly push it directly AWAY from the nearest road point (true
    // repulsion — works for the horizontal spine AND the vertical exit spurs, both
    // of which a fixed ±y push could never escape), then away from any overlapping
    // neighbour. Deterministic (no rng); always terminates — the country is
    // unbounded off the lane, so a clear band always exists a bounded distance out.
    if (bad(aabb)) {
      for (let step = 0; step < 800 && bad(aabb); step++) {
        const cx = (aabb.minX + aabb.maxX) / 2, cy = (aabb.minY + aabb.maxY) / 2;
        let dx = 0, dy = 0;
        if (aabbHitsCorridor(aabb, corridor, CORRIDOR_LU)) {
          const np = nearestOnRoads(cx, cy, corridor);
          dx = cx - np.x; dy = cy - np.y;
        } else {
          // corridor-clear but a neighbour overlaps — push off the nearest one.
          const nb = placed.find(b => !(aabb.maxX + 1 < b.minX || aabb.minX - 1 > b.maxX || aabb.maxY + 1 < b.minY || aabb.minY - 1 > b.maxY));
          if (nb) { dx = cx - (nb.minX + nb.maxX) / 2; dy = cy - (nb.minY + nb.maxY) / 2; }
        }
        let len = Math.hypot(dx, dy);
        if (len < 1e-6) { dx = 0; dy = 1; len = 1; }               // degenerate: push south
        const sx = (dx / len) * 0.5, sy = (dy / len) * 0.5;        // half-lu steps
        aabb = shift(aabb, sx, sy); cxp += sx; cyp += sy;
      }
    }
    placed.push(aabb);
    minX = Math.min(minX, aabb.minX); maxX = Math.max(maxX, aabb.maxX);
    minY = Math.min(minY, aabb.minY); maxY = Math.max(maxY, aabb.maxY);
    const ox = cxp - (ext.minX + ext.maxX) / 2, oy = cyp - (ext.minY + ext.maxY) / 2; // seat plan centre at (cxp,cyp)
    buildings.push({ plan: e.plan, ox, oy, ...e.meta });
  }
  if (!Number.isFinite(minX)) { minX = 0; maxX = span; minY = pathY - 6; maxY = pathY + 6; }
  const endX = Math.max(8, maxX + 2);

  // The curved road as a polyline, reaching the map edge wherever a neighbor lies
  // so you can walk onward; short spurs bend off to the north/south exits. The
  // spine EXTENDS the corridor spine outward (west/east) toward neighbours — the
  // extension only reaches away from the built cluster, so it never re-laps a
  // building. Spurs reuse the SAME seeded wander the corridor tested against.
  const x0 = exits.west ? minX - 4 : Math.max(0, minX - 1);
  const x1 = exits.east ? endX + 3 : endX;
  const roadPts = [];
  for (let x = x0; x <= x1; x += 2) roadPts.push([x, roadY(x)]);
  roadPts.push([x1, roadY(x1)]);
  const paths = [{ pts: roadPts, w: 1.4 }];
  if (exits.north) paths.push({ pts: [[midX, roadY(midX)], [midX + northDx, Math.min(pathY - spurEnd, minY - 6)]], w: 1.1 });
  if (exits.south) paths.push({ pts: [[midX, roadY(midX)], [midX + southDx, Math.max(pathY + spurEnd, maxY + 6)]], w: 1.1 });

  // ROADS-1 — the well (and any prop) sits BESIDE the lane, fully clear of the
  // corridor (spine AND the exit spurs — the naive spot right at midX sat on the
  // south spur's origin). Start a little off midX along the lane (dodging the spur
  // that leaves at midX), step out perpendicular to the emptier side, then verify
  // against the DRAWN paths and push until clear. Deterministic; bounded.
  const wellSide = (roadY(midX) > (minY + maxY) / 2) ? -1 : 1;    // toward more open space
  const wellX = midX + span * 0.12;                               // off the spur origin, still central
  let wellY = roadY(wellX) + wellSide * (CORRIDOR_LU + 0.9);
  for (let step = 0; step < 60 && distPointToRoads(wellX, wellY, paths) < CORRIDOR_LU + 0.4; step++) wellY += wellSide * 0.4;

  const terrain = {
    paths,
    // Groves tuck into the open corners, not on a grid.
    groves: [{ cx: minX - 1.5, cy: maxY + 2, r: 2.2, n: 9 }, { cx: endX - 2, cy: minY - 1.5, r: 1.8, n: 6 }],
    props: [{ type: 'well', ux: wellX, uy: wellY }]
  };

  // MR-1b — the player token reads engine position truth when it's available;
  // the lane-entry seed (x0+1.5, roadY(...)) survives ONLY as the no-pos legacy
  // fallback (a fresh/legacy world with no party[0].pos, or a pos this module
  // can't ground — e.g. a structure not drawn in this village's buildings[]).
  // The player token is exempt from the TT-OCC exclusion below: the player may
  // legitimately be indoors (wake = your bed) — their token comes from position
  // truth (or the fallback), never routed through the outdoor-scatter building check.
  const fallbackPlayerUnit = { ux: x0 + 1.5, uy: roadY(x0 + 1.5) };
  tokens.push({ type: 'player', ...playerTokenPlaceUnit(world, buildings, fallbackPlayerUnit) });
  const shown = outdoorNpcs.filter(n => n && !n.hostile).slice(0, 12).concat(outdoorNpcs.filter(n => n && n.hostile).slice(0, 2).map(n => ({ ...n, name: '?' })));
  shown.forEach((n, i) => {
    const ax0 = minX + ((i + 1) / (shown.length + 1)) * (maxX - minX) + (rng.nextFloat() - 0.5) * 2;
    const ay0 = roadY(ax0) + (rng.nextFloat() < 0.5 ? -1 : 1) * (0.8 + rng.nextFloat() * 1.4);
    // TT-OCC — outdoor scatter must never land inside a building's footprint
    // (+ NPC_MARGIN_LU). `placed` is the SAME building AABB set the scatter
    // loop above already resolved (post ROADS-1 projection); hostile-masked
    // tokens (name '?') go through this identical path — no exemption, an
    // ambusher is still outdoors until the fiction says otherwise.
    const { x: ax, y: ay } = pushClearOfBuildings(ax0, ay0, placed, NPC_MARGIN_LU);
    tokens.push({ type: 'npc', ux: ax, uy: ay, label: String(n.name || 'V').trim().charAt(0).toUpperCase() || 'V', npc: { id: n.id || ('npc' + i), name: n.name, role: n.role } });
  });

  return { nodeType: node.nodeType || 'settlement', tier: tierForNode(world, node), seed, terrain, buildings, tokens, footprintW: endX };
}

function nodeTypeFor(node) {
  const st = node && node.settlement;
  if (st) {
    const pop = Number(st.population || 0);
    const npcs = Array.isArray(st.npcs) ? st.npcs.length : 0;
    if (pop >= 300 || npcs >= 6) return 'town';
    return 'hamlet';
  }
  const t = String(node && node.nodeType || '').toLowerCase();
  if (t.includes('ruin')) return 'ruin';
  if (t.includes('keep') || t.includes('fort')) return 'keep';
  return 'wild';
}

export function tierForNode(world, node) {
  const nodes = (world && world.map && world.map.nodes) || [];
  const homeId = String((world && world.meta && world.meta.homeNodeId) || (world && world.map && world.map.currentNodeId) || '');
  const home = nodes.find(n => String(n.id) === homeId);
  if (!home || !Number.isFinite(node.x) || !Number.isFinite(home.x)) return 1;
  const d = Math.abs(node.x - home.x) + Math.abs(node.y - home.y);
  return Math.max(1, Math.min(4, 1 + Math.floor(d / TIER_STEP)));
}

// placeModelFromNode(world, nodeId) -> a generatePlace() model for that node, or null.
export function placeModelFromNode(world, nodeId) {
  const nodes = (world && world.map && world.map.nodes) || [];
  const id = String(nodeId || (world && world.map && world.map.currentNodeId) || '');
  const node = nodes.find(n => String(n.id) === id);
  if (!node) return null;
  const seed = `${(world && world.meta && world.meta.seed) || 'seed'}|${id}`;
  const nodeType = nodeTypeFor(node);
  const tier = tierForNode(world, node);
  return generatePlace({ seed, nodeType, tier });
}
