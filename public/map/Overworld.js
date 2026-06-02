// 16-bit style tile overworld. Reads the real node coordinates (v19) and paints a
// viewport of terrain tiles centered on the player, with town/landmark icons on
// discovered nodes, roads between discovered neighbors, and an @ avatar on your
// cell. Terrain is deterministic from the world seed but render-only (never hashed
// into world state). Grid y grows downward, so north is up — matching the engine's
// compass geometry.

import { hash32 } from './hash.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'g', 'path', 'line', 'circle', 'rect', 'polygon', 'polyline', 'text']);

function el(tag, attrs = {}, ...children) {
  const node = SVG_TAGS.has(tag) ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') { try { node.setAttribute('class', String(v)); } catch { /* ignore */ } }
    else if (k === 'style' && v && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

// Terrain palette — two shades per kind for a checkerboard texture.
const TERRAIN = {
  water: { a: '#243d49', b: '#284450', glyph: '', ink: '' },
  grass: { a: '#37491f', b: '#3f5325', glyph: '', ink: '' },
  forest: { a: '#2c3c1b', b: '#314319', glyph: '♣', ink: '#6e8a3c' },
  hills: { a: '#4a3d22', b: '#534626', glyph: '⌒', ink: '#8a7038' },
  mtn: { a: '#463f37', b: '#4f463c', glyph: '▲', ink: '#8c8276' }
};

// Chunky 2×2 terrain blocks → reads as regions, not salt-and-pepper noise.
function terrainKind(seed, gx, gy) {
  const h = hash32(`${seed}|terrain|${gx >> 1}|${gy >> 1}`) % 256;
  if (h < 34) return 'water';
  if (h < 150) return 'grass';
  if (h < 196) return 'forest';
  if (h < 226) return 'hills';
  return 'mtn';
}

function nodeGlyph(node) {
  return String(node?.nodeType) === 'settlement' ? '⌂' : '◆';
}

export function renderOverworld(world, opts = {}) {
  const compact = Boolean(opts?.compact);
  const map = world?.map || {};
  const seed = String(world?.meta?.seed || 'seed');
  const nodes = Array.isArray(map.nodes) ? map.nodes : [];
  const discovered = new Set((Array.isArray(map.discovered) ? map.discovered : []).map(String));

  const byId = new Map(nodes.map(n => [String(n.id), n]));
  const here = byId.get(String(map.currentNodeId || '')) || nodes[0] || null;
  const cx = Number.isInteger(here?.x) ? here.x : 0;
  const cy = Number.isInteger(here?.y) ? here.y : 0;

  // Nodes indexed by grid cell for fast lookup while painting tiles.
  const nodeAtCell = new Map();
  for (const n of nodes) {
    if (Number.isInteger(n.x) && Number.isInteger(n.y)) nodeAtCell.set(`${n.x},${n.y}`, n);
  }

  const tile = compact ? 18 : 24;
  const cols = compact ? 15 : 19;
  const rows = compact ? 9 : 13;
  const halfC = Math.floor(cols / 2);
  const halfR = Math.floor(rows / 2);
  const W = cols * tile;
  const H = rows * tile;

  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`,
    width: '100%',
    height: compact ? String(H) : String(H),
    preserveAspectRatio: 'xMidYMid meet',
    style: { display: 'block', 'shape-rendering': 'crispEdges', 'image-rendering': 'pixelated', borderRadius: '6px' }
  });

  // ── Terrain layer ──────────────────────────────────────────────────────
  const glyphLayer = el('g', {});
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const gx = cx - halfC + c;
      const gy = cy - halfR + r;
      const px = c * tile;
      const py = r * tile;
      const onNode = nodeAtCell.has(`${gx},${gy}`);
      // Towns sit on cleared ground so their icon always reads.
      const kind = onNode ? 'grass' : terrainKind(seed, gx, gy);
      const t = TERRAIN[kind];
      const shade = ((gx + gy) & 1) ? t.b : t.a;
      svg.appendChild(el('rect', { x: px, y: py, width: tile, height: tile, fill: shade }));
      if (t.glyph && !onNode && ((gx * 7 + gy * 3) % 2 === 0)) {
        glyphLayer.appendChild(el('text', {
          x: px + tile / 2, y: py + tile / 2 + tile * 0.28,
          fill: t.ink, 'fill-opacity': 0.7,
          'font-size': Math.round(tile * 0.62),
          'text-anchor': 'middle',
          'font-family': 'ui-monospace, Menlo, monospace'
        }, t.glyph));
      }
    }
  }
  svg.appendChild(glyphLayer);

  // ── Roads between discovered neighbors (clipped to viewport by the svg) ──
  const cellToPx = (gx, gy) => ({
    x: (gx - (cx - halfC)) * tile + tile / 2,
    y: (gy - (cy - halfR)) * tile + tile / 2
  });
  const seenEdge = new Set();
  for (const e of (Array.isArray(map.edges) ? map.edges : [])) {
    const a = String(e?.a ?? ''); const b = String(e?.b ?? '');
    if (!a || !b) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seenEdge.has(key)) continue; seenEdge.add(key);
    if (!discovered.has(a) || !discovered.has(b)) continue;
    const na = byId.get(a); const nb = byId.get(b);
    if (!na || !nb || !Number.isInteger(na.x) || !Number.isInteger(nb.x)) continue;
    const pa = cellToPx(na.x, na.y); const pb = cellToPx(nb.x, nb.y);
    svg.appendChild(el('line', {
      x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y,
      stroke: '#7a6638', 'stroke-opacity': 0.5, 'stroke-width': 2, 'stroke-linecap': 'round'
    }));
  }

  // ── Discovered node icons + labels ──────────────────────────────────────
  for (const n of nodes) {
    const id = String(n.id);
    if (!discovered.has(id)) continue;
    if (!Number.isInteger(n.x) || !Number.isInteger(n.y)) continue;
    if (Math.abs(n.x - cx) > halfC || Math.abs(n.y - cy) > halfR) continue;
    const isHere = id === String(map.currentNodeId || '');
    const p = cellToPx(n.x, n.y);
    if (!isHere) {
      svg.appendChild(el('text', {
        x: p.x, y: p.y + tile * 0.3,
        fill: '#c8a84e', 'font-size': Math.round(tile * 0.78),
        'text-anchor': 'middle', 'font-family': 'ui-monospace, Menlo, monospace'
      }, nodeGlyph(n)));
      const label = String(n.name || '').slice(0, 12);
      if (label) {
        glyphLayer.appendChild(el('text', {
          x: p.x, y: p.y + tile * 0.95,
          fill: '#d4c5a9', 'fill-opacity': 0.85, 'font-size': Math.max(8, Math.round(tile * 0.42)),
          'text-anchor': 'middle', 'font-family': 'ui-monospace, Menlo, monospace'
        }, label));
      }
    }
  }

  // ── Avatar (always centered on the player's cell) ───────────────────────
  {
    const p = cellToPx(cx, cy);
    svg.appendChild(el('rect', {
      x: p.x - tile / 2, y: p.y - tile / 2, width: tile, height: tile,
      fill: 'none', stroke: '#c8a84e', 'stroke-opacity': 0.7, 'stroke-width': 1.5
    }));
    svg.appendChild(el('text', {
      x: p.x, y: p.y + tile * 0.32,
      fill: '#f0e6c8', 'font-size': Math.round(tile * 0.82), 'font-weight': '700',
      'text-anchor': 'middle', 'font-family': 'ui-monospace, Menlo, monospace'
    }, '@'));
  }

  const hereName = String(here?.name || '').trim() || 'Uncharted';
  return el('div', { class: 'play-map overworld' + (compact ? '' : ' overworld-full') },
    el('div', { class: 'play-map-header' },
      el('span', { class: 'play-map-label' }, hereName),
      el('span', { class: 'play-map-tag' }, `${discovered.size} discovered`)
    ),
    svg
  );
}
