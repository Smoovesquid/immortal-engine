// ONE MAP — M6: the surface geography (docs/WORLD_AND_DUNGEONS.md, Part A).
//
// The "author": a pure, seeded function that emits the world's illustrated
// ground as plain DATA — never drawing anything itself. oneMap.js is the pen
// that inks this data; a hand-authored map (the future "canvas") could supply
// the same shapes. Built ON engine/world/biome.js (biomeForNode, the LIVE biome
// the DM narrates) via the worldSpace.biomeAtWorld projection, so the painted
// country AGREES with arrival flavor and (later) species/travel reactions.
//
// All geometry is returned in WORLD UNITS (wu). The biome lattice math runs in
// node-units (where biomeForNode is defined) and is multiplied out to wu on the
// way out. Deterministic from the seed alone: makeRng(seedFromString(...)) and a
// seeded value-noise — no Math.random, nothing serialized, worldHash untouched.

import { seedFromString, makeRng } from '../../engine/rng.js';
import { NODE_WU, biomeAtWorld } from './worldSpace.js';

// ── tunables (node-units unless noted) ──────────────────────────────────────
const LAND_MARGIN = 6;    // rich biome band painted beyond the node cloud
const MIN_HALF = 18;      // minimum half-extent: even a tight cloud gets a full world
const COAST_GAP = 5;      // mean coast sits this far seaward of the cloud …
const BAY_AMP = 4.5;      // … and wobbles by this (Maine-style bays + peninsulas)
const OCEAN_DEPTH = 12;   // how far open water reaches past the coast
const HEATH_R = 6;        // the Blasted Heath's mean radius
const STAMP_STEP = 0.62;  // terrain-motif grid spacing (≈620 wu between clumps)
const WARP_AMP = 5.2;     // domain-warp on biome lookup → organic, non-blocky edges
const WARP_FREQ = 7;      // warp wavelength (node-units)

// ── seeded value noise (smooth, deterministic) ──────────────────────────────
// Integer-lattice corners hashed to [0,1), bilinearly blended with smoothstep.
// Inputs in node-units; `freq` is the wavelength in node-units.
function latticeRand(seed, ix, iy) {
  return (seedFromString(`${seed}|vn|${ix}|${iy}`) % 100000) / 100000;
}
function vnoise(seed, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = latticeRand(seed, xi, yi), b = latticeRand(seed, xi + 1, yi);
  const c = latticeRand(seed, xi, yi + 1), d = latticeRand(seed, xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v; // [0,1]
}
// Fractal sum — a couple octaves for natural, non-repetitive shapes.
function fbm(seed, x, y, freq = 6, oct = 3) {
  let sum = 0, amp = 0.5, f = 1 / freq, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(`${seed}|o${i}`, x * f, y * f);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm; // [0,1]
}

// ── node bounds (node-units) ────────────────────────────────────────────────
function nodeBounds(nodes) {
  const list = (Array.isArray(nodes) ? nodes : []).filter(n => n && Number.isFinite(+n.x) && Number.isFinite(+n.y));
  if (!list.length) return { minX: -2, minY: -2, maxX: 2, maxY: 2, cx: 0, cy: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of list) {
    minX = Math.min(minX, +n.x); maxX = Math.max(maxX, +n.x);
    minY = Math.min(minY, +n.y); maxY = Math.max(maxY, +n.y);
  }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

const wu = (n) => n * NODE_WU;

// Ocean edge geometry — which axis the coast runs along, and which way the sea lies.
const EDGES = {
  E: { axis: 'x', sign: +1, along: 'y' },
  W: { axis: 'x', sign: -1, along: 'y' },
  S: { axis: 'y', sign: +1, along: 'x' },
  N: { axis: 'y', sign: -1, along: 'x' }
};

/**
 * worldGeography(seed, nodes) — the whole illustrated world as data (wu):
 *   { rect, ocean, range, heath, rivers, lakes, nodeRectWu }
 * Pure + deterministic. The ocean never swallows a node (coast sits ≥ COAST_GAP
 * seaward of the cloud); the Heath sits beyond the cloud at a far corner.
 */
export function worldGeography(seed, nodes) {
  const nb = nodeBounds(nodes);
  // A land band around the cloud, widened to MIN_HALF so tight clouds still get
  // a full, biome-rich world to paint.
  let minX = Math.min(nb.minX - LAND_MARGIN, nb.cx - MIN_HALF);
  let maxX = Math.max(nb.maxX + LAND_MARGIN, nb.cx + MIN_HALF);
  let minY = Math.min(nb.minY - LAND_MARGIN, nb.cy - MIN_HALF);
  let maxY = Math.max(nb.maxY + LAND_MARGIN, nb.cy + MIN_HALF);

  const rng = makeRng(seedFromString(`${seed}|m6|geo`));

  // ── ocean on one seeded edge, beyond the node cloud ──
  const edgeKey = ['E', 'W', 'S', 'N'][rng.int(0, 3)];
  const E = EDGES[edgeKey];
  // mean coast: COAST_GAP + BAY_AMP seaward of the cloud, so the deepest bay
  // still clears the cloud by COAST_GAP.
  const coastBase = E.sign > 0
    ? (E.axis === 'x' ? nb.maxX : nb.maxY) + COAST_GAP + BAY_AMP
    : (E.axis === 'x' ? nb.minX : nb.minY) - COAST_GAP - BAY_AMP;
  if (E.axis === 'x') { if (E.sign > 0) maxX = coastBase + OCEAN_DEPTH; else minX = coastBase - OCEAN_DEPTH; }
  else { if (E.sign > 0) maxY = coastBase + OCEAN_DEPTH; else minY = coastBase - OCEAN_DEPTH; }

  // sample the ragged coastline along the full span of the `along` axis.
  const alongMin = E.along === 'x' ? minX : minY;
  const alongMax = E.along === 'x' ? maxX : maxY;
  const coast = []; const coastByAlong = [];
  const NC = 48;
  for (let i = 0; i <= NC; i++) {
    const t = alongMin + (alongMax - alongMin) * (i / NC);
    const lo = fbm(`${seed}|coastL`, t, 0, 11, 2) - 0.5;     // bays/headlands (low freq)
    const hi = fbm(`${seed}|coastH`, t, 0, 3, 2) - 0.5;       // ragged detail (high freq)
    const c = coastBase + E.sign * (lo * 2 * BAY_AMP * 0.72 + hi * 2 * BAY_AMP * 0.34);
    const pt = E.axis === 'x' ? [wu(c), wu(t)] : [wu(t), wu(c)];
    coast.push(pt);
    coastByAlong.push({ a: wu(t), c: wu(c) });
  }

  const ocean = { edge: edgeKey, axis: E.axis, sign: E.sign, along: E.along, coast, coastByAlong, coastBaseWu: wu(coastBase) };

  // offshore islands — placed seaward of the coast so they sit in open water.
  const islands = [];
  const nIsl = 2 + rng.int(0, 2);
  for (let i = 0; i < nIsl; i++) {
    const t = alongMin + (alongMax - alongMin) * (0.15 + 0.7 * rng.nextFloat());
    const coastC = coastBase + E.sign * (fbm(`${seed}|coastL`, t, 0, 11, 2) - 0.5) * 2 * BAY_AMP * 0.72;
    const out = 2 + rng.nextFloat() * (OCEAN_DEPTH - 4);
    const c = coastC + E.sign * out;
    const cx = E.axis === 'x' ? c : t;
    const cy = E.axis === 'x' ? t : c;
    const r = 1.1 + rng.nextFloat() * 1.9;
    islands.push({ cx: wu(cx), cy: wu(cy), r: wu(r), blob: blob(`${seed}|isl|${i}`, 11) });
  }
  ocean.islands = islands;

  // ── the mountain RANGE: a seeded ridge-spine, a backbone — not scattered cells ──
  const range = buildRange(seed, nb);

  // ── the Blasted Heath: a dead land far off, at a seeded corner beyond the cloud ──
  const heath = buildHeath(seed, nb, edgeKey);
  // grow the world rect to hold the Heath blob.
  for (const [hx, hy] of heath.poly) {
    minX = Math.min(minX, hx / NODE_WU); maxX = Math.max(maxX, hx / NODE_WU);
    minY = Math.min(minY, hy / NODE_WU); maxY = Math.max(maxY, hy / NODE_WU);
  }

  const rect = { minX: wu(minX), minY: wu(minY), maxX: wu(maxX), maxY: wu(maxY) };
  const geo = {
    rect, ocean, range, heath,
    nodeRectWu: { minX: wu(nb.minX), minY: wu(nb.minY), maxX: wu(nb.maxX), maxY: wu(nb.maxY) },
    rivers: [], lakes: []
  };

  // rivers trace high→sea: from points along the range toward the coast.
  geo.rivers = buildRivers(seed, range, geo);
  // lakes & ponds, pocketed by biome (wet biomes get more).
  geo.lakes = buildLakes(seed, nb, geo);

  return geo;
}

// A wobbled unit blob: `n` radii in [0.62,1] around the circle (organic, never a clean ellipse).
function blob(seed, n = 12) {
  const r = makeRng(seedFromString(`${seed}|blob`));
  const out = [];
  for (let i = 0; i < n; i++) out.push(0.62 + r.nextFloat() * 0.38);
  return out;
}

function buildRange(seed, nb) {
  const rng = makeRng(seedFromString(`${seed}|range`));
  const halfX = Math.max(MIN_HALF, (nb.maxX - nb.minX) / 2 + LAND_MARGIN);
  const halfY = Math.max(MIN_HALF, (nb.maxY - nb.minY) / 2 + LAND_MARGIN);
  // midpoint offset to one side of the cloud, so the range reads as a flanking
  // backbone rather than a scribble through the towns.
  const off = 0.42 + rng.nextFloat() * 0.22;
  const oa = rng.nextFloat() * Math.PI * 2;
  const mid = { x: nb.cx + Math.cos(oa) * halfX * off, y: nb.cy + Math.sin(oa) * halfY * off };
  // spine runs roughly perpendicular to the offset, arcing gently.
  const dir = oa + Math.PI / 2 + (rng.nextFloat() - 0.5) * 0.5;
  const len = (Math.max(halfX, halfY)) * (1.4 + rng.nextFloat() * 0.5);
  const bow = (rng.nextFloat() - 0.5) * 0.5;
  const spine = []; const NS = 7;
  for (let i = 0; i <= NS; i++) {
    const s = (i / NS - 0.5);                         // -0.5..0.5
    const px = mid.x + Math.cos(dir) * len * s - Math.sin(dir) * len * bow * (0.25 - s * s);
    const py = mid.y + Math.sin(dir) * len * s + Math.cos(dir) * len * bow * (0.25 - s * s);
    spine.push([wu(px), wu(py)]);
  }
  // peaks fill a BAND along the spine — overlapping summits spread perpendicular
  // to the ridge so it reads as a mountain range with breadth (foothills + crest),
  // not a single file of firs. Many small peaks, tallest mid-range, none giant.
  const peaks = [];
  const NP = 40;
  const perpX = -Math.sin(dir), perpY = Math.cos(dir);
  for (let i = 0; i <= NP; i++) {
    const s = i / NP;                                  // 0..1
    const seg = s * NS; const k = Math.min(NS - 1, Math.floor(seg)); const f = seg - k;
    const ax = spine[k][0] + (spine[k + 1][0] - spine[k][0]) * f;
    const ay = spine[k][1] + (spine[k + 1][1] - spine[k][1]) * f;
    const taper = Math.sin(s * Math.PI);               // 0 at ends, 1 mid
    const rows = 1 + (rng.nextFloat() < 0.72 ? 1 : 0); // 1–2 peaks across → a band
    for (let r = 0; r < rows; r++) {
      const perp = (rng.nextFloat() - 0.5) * 2 * wu(1.8);   // ±1.8 nu band width
      const along = (rng.nextFloat() - 0.5) * wu(0.55);
      const px = ax + perpX * perp + Math.cos(dir) * along;
      const py = ay + perpY * perp + Math.sin(dir) * along;
      const size = wu(0.4 + taper * 0.82 + rng.nextFloat() * 0.3) * (r === 0 ? 1 : 0.82);
      peaks.push({ x: px, y: py, r: size, snow: taper > 0.5 && r === 0 });
    }
  }
  return { spine, peaks };
}

function buildHeath(seed, nb, oceanEdge) {
  const rng = makeRng(seedFromString(`${seed}|heath`));
  // a far corner, biased AWAY from the ocean edge so the dead land reads as its
  // own distant country (the sea between you and it, where it sits across one).
  const corners = [
    { x: +1, y: +1 }, { x: -1, y: +1 }, { x: +1, y: -1 }, { x: -1, y: -1 }
  ];
  const away = { E: { x: -1 }, W: { x: +1 }, S: { y: -1 }, N: { y: +1 } }[oceanEdge] || {};
  const pick = corners.filter(c => (away.x ? c.x === away.x : true) && (away.y ? c.y === away.y : true));
  const corner = (pick.length ? pick : corners)[rng.int(0, (pick.length ? pick.length : corners.length) - 1)];
  const halfX = (nb.maxX - nb.minX) / 2 + LAND_MARGIN;
  const halfY = (nb.maxY - nb.minY) / 2 + LAND_MARGIN;
  const cx = nb.cx + corner.x * (halfX + HEATH_R + 1.5);
  const cy = nb.cy + corner.y * (halfY + HEATH_R + 1.5);
  // an irregular cracked polygon.
  const poly = []; const N = 16;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rr = HEATH_R * (0.66 + fbm(`${seed}|heathR`, Math.cos(a) * 2, Math.sin(a) * 2, 2.2, 2) * 0.7);
    poly.push([wu(cx + Math.cos(a) * rr), wu(cy + Math.sin(a) * rr * 0.9)]);
  }
  // a few cracks across the dead ground.
  const cracks = [];
  for (let i = 0; i < 5; i++) {
    const a = rng.nextFloat() * Math.PI * 2;
    const pts = [];
    let x = cx + (rng.nextFloat() - 0.5) * HEATH_R, y = cy + (rng.nextFloat() - 0.5) * HEATH_R;
    let ang = a;
    for (let k = 0; k < 5; k++) {
      pts.push([wu(x), wu(y)]);
      ang += (rng.nextFloat() - 0.5) * 1.1;
      x += Math.cos(ang) * (HEATH_R * 0.32); y += Math.sin(ang) * (HEATH_R * 0.32);
    }
    cracks.push(pts);
  }
  return { cx: wu(cx), cy: wu(cy), r: wu(HEATH_R), poly, cracks };
}

function buildRivers(seed, range, geo) {
  const rng = makeRng(seedFromString(`${seed}|rivers`));
  const rivers = [];
  const n = 2;
  for (let i = 0; i < n; i++) {
    // source: a point along the range (high ground).
    const src = range.peaks[Math.floor((0.2 + 0.6 * rng.nextFloat()) * range.peaks.length)] || range.peaks[0];
    if (!src) break;
    let x = src.x, y = src.y;
    // head toward the coast: the ocean normal direction.
    let dx = geo.ocean.axis === 'x' ? geo.ocean.sign : 0;
    let dy = geo.ocean.axis === 'y' ? geo.ocean.sign : 0;
    const pts = [[x, y]];
    const stepWu = NODE_WU * 0.9;
    for (let k = 0; k < 60; k++) {
      const m = (fbm(`${seed}|riv${i}`, x / NODE_WU, y / NODE_WU, 5, 2) - 0.5) * 1.4; // meander
      // rotate the heading slightly by the meander, perpendicular to flow.
      const px = -dy, py = dx;
      x += dx * stepWu + px * m * stepWu;
      y += dy * stepWu + py * m * stepWu;
      pts.push([x, y]);
      if (inOcean(geo, x, y)) break;
      if (x < geo.rect.minX || x > geo.rect.maxX || y < geo.rect.minY || y > geo.rect.maxY) break;
    }
    if (pts.length > 2) rivers.push(pts);
  }
  return rivers;
}

const WETNESS = { marsh: 0.85, coastal: 0.6, forest: 0.5, plains: 0.22, wilderness: 0.16, mountains: 0.18, desert: 0.05, arctic: 0.1 };
function buildLakes(seed, nb, geo) {
  const rng = makeRng(seedFromString(`${seed}|lakes`));
  const lakes = [];
  const cand = 18;
  const halfX = Math.max(MIN_HALF, (nb.maxX - nb.minX) / 2 + LAND_MARGIN);
  const halfY = Math.max(MIN_HALF, (nb.maxY - nb.minY) / 2 + LAND_MARGIN);
  for (let i = 0; i < cand; i++) {
    const nx = nb.cx + (rng.nextFloat() - 0.5) * 2 * halfX;
    const ny = nb.cy + (rng.nextFloat() - 0.5) * 2 * halfY;
    const x = wu(nx), y = wu(ny);
    if (inOcean(geo, x, y) || inHeath(geo, x, y)) continue;
    const biome = biomeAtWorld(seed, x, y);
    if (rng.nextFloat() > (WETNESS[biome] ?? 0.15)) continue;
    const big = rng.nextFloat() < 0.4;
    const r = wu(big ? 1.6 + rng.nextFloat() * 2.2 : 0.5 + rng.nextFloat() * 0.7);
    lakes.push({ cx: x, cy: y, rx: r, ry: r * (0.62 + rng.nextFloat() * 0.3), blob: blob(`${seed}|lake|${i}`, 14) });
  }
  return lakes;
}

/** Is a wu point in open water (seaward of the ragged coast)? */
export function inOcean(geo, wx, wy) {
  const o = geo?.ocean; if (!o) return false;
  const a = o.along === 'x' ? wx : wy;       // position along the coast
  const nrm = o.axis === 'x' ? wx : wy;      // position across it
  const arr = o.coastByAlong;
  // interpolate the coast coord at this `along`.
  let c = arr[0].c;
  if (a <= arr[0].a) c = arr[0].c;
  else if (a >= arr[arr.length - 1].a) c = arr[arr.length - 1].c;
  else {
    for (let i = 1; i < arr.length; i++) {
      if (a <= arr[i].a) {
        const f = (a - arr[i - 1].a) / (arr[i].a - arr[i - 1].a || 1);
        c = arr[i - 1].c + (arr[i].c - arr[i - 1].c) * f;
        break;
      }
    }
  }
  return o.sign > 0 ? nrm > c : nrm < c;
}

/** Is a wu point inside the Blasted Heath polygon? (ray cast) */
export function inHeath(geo, wx, wy) {
  const poly = geo?.heath?.poly; if (!poly || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    const hit = (yi > wy) !== (yj > wy) && wx < ((xj - xi) * (wy - yi)) / (yj - yi || 1e-9) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

// ── terrain stamps: biome-classified motif clumps over the whole land area ───
// Each stamp is drawable DATA — a position, the biome there, and a set of
// normalized motif points; oneMap inks them per biome. Domain-warped biome
// lookup gives organic, interlocking country (no blocky cell edges, no lollipops).
const STAMP_COUNT = {
  forest: [5, 9], marsh: [4, 6], desert: [2, 4], mountains: [1, 3],
  arctic: [3, 6], plains: [1, 3], coastal: [2, 4], wilderness: [1, 3]
};
export function terrainStamps(seed, geo) {
  const stamps = [];
  const { minX, minY, maxX, maxY } = geo.rect;
  const stepWu = STAMP_STEP * NODE_WU;
  let gi = 0;
  for (let gx = minX; gx <= maxX; gx += stepWu) {
    for (let gy = minY; gy <= maxY; gy += stepWu, gi++) {
      const sr = makeRng(seedFromString(`${seed}|stamp|${Math.round(gx)}|${Math.round(gy)}`));
      // jitter off the grid so the field never reads as rows.
      const jx = (sr.nextFloat() - 0.5) * stepWu * 0.9;
      const jy = (sr.nextFloat() - 0.5) * stepWu * 0.9;
      const wx = gx + jx, wy = gy + jy;
      if (inOcean(geo, wx, wy) || inHeath(geo, wx, wy)) continue;
      // domain warp: nudge the lookup so the cell boundaries wobble organically.
      const warpX = (vnoise(`${seed}|wx`, wx / NODE_WU / WARP_FREQ, wy / NODE_WU / WARP_FREQ) - 0.5) * 2 * WARP_AMP * NODE_WU;
      const warpY = (vnoise(`${seed}|wy`, wx / NODE_WU / WARP_FREQ, wy / NODE_WU / WARP_FREQ) - 0.5) * 2 * WARP_AMP * NODE_WU;
      const biome = biomeAtWorld(seed, wx + warpX, wy + warpY);
      const [lo, hi] = STAMP_COUNT[biome] || [1, 2];
      const count = lo + sr.int(0, hi - lo);
      const r = stepWu * (0.55 + sr.nextFloat() * 0.3);
      // forest sub-region: a low-freq field paints conifer groves vs deciduous.
      const coniferBias = vnoise(`${seed}|conifer`, wx / NODE_WU / 9, wy / NODE_WU / 9);
      const pts = [];
      for (let m = 0; m < count; m++) {
        const a = sr.nextFloat() * Math.PI * 2, rad = Math.sqrt(sr.nextFloat());
        const ox = Math.cos(a) * rad, oy = Math.sin(a) * rad * 0.82;
        const s = 0.5 + sr.nextFloat() * 0.6;
        // 4th slot: forest → conifer flag (0/1); others → an angle aux in [0,1).
        const aux = biome === 'forest' ? (sr.nextFloat() < coniferBias ? 1 : 0) : sr.nextFloat();
        pts.push([ox, oy, s, aux]);
      }
      stamps.push({ wx, wy, r, biome, pts });
    }
  }
  return stamps;
}
