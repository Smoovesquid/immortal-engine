/**
 * S1 — Deterministic Structure Generation (stub)
 * Pure function: no world mutation. No uncontrolled randomness.
 *
 * Inputs are explicit so determinism is obvious and testable.
 *
 * A6 — Kind-based topology templates (deterministic)
 * - Same (seed + nodeId + engineVersion + structureId + kind) => identical topology.
 * - Exterior kinds (road/wall/bridge) default to no interior (topology:null) unless explicitly flagged.
 */

function hash32(s) {
  let h = 2166136261;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clampInt(n, lo, hi) {
  const v = Number.isFinite(+n) ? Math.floor(+n) : lo;
  return Math.max(lo, Math.min(hi, v));
}

function uniqStrings(arr) {
  const out = [];
  const seen = new Set();
  for (const v of arr) {
    const s = String(v ?? '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function kindFromTags(tags, fallback = 'building') {
  const allowed = new Set(['road', 'building', 'wall', 'bridge', 'ruin', 'tower', 'shrine']);
  for (const t0 of tags) {
    const t = String(t0).toLowerCase();
    if (t.startsWith('kind:')) {
      const k = t.slice(5);
      if (allowed.has(k)) return k;
    }
    if (allowed.has(t)) return t;
  }
  return fallback;
}

function topoRoomId(structureId, idx) {
  return `room:${String(structureId || 'st')}:r${idx}`;
}

function makeRooms(structureId, n, tagFn) {
  const count = clampInt(n, 1, 64);
  const rooms = [];
  for (let i = 0; i < count; i++) {
    const tags = uniqStrings(tagFn ? tagFn(i) : []);
    rooms.push({ id: topoRoomId(structureId, i), tags });
  }
  // deterministic ordering by id (normalizeTopology will also sort)
  rooms.sort((a, b) => a.id.localeCompare(b.id));
  return rooms;
}

function makeEdgesUndirected(pairs) {
  const out = [];
  const seen = new Set();
  for (const [a0, b0] of pairs) {
    const a = String(a0 || '');
    const b = String(b0 || '');
    if (!a || !b || a === b) continue;
    const lo = a <= b ? a : b;
    const hi = a <= b ? b : a;
    const key = lo + '|' + hi;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ a: lo, b: hi });
  }
  out.sort((x, y) => (x.a + '|' + x.b).localeCompare(y.a + '|' + y.b));
  return out;
}

function generateTopologyForKind({ seed, nodeId, engineVersion, structureId, kind, tags }) {
  const s = String(seed ?? '');
  const nid = String(nodeId ?? '');
  const ver = Number.isFinite(+engineVersion) ? Math.floor(+engineVersion) : 0;
  const sid = String(structureId ?? '');
  const k = String(kind ?? 'building').toLowerCase();
  const t = Array.isArray(tags) ? tags.map(String) : [];
  const base = `${s}|${nid}|v${ver}|${sid}|${k}|${t.join(',')}`;

  // Exterior-by-default kinds: no interior unless explicitly requested.
  // You can force an interior by tagging the node/structure with "interior".
  if (k === 'road' || k === 'wall' || k === 'bridge') {
    const wantsInterior = t.map(x => String(x).toLowerCase()).includes('interior');
    if (!wantsInterior) return null;
    const rooms = makeRooms(sid, 1, (i) => (i === 0 ? ['entry', 'interior'] : ['interior']));
    return { kind: 'rooms', rooms, edges: [] };
  }

  if (k === 'tower') {
    // Vertical stack: linear chain.
    const n = 3 + (hash32(base + '|rooms') % 4); // 3..6
    const rooms = makeRooms(sid, n, (i) => (i === 0 ? ['entry', 'stairs'] : ['stairs']));
    const pairs = [];
    for (let i = 0; i < n - 1; i++) pairs.push([topoRoomId(sid, i), topoRoomId(sid, i + 1)]);
    return { kind: 'rooms', rooms, edges: makeEdgesUndirected(pairs) };
  }

  if (k === 'shrine') {
    // Small loop: cycle graph.
    const n = 3 + (hash32(base + '|rooms') % 3); // 3..5
    const rooms = makeRooms(sid, n, (i) => {
      if (i === 0) return ['entry', 'quiet'];
      if (i === Math.floor(n / 2)) return ['altar', 'quiet'];
      return ['quiet'];
    });
    const pairs = [];
    for (let i = 0; i < n; i++) {
      pairs.push([topoRoomId(sid, i), topoRoomId(sid, (i + 1) % n)]);
    }
    return { kind: 'rooms', rooms, edges: makeEdgesUndirected(pairs) };
  }

  if (k === 'ruin') {
    // Branching rooms: a trunk with deterministic side branches.
    const n = 4 + (hash32(base + '|rooms') % 4); // 4..7
    const rooms = makeRooms(sid, n, (i) => (i === 0 ? ['entry', 'debris'] : ['debris']));
    const pairs = [];
    // trunk
    for (let i = 0; i < n - 1; i++) {
      pairs.push([topoRoomId(sid, i), topoRoomId(sid, i + 1)]);
    }
    // branches (deterministic)
    for (let i = 2; i < n; i++) {
      const wants = (hash32(base + `|branch|${i}`) % 3) === 0;
      if (!wants) continue;
      const attach = 1 + (hash32(base + `|attach|${i}`) % Math.max(1, i));
      pairs.push([topoRoomId(sid, attach), topoRoomId(sid, i)]);
    }
    return { kind: 'rooms', rooms, edges: makeEdgesUndirected(pairs) };
  }

  // Default: building — small interior graph (chain + optional chord).
  {
    const n = 2 + (hash32(base + '|rooms') % 3); // 2..4
    const rooms = makeRooms(sid, n, (i) => (i === 0 ? ['entry'] : []));
    const pairs = [];
    for (let i = 0; i < n - 1; i++) pairs.push([topoRoomId(sid, i), topoRoomId(sid, i + 1)]);
    if (n >= 3) {
      const addChord = (hash32(base + '|chord') % 2) === 0;
      if (addChord) pairs.push([topoRoomId(sid, 0), topoRoomId(sid, n - 1)]);
    }
    return { kind: 'rooms', rooms, edges: makeEdgesUndirected(pairs) };
  }
}

export function generateStructuresForNode({ seed, nodeId, engineVersion, nodeTags }) {
  const s = String(seed ?? '');
  const nid = String(nodeId ?? '');
  const ver = Number.isFinite(+engineVersion) ? Math.floor(+engineVersion) : 0;
  const tags = Array.isArray(nodeTags) ? nodeTags.map(String) : [];

  // Deterministic stable id: derived solely from inputs (not from RNG).
  // NOTE: This is a stub “shape unlock” — future gates can replace with richer logic.
  const id = `stgen:v${ver}:${nid}:0`;

  // Deterministic rule: only emit a trivial building if a stable trigger is present.
  // Keeps behavior minimal and predictable while proving the pipeline.
  const trigger = tags.includes('structure:demo') || (s.length > 0 && nid.length > 0 && (s + '|' + nid).length % 2 === 0);
  if (!trigger) return [];

  // Allow kind to be controlled by tags (e.g., kind:ruin) without changing determinism.
  const kind = kindFromTags(tags, 'building');

  const topology = generateTopologyForKind({
    seed: s,
    nodeId: nid,
    engineVersion: ver,
    structureId: id,
    kind,
    tags
  });

  return [{
    id,
    kind,
    nodeId: nid,
    anchors: { nodeId: nid },
    topology,
    surfaces: {},
    tags: ['generated', 'demo']
  }];
}
