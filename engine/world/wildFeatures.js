// MR-3a — THE FOG-PROCGEN WILD: the pure engine truth the wilderness minis draw from.
//
// Contract of record: docs/briefs/MR-3-FOG-PROCGEN.md §MR-3a + docs/MAP_REAL.md
// (stage 3) + docs/POSITION_AS_CANON.md §1–§3 (the region frame, THE MOVEMENT LAW).
//
// Tim's ruling: the wild materializes in the visibility bubble ON DEMAND,
// deterministic in (seed, position) — trees as minis, you a mini among them.
// Walking back to the same clearing shows the same trees: PERMANENCE WITHOUT MEMORY.
//
// THE ONE LAW: every wild feature is a pure function of (worldSeed, region cell).
// Nothing is stored; nothing re-rolls; the same (seed, cell) re-derives identically
// forever. So:
//   • NO Math.random — a local FNV/h32 hash (mirroring engine/world/biome.js's h32,
//     the same technique public/map's grove scatter uses) drives every choice;
//   • NO stored fields, NO applyDeltas writes, NO WORLD_VERSION bump — worldHash is
//     untouched (this module only READS the world; U536 proves the hash invariance);
//   • NO time dependence — trees do not move between turns.
//
// What it answers: wildFeaturesAround(world, {gx,gy}, radius) → the wild features
// standing within `radius` cells of a region cell, each
//   { kind, cell:{gx,gy}, sizeClass, blocking }
// with kinds v1: tree · boulder · brush · deadfall · stump.
//
// The laws the feature field obeys (U535):
//   • BIOME-AWARE DENSITY  — forest dense, margins sparse, clearings occur; derived
//     from the region truth (node tags + biomeForNode);
//   • CORRIDORS STAY CLEAR — road/path edges keep a clear corridor (+ a margin), so a
//     walk (and a journey arrival) never lands in a tree on the road;
//   • SETTLEMENTS OWN THEIR INK — a cell inside a settlement's extent returns empty
//     (buildings/people are the settlement's own occupancy, not the wild);
//   • BLOCKING BY KIND — trees & boulders block; brush, deadfall & stumps do not.
//
// The blocking half joins the region-frame walkable picture in tacticalPos.js
// (isRegionCellBlocked / regionWalkCellFree), so a tactical move STOPS HONESTLY at a
// tree, exactly like a wall (U536). This module is the single source of that truth —
// tacticalPos calls THROUGH to it (no second copy of the geometry).

import { biomeForNode } from './biome.js';
import {
  NODE_CELLS,
  nodeGridToRegionCell,
  nearestNodeToRegionCell,
} from '../map/spatial/tacticalPos.js';

// ── Local FNV-1a 32-bit hash (mirror of biome.js's h32) ──────────────────────
// The engine must never import from public/, and biome.js's h32 is module-private,
// so the tiny hash is reimplemented here (byte-identical algorithm). Same string →
// same 32-bit unsigned int, every call, forever. This is the ONLY randomness source
// in this module (there is no rng stream, no Math.random) — a pure hash of a cluster
// key, so two boots on the same seed derive byte-identical fields (U534).
function h32(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// A 0..1 float from a hash key (top 24 bits → stable, well-distributed unit float).
function unit(key) {
  return (h32(key) >>> 8) / 0x01000000; // 2^24
}

// ── Pinned taste constants (comment the defaults; change deliberately) ────────
// These are the derivation's dials. They are NOT world state — pure constants a
// later tuning packet may revise. Density is per-CLUSTER expected feature count.

// The wild is derived per CLUSTER, not per cell: one hash roll decides a whole
// CLUSTER_CELLS×CLUSTER_CELLS block's features. This gives SPATIAL COHERENCE (a
// grove, not per-cell salt-and-pepper) and keeps the derivation cheap (a bubble of
// radius R touches ~(2R/CLUSTER_CELLS)² clusters, not (2R)² cells). 4 cells = 20 ft
// = one PLACE_WU layout unit — the same lattice the interiors quantize to.
const CLUSTER_CELLS = 4;

// Per-biome expected feature count PER CLUSTER (a small integer band). The hash
// rolls an actual count in [0, max] weighted toward `mean`. Taste defaults:
//   forest      — DENSE: a real wood, most clusters carry something, many carry 2–3.
//   wilderness  — untamed but not solid canopy (a shade below forest).
//   marsh/plains/coastal/desert/arctic — MARGINS ARE SPARSE: scattered brush/stone.
//   (unknown)   — sparse fallback.
// A cluster whose roll lands at 0 is a natural CLEARING — clearings occur for free.
const BIOME_DENSITY = {
  forest:     { max: 4, dense: true },
  wilderness: { max: 3, dense: true },
  mountains:  { max: 3, dense: false }, // boulder country — sparse but stony
  plains:     { max: 1, dense: false },
  marsh:      { max: 2, dense: false },
  coastal:    { max: 1, dense: false },
  desert:     { max: 1, dense: false },
  arctic:     { max: 1, dense: false },
};
const DEFAULT_DENSITY = { max: 1, dense: false };

// Kind tables per biome family. Weighted by REPETITION in the list — the hash picks
// an index uniformly, so a kind listed twice is twice as likely. Forest is mostly
// trees; mountains mostly boulders; open country mostly brush.
const FOREST_KINDS = ['tree', 'tree', 'tree', 'tree', 'brush', 'brush', 'deadfall', 'stump', 'boulder'];
const MOUNTAIN_KINDS = ['boulder', 'boulder', 'boulder', 'brush', 'stump'];
const OPEN_KINDS = ['brush', 'brush', 'brush', 'boulder', 'deadfall'];

// Which kinds BLOCK movement (join the walkable mask as unwalkable). PINNED per the
// brief: trees & boulders are body-height obstructions → block; brush, deadfall
// (low debris you step over) & stumps are ground clutter → do NOT block.
const BLOCKING_KINDS = new Set(['tree', 'boulder']);
function isBlockingKind(kind) {
  return BLOCKING_KINDS.has(kind);
}

// Size class per kind (a hint the renderer scales minis by; not load-bearing here).
const SIZE_CLASS = {
  tree: 'large',
  boulder: 'medium',
  deadfall: 'medium',
  brush: 'small',
  stump: 'small',
};

// ── Corridor + settlement geometry (the exclusions) ──────────────────────────

// Half-width of a road/path corridor kept clear, in region cells (centreline to
// edge). ROAD_CORRIDOR_CELLS covers the drawn ribbon plus a walking margin so a
// journey arrival on the road (the probe's ~(358,19) Greenwood drop) is never in a
// tree. A path is a touch narrower than a road. 6 cells = 30 ft ≈ a cart-wide lane
// plus verge; the +margin keeps the very edge of the ribbon clear too.
const ROAD_CORRIDOR_CELLS = 6; // road: 30 ft half-width kept clear
const PATH_CORRIDOR_CELLS = 4; // path: 20 ft half-width kept clear

// Settlement exclusion radius, in region cells, around a settlement node's centre.
// A settlement OWNS its ink — its buildings and people are its own occupancy, so the
// wild yields nothing inside its extent. Sized to NODE_JITTER (the radius within
// which tacticalPos.js already clusters a settlement's occupants), plus a small
// verge so a tree never grows on the last cottage's doorstep. NODE_CELLS/4 = 50
// cells (250 ft) matches where the engine puts settlement folk; +10 verge = 60 cells.
//
// Computed via a function, NOT a top-level const: NODE_CELLS is imported from
// tacticalPos.js, and this module and tacticalPos import EACH OTHER (the cycle noted
// in the header). Reading NODE_CELLS at module-evaluation time would hit its temporal
// dead zone when wildFeatures loads first. Deferring the read to call time keeps the
// cycle safe. The value is memoised (NODE_CELLS is a pinned constant, U415).
let _settlementExcludeCells = null;
function settlementExcludeCells() {
  if (_settlementExcludeCells == null) _settlementExcludeCells = Math.floor(NODE_CELLS / 4) + 10;
  return _settlementExcludeCells;
}

// Node types that count as a settlement for exclusion. A dungeon_entrance (the
// chapel) is a wild landmark, NOT a settled place — the wood grows right up to it.
const SETTLEMENT_NODE_TYPES = new Set(['settlement', 'town', 'hamlet', 'village', 'city']);

// Whether a node reads as a settlement (its ink is excluded). Belt-and-suspenders:
// nodeType OR a settlement roster present.
function isSettlementNode(node) {
  if (!node) return false;
  if (SETTLEMENT_NODE_TYPES.has(String(node.nodeType || ''))) return true;
  if (node.settlement && (node.settlement.buildings || node.settlement.npcs)) return true;
  return false;
}

// ── Region truth accessors (pure reads over the map) ─────────────────────────

// The map's positioned nodes (those with integer grid coords), each with its
// region-cell centre precomputed. Cheap to recompute per call (≤ a handful of nodes
// in the slice); no caching that could go stale.
function positionedNodes(world) {
  const nodes = Array.isArray(world?.map?.nodes) ? world.map.nodes : [];
  return nodes
    .filter(n => n && Number.isInteger(n.x) && Number.isInteger(n.y))
    .map(n => ({ node: n, centre: nodeGridToRegionCell(n.x, n.y) }));
}

// The road/path corridor SEGMENTS, in region-cell space: for every map edge, the
// segment between its two endpoints' region-cell centres, tagged with the half-width
// its kind keeps clear. An edge whose endpoints aren't both positioned is skipped.
function corridorSegments(world) {
  const edges = Array.isArray(world?.map?.edges) ? world.map.edges : [];
  const byId = new Map();
  for (const { node, centre } of positionedNodes(world)) byId.set(String(node.id), centre);
  const segs = [];
  for (const e of edges) {
    const a = byId.get(String(e?.a ?? ''));
    const b = byId.get(String(e?.b ?? ''));
    if (!a || !b) continue;
    const half = String(e?.kind) === 'path' ? PATH_CORRIDOR_CELLS : ROAD_CORRIDOR_CELLS;
    segs.push({ ax: a.gx, ay: a.gy, bx: b.gx, by: b.gy, half });
  }
  return segs;
}

// Squared distance from a point to a segment (integer-safe, no sqrt) — the classic
// projection clamp. Used to test corridor clearance.
function distSqPointToSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const vv = vx * vx + vy * vy;
  let t = vv > 0 ? (wx * vx + wy * vy) / vv : 0;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const cx = ax + t * vx, cy = ay + t * vy;
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy;
}

// Is a cell inside ANY corridor (within its half-width)? Kept clear if so.
function inCorridor(cell, segs) {
  for (const s of segs) {
    if (distSqPointToSeg(cell.gx, cell.gy, s.ax, s.ay, s.bx, s.by) <= s.half * s.half) return true;
  }
  return false;
}

// Is a cell inside a settlement's excluded extent?
function inSettlement(cell, nodes) {
  const rad = settlementExcludeCells();
  const r2 = rad * rad;
  for (const { node, centre } of nodes) {
    if (!isSettlementNode(node)) continue;
    const dx = cell.gx - centre.gx, dy = cell.gy - centre.gy;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

// The biome that governs a cluster: the nearest node's AUTHORED tag if it carries a
// terrestrial-biome tag (the slice authors 'forest' on the Greenwood), else the
// deterministic biomeForNode projection. Falls back to 'wilderness' with no node.
const TAG_BIOMES = new Set(['forest', 'plains', 'marsh', 'mountains', 'coastal', 'desert', 'arctic', 'wilderness']);
function biomeForCell(world, cell) {
  const seed = String(world?.meta?.seed ?? '');
  const map = world?.map || {};
  const nid = nearestNodeToRegionCell(map, cell.gx, cell.gy);
  const node = (Array.isArray(map.nodes) ? map.nodes : []).find(n => String(n?.id) === String(nid)) || null;
  if (!node) return 'wilderness';
  const tag = (Array.isArray(node.tags) ? node.tags : []).find(t => TAG_BIOMES.has(String(t)));
  if (tag) return String(tag);
  return biomeForNode(seed, node);
}

// The kind table for a biome family.
function kindsForBiome(biome) {
  if (biome === 'forest' || biome === 'wilderness') return FOREST_KINDS;
  if (biome === 'mountains') return MOUNTAIN_KINDS;
  return OPEN_KINDS;
}

// ── Per-cluster derivation ───────────────────────────────────────────────────

// The cluster index a cell belongs to (floor-divide by CLUSTER_CELLS; correct for
// negatives). A cluster is identified by its (cxi, cyi) integer pair.
function clusterOf(gx, gy) {
  return { cxi: Math.floor(gx / CLUSTER_CELLS), cyi: Math.floor(gy / CLUSTER_CELLS) };
}

// The stable key for a cluster's rolls: (worldSeed, cluster) — the ONLY inputs, so
// the field is pure in (seed, position). No time, no turn count, no node identity
// beyond what the biome/exclusion reads separately.
function clusterKey(worldSeed, cxi, cyi) {
  return `${worldSeed}|wild|${cxi},${cyi}`;
}

// Roll a count in [0, max] from a unit float, biased so most clusters are lightly
// wooded and a few are dense (a soft triangular-ish weighting toward the low end,
// with `dense` biomes shifting the mass up by rounding a squared-complement). This
// keeps forests feeling full without paving every cell, and lets clearings (0) occur.
function rollCount(u, density) {
  const max = density.max;
  if (max <= 0) return 0;
  // dense: bias UP (1 - (1-u)^2 skews toward max); sparse: bias DOWN (u^2).
  const shaped = density.dense ? 1 - (1 - u) * (1 - u) : u * u;
  return Math.min(max, Math.floor(shaped * (max + 1)));
}

/**
 * clusterFeatures(world, cxi, cyi, segs, nodes) -> feature[]
 *
 * The features a single cluster contributes, AFTER exclusions. Pure in
 * (worldSeed, cluster). Each feature sits on a distinct cell inside the cluster;
 * a candidate cell that falls in a corridor or a settlement is dropped (so a dense
 * forest cluster straddling the road simply thins along the lane).
 */
function clusterFeatures(world, cxi, cyi, segs, nodes) {
  const seed = String(world?.meta?.seed ?? '');
  const key = clusterKey(seed, cxi, cyi);
  // Bias the biome by the cluster CENTRE cell (stable representative of the block).
  const cx0 = cxi * CLUSTER_CELLS, cy0 = cyi * CLUSTER_CELLS;
  const centreCell = { gx: cx0 + (CLUSTER_CELLS >> 1), gy: cy0 + (CLUSTER_CELLS >> 1) };
  const biome = biomeForCell(world, centreCell);
  const density = BIOME_DENSITY[biome] || DEFAULT_DENSITY;
  const count = rollCount(unit(`${key}|count`), density);
  if (count <= 0) return [];

  const kinds = kindsForBiome(biome);
  const out = [];
  const used = new Set();
  for (let i = 0; i < count; i++) {
    // Offset within the cluster (each feature its own cell), kind, from independent
    // hash streams keyed by the feature index — deterministic, no rng object.
    const ox = h32(`${key}|f${i}|ox`) % CLUSTER_CELLS;
    const oy = h32(`${key}|f${i}|oy`) % CLUSTER_CELLS;
    const gx = cx0 + ox, gy = cy0 + oy;
    const ck = `${gx},${gy}`;
    if (used.has(ck)) continue; // two features rolled onto one cell — keep the first
    used.add(ck);
    const cell = { gx, gy };
    // Exclusions: corridors and settlements yield NO wild feature here.
    if (inCorridor(cell, segs)) continue;
    if (inSettlement(cell, nodes)) continue;
    const kind = kinds[h32(`${key}|f${i}|kind`) % kinds.length];
    out.push({
      kind,
      cell,
      sizeClass: SIZE_CLASS[kind] || 'small',
      blocking: isBlockingKind(kind),
    });
  }
  return out;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * wildFeaturesAround(world, center, radius) -> feature[]
 *
 * The wild features standing within `radius` cells (Chebyshev/box neighbourhood) of
 * the region cell `center = {gx, gy}`. Pure & deterministic: a function of
 * (world.meta.seed, the region truth, center, radius) — no rng, no Math.random, no
 * stored state, no time. Two boots on the same seed return byte-identical arrays for
 * the same query (U534). Order is stable (cluster-major, then feature index).
 *
 * `radius` defaults to a small visibility bubble. A non-integer/absent center or a
 * radius ≤ 0 yields [] (nothing to derive here — a legal empty answer).
 *
 * This is the ONE derivation MR-3b renders from and tacticalPos's walkable-mask
 * helpers read through — there is no second copy of the geometry.
 */
export function wildFeaturesAround(world, center, radius = 8) {
  if (!center || !Number.isInteger(center.gx) || !Number.isInteger(center.gy)) return [];
  const r = Math.floor(Number(radius));
  if (!(r > 0)) return [];

  const segs = corridorSegments(world);
  const nodes = positionedNodes(world);

  // The clusters whose cells could fall inside the box. Iterate cluster indices in a
  // stable (cxi, cyi) order for deterministic output ordering.
  const minCluster = clusterOf(center.gx - r, center.gy - r);
  const maxCluster = clusterOf(center.gx + r, center.gy + r);

  const out = [];
  for (let cxi = minCluster.cxi; cxi <= maxCluster.cxi; cxi++) {
    for (let cyi = minCluster.cyi; cyi <= maxCluster.cyi; cyi++) {
      const feats = clusterFeatures(world, cxi, cyi, segs, nodes);
      for (const f of feats) {
        // Keep only features whose cell is truly inside the box radius.
        if (Math.abs(f.cell.gx - center.gx) <= r && Math.abs(f.cell.gy - center.gy) <= r) {
          out.push(f);
        }
      }
    }
  }
  return out;
}

/**
 * isRegionCellBlocked(world, gx, gy) -> boolean
 *
 * Whether a BLOCKING wild feature stands on the region cell (gx, gy). The single
 * source of the outdoor walkable-mask truth: tacticalPos.js's region walk calls
 * THROUGH this (no second copy). Pure & deterministic. A radius-0 query on the exact
 * cell: derive its own cluster and check for a blocking feature ON that cell.
 *
 * Cheap — one cluster derivation (not a bubble). Corridors/settlements are already
 * clear (clusterFeatures dropped them), so a corridor cell is never blocked (a walk
 * on the road never stops at a phantom tree).
 */
export function isRegionCellBlocked(world, gx, gy) {
  if (!Number.isInteger(gx) || !Number.isInteger(gy)) return false;
  const segs = corridorSegments(world);
  const nodes = positionedNodes(world);
  const { cxi, cyi } = clusterOf(gx, gy);
  const feats = clusterFeatures(world, cxi, cyi, segs, nodes);
  for (const f of feats) {
    if (f.blocking && f.cell.gx === gx && f.cell.gy === gy) return true;
  }
  return false;
}

// Test/introspection surface (kept minimal): the pinned constants a test asserts
// bounds against, without reaching into module internals. SETTLEMENT_EXCLUDE_CELLS
// is a GETTER — it derives from NODE_CELLS (imported across the cycle), so it must be
// read at access time, never at this object's construction (see settlementExcludeCells).
export const WILD_CONSTANTS = Object.freeze({
  CLUSTER_CELLS,
  ROAD_CORRIDOR_CELLS,
  PATH_CORRIDOR_CELLS,
  get SETTLEMENT_EXCLUDE_CELLS() { return settlementExcludeCells(); },
  BLOCKING_KINDS: Object.freeze([...BLOCKING_KINDS]),
  KINDS: Object.freeze(['tree', 'boulder', 'brush', 'deadfall', 'stump']),
});
