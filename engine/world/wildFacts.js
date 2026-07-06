// MR-3c — THE WILD NARRATED: the derived-feature READ the words share with the map.
//
// Contract of record: docs/briefs/MR-3-FOG-PROCGEN.md §MR-3c + docs/THE_DM_TEST.md.
//
// MR-3a (engine/world/wildFeatures.js, v0.29.9) made the wilderness KNOWN — a pure
// function of (seed, region cell) answering "what stands here?". MR-3b teaches the
// map to DRAW it. This slice makes the WORDS read the SAME world: the outdoor
// look-around and the DM's prompt both compose the derived features honestly —
// "deadfall to the north; a boulder cluster east; the road runs west" — so narrated
// wild can never contradict the derivation (the design's falsifier).
//
// THE ONE SOURCE. The feature field lives in ONE place — wildFeaturesAround. This
// module CONSUMES it (never re-derives geometry): it takes the features standing in
// the player's visibility bubble, buckets them by COMPASS DIRECTION, keeps the most
// notable per direction, caps and stable-orders them, and adds the ROADS in the
// bubble as orientation anchors ("the road runs west" — the most load-bearing line
// for a lost player). Pure f(world): no rng, no Math.random, no stored state, no
// time — so two boots on one seed compose byte-identical facts, and the prose the
// survey builds from these can never drift from what the map draws.
//
// What it answers: outdoorTerrainFacts(world) → { features:[{kind, dir, sizeClass,
// blocking}], roads:[{dir, kind}] } | null. null when the player is INDOORS or the
// current place has no wild to read (a settlement owns its own ink). This is the
// structured fact both the survey (gracefulAdjudication.buildLocationSurvey outdoor
// branch) and the DM prompt (llmAdapter.outdoorTerrainFact) render from — the same
// hide-the-math discipline MR-2b/MR-2d used for doors and windows.

import { wildFeaturesAround } from './wildFeatures.js';
import {
  nodeGridToRegionCell,
} from '../map/spatial/tacticalPos.js';

// ── Pinned taste constants (comment the defaults; change deliberately) ────────

// The visibility bubble radius, in region cells, the outdoor read scans. Matches the
// wildFeaturesAround default (a small bubble ≈ what a person takes in around them);
// 8 cells = 40 ft ≈ a clearing's worth of sightline. A tuning packet may revise.
const READ_RADIUS = 8;

// How many feature entries the composed read carries at most. A real look-around
// names the few notable things, not an inventory — one line per compass direction is
// the natural cap (4 cardinals), and we surface at most that many. ~4-6 per the brief.
const FEATURE_CAP = 4;

// A NOTABLE feature is worth naming; ground clutter is texture the eye skims. We rank
// so the ONE feature named per direction is the most arresting there: a tree/boulder
// (body-height, and blocking) over deadfall over brush/stump. Higher = more notable.
const KIND_NOTABILITY = {
  tree: 5,
  boulder: 4,
  deadfall: 3,
  stump: 2,
  brush: 1,
};

// How close (in region cells) a road/path corridor must pass to the player's cell to
// count as an orientation anchor in view. A road you can SEE from where you stand is
// worth "the road runs west"; one over the horizon is not. 40 cells = 200 ft ≈ the
// same visibility bubble, a touch wider so a road just outside the feature bubble
// still orients a lost traveller.
const ROAD_SIGHT_CELLS = 40;

// ── The player's outdoor region cell ─────────────────────────────────────────

// The region cell the outdoor read centres on: the party's committed tactical pos
// when it's on the region sheet (frame 'region' — the honest, walked position, incl.
// where a journey interrupt dropped them), else the current node's own region-cell
// centre (a freshly-arrived player who hasn't taken a tactical step yet). null when
// there is no positioned node to fall back to. Pure read.
function outdoorCell(world) {
  const w = world || {};
  const pos = Array.isArray(w.party) ? w.party[0]?.pos : null;
  if (pos && String(pos.frame) === 'region'
      && Number.isInteger(pos.gx) && Number.isInteger(pos.gy)) {
    return { gx: pos.gx, gy: pos.gy };
  }
  // Fall back to the current node's centre.
  const nodeId = String(w.map?.currentNodeId ?? '');
  const node = (Array.isArray(w.map?.nodes) ? w.map.nodes : [])
    .find(n => String(n?.id) === nodeId) || null;
  if (node && Number.isInteger(node.x) && Number.isInteger(node.y)) {
    return nodeGridToRegionCell(node.x, node.y);
  }
  return null;
}

// The compass direction of an offset (dx east-positive, dy south-positive), snapped to
// the nearest cardinal — the same 4-cardinal vocabulary the exits/window facings use
// (roomWindowFacings, exitsFrom). A dead-centre offset (0,0) has no direction → ''.
function cardinalOf(dx, dy) {
  if (dx === 0 && dy === 0) return '';
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'east' : 'west';
  return dy > 0 ? 'south' : 'north';
}

// ── The road/path anchors in the bubble ──────────────────────────────────────

// The map's positioned nodes with their region-cell centres (mirrors wildFeatures'
// own accessor — a pure read of the same map data, not a copy of the FEATURE
// geometry). Cheap: a handful of nodes in the slice.
function positionedCentres(world) {
  const nodes = Array.isArray(world?.map?.nodes) ? world.map.nodes : [];
  const byId = new Map();
  for (const n of nodes) {
    if (n && Number.isInteger(n.x) && Number.isInteger(n.y)) {
      byId.set(String(n.id), nodeGridToRegionCell(n.x, n.y));
    }
  }
  return byId;
}

// Squared distance from a point to a segment (integer-safe projection clamp) — the
// classic point-to-segment test, same shape wildFeatures uses for corridor clearance.
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

// The roads/paths passing within sight of the player's cell, each as {dir, kind} — the
// direction the corridor runs FROM the player (toward the far endpoint of the nearest
// segment), so "the road runs west" points a lost traveller down it. Deduped by
// (dir, kind); stable-ordered (cardinal order). A corridor whose endpoints aren't both
// positioned is skipped. This reads the SAME map edges wildFeatures keeps clear — a
// corridor is exactly where there are NO features, so naming it complements the field.
function roadAnchors(world, cell) {
  const edges = Array.isArray(world?.map?.edges) ? world.map.edges : [];
  const centres = positionedCentres(world);
  const seen = new Set();
  const anchors = [];
  const sight2 = ROAD_SIGHT_CELLS * ROAD_SIGHT_CELLS;
  for (const e of edges) {
    const a = centres.get(String(e?.a ?? ''));
    const b = centres.get(String(e?.b ?? ''));
    if (!a || !b) continue;
    if (distSqPointToSeg(cell.gx, cell.gy, a.gx, a.gy, b.gx, b.gy) > sight2) continue;
    // Point the direction toward the endpoint the player is NOT sitting on top of
    // (the far end of the road from here). Ties broken toward b (stable).
    const da2 = (a.gx - cell.gx) ** 2 + (a.gy - cell.gy) ** 2;
    const db2 = (b.gx - cell.gx) ** 2 + (b.gy - cell.gy) ** 2;
    const far = db2 >= da2 ? b : a;
    const dir = cardinalOf(far.gx - cell.gx, far.gy - cell.gy);
    if (!dir) continue;
    const kind = String(e?.kind) === 'road' ? 'road' : 'path';
    const key = `${dir}|${kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    anchors.push({ dir, kind });
  }
  // Stable order: cardinal (N,E,S,W), roads before paths within a direction.
  const ORD = { north: 0, east: 1, south: 2, west: 3 };
  anchors.sort((x, y) => (ORD[x.dir] - ORD[y.dir]) || (x.kind === y.kind ? 0 : x.kind === 'road' ? -1 : 1));
  return anchors;
}

// ── The composed outdoor terrain facts ───────────────────────────────────────

/**
 * outdoorTerrainFacts(world) -> { features, roads } | null
 *
 * The wild features standing in the player's visibility bubble, bucketed by compass
 * direction with the most-notable feature kept per direction, capped and stable-
 * ordered — plus the road corridors in sight as orientation anchors. Pure &
 * deterministic: a function of (world.meta.seed, the region truth, the player's
 * region cell). Two boots on one seed return byte-identical facts.
 *
 * Returns null when the player is INSIDE a structure (the interior seam owns that —
 * planFacts/roomWindows) or when there is no wild to read (a settlement/known-empty
 * bubble). A legal, common empty answer — the caller simply adds no terrain line.
 *
 *   features: [{ kind, dir, sizeClass, blocking }]  — one per direction, most
 *             notable first (notability, then cardinal order), ≤ FEATURE_CAP.
 *   roads:    [{ dir, kind }]                        — corridors in sight, cardinal-
 *             ordered. Orientation anchors, never features.
 */
export function outdoorTerrainFacts(world) {
  const w = world || {};
  // Indoors → the interior seam owns the read (MR-2b/2d). Nothing to compose here.
  const interior = w.scene?.interior;
  if (interior && typeof interior === 'object' && interior.structureKey) return null;

  const cell = outdoorCell(w);
  if (!cell) return null;

  const feats = wildFeaturesAround(w, cell, READ_RADIUS);
  const roads = roadAnchors(w, cell);

  // Bucket features by direction from the player; keep the single most-notable per
  // direction (ties → the closer one, then the one that blocks — a real obstruction
  // over clutter). Directions are the natural cap: at most one line per cardinal.
  const best = new Map(); // dir -> { feature, dist2 }
  for (const f of feats) {
    if (!f || !f.cell) continue;
    const dx = f.cell.gx - cell.gx, dy = f.cell.gy - cell.gy;
    const dir = cardinalOf(dx, dy);
    if (!dir) continue; // a feature dead on the player's cell can't happen (blocking
                        // cells are never walked onto), but guard anyway.
    const dist2 = dx * dx + dy * dy;
    const prev = best.get(dir);
    if (!prev) { best.set(dir, { feature: f, dist2 }); continue; }
    const pn = KIND_NOTABILITY[prev.feature.kind] || 0;
    const cn = KIND_NOTABILITY[f.kind] || 0;
    // More notable wins; tie → closer; tie → the blocker; else keep the incumbent
    // (stable, so the field is order-stable regardless of wildFeaturesAround's order).
    let take = false;
    if (cn > pn) take = true;
    else if (cn === pn) {
      if (dist2 < prev.dist2) take = true;
      else if (dist2 === prev.dist2 && f.blocking && !prev.feature.blocking) take = true;
    }
    if (take) best.set(dir, { feature: f, dist2 });
  }

  // Emit in a STABLE order: most notable first, ties broken by cardinal order — so the
  // list never churns between calls and the survey's prose is deterministic.
  const ORD = { north: 0, east: 1, south: 2, west: 3 };
  const features = [...best.entries()]
    .map(([dir, { feature }]) => ({
      kind: feature.kind,
      dir,
      sizeClass: feature.sizeClass,
      blocking: Boolean(feature.blocking),
    }))
    .sort((a, b) =>
      ((KIND_NOTABILITY[b.kind] || 0) - (KIND_NOTABILITY[a.kind] || 0))
      || (ORD[a.dir] - ORD[b.dir]))
    .slice(0, FEATURE_CAP);

  // Nothing to say (a bare clearing off any road) → null, so the caller adds no line.
  if (!features.length && !roads.length) return null;
  return { features, roads };
}

// ── Prose helpers (shared vocabulary the survey renders with) ─────────────────
// Kept beside the derivation so the survey and any other renderer speak the wild in
// ONE voice. Pure string maps; no state.

// The read-noun for a feature kind (what a look-around CALLS it). Natural phrasing a
// DM would use — "a stand of trees", "a boulder cluster", "deadfall". Hide-the-math:
// never a cell, a coordinate, or a blocking flag — just the thing.
const FEATURE_NOUN = {
  tree: 'a stand of trees',
  boulder: 'a boulder cluster',
  deadfall: 'deadfall',
  stump: 'an old stump',
  brush: 'thick brush',
};

/**
 * terrainSurveyPhrases(facts, opts) -> string[]
 *
 * The outdoor feature/road reads as short survey clauses ("deadfall to the north",
 * "the road runs west"), roads LAST (features are what you see; roads orient you
 * after). Empty array for null/empty facts. Pure.
 *
 * opts.roads (default true) includes the road anchors. The buildLocationSurvey outdoor
 * branch passes { roads: false } — its OWN exits-by-direction block already names the
 * roads leaving, so listing them here too would double them ("a path runs south … a
 * path leads south"). The DM prompt keeps roads (its by-NAME roads fact lacks the
 * compass orientation, and the anchors are load-bearing for a between-nodes drop).
 */
export function terrainSurveyPhrases(facts, opts = {}) {
  if (!facts || typeof facts !== 'object') return [];
  const withRoads = opts.roads !== false;
  const out = [];
  for (const f of (Array.isArray(facts.features) ? facts.features : [])) {
    const noun = FEATURE_NOUN[f.kind];
    if (!noun || !f.dir) continue;
    out.push(`${noun} to the ${f.dir}`);
  }
  if (withRoads) {
    for (const r of (Array.isArray(facts.roads) ? facts.roads : [])) {
      if (!r.dir) continue;
      out.push(`${r.kind === 'road' ? 'the road runs' : 'a path runs'} ${r.dir}`);
    }
  }
  return out;
}
