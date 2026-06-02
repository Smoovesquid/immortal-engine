import { ensureWorld } from '../state.js';
import { seedFromString, makeRng } from '../rng.js';
import { embedNodes } from './embedding.js';

export function ensureMap(map) {
  const m = map && typeof map === 'object' ? map : {};
  let nodes = Array.isArray(m.nodes) ? m.nodes.map(ensureNode) : [];
  const edges = Array.isArray(m.edges) ? m.edges.map(ensureEdge) : [];

  // Backfill overworld grid coordinates for any node missing them. Pre-v19 saves
  // have no positions; the embedding is a pure function of the graph, so upgraded
  // saves get the exact coordinates a fresh game would. Once every node has a
  // position this is a no-op (the common path), so it stays cheap on hot calls.
  if (nodes.length && nodes.some(n => !Number.isInteger(n.x) || !Number.isInteger(n.y))) {
    const pos = embedNodes(nodes, edges);
    nodes = nodes.map(n => {
      const p = pos.get(String(n.id));
      return p ? { ...n, x: p.x, y: p.y } : n;
    });
  }
  const discovered = Array.isArray(m.discovered) ? m.discovered.map(String) : [];
  const currentNodeId = String(m.currentNodeId || (nodes[0]?.id || ''));

  // Free-roam avatar position (v20). The player walks the tile grid one cell at a
  // time; pos is decoupled from currentNodeId so you can stand in open wilderness
  // between named places. Defaults (and backfills pre-v20 saves) to the current
  // node's cell, so a fresh game and an upgraded save both start standing on the
  // node they're "at".
  const pos = ensurePos(m.pos, nodes, currentNodeId);

  const currentStructureId = String(m.currentStructureId || '');
  const currentRoomId = String(m.currentRoomId || '');

  const tacticalRaw = m.tactical && typeof m.tactical === 'object' ? m.tactical : null;
  const tactical = tacticalRaw ? ensureTactical(tacticalRaw) : { active: false, zoneLayout: null };

  const memoryRaw = m.memory && typeof m.memory === 'object' ? m.memory : null;
  const memory = ensureMapMemory(memoryRaw, dedupe(discovered));

  return { nodes, edges, discovered: dedupe(discovered), currentNodeId, pos, currentStructureId, currentRoomId, tactical, memory };
}

// Resolve the free-roam avatar cell. Prefer an explicit integer pos; otherwise
// default to the current node's cell (so "you're standing on the place you're
// at"), then to the first node, then to the origin for an empty map.
function ensurePos(raw, nodes, currentNodeId) {
  if (raw && Number.isInteger(raw.x) && Number.isInteger(raw.y)) {
    return { x: raw.x, y: raw.y };
  }
  const cur = nodes.find(n => String(n.id) === String(currentNodeId)) || nodes[0] || null;
  if (cur && Number.isInteger(cur.x) && Number.isInteger(cur.y)) {
    return { x: cur.x, y: cur.y };
  }
  return { x: 0, y: 0 };
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
// As of v19 every node carries an integer grid position (see embedding.js), so a
// compass direction is no longer a hashed label — it's the actual geometry. The
// direction from A to B is read straight off the delta of their coordinates, which
// makes the on-screen map and the compass finally agree (north on screen = north
// you walk) and makes reciprocity automatic: if B is east of A then A is west of
// B, because the delta simply negates.
//
// When two neighbors fall in the same cardinal at a node, the nearer one wins the
// slot (edges are processed nearest-first); the farther stays reachable by typed
// name. Grid y grows downward, so south is +y.
const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };

function cardinalOf(dx, dy) {
  if (dx === 0 && dy === 0) return '';
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'east' : 'west';
  return dy > 0 ? 'south' : 'north';
}

export function compassLayout(map) {
  const m = ensureMap(map);
  const exits = new Map();   // nodeId -> { north, east, south, west } (neighbor id or null)
  const pos = new Map();     // nodeId -> { x, y }
  for (const n of m.nodes) {
    const id = String(n.id);
    exits.set(id, { north: null, east: null, south: null, west: null });
    if (Number.isInteger(n.x) && Number.isInteger(n.y)) pos.set(id, { x: n.x, y: n.y });
  }

  // Canonical (lo,hi), de-duped edges. Sort nearest-first so a contested cardinal
  // goes to the closer neighbor; key breaks ties deterministically.
  const seen = new Set();
  const edges = [];
  for (const e of m.edges) {
    const a = String(e.a), b = String(e.b);
    if (!a || !b || a === b) continue;
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    const k = `${lo}|${hi}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const pa = pos.get(lo), pb = pos.get(hi);
    const dist = (pa && pb) ? (Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y)) : Infinity;
    edges.push({ lo, hi, k, dist });
  }
  edges.sort((x, y) => (x.dist - y.dist) || (x.k < y.k ? -1 : x.k > y.k ? 1 : 0));

  for (const e of edges) {
    const pa = pos.get(e.lo), pb = pos.get(e.hi);
    if (!pa || !pb) continue; // no geometry — neighbor reachable by typed name only
    const d = cardinalOf(pb.x - pa.x, pb.y - pa.y); // lo -> hi
    if (!d) continue;
    const od = OPPOSITE[d];                          // hi -> lo (exact opposite)
    // Assign both ends together so reciprocity always holds. If either slot is
    // already claimed by a nearer edge, skip — that neighbor stays name-reachable.
    if (exits.get(e.lo)[d] === null && exits.get(e.hi)[od] === null) {
      exits.get(e.lo)[d] = e.hi;
      exits.get(e.hi)[od] = e.lo;
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

// ── Free-roam overworld (v20) ──────────────────────────────────────────────
// The player is a single avatar cell (map.pos) on the same integer grid the nodes
// live on. A cardinal move steps that cell by one. Grid y grows downward, so south
// is +y — same convention as the compass geometry above.
const CARDINAL_DELTA = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 }
};

// How far (Chebyshev distance, in cells) the player can spot a node from the open
// map. Nodes inside this radius get revealed as you roam; reaching a node's exact
// cell is what "arrives" there.
export const SIGHT_RADIUS = 3;

// stepCell({x,y}, dir) -> {x,y} one cell in the cardinal direction (no mutation).
export function stepCell(pos, dir) {
  const p = (pos && Number.isInteger(pos.x) && Number.isInteger(pos.y)) ? pos : { x: 0, y: 0 };
  const d = CARDINAL_DELTA[dir];
  if (!d) return { x: p.x, y: p.y };
  return { x: p.x + d.dx, y: p.y + d.dy };
}

// nodeAtCell(map, x, y) -> node sitting exactly on that cell, or null.
export function nodeAtCell(map, x, y) {
  const m = ensureMap(map);
  for (const n of m.nodes) {
    if (n.x === x && n.y === y) return n;
  }
  return null;
}

// nodesWithinSight(map, pos, radius) -> nodes whose cell is within Chebyshev
// `radius` of pos, nearest first (ties broken by id) for deterministic reveal.
export function nodesWithinSight(map, pos, radius = SIGHT_RADIUS) {
  const m = ensureMap(map);
  const px = Number.isInteger(pos?.x) ? pos.x : 0;
  const py = Number.isInteger(pos?.y) ? pos.y : 0;
  const hits = [];
  for (const n of m.nodes) {
    if (!Number.isInteger(n.x) || !Number.isInteger(n.y)) continue;
    const cheb = Math.max(Math.abs(n.x - px), Math.abs(n.y - py));
    if (cheb <= radius) hits.push({ node: n, cheb });
  }
  hits.sort((a, b) => (a.cheb - b.cheb) || (String(a.node.id) < String(b.node.id) ? -1 : 1));
  return hits.map(h => h.node);
}

// cardinalToCell(from, to) -> 'north'|'south'|'east'|'west'|'' — the coarse
// compass bearing from one cell to another (for "you spot X to the east").
export function cardinalToCell(from, to) {
  return cardinalOf(to.x - from.x, to.y - from.y);
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


// v20 free-roam: discoverNode/seeNode both add a node to `discovered`, so that
// list conflates "sighted from afar" with "actually stood on". visitNode is the
// stronger signal — it marks a node in memory.visitedTurnByNodeId, which the
// overworld renderer reads to draw a bright (visited) vs dim (sighted-only) icon.
// Call this when the avatar lands on a node's cell (or starts standing on it).
export function visitNode(world, nodeId) {
  const id = String(nodeId || '').trim();
  if (!id) return ensureWorld(world);
  // Ensure it's discovered first (prepended, keeping discovered[0] === current).
  const w = discoverNode(world, id);
  const m = ensureMap(w.map);
  const turn = w.time?.turn ?? 0;
  const mem = m.memory && typeof m.memory === 'object' ? m.memory : {};
  if (mem.visitedTurnByNodeId && mem.visitedTurnByNodeId[id] !== undefined) return w;
  const visitedTurnByNodeId = {
    ...(mem.visitedTurnByNodeId && typeof mem.visitedTurnByNodeId === 'object' ? mem.visitedTurnByNodeId : {}),
    [id]: turn
  };
  return { ...w, map: { ...m, memory: { ...mem, visitedTurnByNodeId } } };
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

  // v20 — a node jump (newScene/dev travel) places the free-roam avatar onto the
  // destination node's cell, so the @ on the map stays on the place you're "at".
  const destNode = m1.nodes.find(n => String(n.id) === id) || null;
  const pos = (destNode && Number.isInteger(destNode.x) && Number.isInteger(destNode.y))
    ? { x: destNode.x, y: destNode.y }
    : m1.pos;

  return {
    ...w1,
    map: {
      ...m1,
      ...interiorMapKeys,
      pos,
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
  // Overworld grid position (integer tile cell). Preserved when present; ensureMap
  // backfills any node missing it via the deterministic embedding (old saves).
  if (Number.isInteger(x.x) && Number.isInteger(x.y)) {
    base.x = x.x;
    base.y = x.y;
  }
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
  const cells = new Set();
  for (const n of m.nodes) {
    if (!n.id) throw new Error('Map invariant: node without id');
    if (ids.has(n.id)) throw new Error('Map invariant: duplicate node id');
    ids.add(n.id);
    // v19: every node sits on an integer grid cell, and no two share one.
    if (!Number.isInteger(n.x) || !Number.isInteger(n.y)) {
      throw new Error(`Map invariant: node ${n.id} missing integer grid position`);
    }
    const cell = `${n.x},${n.y}`;
    if (cells.has(cell)) throw new Error(`Map invariant: two nodes share grid cell ${cell}`);
    cells.add(cell);
  }
  if (m.currentNodeId && !ids.has(m.currentNodeId)) {
    throw new Error('Map invariant: invalid currentNodeId');
  }
  // v20: free-roam clears currentNodeId while you stand in open wilderness, so the
  // "you're at the head of your discovery list" contract only binds when you're
  // actually standing on a node.
  if (m.currentNodeId && m.discovered.length && m.discovered[0] !== m.currentNodeId) {
    throw new Error('Map invariant: discovered[0] must equal currentNodeId');
  }
  // v20: the avatar always has an integer tile position.
  if (!m.pos || !Number.isInteger(m.pos.x) || !Number.isInteger(m.pos.y)) {
    throw new Error('Map invariant: map.pos must be an integer cell');
  }
}
