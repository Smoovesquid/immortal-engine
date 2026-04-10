import { assertMapStructure } from './mapState.js';
import { seedFromString, makeRng } from '../rng.js';
import { classifyNodeType } from './nodeType.js';

// Living Terrain Engine v1 — deterministic narrative map graph.

export function generateInitialMap({ seed = 'seed', packId = 'fantasy', pack = {}, nodeCountOverride = null } = {}) {
  const rng = makeRng(seedFromString(`${seed}|map|${packId}`));

  const names = Array.isArray(pack.locations) ? pack.locations.map(String).filter(Boolean) : [];
  const fallback = ['Roadside', 'Ruined Tower', 'Dry Creek', 'Old Shrine', 'Sooted Bridge', 'Salt Flats', 'Black Orchard', 'Hollow Chapel'];
  // Settlement-keyword names injected so at least some nodes classify as settlements.
  const settlementNames = ['Trader\'s Camp', 'Riverside Inn', 'Wayfarers\' Outpost'];
  const pool = (names.length ? names : fallback).slice();
  // Ensure settlement names are in the pool so the classifier can assign nodeType 'settlement'.
  for (const sn of settlementNames) {
    if (!pool.some(n => String(n).toLowerCase() === sn.toLowerCase())) pool.push(sn);
  }

  const nodeCountBase = 12 + (seedFromString(`${seed}|mapN|${packId}`) % 10);
  const nodeCount = clampInt((nodeCountOverride == null ? nodeCountBase : Number(nodeCountOverride)), 12, 200);

  const nodes = [];
  const used = new Set();
  for (let i = 0; i < nodeCount; i++) {
    const base = pool.length ? (pool[(i * 7) % pool.length] || rng.pick(pool)) : `Place ${i + 1}`;
    const name = uniquify(String(base || `Place ${i + 1}`), used);
    used.add(name);

    const id = `n${i}_${seedFromString(`${seed}|${packId}|${name}`)}`;
    const nodeType = classifyNodeType({ seed, nodeId: id, name });
    nodes.push({
      id,
      name,
      nodeType,
      tags: [],
      motifs: [],
      scars: []
    });
  }

  // Edges: ring + deterministic chords (keeps it navigable).
  const edges = [];
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i].id;
    const b = nodes[(i + 1) % nodes.length].id;
    edges.push({ a, b, kind: 'path' });
  }

  const chordCount = clampInt(Math.floor(nodes.length / 10), 3, 25);
  for (let j = 0; j < chordCount; j++) {
    const i = (j * 3 + 2) % nodes.length;
    const k = (i + 4 + (j % 3)) % nodes.length;
    const a = nodes[i].id;
    const b = nodes[k].id;
    if (!hasEdge(edges, a, b)) edges.push({ a, b, kind: (j % 2) ? 'road' : 'tunnel' });
  }

  // Guarantee at least 2 settlement nodes. If the keyword classifier didn't produce
  // enough, forcibly reclassify the 2nd and 3rd nodes (index 1,2) as settlements
  // so NPC genesis can trigger on arrival.
  const settlementCount = nodes.filter(n => n.nodeType === 'settlement').length;
  if (settlementCount < 2) {
    const need = 2 - settlementCount;
    let patched = 0;
    for (let i = 1; i < nodes.length && patched < need; i++) {
      if (nodes[i].nodeType !== 'settlement') {
        nodes[i] = { ...nodes[i], nodeType: 'settlement' };
        patched++;
      }
    }
  }

  const startNodeId = nodes[0]?.id || '';

  const map = {
    nodes,
    edges,
    discovered: startNodeId ? [startNodeId] : [],
    currentNodeId: startNodeId
  };

  assertMapStructure(map);
  return map;
}

function hasEdge(edges, a, b) {
  return (edges || []).some(e => (e.a === a && e.b === b) || (e.a === b && e.b === a));
}

function uniquify(name, used) {
  let n = name;
  let i = 2;
  while (used.has(n)) {
    n = `${name} (${i})`;
    i++;
  }
  return n;
}

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
