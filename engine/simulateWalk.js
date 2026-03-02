import { generateInitialMap } from './map/generateMap.js';
import { computeWalkMetrics } from './metrics/walkMetrics.js';
import { makeRng, seedFromString } from './rng.js';

function buildAdjacency(map) {
  const adj = new Map();
  const edges = Array.isArray(map?.edges) ? map.edges : [];

  for (const e of edges) {
    const a = String(e?.a || '');
    const b = String(e?.b || '');
    if (!a || !b) continue;

    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b);
    adj.get(b).push(a);
  }

  // Stable order (and de-dupe) per node.
  for (const [k, arr] of adj.entries()) {
    const seen = new Set();
    const out = [];
    for (const x of arr) {
      const s = String(x || '').trim();
      if (!s) continue;
      if (seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
    out.sort();
    adj.set(k, out);
  }

  return adj;
}

export function simulateWalk({ seed = 'walk', steps = 5000 } = {}) {
  const map = generateInitialMap({ seed, nodeCountOverride: 200 });
  const adj = buildAdjacency(map);

  const history = [];
  let current = String(map.currentNodeId || '');
  let prev = '';

  for (let i = 0; i < steps; i++) {
    history.push({ nodeId: current });

    const nbs0 = adj.get(current) || [];
    if (!nbs0.length) break;

    // Avoid immediate backtrack if we have alternatives.
    const nbs = (prev && nbs0.length > 1) ? nbs0.filter(x => x !== prev) : nbs0;
    const pool = nbs.length ? nbs : nbs0;

    const rng = makeRng(seedFromString(`${seed}|walk|${i}|${current}|${prev}`));
    const next = rng.pick(pool) || pool[0];

    prev = current;
    current = String(next || current);
  }

  const metrics = computeWalkMetrics(history);
  return { metrics };
}
