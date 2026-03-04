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
