import { ensureWorld } from '../state.js';
import { seedFromString, makeRng } from '../rng.js';

export function ensureMap(map) {
  const m = map && typeof map === 'object' ? map : {};
  const nodes = Array.isArray(m.nodes) ? m.nodes.map(ensureNode) : [];
  const edges = Array.isArray(m.edges) ? m.edges.map(ensureEdge) : [];
  const discovered = Array.isArray(m.discovered) ? m.discovered.map(String) : [];
  const currentNodeId = String(m.currentNodeId || (nodes[0]?.id || ''));

  const tacticalRaw = m.tactical && typeof m.tactical === 'object' ? m.tactical : null;
  const tactical = tacticalRaw ? ensureTactical(tacticalRaw) : { active: false, zoneLayout: null };

  const memoryRaw = m.memory && typeof m.memory === 'object' ? m.memory : null;
  const memory = ensureMapMemory(memoryRaw, dedupe(discovered));

  return { nodes, edges, discovered: dedupe(discovered), currentNodeId, tactical, memory };
}

export function neighbors(map, nodeId) {
  const m = ensureMap(map);
  const id = String(nodeId || m.currentNodeId || '');
  const out = new Set();
  for (const e of m.edges) {
    if (e.a === id) out.add(e.b);
    if (e.b === id) out.add(e.a);
  }
  return [...out];
}

export function discoverNode(world, nodeId) {
  const w = ensureWorld(world);
  const m = ensureMap(w.map);
  const id = String(nodeId || '').trim();
  if (!id) return w;
  if (m.discovered.includes(id)) return w;
  return { ...w, map: { ...m, discovered: [id, ...m.discovered] } };
}

export function moveToNode(world, nodeId) {
  const w = ensureWorld(world);
  const m = ensureMap(w.map);
  const id = String(nodeId || '').trim();
  if (!id) return w;
  const nbs = neighbors(m, m.currentNodeId);
  if (!nbs.includes(id)) return w;
  const w1 = { ...w, map: { ...m, currentNodeId: id } };
  return discoverNode(w1, id);
}

export function scarifyNode(world, nodeId, scarId) {
  const w = ensureWorld(world);
  const m = ensureMap(w.map);
  const nid = String(nodeId || '').trim();
  const sid = String(scarId || '').trim();
  if (!nid || !sid) return w;

  const nodes = m.nodes.map(n => {
    if (n.id !== nid) return n;
    if ((n.scars || []).includes(sid)) return n;
    return { ...n, scars: [...(n.scars || []), sid] };
  });

  return { ...w, map: { ...m, nodes } };
}

export function pickTravelDestination(world, playerText) {
  const w = ensureWorld(world);
  const m = ensureMap(w.map);
  const here = m.currentNodeId;
  const nbs = neighbors(m, here);
  if (!nbs.length) return here;

  const t = String(playerText || '').toLowerCase();

  // Directional shorthand: choose neighbor by stable index.
  // neighbors() preserves deterministic insertion order based on edges traversal.
  const dir = (t.match(/\\b(north|south|east|west|n|s|e|w)\\b/) || [])[1] || '';
  if (dir) {
    const idx =
      (dir === 'north' || dir === 'n') ? 0 :
      (dir === 'east'  || dir === 'e') ? 1 :
      (dir === 'south' || dir === 's') ? 2 :
      (dir === 'west'  || dir === 'w') ? 3 : 0;
    return nbs[idx % nbs.length] || nbs[0];
  }

  // Generic "exit"/"leave" with no named destination: deterministic first neighbor.
  if (/\\b(exit|leave|escape|get out|get outside|out of here)\\b/.test(t)) {
    return nbs[0] || here;
  }

  const nbNodes = nbs.map(id => m.nodes.find(n => n.id === id)).filter(Boolean);
  const match = nbNodes.find(n => t.includes(String(n.name || '').toLowerCase()));
  if (match) return match.id;

  const rng = makeRng(seedFromString(`${w.meta.seed}|travel|${w.scene.promptSeed}|${w.timeline.length}`));
  return rng.pick(nbs) || nbs[0];
}

function ensureNode(n) {
  const x = n && typeof n === 'object' ? n : {};
  return {
    id: String(x.id || ''),
    name: String(x.name || ''),
    tags: Array.isArray(x.tags) ? x.tags.map(String).slice(0, 8) : [],
    motifs: Array.isArray(x.motifs) ? x.motifs.map(String).slice(0, 8) : [],
    scars: Array.isArray(x.scars) ? x.scars.map(String).slice(0, 8) : []
  };
}

function ensureEdge(e) {
  const x = e && typeof e === 'object' ? e : {};
  return {
    a: String(x.a || ''),
    b: String(x.b || ''),
    kind: (x.kind === 'road' || x.kind === 'tunnel') ? x.kind : 'path'
  };
}

function ensureTactical(t) {
  const x = t && typeof t === 'object' ? t : {};
  const zl = x.zoneLayout && typeof x.zoneLayout === 'object' ? x.zoneLayout : null;
  const cover = Array.isArray(zl?.coverTags) ? zl.coverTags.map(String).slice(0, 6) : [];
  const lanes = Array.isArray(zl?.lanes) ? zl.lanes.map(String).slice(0, 6) : [];
  return {
    active: Boolean(x.active),
    zoneLayout: zl ? { lanes: lanes.length ? lanes : ['left', 'center', 'right'], coverTags: cover.length ? cover : ['cover', 'shadow'] } : null
  };
}

function ensureMapMemory(mem, discovered) {
  const x = mem && typeof mem === 'object' ? mem : {};
  const seenNodeIds = Array.isArray(x.seenNodeIds) ? dedupe(x.seenNodeIds) : dedupe(discovered);
  const visitedTurnByNodeId = (x.visitedTurnByNodeId && typeof x.visitedTurnByNodeId === 'object') ? x.visitedTurnByNodeId : {};
  const seenTurnByNodeId = (x.seenTurnByNodeId && typeof x.seenTurnByNodeId === 'object') ? x.seenTurnByNodeId : {};
  const knowledgeByNodeId = (x.knowledgeByNodeId && typeof x.knowledgeByNodeId === 'object') ? x.knowledgeByNodeId : {};
  const snapshotByNodeId = (x.snapshotByNodeId && typeof x.snapshotByNodeId === 'object') ? x.snapshotByNodeId : {};
  return { seenNodeIds, visitedTurnByNodeId, seenTurnByNodeId, knowledgeByNodeId, snapshotByNodeId };
}

function dedupe(arr) {
  const out = [];
  const seen = new Set();
  for (const x of (arr || [])) {
    const s = String(x || '').trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function assertMapStructure(map) {
  const m = ensureMap(map);
  const ids = new Set();
  for (const n of m.nodes) {
    if (!n.id) throw new Error('Map invariant: node without id');
    if (ids.has(n.id)) throw new Error('Map invariant: duplicate node id');
    ids.add(n.id);
  }
  if (m.currentNodeId && !ids.has(m.currentNodeId)) {
    throw new Error('Map invariant: invalid currentNodeId');
  }
  if (m.discovered.length && m.discovered[0] !== m.currentNodeId) {
    throw new Error('Map invariant: discovered[0] must equal currentNodeId');
  }
}
