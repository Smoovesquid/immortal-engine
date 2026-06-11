import { assertMapStructure } from './mapState.js';
import { seedFromString, makeRng } from '../rng.js';
import { classifyNodeType } from './nodeType.js';
import { embedNodes } from './embedding.js';

// Living Terrain Engine v1 — deterministic narrative map graph.

export function generateInitialMap({ seed = 'seed', packId = 'fantasy', pack = {}, nodeCountOverride = null } = {}) {
  const rng = makeRng(seedFromString(`${seed}|map|${packId}`));

  const names = Array.isArray(pack.locations) ? pack.locations.map(String).filter(Boolean) : [];
  // County-scale name pool: enough distinct ground that a day's travel reads
  // as country, not a loop of eight tiles.
  const fallback = [
    'Roadside', 'Ruined Tower', 'Dry Creek', 'Old Shrine', 'Sooted Bridge',
    'Salt Flats', 'Black Orchard', 'Hollow Chapel', 'Gallows Hill', 'Reedmere',
    'Stonebridge', 'Howling Pass', 'Witchlight Fen', 'Cairn Field',
    'Old Mill Ruin', 'The Standing Stones', 'Drowned Coppice', 'Beacon Tor',
    'Foxglove Hollow', 'The Sunken Road'
  ];
  // Settlement-keyword names injected so nodes classify as settlements — each
  // a distinct archetype (market, port, shrine-stop, mining camp, crossroads)
  // so the county's towns aren't interchangeable.
  const settlementNames = [
    'Trader\'s Camp', 'Riverside Inn', 'Wayfarers\' Outpost',
    'Saltmarket Town', 'Pilgrim\'s Rest Village', 'Ferry Landing',
    'Deepvein Camp', 'Crossway Village'
  ];
  const pool = (names.length ? names : fallback).slice();
  // Ensure settlement names are in the pool so the classifier can assign nodeType 'settlement'.
  for (const sn of settlementNames) {
    if (!pool.some(n => String(n).toLowerCase() === sn.toLowerCase())) pool.push(sn);
  }

  // County scale: 24-39 nodes (was 12-21). Lazy decompression keeps the cost
  // of a bigger county at zero until you actually walk it.
  const nodeCountBase = 24 + (seedFromString(`${seed}|mapN|${packId}`) % 16);
  const nodeCount = clampInt((nodeCountOverride == null ? nodeCountBase : Number(nodeCountOverride)), 12, 200);

  // Deterministic shuffle so the county draws across the WHOLE pool (the old
  // stride-7 pick collided with larger pools and named every town the same).
  const shuffleRng = makeRng(seedFromString(`${seed}|mapShuffle|${packId}`));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = shuffleRng.int(0, i);
    const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
  }

  const nodes = [];
  const used = new Set();
  for (let i = 0; i < nodeCount; i++) {
    const base = pool.length ? (pool[i % pool.length] || rng.pick(pool)) : `Place ${i + 1}`;
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
  const MIN_SETTLEMENTS = nodeCount >= 24 ? 4 : 2;
  if (settlementCount < MIN_SETTLEMENTS) {
    const need = MIN_SETTLEMENTS - settlementCount;
    let patched = 0;
    for (let i = 1; i < nodes.length && patched < need; i++) {
      if (nodes[i].nodeType !== 'settlement') {
        nodes[i] = { ...nodes[i], nodeType: 'settlement' };
        patched++;
      }
    }
  }

  const startNodeId = nodes[0]?.id || '';

  // v19: lay the graph onto an integer tile grid so the overworld has real
  // geography. Pure function of the node/edge set — deterministic, integer-only.
  const pos = embedNodes(nodes, edges);
  const placedNodes = nodes.map(n => {
    const p = pos.get(String(n.id));
    return p ? { ...n, x: p.x, y: p.y } : n;
  });

  const map = {
    nodes: placedNodes,
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
