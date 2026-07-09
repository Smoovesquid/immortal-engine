import { seedFromString } from '../rng.js';

function isObject(x) { return x && typeof x === 'object'; }

function uniqStrings(arr) {
  const out = [];
  const seen = new Set();
  for (const v of arr) {
    const s = String(v);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function sortPair(a, b) {
  const A = String(a ?? '');
  const B = String(b ?? '');
  return (A <= B) ? [A, B] : [B, A];
}

// FUNC-MINIS-1 — shape normalization for a room's authored furniture (the drawn
// pieces the Builder placed; see authoredFurniture.js for the contract). This is
// hashed world shape, so every field is coerced explicitly. Returns null when
// nothing well-formed remains, so the field is omitted rather than stored empty.
function normalizeRoomFurniture(v) {
  if (!Array.isArray(v) || !v.length) return null;
  const num = (x, d = 0) => (Number.isFinite(+x) ? +x : d);
  const out = [];
  const seen = new Set();
  for (const f of v) {
    if (!isObject(f)) continue;
    const id = String(f.id ?? '');
    const kind = String(f.kind ?? '');
    if (!id || !kind || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      kind,
      label: String(f.label ?? kind),
      shape: String(f.shape ?? 'rect'),
      material: String(f.material ?? 'wood'),
      light: num(f.light),
      cover: (f.cover === 'half' || f.cover === 'three-quarter') ? f.cover : null,
      loot: num(f.loot),
      flat: f.flat ? 1 : 0,
      fx: Math.max(0, Math.min(1, num(f.fx, 0.5))),
      fy: Math.max(0, Math.min(1, num(f.fy, 0.5))),
      w: num(f.w), h: num(f.h), r: num(f.r),
      authored: f.authored ? 1 : 0,
    });
  }
  return out.length ? out : null;
}

/**
 * Topology v0 (S3): room graph with undirected adjacency.
 * {
 *   kind: 'rooms',
 *   rooms: [{ id, tags?:string[] }],
 *   edges: [{ a, b }]
 * }
 */
export function normalizeTopology(topology) {
  const t = isObject(topology) ? topology : null;
  if (!t) return null;

  const kind = String(t.kind ?? '');
  if (kind !== 'rooms') return null;

  const roomsIn = Array.isArray(t.rooms) ? t.rooms : [];
  const rooms = [];
  const roomIds = new Set();

  for (const r of roomsIn) {
    const obj = isObject(r) ? r : {};
    const id = String(obj.id ?? '');
    if (!id || roomIds.has(id)) continue;
    roomIds.add(id);
    // FUNC-MINIS-1 — authored rooms carry their drawn furniture. Kept ONLY when
    // present and well-formed, so every procgen room's shape (and its worldHash)
    // is unchanged. Without this the field dies on the first round-trip: rooms
    // are rebuilt field-by-field right here (the whitelist trap).
    const furniture = normalizeRoomFurniture(obj.furniture);
    rooms.push({ id, tags: uniqStrings(Array.isArray(obj.tags) ? obj.tags : []), ...(furniture ? { furniture } : {}) });
  }

  const edgesIn = Array.isArray(t.edges) ? t.edges : [];
  const edges = [];
  const edgeSet = new Set();

  for (const e of edgesIn) {
    const obj = isObject(e) ? e : {};
    const a = String(obj.a ?? '');
    const b = String(obj.b ?? '');
    if (!a || !b || a === b) continue;
    if (!roomIds.has(a) || !roomIds.has(b)) continue;

    const [lo, hi] = sortPair(a, b);
    const key = lo + '|' + hi;
    if (edgeSet.has(key)) continue;
    edgeSet.add(key);
    edges.push({ a: lo, b: hi });
  }

  rooms.sort((x, y) => x.id.localeCompare(y.id));
  edges.sort((x, y) => (x.a + '|' + x.b).localeCompare(y.a + '|' + y.b));

  return { kind: 'rooms', rooms, edges };
}

export function adjacentRooms(topology, roomId) {
  const t = normalizeTopology(topology);
  if (!t) return [];
  const rid = String(roomId ?? '');
  const out = [];

  for (const e of t.edges) {
    if (e.a === rid) out.push(e.b);
    else if (e.b === rid) out.push(e.a);
  }

  out.sort((a, b) => a.localeCompare(b));
  return out;
}

// ── Interior cardinal navigation ─────────────────────────────────────────────
// A room interior is an undirected graph just like the overland map, so it gets
// the same reciprocal compass treatment (see map/mapState.js compassLayout). A
// doorway is assigned a compass slot at both rooms it connects, deterministically
// and reciprocally: if leaving room A by "north" reaches B, then leaving B by
// "south" returns to A. A direction with no doorway is genuinely absent — the
// player hits a wall there instead of folding the direction onto some other door
// (the old `idx % exits.length` bug let you walk south forever).
const DIRS = ['north', 'east', 'south', 'west'];
const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };

function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function interiorCompassLayout(topology) {
  const t = normalizeTopology(topology);
  const exits = new Map();   // roomId -> { north, east, south, west } (room id or null)
  const taken = new Map();   // roomId -> Set<dir>
  if (!t || !t.rooms.length) return exits;

  const ensure = (id) => {
    if (!exits.has(id)) exits.set(id, { north: null, east: null, south: null, west: null });
    if (!taken.has(id)) taken.set(id, new Set());
  };
  for (const r of t.rooms) ensure(r.id);

  // Adjacency (sorted, so iteration is deterministic).
  const adj = new Map();
  for (const r of t.rooms) adj.set(r.id, []);
  for (const e of t.edges) {
    if (adj.has(e.a)) adj.get(e.a).push(e.b);
    if (adj.has(e.b)) adj.get(e.b).push(e.a);
  }
  for (const list of adj.values()) list.sort((a, b) => a.localeCompare(b));

  const assign = (a, dirA, b) => {
    const dirB = OPPOSITE[dirA];
    exits.get(a)[dirA] = b; exits.get(b)[dirB] = a;
    taken.get(a).add(dirA); taken.get(b).add(dirB);
  };
  // Per-room direction preference, rotated by a seed so a hub fans its spokes
  // out in different orders building-to-building but identically every replay.
  const order = (id) => {
    const s = seedFromString('dir|' + id) % 4;
    return [DIRS[s], DIRS[(s + 1) % 4], DIRS[(s + 2) % 4], DIRS[(s + 3) % 4]];
  };

  // Root = the entry-tagged room (matches floorPlan's entry), else the
  // lexicographically smallest id — so the building grows out from its door.
  const entryRoom = t.rooms.find(r => (r.tags || []).some(tag => String(tag).toLowerCase() === 'entry'));
  const root = String(entryRoom?.id || t.rooms[0].id);

  // Pass 1 — spanning tree via BFS. Each room hands its children the first free
  // cardinal slot in its rotated preference order, so rooms branch off a spine
  // (planar, building-like) instead of stacking on top of each other.
  const visited = new Set([root]);
  const queue = [root];
  while (queue.length) {
    const id = queue.shift();
    for (const nb of adj.get(id) || []) {
      if (visited.has(nb)) continue;            // tree edge only on first reach
      for (const d of order(id)) {
        if (!taken.get(id).has(d) && !taken.get(nb).has(OPPOSITE[d])) {
          assign(id, d, nb); visited.add(nb); queue.push(nb); break;
        }
      }
    }
  }

  // Pass 2 — the leftover (loop / cross) edges and any disconnected components.
  // Sorted by key so it's deterministic; each gets whatever reciprocal slot is
  // still free at both ends. None free → genuinely a wall there.
  const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const linked = new Set();
  for (const [id, ex] of exits) for (const d of DIRS) if (ex[d]) linked.add(pairKey(id, ex[d]));
  const loose = t.edges
    .filter(e => e.a && e.b && e.a !== e.b && !linked.has(pairKey(e.a, e.b)))
    .map(e => ({ ...e, key: edgeKey(e.a, e.b) }))
    .sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
  for (const e of loose) {
    const start = seedFromString(e.key) % 4;
    for (let k = 0; k < 4; k++) {
      const d = DIRS[(start + k) % 4];
      if (!taken.get(e.a).has(d) && !taken.get(e.b).has(OPPOSITE[d])) {
        assign(e.a, d, e.b); break;
      }
    }
  }
  return exits;
}

// interiorExitsFrom(topology, roomId) -> { north, east, south, west } room id or null.
export function interiorExitsFrom(topology, roomId) {
  const id = String(roomId ?? '');
  return interiorCompassLayout(topology).get(id) || { north: null, east: null, south: null, west: null };
}
