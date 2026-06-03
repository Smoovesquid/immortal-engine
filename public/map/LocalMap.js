import { hash32 } from './hash.js';

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') node.className = v;
    else if (k === 'style' && v && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === false || v === null || v === undefined) continue;
    else node.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    if (typeof c === 'string') node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  }
  return node;
}

// ── Theme colors ────────────────────────────────────────────────────────
const THEME = {
  bg: '#0d0d0d',
  gridLine: 'rgba(200,168,78,0.06)',
  gridFill: 'rgba(28,24,16,0.9)',
  hexEdge: 'rgba(200,168,78,0.25)',
  hexEdgeGlow: 'rgba(200,168,78,0.08)',
  obstacle: 'rgba(200,168,78,0.15)',
  structureFill: 'rgba(200,168,78,0.25)',
  structureStroke: 'rgba(200,168,78,0.6)',
  playerFill: '#c8a84e',
  playerGlow: 'rgba(200,168,78,0.4)',
  roomFloor: '#1c1810',
  roomWall: 'rgba(200,168,78,0.35)',
  doorStroke: '#c8a84e',
  roomLabel: '#8a7e6a',
  npcName: '#d4c5a9',
};

// ── Geometry helpers ────────────────────────────────────────────────────
function inHexMask(dx, dy, R) {
  const r = dy;
  const q = dx - Math.floor(dy / 2);
  const s = -q - r;
  const dist = (Math.abs(q) + Math.abs(r) + Math.abs(s)) / 2;
  return dist <= R;
}

function structuresAtCurrentNode(world) {
  const nodeId = String(world?.map?.currentNodeId || '');
  const byId = world?.structures?.byId && typeof world.structures.byId === 'object' ? world.structures.byId : {};
  return Object.values(byId)
    .filter(s => String(s?.nodeId || '') === nodeId)
    .sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || '')));
}

function roomLayoutFromTopology(topology) {
  const rooms = Array.isArray(topology?.rooms) ? topology.rooms : [];
  const out = [];
  const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, rooms.length))));
  for (let i = 0; i < rooms.length; i++) {
    out.push({ id: String(rooms[i]?.id || ''), col: i % cols, row: Math.floor(i / cols) });
  }
  return out;
}

function parseFeetIntent(text) {
  const t = String(text || '').toLowerCase();
  const m = t.match(/\b(?:move|step|go)\s+(\d+)\s*ft\s+(north|south|east|west|n|s|e|w)\b/);
  if (!m) return { dxFt: 0, dyFt: 0 };
  const ft = Math.max(0, Number(m[1] || 0));
  const d = String(m[2] || '');
  if (d === 'north' || d === 'n') return { dxFt: 0, dyFt: -ft };
  if (d === 'south' || d === 's') return { dxFt: 0, dyFt: ft };
  if (d === 'east' || d === 'e') return { dxFt: ft, dyFt: 0 };
  if (d === 'west' || d === 'w') return { dxFt: -ft, dyFt: 0 };
  return { dxFt: 0, dyFt: 0 };
}

function projectedFeetFromTimeline(world) {
  const tl = Array.isArray(world?.timeline) ? world.timeline : [];
  let x = 0;
  let y = 0;
  for (const ev of tl) {
    if (!ev || typeof ev !== 'object') continue;
    const data = ev.data && typeof ev.data === 'object' ? ev.data : {};
    const text = String(data.intent || data.text || data.intentText || '');
    const d = parseFeetIntent(text);
    x += d.dxFt;
    y += d.dyFt;
  }
  const clamp = (v) => Math.max(-150, Math.min(150, v));
  return { xFt: clamp(x), yFt: clamp(y) };
}

function playerFeet(world) {
  const pos = world?.party?.[0]?.position && typeof world.party[0].position === 'object' ? world.party[0].position : {};
  if (typeof pos.localFtX === 'number' || typeof pos.localFtY === 'number') {
    return { xFt: Number(pos.localFtX || 0), yFt: Number(pos.localFtY || 0) };
  }
  return projectedFeetFromTimeline(world);
}

// ── Exterior drawing (hex-masked tactical grid) ─────────────────────────
function drawExterior(ctx, world, w, size, cell) {
  const seed = String(world?.meta?.seed ?? 'seed');
  const nodeId = String(world?.map?.currentNodeId ?? '');
  const key = seed + '::' + nodeId;
  const radius = 30;
  const mid = Math.floor(size / 2);

  // Dark background
  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, w, w);

  // Draw hex-masked terrain cells
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - mid;
      const dy = y - mid;
      if (!inHexMask(dx, dy, radius)) continue;

      // Subtle cell fill
      ctx.fillStyle = THEME.gridFill;
      ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);

      // Sparse obstacles / features
      const h = hash32(key + ':' + x + ',' + y);
      if ((h % 97) <= 1) {
        ctx.fillStyle = THEME.obstacle;
        ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
      }
    }
  }

  // Subtle grid lines
  ctx.strokeStyle = THEME.gridLine;
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= size; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, w);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cell);
    ctx.lineTo(w, i * cell);
    ctx.stroke();
  }

  // Hex boundary edge glow
  ctx.lineWidth = 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - mid;
      const dy = y - mid;
      if (!inHexMask(dx, dy, radius)) continue;
      const edge =
        !inHexMask(dx + 1, dy, radius) ||
        !inHexMask(dx - 1, dy, radius) ||
        !inHexMask(dx, dy + 1, radius) ||
        !inHexMask(dx, dy - 1, radius);
      if (edge) {
        // Outer glow
        ctx.strokeStyle = THEME.hexEdgeGlow;
        ctx.lineWidth = 4;
        ctx.strokeRect(x * cell, y * cell, cell, cell);
        // Sharp edge
        ctx.strokeStyle = THEME.hexEdge;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x * cell, y * cell, cell, cell);
      }
    }
  }

  // Structures
  const structures = structuresAtCurrentNode(world);
  if (structures.length) {
    for (let i = 0; i < structures.length; i++) {
      const st = structures[i] || {};
      const baseCol = mid - 8 + (i % 2) * 8;
      const baseRow = mid - 8 + Math.floor(i / 2) * 8;
      const layout = roomLayoutFromTopology(st.topology);
      for (const r of layout) {
        const x = (baseCol + r.col * 2) * cell;
        const y = (baseRow + r.row * 2) * cell;
        ctx.fillStyle = THEME.structureFill;
        ctx.fillRect(x + 1, y + 1, cell * 2 - 2, cell * 2 - 2);
        ctx.strokeStyle = THEME.structureStroke;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 1, y + 1, cell * 2 - 2, cell * 2 - 2);
      }
    }
  }

  // Player marker with glow
  const { xFt, yFt } = playerFeet(world);
  const ox = (xFt / 5) * cell;
  const oy = (yFt / 5) * cell;
  const px = mid * cell + cell / 2 + ox;
  const py = mid * cell + cell / 2 + oy;

  // Glow
  ctx.beginPath();
  ctx.arc(px, py, cell * 0.7, 0, Math.PI * 2);
  ctx.fillStyle = THEME.playerGlow;
  ctx.fill();

  // Marker
  ctx.beginPath();
  ctx.arc(px, py, cell * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = THEME.playerFill;
  ctx.fill();
}

// ── Interior compass layout (mirrors engine/structures/topology.js) ──────
// The engine pins every doorway to a reciprocal N/E/S/W slot deterministically.
// We replicate that here (same hash, same algorithm) so the floor plan we draw
// matches the actual movement: the room shown to your north is the one "go north"
// reaches. seedFromString is copied verbatim from engine/rng.js (browser-safe).
function seedFromString(str) {
  const s = String(str ?? '');
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

const I_DIRS = ['north', 'east', 'south', 'west'];
const I_OPP = { north: 'south', south: 'north', east: 'west', west: 'east' };
const I_VEC = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

function edgeKeyOf(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }

function interiorCompassLayout(rooms, edgesIn) {
  const roomIds = new Set(rooms.map(r => String(r?.id || '')));
  const exits = new Map();   // roomId -> { north, east, south, west }
  const taken = new Map();   // roomId -> Set<dir>
  const ensure = (id) => {
    if (!exits.has(id)) exits.set(id, { north: null, east: null, south: null, west: null });
    if (!taken.has(id)) taken.set(id, new Set());
  };

  const edges = (Array.isArray(edgesIn) ? edgesIn : [])
    .map(e => ({ a: String(e?.a || ''), b: String(e?.b || '') }))
    .filter(e => e.a && e.b && e.a !== e.b && roomIds.has(e.a) && roomIds.has(e.b))
    .map(e => ({ lo: e.a < e.b ? e.a : e.b, hi: e.a < e.b ? e.b : e.a }))
    .map(e => ({ ...e, key: edgeKeyOf(e.lo, e.hi) }));

  // de-dupe by key, then sort by key (matches engine ordering)
  const seen = new Set();
  const uniq = [];
  for (const e of edges) { if (!seen.has(e.key)) { seen.add(e.key); uniq.push(e); } }
  uniq.sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));

  for (const e of uniq) {
    ensure(e.lo); ensure(e.hi);
    const start = seedFromString(e.key) % 4;
    for (let k = 0; k < 4; k++) {
      const dLo = I_DIRS[(start + k) % 4];
      const dHi = I_OPP[dLo];
      if (!taken.get(e.lo).has(dLo) && !taken.get(e.hi).has(dHi)) {
        exits.get(e.lo)[dLo] = e.hi;
        exits.get(e.hi)[dHi] = e.lo;
        taken.get(e.lo).add(dLo);
        taken.get(e.hi).add(dHi);
        break;
      }
    }
  }
  for (const r of rooms) ensure(String(r?.id || ''));
  return exits;
}

// Walk the compass graph from the entry room and assign each room an integer
// grid cell (gx,gy). north = up, south = down, east = right, west = left. On a
// collision (the graph isn't always planar) spiral out to the nearest free cell
// so rooms never stack on top of each other.
function placeRoomsOnGrid(rooms, exits, entryId) {
  const pos = new Map();      // id -> {gx,gy}
  const occupied = new Set(); // "gx,gy"
  const key = (x, y) => `${x},${y}`;
  const placed = (x, y) => occupied.has(key(x, y));
  const put = (id, x, y) => { pos.set(id, { gx: x, gy: y }); occupied.add(key(x, y)); };

  const nearestFree = (x, y) => {
    if (!placed(x, y)) return [x, y];
    for (let r = 1; r < 20; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          if (!placed(x + dx, y + dy)) return [x + dx, y + dy];
        }
      }
    }
    return [x, y];
  };

  const queue = [];
  if (entryId) { put(entryId, 0, 0); queue.push(entryId); }

  while (queue.length) {
    const id = queue.shift();
    const here = pos.get(id);
    const ex = exits.get(id) || {};
    for (const dir of I_DIRS) {
      const nb = ex[dir];
      if (!nb || pos.has(nb)) continue;
      const [vx, vy] = I_VEC[dir];
      const [fx, fy] = nearestFree(here.gx + vx, here.gy + vy);
      put(nb, fx, fy);
      queue.push(nb);
    }
  }

  // Any room not reachable from entry (disconnected): drop into a trailing row.
  let stray = 0;
  for (const r of rooms) {
    const id = String(r?.id || '');
    if (id && !pos.has(id)) {
      const [fx, fy] = nearestFree(stray++, 99);
      put(id, fx, fy);
    }
  }
  return pos;
}

function roomLabel(room, index, isCurrent) {
  if (isCurrent) return 'You are here';
  const tags = Array.isArray(room?.tags) ? room.tags.map(t => String(t).toLowerCase()) : [];
  const PRETTY = { entry: 'Entry', hall: 'Hall', stair: 'Stairs', vault: 'Vault', cell: 'Cell', shrine: 'Shrine', kitchen: 'Kitchen', exit: 'Exit' };
  for (const t of tags) if (PRETTY[t]) return PRETTY[t];
  return `Room ${index + 1}`;
}

// ── Interior drawing (true floor-plan layout) ───────────────────────────
function drawInterior(ctx, world, w) {
  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, w, w);

  const interior = world?.scene?.interior && typeof world.scene.interior === 'object' ? world.scene.interior : null;
  const roomId = String(interior?.roomId || '');
  const structureKey = String(interior?.structureKey || '');
  const st = world?.structures?.byId?.[structureKey];
  const topo = st?.topology && typeof st.topology === 'object' ? st.topology : null;
  const rooms = (Array.isArray(topo?.rooms) ? topo.rooms : []).filter(r => r && r.id != null);
  const edges = Array.isArray(topo?.edges) ? topo.edges : [];

  if (!rooms.length) {
    ctx.fillStyle = THEME.roomLabel;
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('Interior', 12, 20);
    return;
  }

  // Stable index per room (sorted by id) for "Room N" labels.
  const sortedIds = rooms.map(r => String(r.id)).sort((a, b) => a.localeCompare(b));
  const indexOf = new Map(sortedIds.map((id, i) => [id, i]));

  // Entry = room tagged 'entry', else lexicographically first (matches engine's
  // normalizeTopology rooms[0], which is where enterStructureInterior drops you).
  const entryRoom = rooms.find(r => (r.tags || []).map(t => String(t).toLowerCase()).includes('entry'));
  const entryId = String(entryRoom?.id || sortedIds[0] || '');

  const exits = interiorCompassLayout(rooms, edges);
  const pos = placeRoomsOnGrid(rooms, exits, entryId);

  // Grid bounds → fit to canvas with padding.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { gx, gy } of pos.values()) {
    if (gx < minX) minX = gx; if (gx > maxX) maxX = gx;
    if (gy < minY) minY = gy; if (gy > maxY) maxY = gy;
  }
  const gw = (maxX - minX) + 1;
  const gh = (maxY - minY) + 1;
  const pad = Math.max(10, Math.round(w * 0.06));
  const pitch = Math.min((w - pad * 2) / gw, (w - pad * 2) / gh);
  const room = pitch * 0.78;            // room box smaller than its cell → gaps read as walls/corridors
  const offX = (w - gw * pitch) / 2 - minX * pitch;
  const offY = (w - gh * pitch) / 2 - minY * pitch;
  const cellCenter = (gx, gy) => ({ cx: offX + gx * pitch + pitch / 2, cy: offY + gy * pitch + pitch / 2 });

  // 1) Corridors first (drawn under rooms): connect every doorway. Cardinally
  //    adjacent rooms get a short door stub; non-adjacent (collision-spiraled)
  //    neighbors get a connecting passage.
  ctx.strokeStyle = THEME.doorStroke;
  for (const r of rooms) {
    const id = String(r.id);
    const a = pos.get(id); if (!a) continue;
    const ex = exits.get(id) || {};
    for (const dir of I_DIRS) {
      const nb = ex[dir]; if (!nb) continue;
      if (id >= nb) continue; // draw each doorway once
      const b = pos.get(nb); if (!b) continue;
      const A = cellCenter(a.gx, a.gy);
      const B = cellCenter(b.gx, b.gy);
      const adjacent = Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy) === 1;
      ctx.lineWidth = adjacent ? room * 0.32 : 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(A.cx, A.cy);
      ctx.lineTo(B.cx, B.cy);
      ctx.stroke();
    }
  }
  ctx.lineCap = 'butt';

  // 2) Rooms on top (so the corridor reads as a door cut into the wall).
  for (const r of rooms) {
    const id = String(r.id);
    const p = pos.get(id); if (!p) continue;
    const { cx, cy } = cellCenter(p.gx, p.gy);
    const x = cx - room / 2;
    const y = cy - room / 2;
    const isCurrent = id === roomId;

    ctx.fillStyle = isCurrent ? 'rgba(200,168,78,0.10)' : THEME.roomFloor;
    ctx.fillRect(x, y, room, room);
    ctx.strokeStyle = isCurrent ? 'rgba(200,168,78,0.65)' : THEME.roomWall;
    ctx.lineWidth = isCurrent ? 2.5 : 1.5;
    ctx.strokeRect(x, y, room, room);

    // Label only when the room box is big enough to hold text (full map).
    if (room >= 56) {
      ctx.fillStyle = isCurrent ? THEME.playerFill : THEME.roomLabel;
      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
      const label = roomLabel(r, indexOf.get(id) ?? 0, isCurrent);
      ctx.fillText(label, x + 6, y + 14);
    }
  }

  // 3) Player marker in the current room.
  const cur = pos.get(roomId);
  if (cur) {
    const { cx, cy } = cellCenter(cur.gx, cur.gy);
    const dot = Math.max(4, room * 0.16);
    ctx.beginPath();
    ctx.arc(cx, cy, dot * 2, 0, Math.PI * 2);
    ctx.fillStyle = THEME.playerGlow;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, dot, 0, Math.PI * 2);
    ctx.fillStyle = THEME.playerFill;
    ctx.fill();
  }
}

// ── NPC roster ──────────────────────────────────────────────────────────
function npcsAtCurrentNode(world) {
  const nodeId = String(world?.map?.currentNodeId || '');
  const node = (world?.map?.nodes || []).find(n => n.id === nodeId);
  return Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
}

function renderNpcRoster(world) {
  const npcs = npcsAtCurrentNode(world);
  if (!npcs.length) {
    return el('div', { class: 'small', style: { opacity: '0.5', fontStyle: 'italic' } }, 'No known persons here.');
  }
  const rows = npcs.map(n => {
    const name = String(n?.name || 'unknown').trim() || 'unknown';
    const role = String(n?.role || '').trim();
    const trust = Number(n?.conversationState?.trustLevel ?? 5);
    const met = Boolean(n?.conversationState?.metPlayer);
    const disp = String(n?.disposition || '').trim();
    const tags = [
      role || null,
      disp || null,
      met ? `trust ${trust}/10` : null
    ].filter(Boolean).join(' · ');
    return el('div', { class: 'small' },
      el('strong', {}, name),
      tags ? ` — ${tags}` : ''
    );
  });
  return el('div', { class: 'stack', style: { gap: '3px' } }, ...rows);
}

// ── Public render function ──────────────────────────────────────────────
/**
 * @param {object} world
 * @param {object} [opts]
 * @param {boolean} [opts.compact] - If true, render a smaller map for embedding in the play screen
 */
export function renderLocalMap(world, opts = {}) {
  const compact = Boolean(opts?.compact);
  const size = compact ? 41 : 61;
  const cell = compact ? 8 : 14;
  const w = size * cell;

  const canvas = el('canvas', {
    width: String(w),
    height: String(w),
    class: compact ? 'local-map-canvas compact' : 'local-map-canvas'
  });
  const ctx = canvas.getContext('2d');

  const isInterior = Boolean(world?.scene?.interior);
  if (isInterior) drawInterior(ctx, world, w);
  else drawExterior(ctx, world, w, size, cell);

  const structures = structuresAtCurrentNode(world);
  const npcs = npcsAtCurrentNode(world);
  // Use the location's readable name, never the raw internal node id. The id is
  // an engine handle (e.g. "n5_1557310534") and must never surface in the UI.
  const curId = String(world?.map?.currentNodeId || '');
  const curNode = (world?.map?.nodes || []).find(n => n && String(n.id) === curId) || null;
  const nodeName = String(curNode?.name || '').trim() || 'Uncharted';

  if (compact) {
    // Compact mode: map canvas only, minimal chrome
    return el('div', { class: 'play-map' },
      el('div', { class: 'play-map-header' },
        el('span', { class: 'play-map-label' }, isInterior ? 'Interior' : nodeName),
        structures.length ? el('span', { class: 'play-map-tag' }, `${structures.length} structure${structures.length > 1 ? 's' : ''}`) : null,
        npcs.length ? el('span', { class: 'play-map-tag' }, `${npcs.length} NPC${npcs.length > 1 ? 's' : ''}`) : null
      ),
      canvas
    );
  }

  // Full mode (used on the dedicated Map screen)
  return el('div', { class: 'card stack' },
    el('div', { class: 'local-map-header' },
      el('strong', {}, 'Local'),
      el('span', { class: 'small' }, isInterior
        ? `Inside · ${String(world?.scene?.interior?.structureKey || 'structure')}`
        : `${nodeName} · ${structures.length} structures · ${npcs.length} persons`)
    ),
    canvas,
    el('div', { class: 'stack', style: { gap: '6px' } },
      el('div', { class: 'local-map-header' }, el('strong', {}, 'Persons of note')),
      renderNpcRoster(world)
    )
  );
}
