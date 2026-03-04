
import { ringLayout } from './layout.js';
import { hexPath } from './hex.js';
import { drawHexField, drawHexHighlights, snapToHexCenter } from './hexField.js';
function el(tag, attrs = {}, ...children) {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SVG_TAGS = new Set(['svg','g','path','line','circle','rect','polygon','polyline','text']);
  const node = SVG_TAGS.has(tag)
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') {
      try { node.setAttribute('class', String(v)); } catch { node.className = v; }
    }
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

export function renderWorldMap(map) {
  // For now: "30,000 ft" is the same graph visual with a different label.
  const { nodes, byId, adj, pos, hereId } = ringLayout(map);
  const hereId0 = String(map?.currentNodeId ?? '');
  const fallbackHere = hereId0 || String(hereId || '') || String(nodes?.[0]?.id ?? '');
  const hereIdUse = fallbackHere;
  const discovered = new Set(Array.isArray(map?.discovered) ? map.discovered.map(String) : []);
  if (hereIdUse) discovered.add(String(hereIdUse));

  const w = 900, h = 520;
  const view = { minX: -450, maxX: 450, minY: -260, maxY: 260 };
  const fieldR = 18;
  const svg = el('svg', { viewBox: '-450 -260 900 520', width: '100%', height: '520', style: { display: 'block' } });

  // Background lattice (muted + filled)
  drawHexField(svg, view, fieldR, { stroke: 'rgba(255,255,255,0.10)', fill: 'rgba(255,255,255,0.02)', strokeWidth: 1 });

  // Snap graph positions onto the lattice so node-hexes correspond
  const pos2 = new Map();
  for (const n of nodes) {
    const id = String(n?.id ?? '');
    const p0 = pos.get(id);
    if (!p0) continue;
    const p1 = snapToHexCenter(p0.x, p0.y, fieldR, view);
    pos2.set(id, { x: p1.x, y: p1.y });
  }

  // background silhouette: empty hex field
  drawHexField(svg, { minX: -450, maxX: 450, minY: -260, maxY: 260 }, 18, { stroke: 'rgba(255,255,255,0.09)', fill: 'rgba(255,255,255,0.04)', strokeWidth: 1 });
  svg.appendChild(el('rect', {
    x: -450, y: -260, width: 900, height: 520,
    fill: '#0b0d10'
  }));
  // hex silhouette background
  drawHexField(svg, { minX:-450, maxX:450, minY:-260, maxY:260 }, 18);


  // snail trail: visited nodes (deterministic by visitedTurn)
  const visitedIds = nodes
    .filter(n => n && Number.isFinite(n.visitedTurn))
    .sort((a,b) => (a.visitedTurn - b.visitedTurn) || String(a.id).localeCompare(String(b.id)))
    .map(n => String(n.id));
  const highlightCenters = [];
  // current
  if (hereIdUse && pos2.get(hereIdUse)) highlightCenters.push({ kind: 'current', ...pos2.get(hereIdUse) });
  // visited
  for (const id of visitedIds) {
    const p = pos2.get(id);
    if (p) highlightCenters.push({ kind: 'visited', ...p });
  }
  drawHexHighlights(svg, view, fieldR, highlightCenters, {
    currentFill: 'rgba(255,255,255,0.12)',
    visitedFill: 'rgba(255,255,255,0.07)',
    stroke: 'rgba(255,255,255,0.12)',
    strokeWidth: 1
  });
  for (let i = 1; i < visitedIds.length; i++) {
    const a = visitedIds[i-1], b = visitedIds[i];
    const pa = pos2.get(a), pb = pos2.get(b);
    if (!pa || !pb) continue;
    svg.appendChild(el('line', {
      x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y,
      stroke: '#ffffff', 'stroke-opacity': 0.22, 'stroke-width': 4,
      'stroke-linecap': 'round'
    }));
  }

  // edges
  for (const e of (Array.isArray(map?.edges) ? map.edges : [])) {
    const a = String(e?.a ?? '');
    const b = String(e?.b ?? '');
    const pa = pos2.get(a), pb = pos2.get(b);
    if (!pa || !pb) continue;
    svg.appendChild(el('line', {
      x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y,
      stroke: '#ffffff', 'stroke-opacity': 0.18, 'stroke-width': 2
    }));
  }

  // nodes
  for (const n of nodes) {
    const id = String(n?.id ?? '');
    const p = pos2.get(id);
    if (!p) continue;
    const isHere = id === hereIdUse;
    const isDisc = discovered.has(id) || isHere;

    svg.appendChild(el('polygon', {
      points: hexPath(p.x, p.y, isHere ? 13 : 9),
      fill: isHere ? 'rgba(255,255,255,0.18)' : (isDisc ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'),
      stroke: '#000000', 'stroke-opacity': 0.35, 'stroke-width': 2
    }));

    if (isHere || isDisc) {
      const name = String(n?.name || id);
      svg.appendChild(el('text', {
        x: p.x + 14, y: p.y + 5,
        fill: '#ffffff', 'fill-opacity': 0.75,
        'font-size': 12,
        'font-family': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
      }, name));
    }
  }

  return el('div', { class: 'card stack' },
    el('div', {}, el('strong', {}, 'World (30,000 ft)')),
    el('div', { class: 'small' }, 'Deterministic graph view with hex silhouette field + travel trail.'),
    svg
  );
}
