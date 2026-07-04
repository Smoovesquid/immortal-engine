// ROADS-1 — the ONE road network (docs/briefs/ROADS-1-one-road-truth.md).
//
// Before this, the map drew two disconnected road systems: a LOCAL lane inside
// each village (placeFromNode.js, place-units) and a SEPARATE node-to-node dashed
// track between towns (oneMap.js roadMeanderPts, its own wiggle). They never met —
// so roads "dead-ended at the town line."
//
// This module derives ONE world-unit road network from the map graph: for every
// edge, a single seeded meandering polyline whose SETTLEMENT terminals ARE that
// settlement's own local lane endpoints (projected place-unit → wu). The lane
// through a village and the road to the next town are now the SAME line, drawn
// continuously at every zoom band from this one geometry.
//
// Pure + deterministic: seeded by edge ids (keyed hash / seeded rng only — no
// Math.random), read-only over engine state, never serialized, never hashed. The
// camera (oneMap.js) styles it per band (dashed track far out, ribbon up close);
// the GEOMETRY here never varies by zoom.

import { seedFromString } from '../../engine/rng.js';
import { nodeToWu, placeFrame, placeUnitToWu, PLACE_WU } from './worldSpace.js';
import { placeFromWorldNode } from './placeFromNode.js';
import { exitsFrom, ensureMap } from '../../engine/map/mapState.js';

// A settlement's local lane endpoints, in WORLD UNITS. The lane (place.terrain
// paths[0]) runs west→east; the exit spurs (paths[1..]) leave toward N/S. We read
// each path's terminal, decide which compass end it is from its own geometry, and
// project it through the place frame — so these points sit EXACTLY on the drawn
// lane (same placeUnitToWu the layout uses), giving the network a seamless join.
//   returns { west, east, north, south } — each {x,y} in wu, or null if absent.
export function laneEndpointsWu(world, node, place, frame) {
  const paths = place?.terrain?.paths || [];
  const out = { west: null, east: null, north: null, south: null };
  if (!paths.length) return out;
  const proj = (ux, uy) => { const p = placeUnitToWu(node, frame, ux, uy); return { x: p.x, y: p.y }; };

  // The spine (paths[0]) — its endpoints are the west (min-x) and east (max-x) ends.
  const spine = paths[0]?.pts || [];
  if (spine.length >= 2) {
    const a = spine[0], b = spine[spine.length - 1];
    const west = a[0] <= b[0] ? a : b;
    const east = a[0] <= b[0] ? b : a;
    out.west = proj(west[0], west[1]);
    out.east = proj(east[0], east[1]);
  }
  // Spurs (paths[1..]) leave the lane toward a cardinal — classify each by its far
  // endpoint relative to its start: mostly-vertical → north (smaller y) / south.
  for (let i = 1; i < paths.length; i++) {
    const pts = paths[i]?.pts || [];
    if (pts.length < 2) continue;
    const s = pts[0], e = pts[pts.length - 1];
    const dx = e[0] - s[0], dy = e[1] - s[1];
    if (Math.abs(dy) >= Math.abs(dx)) {
      if (dy < 0) out.north = proj(e[0], e[1]);
      else out.south = proj(e[0], e[1]);
    } else {
      if (dx < 0 && !out.west) out.west = proj(e[0], e[1]);
      else if (dx > 0 && !out.east) out.east = proj(e[0], e[1]);
    }
  }
  return out;
}

// The wu terminal of an edge AT a given node, toward a given neighbor. For a
// settlement we attach to the lane endpoint facing that neighbor (by the exit
// compass), so the road joins the drawn lane with no seam; if that specific end
// is missing we fall back through the other lane ends, then the node center. For
// a non-settlement node the terminal is simply the node center (nodeToWu).
function terminalWu(world, node, place, frame, neighborId) {
  const c = nodeToWu(node);
  if (!place || !frame) return { x: c.x, y: c.y, joinsLane: false };
  const ends = laneEndpointsWu(world, node, place, frame);
  const exits = exitsFrom(ensureMap(world && world.map), node.id);
  const dirForNeighbor = ['west', 'east', 'north', 'south'].find(d => String(exits[d] || '') === String(neighborId));
  const order = [];
  if (dirForNeighbor) order.push(dirForNeighbor);
  // Prefer the facing end; then any end that exists (deterministic W,E,N,S order).
  for (const d of ['west', 'east', 'north', 'south']) if (!order.includes(d)) order.push(d);
  for (const d of order) if (ends[d]) return { ...ends[d], joinsLane: true };
  return { x: c.x, y: c.y, joinsLane: false };
}

// A seeded meandering polyline between two wu points, keyed by the edge id so it
// is identical every render. Same wander character as the old node-to-node track,
// but computed ONCE in world units (not per-zoom px) and pinned to real lane
// terminals. Endpoints are exact (env=0 at both ends) so the join never gaps.
function meanderWu(key, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;                     // perpendicular unit
  const N = Math.max(6, Math.min(28, Math.round(len / 60)));
  const amp = Math.min(len * 0.14, 140);                   // wander, capped (wu)
  const A = 5;
  const anchor = [];
  for (let i = 0; i <= A; i++) anchor.push(((seedFromString(`${key}|rd|${i}`) % 2000) / 2000 - 0.5) * 2);
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const env = Math.sin(Math.PI * t);                     // 0 at both terminals, max mid-route
    const k = t * A, k0 = Math.floor(k), f = k - k0;
    const lo = anchor[k0] ?? 0, hi = anchor[k0 + 1] ?? lo, sm = f * f * (3 - 2 * f);
    const low = lo * (1 - sm) + hi * sm;
    const high = ((seedFromString(`${key}|h|${i}`) % 1000) / 1000 - 0.5) * 0.4;
    const off = (low + high) * amp * env;
    pts.push([ax + dx * t + nx * off, ay + dy * t + ny * off]);
  }
  // Force exact terminals (kill any float drift from the env≈0 ends).
  pts[0] = [ax, ay];
  pts[pts.length - 1] = [bx, by];
  return pts;
}

/**
 * roadNetwork(world) -> { segments, byNode }
 *   segments: [{ a, b, key, aKnown, bKnown, pts:[[wx,wy],...], aJoinsLane, bJoinsLane }]
 *     ONE polyline per map edge in world units. `pts` runs terminal-a → terminal-b,
 *     each terminal on that node's lane endpoint (settlement) or node center.
 *   byNode: Map(nodeId -> { place, frame, ends }) — the per-settlement lane
 *     embedding (cached) so callers can prove the join (lane endpoint ∈ segment).
 *
 * Deterministic + pure; `place`/`frame` come from placeFromWorldNode (read-only).
 */
export function roadNetwork(world) {
  const map = world?.map || {};
  const nodes = Array.isArray(map.nodes) ? map.nodes : [];
  const edges = Array.isArray(map.edges) ? map.edges : [];
  const byId = new Map(nodes.map(n => [String(n.id), n]));
  const discovered = new Set((Array.isArray(map.discovered) ? map.discovered : []).map(String));
  const here = String(map.currentNodeId || '');
  if (here) discovered.add(here);

  // Per-node lane embedding, computed once (settlements only; others node-center).
  const byNode = new Map();
  const embed = (node) => {
    const id = String(node.id);
    if (byNode.has(id)) return byNode.get(id);
    let entry = { place: null, frame: null, ends: null };
    if (node.settlement) {
      try {
        const place = placeFromWorldNode(world, id);
        if (place && Array.isArray(place.buildings) && place.buildings.length) {
          const frame = placeFrame(place);
          entry = { place, frame, ends: laneEndpointsWu(world, node, place, frame) };
        }
      } catch { /* keep node-center fallback */ }
    }
    byNode.set(id, entry);
    return entry;
  };

  const segments = [];
  for (const e of edges) {
    const a = byId.get(String(e.a)), b = byId.get(String(e.b));
    if (!a || !b) continue;
    const ea = embed(a), eb = embed(b);
    const ta = terminalWu(world, a, ea.place, ea.frame, b.id);
    const tb = terminalWu(world, b, eb.place, eb.frame, a.id);
    const key = String(a.id) < String(b.id) ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
    segments.push({
      a: String(a.id), b: String(b.id), key,
      aKnown: discovered.has(String(a.id)), bKnown: discovered.has(String(b.id)),
      aJoinsLane: ta.joinsLane, bJoinsLane: tb.joinsLane,
      pts: meanderWu(key, ta.x, ta.y, tb.x, tb.y)
    });
  }
  return { segments, byNode };
}
