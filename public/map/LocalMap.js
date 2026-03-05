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
export function renderLocalMap(world) {
  const seed = String(world?.meta?.seed ?? 'seed');
  const nodeId = String(world?.map?.currentNodeId ?? '');
  const key = seed + '::' + nodeId;
  const size = 61;
  const radius = 30;
  const cell = 14;
  const w = size * cell;
  const canvas = el('canvas', { width: String(w), height: String(w) });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, w, w);
  const mid = Math.floor(size / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - mid;
      const dy = y - mid;
      const inside = inHexMask(dx, dy, radius);
      if (!inside) continue;
      const h = hash32(key + ':' + x + ',' + y);
      const v = h % 97;
      if (v === 0 || v === 1) {
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
  const cx = mid;
  const cy = mid;
  ctx.fillStyle = 'red';
  ctx.beginPath();
  ctx.arc(cx * cell + cell / 2, cy * cell + cell / 2, cell * 0.3, 0, Math.PI * 2);
  ctx.fill();
  return el('div', { class: 'card stack' },
    el('div', {}, el('strong', {}, 'Local (tactical)')),
    canvas
  );
}
