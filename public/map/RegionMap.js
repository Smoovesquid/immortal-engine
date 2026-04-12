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
      try { node.setAttribute('class', String(v)); } catch { /* ignore */ }
    } else if (k === 'style' && v && typeof v === 'object') {
      Object.assign(node.style, v);
    } else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v === false || v === null || v === undefined) {
      continue;
    } else {
      node.setAttribute(k, String(v));
    }
  }

  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    if (typeof c === 'string') node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  }
  return node;
}

export function renderRegionMap(map) {
  // "10,000 ft" focuses on discovered nodes + current node.
  const { nodes, pos, hereId } = ringLayout(map);
  const discovered = new Set(Array.isArray(map?.discovered) ? map.discovered.map(String) : []);
  const show = new Set([String(hereId ?? ''), ...discovered].filter(Boolean));

  const view = { minX: -450, maxX: 450, minY: -260, maxY: 260 };
  const fieldR = 9;

  const svg = el('svg', {
    viewBox: '-450 -260 900 520',
    width: '100%',
    height: '520',
    style: { display: 'block' }
  });

  // Background lattice (muted + filled, like Local map vibe)
  drawHexField(svg, view, fieldR, {
    stroke: 'rgba(255,255,255,0.09)',
    fill: 'rgba(255,255,255,0.02)',
    strokeWidth: 1
  });

  // Snap graph positions onto the lattice so node-hexes correspond
  const pos2 = new Map();
  for (const n of nodes) {
    const id = String(n?.id ?? '');
    const p0 = pos.get(id);
    if (!p0) continue;
    const p1 = snapToHexCenter(p0.x, p0.y, fieldR, view);
    pos2.set(id, { x: p1.x, y: p1.y });
  }

  // Map boundary silhouette (10k): fade the hex grid OUTSIDE the region so the map "lives inside" it.
  // We do this by drawing a full-rect path with a hex "hole" using evenodd fill.
  const boundaryR = 245;
  const boundaryPoints = hexPath(0, 0, boundaryR);

  // Fade outside region (rect minus hex)
  const rectD = 'M -450 -260 H 450 V 260 H -450 Z';
  const hexD  = 'M ' + boundaryPoints + ' Z';
  svg.appendChild(el('path', {
    d: rectD + ' ' + hexD,
    fill: 'rgba(11,13,16,0.55)',
    'fill-rule': 'evenodd'
  }));

  // Soft silhouette border (2-pass)
  svg.appendChild(el('polygon', {
    points: boundaryPoints,
    fill: 'none',
    stroke: 'rgba(255,255,255,0.06)',
    'stroke-width': 6
  }));
  svg.appendChild(el('polygon', {
    points: boundaryPoints,
    fill: 'none',
    stroke: 'rgba(255,255,255,0.12)',
    'stroke-width': 2
  }));


  // Snail trail + visited/current fills (filled to avoid “holes” look)
  const visitedIds = nodes
    .filter(n => n && Number.isFinite(n.visitedTurn))
    .sort((a,b) => (a.visitedTurn - b.visitedTurn) || String(a.id).localeCompare(String(b.id)))
    .map(n => String(n.id))
    .filter(id => show.has(id));

  const highlightCenters = [];
  if (hereId && pos2.get(String(hereId))) highlightCenters.push({ kind: 'current', ...pos2.get(String(hereId)) });
  for (const id of visitedIds) {
    const p = pos2.get(id);
    if (p) highlightCenters.push({ kind: 'visited', ...p });
  }

  drawHexHighlights(svg, view, fieldR, highlightCenters, {
    currentFill: 'rgba(255,255,255,0.12)',
    visitedFill: 'rgba(255,255,255,0.07)',
    stroke: 'rgba(255,255,255,0.14)',
    strokeWidth: 1
  });

  // Snail trail lines (only among shown/visited)
  for (let i = 1; i < visitedIds.length; i++) {
    const a = visitedIds[i - 1], b = visitedIds[i];
    const pa = pos2.get(a), pb = pos2.get(b);
    if (!pa || !pb) continue;
    svg.appendChild(el('line', {
      x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y,
      stroke: '#ffffff',
      'stroke-opacity': 0.22,
      'stroke-width': 4,
      'stroke-linecap': 'round'
    }));
  }

  // Edges among shown nodes
  for (const e of (Array.isArray(map?.edges) ? map.edges : [])) {
    const a = String(e?.a ?? '');
    const b = String(e?.b ?? '');
    if (!show.has(a) || !show.has(b)) continue;
    const pa = pos2.get(a), pb = pos2.get(b);
    if (!pa || !pb) continue;
    svg.appendChild(el('line', {
      x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y,
      stroke: '#ffffff',
      'stroke-opacity': 0.16,
      'stroke-width': 2
    }));
  }

  // Node hexes + labels
  for (const n of nodes) {
    const id = String(n?.id ?? '');
    if (!show.has(id)) continue;
    const p = pos2.get(id);
    if (!p) continue;
    const isHere = id === String(hereId ?? '');
    const isDecompressed = Boolean(n?.settlement?.decompressed);

    // Pass S2 — differentiate discovered (decompressed) vs undiscovered nodes
    const nodeFill = isHere
      ? 'rgba(103,212,255,0.25)'
      : isDecompressed
        ? 'rgba(255,255,255,0.18)'
        : 'rgba(255,255,255,0.08)';
    const nodeStroke = isHere
      ? 'rgba(103,212,255,0.6)'
      : isDecompressed
        ? 'rgba(255,255,255,0.25)'
        : 'rgba(255,255,255,0.12)';
    const nodeR = isHere ? 8 : 5;

    svg.appendChild(el('polygon', {
      points: hexPath(p.x, p.y, nodeR),
      fill: nodeFill,
      stroke: nodeStroke,
      'stroke-width': isHere ? 2.5 : 1.5
    }));

    // Pass S2 — current position pulsing ring indicator
    if (isHere) {
      svg.appendChild(el('polygon', {
        points: hexPath(p.x, p.y, 12),
        fill: 'none',
        stroke: 'rgba(103,212,255,0.35)',
        'stroke-width': 1.5,
        'stroke-dasharray': '4,3'
      }));
    }

    const name = String(n?.name || id);
    const labelOpacity = isHere ? 1.0 : isDecompressed ? 0.72 : 0.4;
    svg.appendChild(el('text', {
      x: p.x + 14, y: p.y + 5,
      fill: '#ffffff',
      'fill-opacity': labelOpacity,
      'font-size': isHere ? 13 : 12,
      'font-weight': isHere ? '700' : '400',
      'font-family': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
    }, name));
  }

  return el('div', { class: 'card stack' },
    el('div', {}, el('strong', {}, 'Region (10,000 ft)')),
    el('div', { class: 'small' }, 'Discovered + current node, deterministic, with hex silhouette field + travel trail.'),
    svg
  );
}
