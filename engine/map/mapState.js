import { ensureWorld } from '../state.js';
import { seedFromString, makeRng } from '../rng.js';

export function ensureMap(map) {
  const m = map && typeof map === 'object' ? map : {};
  const nodes = Array.isArray(m.nodes) ? m.nodes.map(ensureNode) : [];
  const edges = Array.isArray(m.edges) ? m.edges.map(ensureEdge) : [];
  const discovered = Array.isArray(m.discovered) ? m.discovered.map(String) : [];
  const currentNodeId = String(m.currentNodeId || (nodes[0]?.id || ''));

  const currentStructureId = String(m.currentStructureId || '');
  const currentRoomId = String(m.currentRoomId || '');

  const tacticalRaw = m.tactical && typeof m.tactical === 'object' ? m.tactical : null;
  const tactical = tacticalRaw ? ensureTactical(tacticalRaw) : { active: false, zoneLayout: null };

  const memoryRaw = m.memory && typeof m.memory === 'object' ? m.memory : null;
  const memory = ensureMapMemory(memoryRaw, dedupe(discovered));

  return { nodes, edges, discovered: dedupe(discovered), currentNodeId, currentStructureId, currentRoomId, tactical, memory };
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

// ── Cardinal navigation ──────────────────────────────────────────────────────
// The overworld is an abstract node graph with no real geometry, so "north" is
// a label we assign, not a coordinate. compassLayout() assigns every edge a
// compass slot at each of its two endpoints, deterministically and RECIPROCALLY:
// if leaving A by "north" arrives at B, then leaving B by "south" returns to A.
// This lets a player draw a stable map in their head (core to the explore feel).
//
// Reciprocity is free because each edge is assigned once, from a canonical
// (lo,hi) endpoint ordering, writing opposite directions at both ends in the
// same step. Collisions (two edges wanting the same slot at a node) are resolved
// greedily; a saturated node (>4 edges, rare on the ring+chord map) may leave an
// edge with no compass slot — that neighbor stays reachable by typed name.
const DIRS = ['north', 'east', 'south', 'west'];
const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };

function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function compassLayout(map) {
  const m = ensureMap(map);
  const exits = new Map();   // nodeId -> { north, east, south, west } (neighbor id or null)
  const taken = new Map();   // nodeId -> Set<dir>
  const ensure = (id) => {
    if (!exits.has(id)) exits.set(id, { north: null, east: null, south: null, west: null });
    if (!taken.has(id)) taken.set(id, new Set());
  };

  const edges = m.edges
    .filter(e => e.a && e.b && e.a !== e.b)
    .map(e => ({ lo: e.a < e.b ? e.a : e.b, hi: e.a < e.b ? e.b : e.a }))
    .map(e => ({ ...e, key: edgeKey(e.lo, e.hi) }))
    .sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));

  // Drop duplicate edges (same pair) so we don't waste two slots on one passage.
  const seenKeys = new Set();

  for (const e of edges) {
    if (seenKeys.has(e.key)) continue;
    seenKeys.add(e.key);
    ensure(e.lo); ensure(e.hi);
    const start = seedFromString(e.key) % 4;
    for (let k = 0; k < 4; k++) {
      const dLo = DIRS[(start + k) % 4];
      const dHi = OPPOSITE[dLo];
      if (!taken.get(e.lo).has(dLo) && !taken.get(e.hi).has(dHi)) {
        exits.get(e.lo)[dLo] = e.hi;
        exits.get(e.hi)[dHi] = e.lo;
        taken.get(e.lo).add(dLo);
        taken.get(e.hi).add(dHi);
        break;
      }
    }
  }
  return exits;
}

// exitsFrom(map, nodeId) -> { north, east, south, west } neighbor id or null.
export function exitsFrom(map, nodeId) {
  const m = ensureMap(map);
  const id = String(nodeId || m.currentNodeId || '');
  return compassLayout(m).get(id) || { north: null, east: null, south: null, west: null };
}

// directionFromText(text) -> 'north'|'south'|'east'|'west'|'' for short, bare
// movement commands only ("north", "n", "go west", "head south"). It deliberately
// does NOT fire on longer named-destination intents like "travel to North Tower",
// so cardinal nav and name travel stay distinct.
export function directionFromText(text) {
  const t = String(text || '').trim().toLowerCase();
  const m = t.match(/^(?:go|head|move|walk|travel)?\s*(north|south|east|west|n|s|e|w)$/);
  if (!m) return '';
  const d = m[1];
  if (d === 'north' || d === 'n') return 'north';
  if (d === 'south' || d === 's') return 'south';
  if (d === 'east' || d === 'e') return 'east';
  if (d === 'west' || d === 'w') return 'west';
  return '';
}

export function discoverNode(world, nodeId) {
  const w = ensureWorld(world);
  const m = ensureMap(w.map);
  const id = String(nodeId || '').trim();
  if (!id) return w;
  if (m.discovered.includes(id)) return w;

  const turn = w.time?.turn ?? 0;
  const nextDiscovered = [id, ...m.discovered];
  const mem = m.memory && typeof m.memory === 'object' ? m.memory : {};
  const seenTurnByNodeId = {
    ...(mem.seenTurnByNodeId && typeof mem.seenTurnByNodeId === 'object' ? mem.seenTurnByNodeId : {}),
    [id]: (mem.seenTurnByNodeId && mem.seenTurnByNodeId[id] !== undefined) ? mem.seenTurnByNodeId[id] : turn
  };

  return {
    ...w,
    map: {
      ...m,
      discovered: nextDiscovered,
      memory: {
        ...mem,
        seenNodeIds: nextDiscovered,
        seenTurnByNodeId
      }
    }
  };
}

export function seeNode(world, nodeId) {
  const w = ensureWorld(world);
  const m = ensureMap(w.map);
  const id = String(nodeId || "").trim();
  if (!id) return w;
  if (m.discovered.includes(id)) return w;

  const turn = w.time?.turn ?? 0;
  // IMPORTANT: no travel => keep discovered[0] === currentNodeId
  const nextDiscovered = [...m.discovered, id];
  const mem = (m.memory && typeof m.memory === "object") ? m.memory : {};

  const seenTurnByNodeId = {
    ...((mem.seenTurnByNodeId && typeof mem.seenTurnByNodeId === "object") ? mem.seenTurnByNodeId : {}),
    [id]: (mem.seenTurnByNodeId && mem.seenTurnByNodeId[id] !== undefined) ? mem.seenTurnByNodeId[id] : turn
  };

  return {
    ...w,
    map: {
      ...m,
      discovered: nextDiscovered,
      memory: {
        ...mem,
        seenNodeIds: nextDiscovered,
        seenTurnByNodeId
      }
    }
  };
}


export function moveToNode(world, nodeId) {
  const w = ensureWorld(world);
  const m = ensureMap(w.map);
  const id = String(nodeId || '').trim();
  if (!id) return w;
  const nbs = neighbors(m, m.currentNodeId);
  if (!nbs.includes(id)) return w;
  const previousNodeId = String(m.currentNodeId || '');
  const nodeChanged = previousNodeId !== id;

  const w1 = discoverNode({ ...w, map: { ...m, currentNodeId: id } }, id);
  const m1 = ensureMap(w1.map);
  const turn = w1.time?.turn ?? 0;
  const mem = m1.memory && typeof m1.memory === 'object' ? m1.memory : {};

  const visitedTurnByNodeId = {
    ...(mem.visitedTurnByNodeId && typeof mem.visitedTurnByNodeId === 'object' ? mem.visitedTurnByNodeId : {}),
    [id]: (mem.visitedTurnByNodeId && mem.visitedTurnByNodeId[id] !== undefined) ? mem.visitedTurnByNodeId[id] : turn
  };

  const seenTurnByNodeId = {
    ...(mem.seenTurnByNodeId && typeof mem.seenTurnByNodeId === 'object' ? mem.seenTurnByNodeId : {}),
    [id]: (mem.seenTurnByNodeId && mem.seenTurnByNodeId[id] !== undefined) ? mem.seenTurnByNodeId[id] : turn
  };

  // Pass H — interior context is bound to a specific node's structure. When
  // the player moves to a different node, any stale interior pointer must be
  // cleared (the structure no longer exists at this node).
  const sceneInterior = nodeChanged ? null : (w1.scene?.interior ?? null);
  const interiorMapKeys = nodeChanged
    ? { currentStructureId: '', currentRoomId: '' }
    : {
      currentStructureId: String(m1.currentStructureId || ''),
      currentRoomId: String(m1.currentRoomId || '')
    };

  return {
    ...w1,
    map: {
      ...m1,
      ...interiorMapKeys,
      memory: {
        ...mem,
        visitedTurnByNodeId,
        seenTurnByNodeId,
        seenNodeIds: m1.discovered
      }
    },
    scene: w1.scene ? { ...w1.scene, interior: sceneInterior } : w1.scene
  };
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

  // Exact node-id targeting (UI path buttons): unambiguous even when node
  // display names collide (e.g. two "Hollow Chapel" nodes). Marker form
  // "::<nodeId>" embedded in the intent text; matched against neighbor ids.
  const idMarker = String(playerText || '').match(/::([A-Za-z0-9_]+)/);
  if (idMarker) {
    const wantId = idMarker[1];
    const hit = nbs.find(id => String(id) === wantId);
    if (hit) return hit;
  }

  const t = String(playerText || '').toLowerCase();

  // Directional command: resolve through the deterministic compass layout
  // (reciprocal — north then south returns you). A bare direction that leads
  // nowhere returns `here`, which the travel handler reports as a dead end.
  const dir = directionFromText(t);
  if (dir) {
    const exits = exitsFrom(m, here);
    return exits[dir] || here;
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
  const base = {
    id: String(x.id || ''),
    name: String(x.name || ''),
    tags: Array.isArray(x.tags) ? x.tags.map(String).slice(0, 8) : [],
    motifs: Array.isArray(x.motifs) ? x.motifs.map(String).slice(0, 8) : [],
    scars: Array.isArray(x.scars) ? x.scars.map(String).slice(0, 8) : []
  };
  if (x.nodeType) base.nodeType = String(x.nodeType);
  // Preserve settlement data from decompression (NPCs, buildings, history, etc.)
  if (x.settlement && typeof x.settlement === 'object') {
    const s = x.settlement;
    if (Array.isArray(s.npcs)) {
      base.settlement = { ...s, npcs: s.npcs.map(ensureNpcMemory) };
    } else {
      base.settlement = s;
    }
  }
  // Preserve furniture data for physics interaction
  if (Array.isArray(x.furniture)) base.furniture = x.furniture;
  return base;
}

function ensureNpcMemory(npc) {
  if (!npc || typeof npc !== 'object') return npc;
  return { ...npc, memory: Array.isArray(npc.memory) ? npc.memory.slice(0, 12) : [] };
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
