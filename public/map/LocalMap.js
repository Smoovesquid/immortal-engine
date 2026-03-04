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

// Hex-shaped footprint over a square grid.
// Uses axial coords centered at (0,0): pointy-top axial distance <= R.
// Keeps deterministic rendering: no time, no randomness (hash32 only).
function inHexMask(dx, dy, R) {
  // Map grid deltas -> axial coords (q,r) for a pointy-top "odd-r" style.
  // We treat dy as axial r, and dx shifts with dy/2 to keep symmetry.
  const r = dy;
  const q = dx - Math.floor(dy / 2);
  const s = -q - r;
  const dist = (Math.abs(q) + Math.abs(r) + Math.abs(s)) / 2;
  return dist <= R;
}

export function renderLocalMap(world) {
  // Tactical grid: deterministic obstacles derived from (seed + nodeId + cell).
  const seed = String(world?.meta?.seed ?? 'seed');
  const nodeId = String(world?.map?.currentNodeId ?? '');
  const key = seed + '::' + nodeId;

  // Bigger local view: 61x61 squares (5 ft each) => ~305 ft across.
  // Hex mask radius ~30 gives a hex silhouette over the square grid.
  const size = 61;              // squares across/vertical
  const radius = 30;            // hex radius in squares (fits within 61)
  const cell = 14;              // px per square (visual only)
  const w = size * cell;        // canvas px

  const canvas = el('canvas', { width: String(w), height: String(w), style: { width: '100%', maxWidth: w + 'px', display: 'block' } });
  const ctx = canvas.getContext('2d');

  // background
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(0, 0, w, w);

  const mid = Math.floor(size / 2);

  // grid + mask shading
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - mid;
      const dy = y - mid;
      const inside = inHexMask(dx, dy, radius);

      // faint mask outside the hex
      if (!inside) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(x * cell, y * cell, cell, cell);
        continue;
      }

      // deterministic obstacles (only inside mask)
      const h = hash32(key + ':' + x + ',' + y);
      const v = h % 97;
      if (v === 0 || v === 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
      }
    }
  }

  // grid lines on top (drawn once, across full canvas)
  for (let i = 0; i <= size; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, w); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(w, i * cell); ctx.stroke();
  }

  // player marker at center
  const cx = mid, cy = mid;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(cx * cell + cell / 2, cy * cell + cell / 2, cell * 0.28, 0, Math.PI * 2);
  ctx.fill();

  return el('div', { class: 'card stack' },
    el('div', {}, el('strong', {}, 'Local (tactical)')),
    el('div', { class: 'small' }, 'Hex-shaped footprint of 5-ft squares (~305 ft across). Deterministic mask + obstacles.'),
    canvas
  );
}
