/**
 * ASCII Map — compact spatial representation for the AI context.
 *
 * Research basis: GVGAI-LLM (arxiv 2508.08501) — LLMs reason about space far
 * better from a compact ASCII grid than from prose. The narrator/referee used to
 * receive only a flat list of exit NAMES; this gives them the actual layout the
 * renderer draws (same `floorPlan` data inside structures, same compass geometry
 * outdoors), so "the AI sees the map."
 *
 * PURE + DETERMINISTIC: derives entirely from world state (node x/y, room gx/gy).
 * Adds nothing to world shape. Safe to call every turn.
 *
 * buildAsciiMap(world) -> {
 *   scale: 'interior' | 'overworld',
 *   here:  string,                       // current room/node name
 *   building?: string,                   // interior only
 *   text:  string,                       // the ASCII grid (monospace)
 *   legend?: string[],                   // interior: letter -> room name
 *   exits: [{ dir, to }]                 // structured, so movement/hover can reuse
 * }  |  null
 */

import { ensureWorld } from '../state.js';
import { exitsFrom } from '../map/mapState.js';
import { floorPlan } from '../structures/floorPlan.js';

export function buildAsciiMap(world) {
  const w = ensureWorld(world);
  const interior = (w.scene?.interior && typeof w.scene.interior === 'object') ? w.scene.interior : null;
  if (interior && interior.structureKey) {
    const st = w.structures?.byId?.[interior.structureKey];
    if (st) {
      const a = interiorAscii(st, String(interior.roomId || ''));
      if (a) return a;
    }
  }
  return overworldAscii(w);
}

// ── Interior: a grid of room cells from floorPlan, doors as connectors ──────
function interiorAscii(st, currentRoomId) {
  const fp = floorPlan(st);
  const rooms = Array.isArray(fp.rooms) ? fp.rooms : [];
  if (!rooms.length) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rooms) {
    minX = Math.min(minX, r.gx); maxX = Math.max(maxX, r.gx);
    minY = Math.min(minY, r.gy); maxY = Math.max(maxY, r.gy);
  }
  if (!Number.isFinite(minX)) return null;

  // Letter per room (A, B, C…); current room renders as '@'.
  const letterOf = new Map();
  rooms.forEach((r, i) => letterOf.set(String(r.id), String.fromCharCode(65 + (i % 26))));

  // Canvas at 2× pitch so odd slots hold door connectors between adjacent cells.
  const cols = (maxX - minX) * 2 + 1;
  const rowsN = (maxY - minY) * 2 + 1;
  const grid = Array.from({ length: rowsN }, () => Array(cols).fill(' '));
  const colOf = gx => (gx - minX) * 2;
  const rowOf = gy => (gy - minY) * 2;

  for (const r of rooms) {
    const ch = String(r.id) === currentRoomId ? '@' : letterOf.get(String(r.id));
    grid[rowOf(r.gy)][colOf(r.gx)] = ch;
  }
  for (const d of (Array.isArray(fp.doors) ? fp.doors : [])) {
    const a = rooms.find(r => String(r.id) === String(d.a));
    const b = rooms.find(r => String(r.id) === String(d.b));
    if (!a || !b) continue;
    const ar = rowOf(a.gy), ac = colOf(a.gx), br = rowOf(b.gy), bc = colOf(b.gx);
    const mr = (ar + br) / 2, mc = (ac + bc) / 2;
    if (Number.isInteger(mr) && Number.isInteger(mc)) grid[mr][mc] = (ar === br) ? '-' : '|';
  }

  const text = grid.map(row => row.join('').replace(/\s+$/, '')).join('\n');
  const legend = rooms.map(r => {
    const isHere = String(r.id) === currentRoomId;
    const tag = isHere ? '@' : letterOf.get(String(r.id));
    const you = isHere ? ' (you)' : '';
    return `${tag}=${r.name || r.role || r.id}${you}`;
  });

  const exits = [];
  for (const d of (Array.isArray(fp.doors) ? fp.doors : [])) {
    let other = null;
    if (String(d.a) === currentRoomId) other = d.b;
    else if (String(d.b) === currentRoomId) other = d.a;
    if (!other) continue;
    const o = rooms.find(r => String(r.id) === String(other));
    if (o) exits.push({ dir: String(d.dir || ''), to: String(o.name || o.role || o.id) });
  }

  const cur = rooms.find(r => String(r.id) === currentRoomId);
  return {
    scale: 'interior',
    building: String(fp.name || 'Building'),
    here: String(cur?.name || cur?.role || currentRoomId || 'unknown'),
    text, legend, exits
  };
}

// ── Overworld: a compass cross of immediate neighbors ──────────────────────
function overworldAscii(w) {
  const map = w.map;
  const id = String(map?.currentNodeId || '');
  const nodes = Array.isArray(map?.nodes) ? map.nodes : [];
  if (!id || !nodes.length) return null;
  const byId = new Map(nodes.map(n => [String(n.id), n]));
  const here = byId.get(id);
  if (!here) return null;

  const ex = exitsFrom(map, id); // { north, east, south, west } neighbor id | null
  const nameOf = nid => { const n = byId.get(String(nid)); return n ? String(n.name || n.id) : null; };
  const N = ex.north ? nameOf(ex.north) : null;
  const E = ex.east ? nameOf(ex.east) : null;
  const S = ex.south ? nameOf(ex.south) : null;
  const W = ex.west ? nameOf(ex.west) : null;

  const center = `@ ${String(here.name || here.id)}`;
  const left = W ? `${W}  --  ` : '';
  const mid = `${left}${center}${E ? `  --  ${E}` : ''}`;
  const centerCol = left.length + Math.floor(center.length / 2);
  const pad = n => ' '.repeat(Math.max(0, n));
  const labelAt = (s, col) => pad(col - Math.floor(s.length / 2)) + s;

  const lines = [];
  if (N) { lines.push(labelAt(N, centerCol)); lines.push(pad(centerCol) + '|'); }
  lines.push(mid);
  if (S) { lines.push(pad(centerCol) + '|'); lines.push(labelAt(S, centerCol)); }

  const exits = [];
  if (N) exits.push({ dir: 'north', to: N });
  if (E) exits.push({ dir: 'east', to: E });
  if (S) exits.push({ dir: 'south', to: S });
  if (W) exits.push({ dir: 'west', to: W });

  return {
    scale: 'overworld',
    here: String(here.name || here.id),
    text: lines.join('\n'),
    exits
  };
}

// Render an asciiMap object into a prompt block (or '' when null).
export function renderAsciiMapBlock(m) {
  if (!m || !m.text) return '';
  const head = m.scale === 'interior'
    ? `LOCAL MAP — ${m.building} (@ = you, in ${m.here}):`
    : `LOCAL MAP — overworld (@ = you, at ${m.here}):`;
  const parts = [head, m.text];
  if (Array.isArray(m.legend) && m.legend.length) parts.push(m.legend.join('  '));
  return parts.join('\n');
}
