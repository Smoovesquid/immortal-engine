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

// ── Interior drawing (room-based dungeon layout) ────────────────────────
function drawInterior(ctx, world, w) {
  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, w, w);

  const interior = world?.scene?.interior && typeof world.scene.interior === 'object' ? world.scene.interior : null;
  const structureKey = String(interior?.structureKey || '');
  const roomId = String(interior?.roomId || '');
  const st = world?.structures?.byId?.[structureKey];
  const topo = st?.topology && typeof st.topology === 'object' ? st.topology : null;
  const rooms = Array.isArray(topo?.rooms) ? topo.rooms : [];
  const edges = Array.isArray(topo?.edges) ? topo.edges : [];

  const centers = new Map();
  const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, rooms.length))));
  const spacing = 190;
  const roomW = 130;
  const roomH = 90;
  const startX = Math.floor((w - (Math.min(cols, rooms.length) * spacing)) / 2) + 95;
  const rows = Math.max(1, Math.ceil(Math.max(1, rooms.length) / cols));
  const startY = Math.floor((w - (rows * spacing)) / 2) + 95;

  rooms.forEach((r, i) => {
    const c = i % cols;
    const rr = Math.floor(i / cols);
    const cx = startX + c * spacing;
    const cy = startY + rr * spacing;
    centers.set(String(r.id), { cx, cy });

    const isCurrent = String(r.id) === roomId;

    // Room floor
    ctx.fillStyle = isCurrent ? 'rgba(200,168,78,0.08)' : THEME.roomFloor;
    ctx.fillRect(cx - roomW / 2, cy - roomH / 2, roomW, roomH);

    // Room walls
    ctx.strokeStyle = isCurrent ? 'rgba(200,168,78,0.5)' : THEME.roomWall;
    ctx.lineWidth = isCurrent ? 2.5 : 1.5;
    ctx.strokeRect(cx - roomW / 2, cy - roomH / 2, roomW, roomH);

    // Room label — readable, never the raw internal id
    ctx.fillStyle = THEME.roomLabel;
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(isCurrent ? 'You are here' : `Room ${i + 1}`, cx - roomW / 2 + 8, cy - roomH / 2 + 14);
  });

  // Doors between rooms
  for (const e of edges) {
    const a = centers.get(String(e?.a || ''));
    const b = centers.get(String(e?.b || ''));
    if (!a || !b) continue;

    ctx.strokeStyle = THEME.doorStroke;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(a.cx, a.cy);
    ctx.lineTo(b.cx, b.cy);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Player marker
  const p = centers.get(roomId);
  if (p) {
    const { xFt, yFt } = playerFeet(world);
    const ox = (xFt / 5) * 12;
    const oy = (yFt / 5) * 12;

    // Glow
    ctx.beginPath();
    ctx.arc(p.cx + ox, p.cy + oy, 16, 0, Math.PI * 2);
    ctx.fillStyle = THEME.playerGlow;
    ctx.fill();

    // Marker
    ctx.beginPath();
    ctx.arc(p.cx + ox, p.cy + oy, 8, 0, Math.PI * 2);
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
