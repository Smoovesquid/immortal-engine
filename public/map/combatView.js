// COMBAT VIEW — surface the tactical board on the Map screen during a fight.
//
// While world.combat.active, the Map shows THIS battle board (the overworld map
// returns the moment the fight ends). Two stacked layers, mirroring the
// continuous-map pattern:
//   • a 2D canvas board (always drawn) — the no-WebGL fallback + instant paint;
//   • the 3D board (render3d.mountCombat3D) overlaid opaque on top when WebGL is
//     available. If 3D fails to mount, the 2D board remains — combat is always
//     fully playable in text on the play screen regardless (the board is an aid).
//
// PURE VIEW: combatSceneFromWorld is a read of world.combat; nothing here writes
// world state. The minis show CURRENT positions; the caller re-renders (and this
// re-mounts) when combat state changes. They do not move yet (talk→token next).

import { combatSceneFromWorld } from './combatScene.js';

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') n.className = v;
    else if (k === 'style' && v && typeof v === 'object') Object.assign(n.style, v);
    else if (v === false || v == null) continue;
    else n.setAttribute(k, String(v));
  }
  for (const c of kids.flat()) { if (c == null || c === false) continue; n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
  return n;
}

// One live 3D board at a time (module-level — mirrors v1's full-rebuild model).
let _board = null;    // { ctrl } or null
let _token = 0;       // guards async mounts across re-renders
let _failed = false;  // WebGL/import failed once → 2D board only this session

export function disposeCombatBoard() {
  if (_board && _board.ctrl) { try { _board.ctrl.dispose(); } catch {} }
  _board = null; _token++;
  try { delete window.__combat3d; } catch {}
}

// ── 2D fallback board: cells with the player + enemy tokens (cx east, cy south).
function drawCombatBoard2D(canvas, scene) {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const cssW = Math.max(200, canvas.clientWidth || 700);
  const cssH = Math.max(200, canvas.clientHeight || 420);
  if (canvas.width !== Math.round(cssW * dpr)) canvas.width = Math.round(cssW * dpr);
  if (canvas.height !== Math.round(cssH * dpr)) canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const W = Math.max(1, scene.grid.w), H = Math.max(1, scene.grid.h);
  const pad = 18;
  const cell = Math.max(8, Math.min((cssW - pad * 2) / W, (cssH - pad * 2) / H));
  const bw = cell * W, bh = cell * H;
  const ox = (cssW - bw) / 2, oy = (cssH - bh) / 2;
  const cc = (cx, cy) => [ox + (cx + 0.5) * cell, oy + (cy + 0.5) * cell];

  // board + grid
  ctx.fillStyle = '#5f6c41'; ctx.fillRect(ox, oy, bw, bh);
  ctx.strokeStyle = 'rgba(233,220,182,0.45)'; ctx.lineWidth = 1;
  for (let i = 0; i <= W; i++) { ctx.beginPath(); ctx.moveTo(ox + i * cell, oy); ctx.lineTo(ox + i * cell, oy + bh); ctx.stroke(); }
  for (let j = 0; j <= H; j++) { ctx.beginPath(); ctx.moveTo(ox, oy + j * cell); ctx.lineTo(ox + bw, oy + j * cell); ctx.stroke(); }

  const r = Math.max(5, cell * 0.34);
  const token = (cx, cy, fill, ring, label, dim) => {
    const [x, y] = cc(cx, cy);
    ctx.globalAlpha = dim ? 0.5 : 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = ring; ctx.stroke();
    ctx.globalAlpha = 1;
    if (label && cell >= 22) {
      ctx.fillStyle = dim ? 'rgba(220,220,220,0.7)' : '#f3ecdf';
      ctx.font = `${Math.round(Math.min(13, cell * 0.32))}px Georgia, serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(label, x, y - r - 2);
    }
  };
  // Archetype-keyed colors mirror the 3D figures so the fallback reads the same.
  const ARCH_FILL = { humanoid: '#8a3b2e', beast: '#6f5a39', undead: '#9fb8b0' };
  const ARCH_RING = { humanoid: '#e05038', beast: '#b0883a', undead: '#6fd9c4' };
  for (const e of scene.enemies) {
    const fill = e.defeated ? '#6a5454' : (ARCH_FILL[e.archetype] || '#c0392b');
    const ring = e.defeated ? '#8a7d72' : (e.elite ? '#f2cf5e' : (ARCH_RING[e.archetype] || '#e8806f'));
    token(e.cx, e.cy, fill, ring, e.name, e.defeated);
  }
  token(scene.player.cx, scene.player.cy, '#3388ff', '#d9a441', scene.player.name, false);
}

export function renderCombatBoard(world, opts = {}) {
  disposeCombatBoard();
  const token = _token;
  const scene = combatSceneFromWorld(world); // PURE read of world.combat

  const wrap = el('div', { class: 'combat-board', style: {
    position: 'relative', width: '100%', height: '68vh', minHeight: '360px',
    borderRadius: '6px', overflow: 'hidden', background: '#0b0d12'
  } });

  // 2D base (fallback + instant paint).
  const base = el('canvas', { style: { display: 'block', width: '100%', height: '100%' } });
  // 3D overlay (opaque once mounted, covering the 2D base).
  const layer = el('div', { class: 'combat3d-overlay', style: {
    position: 'absolute', inset: '0', opacity: '0', transition: 'opacity .15s linear'
  } });
  wrap.append(base, layer);

  // Draw the 2D board once laid out, and on resize.
  const draw2d = () => { if (document.contains(base)) { try { drawCombatBoard2D(base, scene); } catch {} } };
  setTimeout(draw2d, 0);
  try { const ro = new ResizeObserver(draw2d); ro.observe(base); wrap.__ro = ro; } catch {}

  // Mount the 3D board on top (lazy Three.js). Graceful: any failure leaves the
  // 2D board showing — combat is never blocked on WebGL.
  if (!_failed) {
    setTimeout(async () => {
      if (token !== _token || !document.contains(layer)) return;
      try {
        const { mountCombat3D } = await import('./render3d.js');
        if (token !== _token || !document.contains(layer)) return;
        const ctrl = await mountCombat3D(layer, scene, {});
        if (token !== _token || !document.contains(layer)) { try { ctrl.dispose(); } catch {} return; }
        _board = { ctrl };
        try { window.__combat3d = ctrl; } catch {}
        layer.style.opacity = '1'; // 3D covers the 2D fallback
      } catch {
        _failed = true; // stay on the 2D board
      }
    }, 0);
  }

  return wrap;
}
