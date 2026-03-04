import { hexPath } from './hex.js';

// SVG-safe helper (no .className on SVGElements)
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'style' && v && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) node.style[sk] = String(sv);
    } else {
      node.setAttribute(k, String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function hexSpacing(r) {
  const R = Math.max(2, Number(r || 18));
  const dx = Math.sqrt(3) * R; // pointy-top hex horizontal spacing
  const dy = 1.5 * R;          // pointy-top hex vertical spacing
  return { R, dx, dy };
}

// Snap an (x,y) point to the nearest hex center of a pointy-top lattice.
// Lattice definition matches drawHexField: rows step by dy; odd rows offset by dx/2.
export function snapToHexCenter(x, y, r, viewBox = { minX:-450, minY:-260 }) {
  const { R, dx, dy } = hexSpacing(r);
  const minX = Number(viewBox?.minX ?? -450);
  const minY = Number(viewBox?.minY ?? -260);
  const pad = 2 * R;
  const x0 = (minX - pad);
  const y0 = (minY - pad);

  // Approx row
  const row = Math.round((y - y0) / dy);
  const cy = y0 + row * dy;

  const offset = (row % 2) ? (dx / 2) : 0;
  const col = Math.round((x - (x0 + offset)) / dx);
  const cx = x0 + offset + col * dx;

  return { x: cx, y: cy, row, col };
}

// Draws a large field of hex silhouettes behind the graph.
// Pure rendering: no randomness, no time-based branching.
export function drawHexField(svg, viewBox, r, {
  stroke='rgba(255,255,255,0.10)',
  fill='rgba(255,255,255,0.02)',
  strokeWidth=1
} = {}) {
  const minX = Number(viewBox?.minX ?? -450);
  const maxX = Number(viewBox?.maxX ??  450);
  const minY = Number(viewBox?.minY ?? -260);
  const maxY = Number(viewBox?.maxY ??  260);

  const { R, dx, dy } = hexSpacing(r);

  // Expand bounds a bit so silhouettes cover edges
  const pad = 2 * R;
  const x0 = minX - pad;
  const x1 = maxX + pad;
  const y0 = minY - pad;
  const y1 = maxY + pad;

  let row = 0;
  for (let cy = y0; cy <= y1; cy += dy, row++) {
    const offset = (row % 2) ? (dx / 2) : 0;
    for (let cx = x0; cx <= x1; cx += dx) {
      const x = cx + offset;
      svg.appendChild(svgEl('polygon', {
        points: hexPath(x, cy, R),
        fill,
        stroke,
        'stroke-width': strokeWidth
      }));
    }
  }
}

// Draw filled hexes for “current” and “visited” so the lattice has meaning.
export function drawHexHighlights(svg, viewBox, r, centers, {
  currentFill = 'rgba(255,255,255,0.10)',
  visitedFill = 'rgba(255,255,255,0.06)',
  stroke = 'rgba(255,255,255,0.14)',
  strokeWidth = 1
} = {}) {  // CUBE_CURRENT_HEX_V1: current hex gets a second offset outline for a pseudo-3D look.

  const { R } = hexSpacing(r);
  for (const c of (centers || [])) {
    if (!c || !Number.isFinite(c.x) || !Number.isFinite(c.y)) continue;
    svg.appendChild(svgEl('polygon', {
      points: hexPath(c.x, c.y, R),
      fill: c.kind === 'current' ? currentFill : visitedFill,
      stroke,
      'stroke-width': strokeWidth
    }));
  }
}
