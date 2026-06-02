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
    rooms.push({ id, tags: uniqStrings(Array.isArray(obj.tags) ? obj.tags : []) });
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
  if (!t) return exits;

  const ensure = (id) => {
    if (!exits.has(id)) exits.set(id, { north: null, east: null, south: null, west: null });
    if (!taken.has(id)) taken.set(id, new Set());
  };

  // Edges are already normalized to (lo,hi) and de-duped by normalizeTopology,
  // and sorted by key — but sort again on the local key form to be explicit.
  const edges = t.edges
    .filter(e => e.a && e.b && e.a !== e.b)
    .map(e => ({ lo: e.a < e.b ? e.a : e.b, hi: e.a < e.b ? e.b : e.a }))
    .map(e => ({ ...e, key: edgeKey(e.lo, e.hi) }))
    .sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));

  for (const e of edges) {
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

// interiorExitsFrom(topology, roomId) -> { north, east, south, west } room id or null.
export function interiorExitsFrom(topology, roomId) {
  const id = String(roomId ?? '');
  return interiorCompassLayout(topology).get(id) || { north: null, east: null, south: null, west: null };
}
