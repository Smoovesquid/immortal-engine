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

function drawExterior(ctx, world, w, size, cell) {
  const seed = String(world?.meta?.seed ?? 'seed');
  const nodeId = String(world?.map?.currentNodeId ?? '');
  const key = seed + '::' + nodeId;
  const radius = 30;
  const mid = Math.floor(size / 2);

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, w, w);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - mid;
      const dy = y - mid;
      if (!inHexMask(dx, dy, radius)) continue;
      const h = hash32(key + ':' + x + ',' + y);
      if ((h % 97) <= 1) {
        ctx.fillStyle = 'white';
        ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
      }
    }
  }

  ctx.strokeStyle = 'white';
  ctx.lineWidth = 1;
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

  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 3;
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
      if (edge) ctx.strokeRect(x * cell, y * cell, cell, cell);
    }
  }

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
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(x + 1, y + 1, cell * 2 - 2, cell * 2 - 2);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, cell * 2 - 2, cell * 2 - 2);
      }
    }
  }

  // Player marker from canonical local feet position (5 ft per square).
  const { xFt, yFt } = playerFeet(world);
  const ox = (xFt / 5) * cell;
  const oy = (yFt / 5) * cell;
  ctx.fillStyle = 'red';
  ctx.beginPath();
  ctx.arc(mid * cell + cell / 2 + ox, mid * cell + cell / 2 + oy, cell * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawInterior(ctx, world, w) {
  ctx.fillStyle = '#050607';
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

    // room floor
    ctx.fillStyle = '#1b1f24';
    ctx.fillRect(cx - roomW / 2, cy - roomH / 2, roomW, roomH);

    // walls
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(cx - roomW / 2, cy - roomH / 2, roomW, roomH);

    // room id label
    ctx.fillStyle = '#cfd8dc';
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(String(r.id), cx - roomW / 2 + 8, cy - roomH / 2 + 16);
  });

  // doors between adjacent rooms (from topology edges)
  for (const e of edges) {
    const a = centers.get(String(e?.a || ''));
    const b = centers.get(String(e?.b || ''));
    if (!a || !b) continue;

    ctx.strokeStyle = '#f4a261';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(a.cx, a.cy);
    ctx.lineTo(b.cx, b.cy);
    ctx.stroke();
  }

  // Player marker (5 ft per square): offset inside current room by canonical feet position.
  const p = centers.get(roomId);
  if (p) {
    const { xFt, yFt } = playerFeet(world);
    const ox = (xFt / 5) * 12;
    const oy = (yFt / 5) * 12;

    ctx.fillStyle = '#ff2d55';
    ctx.beginPath();
    ctx.arc(p.cx + ox, p.cy + oy, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

function npcsAtCurrentNode(world) {
  const nodeId = String(world?.map?.currentNodeId || '');
  const node = (world?.map?.nodes || []).find(n => n.id === nodeId);
  return Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
}

function renderNpcRoster(world) {
  const npcs = npcsAtCurrentNode(world);
  if (!npcs.length) {
    return el('div', { class: 'small', style: { opacity: '0.6' } }, 'No known persons here.');
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
      met ? `met (trust ${trust}/10)` : null
    ].filter(Boolean).join(' • ');
    return el('div', { class: 'small' },
      el('strong', {}, name),
      tags ? ` — ${tags}` : ''
    );
  });
  return el('div', { class: 'stack', style: { gap: '4px' } }, ...rows);
}

export function renderLocalMap(world) {
  const size = 61;
  const cell = 14;
  const w = size * cell;
  const canvas = el('canvas', { width: String(w), height: String(w), 'data-local-map-debug': 'LOCAL_MAP_DEBUG_V1' });
  const ctx = canvas.getContext('2d');

  const isInterior = Boolean(world?.scene?.interior);
  if (isInterior) drawInterior(ctx, world, w);
  else drawExterior(ctx, world, w, size, cell);

  const structures = structuresAtCurrentNode(world);
  const npcs = npcsAtCurrentNode(world);
  const info = isInterior
    ? `Interior mode • structure=${String(world?.scene?.interior?.structureKey || '')} • room=${String(world?.scene?.interior?.roomId || '')}`
    : `Exterior mode • structures here=${structures.length} • persons here=${npcs.length}`;

  return el('div', { class: 'card stack' },
    el('div', {}, el('strong', {}, 'Local (tactical)')),
    el('div', { style: { color: '#00ffff', fontWeight: '700' } }, 'LOCAL_MAP_DEBUG_V1'),
    el('div', { class: 'small' }, info),
    canvas,
    el('div', { class: 'stack' },
      el('div', {}, el('strong', {}, 'Persons of note')),
      renderNpcRoster(world)
    )
  );
}
