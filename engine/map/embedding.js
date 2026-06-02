import { seedFromString } from '../rng.js';

// ── Deterministic graph → grid embedding ─────────────────────────────────────
// The overworld is an abstract node graph (ring + chords). To draw it as a real
// place — and to make the compass mean geometry instead of a hashed label — every
// node needs a stable position. embedNodes() lays the graph onto an integer tile
// grid, deterministically and using integer math ONLY (no sin/cos/sqrt), so the
// result is identical on every machine and safe to fold into worldHash.
//
// The layout is a pure function of the node-id set + edges. It does NOT depend on
// the world seed or current position, so a fresh game and an upgraded old save
// produce the exact same coordinates for the same graph.
//
// Towns are spaced STEP cells apart, leaving empty ground between them for terrain
// (terrain is render-only paint, never stored, never hashed).

const STEP = 3;
// North is up; screen/grid y grows downward, so south is +y.
const CARD = [
  { dx: 0, dy: -1 }, // north
  { dx: 1, dy: 0 },  // east
  { dx: 0, dy: 1 },  // south
  { dx: -1, dy: 0 }  // west
];

function key(x, y) { return `${x},${y}`; }

// Nearest free cell to (tx,ty) by expanding square rings, scanned in a fixed
// order so the choice is deterministic. r=0 returns the target itself if free.
function nearestFreeCell(tx, ty, occupied) {
  for (let r = 0; r < 256; r++) {
    if (r === 0) {
      if (!occupied.has(key(tx, ty))) return { x: tx, y: ty };
      continue;
    }
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // ring shell only
        const x = tx + dx;
        const y = ty + dy;
        if (!occupied.has(key(x, y))) return { x, y };
      }
    }
  }
  // Pathological fallback (graph far larger than 256 rings — never on a real map).
  return { x: tx, y: ty };
}

// embedNodes(nodes, edges) -> Map<nodeId, {x, y}> (integer grid cells).
export function embedNodes(nodes, edges) {
  const ids = (Array.isArray(nodes) ? nodes : [])
    .map(n => String(n?.id ?? ''))
    .filter(Boolean);
  const pos = new Map();
  if (!ids.length) return pos;

  // Adjacency, neighbor lists sorted for a stable processing order.
  const idSet = new Set(ids);
  const adj = new Map(ids.map(id => [id, []]));
  for (const e of (Array.isArray(edges) ? edges : [])) {
    const a = String(e?.a ?? '');
    const b = String(e?.b ?? '');
    if (!a || !b || a === b) continue;
    if (!idSet.has(a) || !idSet.has(b)) continue;
    adj.get(a).push(b);
    adj.get(b).push(a);
  }
  for (const list of adj.values()) list.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));

  const occupied = new Set();
  const place = (id, x, y) => { pos.set(id, { x, y }); occupied.add(key(x, y)); };

  // Deterministic root: lexicographically smallest id, placed at origin.
  const sortedIds = ids.slice().sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));

  // BFS from each unplaced root (handles disconnected components too).
  for (const root of sortedIds) {
    if (pos.has(root)) continue;
    if (occupied.size === 0) {
      place(root, 0, 0);
    } else {
      // New component: drop it clear of everything placed so far.
      const seed = seedFromString(`embed|comp|${root}`);
      const cell = nearestFreeCell((seed % 7) - 3, ((seed >> 3) % 7) - 3, occupied);
      place(root, cell.x, cell.y);
    }

    const queue = [root];
    while (queue.length) {
      const cur = queue.shift();
      const cp = pos.get(cur);
      // Per-node rotation of the cardinal order spreads neighbors around instead
      // of always budding the same way — deterministic, derived from the id.
      const rot = seedFromString(`embed|dir|${cur}`) % 4;
      const nbrs = adj.get(cur) || [];
      let slot = 0;
      for (const nb of nbrs) {
        if (pos.has(nb)) continue;
        const d = CARD[(rot + slot) % 4];
        slot++;
        const cell = nearestFreeCell(cp.x + d.dx * STEP, cp.y + d.dy * STEP, occupied);
        place(nb, cell.x, cell.y);
        queue.push(nb);
      }
    }
  }

  return pos;
}

export const EMBED_STEP = STEP;
