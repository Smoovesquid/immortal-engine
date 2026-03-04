
// Deterministic layout derived from map graph; no randomness/time.
// Produces stable 2D positions for nodes (SVG).
import { hash32 } from './hash.js';

export function buildGraph(map) {
  const nodes = Array.isArray(map?.nodes) ? map.nodes : [];
  const edges = Array.isArray(map?.edges) ? map.edges : [];
  const byId = new Map(nodes.map(n => [String(n.id), n]));
  const adj = new Map();
  for (const n of nodes) adj.set(String(n.id), []);
  for (const e of edges) {
    const a = String(e?.a ?? '');
    const b = String(e?.b ?? '');
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    if (a && b) {
      adj.get(a).push(b);
      adj.get(b).push(a);
    }
  }
  // stable ordering
  for (const [k, v] of adj.entries()) v.sort((x,y) => x.localeCompare(y));
  return { nodes, byId, adj };
}

export function bfsOrder(adj, startId) {
  const start = String(startId ?? '');
  const q = [];
  const seen = new Set();
  const order = [];
  if (start && adj.has(start)) { q.push(start); seen.add(start); }
  while (q.length) {
    const cur = q.shift();
    order.push(cur);
    const ns = adj.get(cur) || [];
    for (const nxt of ns) {
      if (seen.has(nxt)) continue;
      seen.add(nxt);
      q.push(nxt);
    }
  }
  // include any disconnected nodes deterministically
  const rest = [...adj.keys()].filter(id => !seen.has(id)).sort((a,b) => a.localeCompare(b));
  return order.concat(rest);
}

// Simple ring layout: center = current node, rings by BFS distance.
export function ringLayout(map) {
  const { nodes, byId, adj } = buildGraph(map);
  const hereId = String(map?.currentNodeId ?? '');
  const order = bfsOrder(adj, hereId);

  // Compute BFS distances from here
  const dist = new Map();
  if (hereId && adj.has(hereId)) {
    const q = [hereId];
    dist.set(hereId, 0);
    while (q.length) {
      const cur = q.shift();
      const d = dist.get(cur);
      for (const nxt of (adj.get(cur) || [])) {
        if (dist.has(nxt)) continue;
        dist.set(nxt, d + 1);
        q.push(nxt);
      }
    }
  }

  // Bucket by ring
  const rings = new Map(); // ring -> ids
  for (const id of order) {
    const r = dist.has(id) ? dist.get(id) : 999;
    if (!rings.has(r)) rings.set(r, []);
    rings.get(r).push(id);
  }
  const ringKeys = [...rings.keys()].sort((a,b) => a - b);

  const pos = new Map();
  // center
  if (hereId) pos.set(hereId, { x: 0, y: 0 });

  for (const r of ringKeys) {
    if (r === 0) continue;
    const ids = rings.get(r) || [];
    const n = Math.max(1, ids.length);
    const radius = (r === 999 ? (ringKeys.length + 1) : r) * 90;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const a = (i / n) * Math.PI * 2;
      // tiny deterministic jitter from id to reduce overlaps (still deterministic)
      const j = (hash32(id) % 13) - 6;
      const rr = radius + j * 2;
      pos.set(id, { x: Math.cos(a) * rr, y: Math.sin(a) * rr });
    }
  }

  // Fallback: if no hereId, lay out by hash angle
  if (!hereId) {
    for (const id of order) {
      const a = (hash32(id) % 360) * (Math.PI / 180);
      const r = 200 + ((hash32(id + ':r') % 200));
      pos.set(id, { x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
  }

  return { nodes, byId, adj, pos, hereId };
}
