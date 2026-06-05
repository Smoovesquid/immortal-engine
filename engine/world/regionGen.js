/**
 * Region geography — the coherent world the places and ecology live on.
 *
 * Deterministic from a seed: a value-noise elevation + moisture field decides
 * biomes; water flows downhill (D8 flow accumulation) into streams and rivers;
 * settlements sit on habitable land with a GEOGRAPHIC tier (safe near home,
 * deadly at the edges); roads route least-cost across the terrain and throw a
 * bridge wherever they cross a river. The same biome map feeds the living
 * ecology, so each region runs its own food web.
 *
 * PURE + DETERMINISTIC (hashed lattice noise; rng only for settlement scatter).
 */

import { makeRng, seedFromString } from '../rng.js';

const h01 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const lerp = (a, b, t) => a + (b - a) * t, smooth = t => t * t * (3 - 2 * t);

function noise(seed, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
  const c = (a, b) => h01(`${seed}|${a}|${b}`);
  return lerp(lerp(c(xi, yi), c(xi + 1, yi), xf), lerp(c(xi, yi + 1), c(xi + 1, yi + 1), xf), yf);
}
function field(seed, W, H, octaves) {
  const g = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0, amp = 1, freq = 1 / 12, max = 0;
    for (let o = 0; o < octaves; o++) { v += amp * noise(seed + ':' + o, x * freq, y * freq); max += amp; amp *= 0.5; freq *= 2; }
    g[y * W + x] = v / max;
  }
  return g;
}

const SEA = 0.30;
function biomeFor(e, m) {
  if (e < SEA) return 'water';
  if (e > 0.80) return 'mountains';
  if (e > 0.66) return m > 0.5 ? 'forest' : 'mountains';
  if (m > 0.62) return e < 0.42 ? 'marsh' : 'forest';
  if (m < 0.30) return 'desert';
  return 'plains';
}

const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function flowAccum(elev, W, H) {
  const down = new Int32Array(W * H).fill(-1), acc = new Float32Array(W * H).fill(1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (elev[i] < SEA) continue;
    let lo = elev[i], li = -1;
    for (const [dx, dy] of N8) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const ni = ny * W + nx; if (elev[ni] < lo) { lo = elev[ni]; li = ni; } }
    down[i] = li;
  }
  const order = [...Array(W * H).keys()].filter(i => elev[i] >= SEA).sort((a, b) => elev[b] - elev[a]);
  for (const i of order) if (down[i] >= 0) acc[down[i]] += acc[i];
  return { down, acc };
}

function placeSettlements(seed, elev, moist, W, H, count) {
  const rng = makeRng(seedFromString(seed + '|places'));
  const out = [], minD = Math.max(4, Math.floor(Math.min(W, H) / (count + 1)));
  let tries = 0;
  while (out.length < count && tries++ < count * 200) {
    const x = rng.int(2, W - 3), y = rng.int(2, H - 3), i = y * W + x, e = elev[i];
    if (e < SEA + 0.04 || e > 0.74) continue; // not in water or on peaks
    if (out.some(p => Math.abs(p.x - x) + Math.abs(p.y - y) < minD)) continue;
    out.push({ x, y, e, m: moist[i] });
  }
  // home = closest to centre
  const cx = W / 2, cy = H / 2;
  let home = 0, hd = Infinity;
  out.forEach((p, idx) => { const d = Math.hypot(p.x - cx, p.y - cy); if (d < hd) { hd = d; home = idx; } });
  const H0 = out[home];
  const maxd = Math.max(1, ...out.map(p => Math.hypot(p.x - H0.x, p.y - H0.y)));
  const biomeNode = (b) => ({ forest: 'hamlet', plains: 'town', marsh: 'wild', mountains: 'keep', desert: 'ruin' }[b] || 'hamlet');
  return out.map((p, idx) => {
    const b = biomeFor(p.e, p.m);
    const d = Math.hypot(p.x - H0.x, p.y - H0.y);
    return { id: 'r' + idx, x: p.x, y: p.y, biome: b, nodeType: idx === home ? 'hamlet' : biomeNode(b), home: idx === home, tier: Math.max(1, Math.min(4, 1 + Math.floor(d / maxd * 3.999))) };
  });
}

function routeRoads(places, elev, biome, W, H, riverSet) {
  const costOf = i => { if (riverSet.has(i) && biome[i] !== 'water') return 7; const b = biome[i]; if (b === 'water') return 28; if (b === 'mountains') return 9; if (b === 'marsh') return 4; if (b === 'forest') return 2; if (b === 'desert') return 2.5; return 1; };
  const isCrossing = i => riverSet.has(i) || biome[i] === 'water';
  function dijkstra(s, t) {
    const dist = new Float32Array(W * H).fill(Infinity), prev = new Int32Array(W * H).fill(-1);
    dist[s] = 0; const pq = [[0, s]];
    while (pq.length) {
      let mi = 0; for (let k = 1; k < pq.length; k++) if (pq[k][0] < pq[mi][0]) mi = k;
      const [d, i] = pq.splice(mi, 1)[0]; if (i === t) break; if (d > dist[i]) continue;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of N8) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const ni = ny * W + nx; const w = costOf(ni) + Math.abs(elev[ni] - elev[i]) * 12 + (dx && dy ? 0.4 : 0); if (dist[i] + w < dist[ni]) { dist[ni] = dist[i] + w; prev[ni] = i; pq.push([dist[ni], ni]); } }
    }
    const path = []; let c = t; while (c >= 0) { path.push([c % W, (c / W) | 0]); c = prev[c]; } return path.reverse();
  }
  // spanning tree: connect each place to the nearest already-connected
  const roads = [], bridges = [], connected = [0];
  for (let k = 1; k < places.length; k++) {
    let best = connected[0], bd = Infinity;
    for (const c of connected) { const d = Math.hypot(places[k].x - places[c].x, places[k].y - places[c].y); if (d < bd) { bd = d; best = c; } }
    const path = dijkstra(places[k].y * W + places[k].x, places[best].y * W + places[best].x);
    roads.push({ pts: path });
    for (const [x, y] of path) if (isCrossing(y * W + x)) bridges.push({ x, y });
    connected.push(k);
  }
  return { roads, bridges };
}

export function generateRegion({ seed = 'region', W = 48, H = 32, places = 7, riverThreshold = 32 } = {}) {
  const elev = field(seed + '|elev', W, H, 4), moist = field(seed + '|moist', W, H, 3);
  const biome = new Array(W * H);
  for (let i = 0; i < W * H; i++) biome[i] = biomeFor(elev[i], moist[i]);
  const { down, acc } = flowAccum(elev, W, H);
  const riverSet = new Set();
  for (let i = 0; i < W * H; i++) if (elev[i] >= SEA && acc[i] > riverThreshold) { riverSet.add(i); biome[i] = biome[i] === 'water' ? 'water' : biome[i]; }
  // river segments from down-links among river cells
  const riverSegs = [];
  for (const i of riverSet) { const di = down[i]; if (di >= 0 && (riverSet.has(di) || elev[di] < SEA)) riverSegs.push([i % W, (i / W) | 0, di % W, (di / W) | 0]); }
  const placesArr = placeSettlements(seed, elev, moist, W, H, places);
  const { roads, bridges } = routeRoads(placesArr, elev, biome, W, H, riverSet);
  return { seed, W, H, SEA, elev, moist, biome, riverSet, riverSegs, places: placesArr, roads, bridges };
}

export function biomeAt(region, x, y) {
  if (x < 0 || y < 0 || x >= region.W || y >= region.H) return 'water';
  return region.biome[y * region.W + x];
}
