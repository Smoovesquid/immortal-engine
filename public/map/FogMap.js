// AoE-style fog-of-war canvas map.
// Three fog states per tile: lit (within FOV), shroud (explored but not current),
// black (never seen). Redraws once per action — no animation loop.
//
// Exports: renderFogMap(world, opts?) → HTMLDivElement (wraps a <canvas>)

import { hash32 } from './hash.js';

const TILE_FULL = 24;
const TILE_COMPACT = 18;
const COLS_FULL = 19;
const ROWS_FULL = 13;
const COLS_COMPACT = 15;
const ROWS_COMPACT = 9;
const DEFAULT_FOV = 3;

// Terrain palette — two alternating shades + optional glyph, same as Overworld.
const TERRAIN = {
  water:  { a: '#243d49', b: '#284450', glyph: null,  ink: null },
  grass:  { a: '#37491f', b: '#3f5325', glyph: null,  ink: null },
  forest: { a: '#2c3c1b', b: '#314319', glyph: '♣',   ink: '#5a7630' },
  hills:  { a: '#4a3d22', b: '#534626', glyph: '⌒', ink: '#7a6030' },
  mtn:    { a: '#463f37', b: '#4f463c', glyph: '▲', ink: '#7a7266' },
};

// nodeType → terrain kind (so settlements show as cleared ground, dungeons as dark stone).
const NODE_KIND = {
  settlement:      'grass',
  wilderness:      'forest',
  landmark:        'hills',
  dungeon_entrance: 'mtn',
};

function terrainKind(seed, gx, gy) {
  // 2×2 chunky blocks so terrain reads as regions, not salt-and-pepper noise.
  const h = hash32(`${seed}|terrain|${gx >> 1}|${gy >> 1}`) % 256;
  if (h <  34) return 'water';
  if (h < 150) return 'grass';
  if (h < 196) return 'forest';
  if (h < 226) return 'hills';
  return 'mtn';
}

// Chebyshev distance (matches engine's nodesWithinSight).
function cheb(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

// 'lit' | 'shroud' | 'black' for a given tile.
function fogState(gx, gy, cx, cy, discoveredNodes, fov) {
  if (cheb(gx, gy, cx, cy) <= fov) return 'lit';
  for (const n of discoveredNodes) {
    if (cheb(gx, gy, n.x, n.y) <= fov) return 'shroud';
  }
  return 'black';
}

export function renderFogMap(world, opts = {}) {
  const compact = Boolean(opts?.compact);
  const fov     = typeof opts?.fovRadius === 'number' ? opts.fovRadius : DEFAULT_FOV;

  const TILE = compact ? TILE_COMPACT : TILE_FULL;
  const COLS = compact ? COLS_COMPACT : COLS_FULL;
  const ROWS = compact ? ROWS_COMPACT : ROWS_FULL;
  const W    = COLS * TILE;
  const H    = ROWS * TILE;

  const map   = world?.map || {};
  const seed  = String(world?.meta?.seed || 'seed');
  const nodes = Array.isArray(map.nodes) ? map.nodes : [];

  const discoveredIds = new Set(
    (Array.isArray(map.discovered) ? map.discovered : []).map(String)
  );

  // Player cell — prefer free-roam pos, fall back to current node.
  const fallbackNode = nodes.find(n => String(n.id) === String(map.currentNodeId || '')) || nodes[0] || null;
  const pos = (map.pos && Number.isInteger(map.pos.x) && Number.isInteger(map.pos.y))
    ? map.pos
    : { x: Number.isInteger(fallbackNode?.x) ? fallbackNode.x : 0,
        y: Number.isInteger(fallbackNode?.y) ? fallbackNode.y : 0 };
  const cx = pos.x;
  const cy = pos.y;

  // Nodes used for shroud calculation — those the player has visited at least once.
  const visitedMem = (map.memory?.visitedTurnByNodeId && typeof map.memory.visitedTurnByNodeId === 'object')
    ? map.memory.visitedTurnByNodeId : {};
  const visitedIds = new Set(Object.keys(visitedMem).map(String));
  const standingNode = nodes.find(n => n.x === cx && n.y === cy) || null;
  if (standingNode) visitedIds.add(String(standingNode.id));

  // Nodes whose sight radius extends the shroud (all visited, with valid coords).
  const shroudSources = nodes.filter(n =>
    visitedIds.has(String(n.id)) && Number.isInteger(n.x) && Number.isInteger(n.y)
  );

  const halfC = Math.floor(COLS / 2);
  const halfR = Math.floor(ROWS / 2);

  // Viewport → pixel helper.
  const cellToPx = (gx, gy) => ({
    x: (gx - (cx - halfC)) * TILE + TILE / 2,
    y: (gy - (cy - halfR)) * TILE + TILE / 2,
  });

  // Fast cell → node lookup.
  const nodeAtCell = new Map();
  for (const n of nodes) {
    if (Number.isInteger(n.x) && Number.isInteger(n.y)) {
      nodeAtCell.set(`${n.x},${n.y}`, n);
    }
  }

  // ── Canvas setup ────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  canvas.style.cssText = 'display:block;width:100%;image-rendering:pixelated;border-radius:6px;';

  const ctx = canvas.getContext('2d');

  // ── Layer 1: terrain ─────────────────────────────────────────────────────
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const gx = cx - halfC + c;
      const gy = cy - halfR + r;
      const px = c * TILE;
      const py = r * TILE;

      const nodeHere = nodeAtCell.get(`${gx},${gy}`);
      const kind  = nodeHere ? (NODE_KIND[nodeHere.nodeType] || 'forest') : terrainKind(seed, gx, gy);
      const t     = TERRAIN[kind];
      const shade = ((gx + gy) & 1) ? t.b : t.a;

      ctx.fillStyle = shade;
      ctx.fillRect(px, py, TILE, TILE);

      if (t.glyph && !nodeHere && ((gx * 7 + gy * 3) % 2 === 0)) {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle   = t.ink;
        ctx.font        = `${Math.round(TILE * 0.62)}px ui-monospace,Menlo,monospace`;
        ctx.textAlign   = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.glyph, px + TILE / 2, py + TILE / 2 + 2);
        ctx.globalAlpha = 1;
      }
    }
  }

  // ── Layer 2: roads (visited nodes only) ─────────────────────────────────
  ctx.lineWidth   = 2;
  ctx.strokeStyle = '#7a6638';
  ctx.globalAlpha = 0.5;
  const seenEdge = new Set();
  for (const e of (Array.isArray(map.edges) ? map.edges : [])) {
    const a = String(e?.a ?? ''), b = String(e?.b ?? '');
    if (!a || !b) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seenEdge.has(key)) continue;
    seenEdge.add(key);
    if (!visitedIds.has(a) || !visitedIds.has(b)) continue;
    const na = nodes.find(n => String(n.id) === a);
    const nb = nodes.find(n => String(n.id) === b);
    if (!na || !nb || !Number.isInteger(na.x) || !Number.isInteger(nb.x)) continue;
    const pa = cellToPx(na.x, na.y), pb = cellToPx(nb.x, nb.y);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // ── Layer 3: node icons + labels (discovered nodes in viewport) ─────────
  for (const n of nodes) {
    const id = String(n.id);
    if (!discoveredIds.has(id)) continue;
    if (!Number.isInteger(n.x) || !Number.isInteger(n.y)) continue;
    if (Math.abs(n.x - cx) > halfC || Math.abs(n.y - cy) > halfR) continue;

    const underAvatar = (n.x === cx && n.y === cy);
    const seenOnly    = !visitedIds.has(id) && !underAvatar;
    const p           = cellToPx(n.x, n.y);

    if (!underAvatar) {
      ctx.globalAlpha  = seenOnly ? 0.5 : 1.0;
      ctx.fillStyle    = seenOnly ? '#7e7456' : '#c8a84e';
      ctx.font         = `${Math.round(TILE * (seenOnly ? 0.6 : 0.78))}px ui-monospace,Menlo,monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(seenOnly ? '○' : (n.nodeType === 'settlement' ? '⌂' : '◆'), p.x, p.y + 2);
      ctx.globalAlpha = 1;
    }

    const label = (seenOnly || underAvatar) ? '' : String(n.name || '').slice(0, 12);
    if (label) {
      ctx.globalAlpha  = 0.85;
      ctx.fillStyle    = '#d4c5a9';
      ctx.font         = `${Math.max(8, Math.round(TILE * 0.42))}px ui-monospace,Menlo,monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, p.x, p.y + TILE * 0.45);
      ctx.globalAlpha = 1;
    }
  }

  // ── Layer 4: creatures (hostile NPCs within viewport, shown only if in FOV) ──
  for (const n of nodes) {
    if (!Number.isInteger(n.x) || !Number.isInteger(n.y)) continue;
    if (Math.abs(n.x - cx) > halfC || Math.abs(n.y - cy) > halfR) continue;
    if (cheb(n.x, n.y, cx, cy) > fov) continue; // only visible within FOV

    const npcs = Array.isArray(n.settlement?.npcs) ? n.settlement.npcs : [];
    const hostileCount  = npcs.filter(npc => npc?.hostile).length;
    const friendlyCount = npcs.filter(npc => npc && !npc.hostile).length;

    if (hostileCount === 0 && friendlyCount === 0) continue;

    const p = cellToPx(n.x, n.y);
    // Draw a dot per presence type, offset so they don't sit on the node icon.
    if (hostileCount > 0) {
      ctx.fillStyle   = '#cc3333';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.arc(p.x + TILE * 0.38, p.y - TILE * 0.28, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (friendlyCount > 0) {
      ctx.fillStyle   = '#33aa66';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.arc(p.x - TILE * 0.38, p.y - TILE * 0.28, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // ── Layer 5: player @ ───────────────────────────────────────────────────
  {
    const p = cellToPx(cx, cy);
    ctx.globalAlpha  = 0.7;
    ctx.strokeStyle  = '#c8a84e';
    ctx.lineWidth    = 1.5;
    ctx.strokeRect(p.x - TILE / 2, p.y - TILE / 2, TILE, TILE);
    ctx.globalAlpha  = 1;
    ctx.fillStyle    = '#f0e6c8';
    ctx.font         = `bold ${Math.round(TILE * 0.82)}px ui-monospace,Menlo,monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('@', p.x, p.y + 2);
  }

  // ── Layer 6: fog overlay ─────────────────────────────────────────────────
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const gx = cx - halfC + c;
      const gy = cy - halfR + r;
      const fog = fogState(gx, gy, cx, cy, shroudSources, fov);
      if (fog === 'lit') continue;
      ctx.fillStyle = fog === 'black' ? '#000000' : 'rgba(0,0,0,0.65)';
      ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
    }
  }

  // Warm torch-glow at the player's cell — drawn after fog so it sits on top.
  {
    const px = halfC * TILE + TILE / 2;
    const py = halfR * TILE + TILE / 2;
    const r  = fov * TILE + TILE;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
    grad.addColorStop(0, 'rgba(255,200,100,0.10)');
    grad.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Wrapper ──────────────────────────────────────────────────────────────
  const hereName = standingNode ? (String(standingNode.name || '').trim() || 'The Wilds') : 'The Wilds';

  const wrap = document.createElement('div');
  wrap.className = 'play-map overworld' + (compact ? '' : ' overworld-full') + ' fog-map';

  const header = document.createElement('div');
  header.className = 'play-map-header';

  const labelEl = document.createElement('span');
  labelEl.className   = 'play-map-label';
  labelEl.textContent = hereName;

  const tagEl = document.createElement('span');
  tagEl.className   = 'play-map-tag';
  tagEl.textContent = `${discoveredIds.size} discovered`;

  header.appendChild(labelEl);
  header.appendChild(tagEl);
  wrap.appendChild(header);
  wrap.appendChild(canvas);

  return wrap;
}
