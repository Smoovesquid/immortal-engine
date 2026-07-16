/**
 * Hand-drawn interior renderer — the canonical "grubby graph-paper dungeon map"
 * draw routine, shared by the live LocalMap and the preview harness.
 *
 * Carve-the-void + hatch-the-rock: hatch a rock band hugging each room/corridor
 * outline, re-expose the paper+grid floor inside, ink bold walls on top. Doors
 * swing, windows glaze the exterior walls, furniture reads by material
 * (wood/stone/metal), tokens carry inspect data.
 *
 * DETERMINISTIC: wobble comes from a keyed FNV hash of a seed string — never
 * Math.random — so the same structure always draws the same, and it never
 * shimmers between redraws. (Browser render code, not engine/, but it honours
 * the same no-Math.random discipline so the live map is stable.)
 *
 * createInteriorMap(canvas, { seed }) -> {
 *   draw(model),                 // returns token hitboxes [{x,y,r,token}]
 *   screenToUnit(px,py) -> {ux,uy},
 *   roomAtUnit(model,ux,uy) -> roomId | null,
 *   hitboxes, transform
 * }
 *
 * Scene model:
 * {
 *   material: 'stone'|'timber'|'cave'|'fortified',
 *   rooms:    [{ id, shape:'rect'|'round', cx, cy, w, h | r, name, current? }],
 *   doors:    [{ x, y, orient:'h'|'v' }],
 *   corridors:[{ pts:[[x,y]...], w }],
 *   windows:  [{ x, y, orient, t:'casement'|'slit'|'barred' }],
 *   furniture:[{ type, ux, uy, uw, uh }],
 *   tokens:   [{ type, ux, uy, label, info }]
 * }
 */

const PAPER = '#e8ecdd', GMIN = 'rgba(92,134,120,0.20)', GMAJ = 'rgba(92,134,120,0.40)';
const INK = 'rgba(18,26,48,0.96)', INKSOFT = 'rgba(18,26,48,0.5)';
const FILL = 'rgba(50,56,78,0.06)', ACC = 'rgba(150,60,40,0.85)';
const WARM = 'rgba(232,160,60,0.14)';
const PLAYER = '#c0392b', NPC = '#2a6f8e', MON = '#6b2b2b', LOOT = '#2e8b57', LIGHT = '#e8902a';
const WOODI = 'rgba(96,62,32,0.92)', WOODF = 'rgba(150,96,48,0.16)';
const STONEI = 'rgba(70,78,98,0.92)', STONEF = 'rgba(70,78,98,0.08)';
const METAL = 'rgba(34,40,54,0.95)', CLOTH = 'rgba(232,236,221,0.7)';
const HAND = '"Bradley Hand","Comic Sans MS","Chalkboard SE","Marker Felt",cursive';

import { iconKindFor, drawCreatureIcon } from './creatureIcons.js';
import { floorPlanToPlanModel } from './planModel.js';

const MATERIALS = {
  stone:     { wall: INK, wallW: 3.0, band: 1.3, amp: 1.5, hatch: 'diag' },
  fortified: { wall: 'rgba(14,20,40,0.98)', wallW: 3.6, band: 1.5, amp: 1.0, hatch: 'cross' },
  timber:    { wall: 'rgba(74,52,30,0.95)', wallW: 2.6, band: 1.1, amp: 1.8, hatch: 'diag' },
  cave:      { wall: 'rgba(30,34,44,0.95)', wallW: 2.4, band: 1.4, amp: 2.6, hatch: 'stipple' }
};

export function createInteriorMap(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  let SEED = String(opts.seed || 'map');
  let TT = { s: 24, ox: 0, oy: 0 };
  let HPAT = null, HPKIND = '';
  let HITBOXES = [];

  const h32 = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const jit = (k, a) => (((h32(SEED + '|' + k) % 2000) / 1000) - 1) * a;
  const gx = x => TT.ox + x * TT.s, gy = y => TT.oy + y * TT.s;

  // ── geometry ──
  function roomPoly(r, amp) {
    const k = 'R' + r.id;
    if (r.shape === 'round') {
      const n = 44, p = [];
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; p.push([gx(r.cx) + Math.cos(a) * r.r * TT.s + jit(k + i + 'x', amp), gy(r.cy) + Math.sin(a) * r.r * TT.s + jit(k + i + 'y', amp)]); }
      return p;
    }
    const x0 = r.cx - r.w / 2, y0 = r.cy - r.h / 2;
    const c = [[x0, y0], [x0 + r.w, y0], [x0 + r.w, y0 + r.h], [x0, y0 + r.h]], p = [];
    for (let e = 0; e < 4; e++) {
      const a = c[e], b = c[(e + 1) % 4], ax = gx(a[0]), ay = gy(a[1]), bx = gx(b[0]), by = gy(b[1]);
      const segs = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 16));
      for (let s = 0; s < segs; s++) { const t = s / segs; p.push([ax + (bx - ax) * t + jit(k + e + s + 'x', amp), ay + (by - ay) * t + jit(k + e + s + 'y', amp)]); }
    }
    return p;
  }
  function corrPoly(c) {
    const w = c.w * TT.s / 2, L = [], R = [];
    for (let i = 0; i < c.pts.length; i++) {
      const p = c.pts[i], pr = c.pts[Math.max(0, i - 1)], nx = c.pts[Math.min(c.pts.length - 1, i + 1)];
      let dx = gx(nx[0]) - gx(pr[0]), dy = gy(nx[1]) - gy(pr[1]); const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const px = gx(p[0]), py = gy(p[1]);
      L.push([px - dy * w, py + dx * w]); R.push([px + dy * w, py - dx * w]);
    }
    return L.concat(R.reverse());
  }
  const trace = (p, close = true) => { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); if (close) ctx.closePath(); };
  function inkLoop(p, col, lw, passes) { ctx.strokeStyle = col; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; for (let i = 0; i < passes; i++) { ctx.lineWidth = lw + (i ? 0.4 : 0); trace(p, true); ctx.stroke(); } }

  function hatch(kind) {
    if (HPAT && HPKIND === kind) return HPAT;
    const t = document.createElement('canvas'); t.width = t.height = 10; const x = t.getContext('2d');
    x.strokeStyle = 'rgba(40,50,74,0.38)'; x.lineWidth = 1;
    if (kind === 'stipple') { x.fillStyle = 'rgba(40,50,74,0.4)';[[2, 3], [6, 7], [8, 2], [3, 8]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 0.8, 0, 7); x.fill(); }); }
    else { x.beginPath(); x.moveTo(-2, 12); x.lineTo(12, -2); x.stroke(); x.beginPath(); x.moveTo(-2, 5); x.lineTo(5, -2); x.stroke(); x.beginPath(); x.moveTo(5, 12); x.lineTo(12, 5); x.stroke();
      if (kind === 'cross') { x.beginPath(); x.moveTo(-2, -2); x.lineTo(12, 12); x.stroke(); } }
    HPAT = ctx.createPattern(t, 'repeat'); HPKIND = kind; return HPAT;
  }

  function grid() {
    for (let x = 0; x <= canvas.width; x += TT.s) { const v = Math.round((x - TT.ox) / TT.s); ctx.strokeStyle = v % 5 === 0 ? GMAJ : GMIN; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, canvas.height); ctx.stroke(); }
    for (let y = 0; y <= canvas.height; y += TT.s) { const v = Math.round((y - TT.oy) / TT.s); ctx.strokeStyle = v % 5 === 0 ? GMAJ : GMIN; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(canvas.width, y + .5); ctx.stroke(); }
  }

  function fit(model, padpx) {
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    const ext = (x, y) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
    model.rooms.forEach(r => { if (r.shape === 'round') { ext(r.cx - r.r, r.cy - r.r); ext(r.cx + r.r, r.cy + r.r); } else { ext(r.cx - r.w / 2, r.cy - r.h / 2); ext(r.cx + r.w / 2, r.cy + r.h / 2); } });
    (model.corridors || []).forEach(c => c.pts.forEach(p => ext(p[0], p[1])));
    if (!Number.isFinite(minX)) { TT = { s: 24, ox: padpx, oy: padpx }; return; }
    const B = 1.2; minX -= B; minY -= B; maxX += B; maxY += B; const spanX = maxX - minX, spanY = maxY - minY;
    const s = Math.min((canvas.width - padpx * 2) / spanX, (canvas.height - padpx * 2) / spanY);
    TT = { s, ox: padpx - minX * s + ((canvas.width - padpx * 2) - spanX * s) / 2, oy: padpx - minY * s + ((canvas.height - padpx * 2) - spanY * s) / 2 };
  }

  function openingGap(d, lenSq) { const x = gx(d.x), y = gy(d.y), half = TT.s * lenSq / 2, t = TT.s * 0.55; ctx.fillStyle = PAPER; if (d.orient === 'v') ctx.fillRect(x - t / 2, y - half, t, half * 2); else ctx.fillRect(x - half, y - t / 2, half * 2, t); }
  function doorGlyph(d) {
    const x = gx(d.x), y = gy(d.y), half = TT.s * 0.46; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineCap = 'round';
    if (d.orient === 'v') { ctx.beginPath(); ctx.moveTo(x - 4, y - half); ctx.lineTo(x + 4, y - half); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 4, y + half); ctx.lineTo(x + 4, y + half); ctx.stroke(); ctx.lineWidth = 1.3; ctx.strokeStyle = INKSOFT; ctx.beginPath(); ctx.arc(x, y - half, TT.s * 0.9, Math.PI * 0.5, 0, true); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(x - half, y - 4); ctx.lineTo(x - half, y + 4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + half, y - 4); ctx.lineTo(x + half, y + 4); ctx.stroke(); ctx.lineWidth = 1.3; ctx.strokeStyle = INKSOFT; ctx.beginPath(); ctx.arc(x - half, y, TT.s * 0.9, 0, Math.PI * 0.5); ctx.stroke(); }
  }
  const ln = (x1, y1, x2, y2, col, lw) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  function windowGlyph(d) {
    const x = gx(d.x), y = gy(d.y), kind = d.t || 'casement', H = d.orient === 'h', th = 7;
    const half = TT.s * (d.len || (kind === 'slit' ? 0.42 : 0.7)) / 2;
    ctx.fillStyle = PAPER; if (H) ctx.fillRect(x - half, y - th / 2, half * 2, th); else ctx.fillRect(x - th / 2, y - half, th, half * 2);
    if (H) { ln(x - half, y - th / 2, x + half, y - th / 2, INK, 1.8); ln(x - half, y + th / 2, x + half, y + th / 2, INK, 1.8); ln(x - half, y - th / 2, x - half, y + th / 2, INK, 1.6); ln(x + half, y - th / 2, x + half, y + th / 2, INK, 1.6); }
    else { ln(x - th / 2, y - half, x - th / 2, y + half, INK, 1.8); ln(x + th / 2, y - half, x + th / 2, y + half, INK, 1.8); ln(x - th / 2, y - half, x + th / 2, y - half, INK, 1.6); ln(x - th / 2, y + half, x + th / 2, y + half, INK, 1.6); }
    if (kind === 'slit') { if (H) { ln(x, y - th / 2 + 1, x, y + th / 2 - 1, INK, 2.2); ln(x - half * 0.55, y, x + half * 0.55, y, INK, 2.2); } else { ln(x - th / 2 + 1, y, x + th / 2 - 1, y, INK, 2.2); ln(x, y - half * 0.55, x, y + half * 0.55, INK, 2.2); } }
    else { if (H) ln(x, y - th / 2, x, y + th / 2, INKSOFT, 1.2); else ln(x - th / 2, y, x + th / 2, y, INKSOFT, 1.2); if (kind === 'barred') { if (H) { for (let i = 1; i < 3; i++) { const X = x - half + i * half * 2 / 3; ln(X, y - th / 2, X, y + th / 2, METAL, 2); } } else { for (let i = 1; i < 3; i++) { const Y = y - half + i * half * 2 / 3; ln(x - th / 2, Y, x + th / 2, Y, METAL, 2); } } } }
  }

  // ── furniture ──
  function wrect(x, y, w, h, k, amp = 0.8) { const p = [], pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; for (let e = 0; e < 4; e++) { const a = pts[e], b = pts[(e + 1) % 4]; const segs = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 12)); for (let s = 0; s < segs; s++) { const t = s / segs; p.push([a[0] + (b[0] - a[0]) * t + jit(k + e + s + 'x', amp), a[1] + (b[1] - a[1]) * t + jit(k + e + s + 'y', amp)]); } } return p; }
  function wcirc(cx, cy, r, k, amp = 0.6) { const n = 24, p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; p.push([cx + Math.cos(a) * r + jit(k + i + 'x', amp), cy + Math.sin(a) * r + jit(k + i + 'y', amp)]); } return p; }
  const strk = (p, col, lw, close = true) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); if (close) ctx.closePath(); ctx.stroke(); };
  const fll = (p, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath(); ctx.fill(); };

  function furn(type, ux, uy, uw, uh, k) {
    const bx = gx(ux), by = gy(uy), bw = uw * TT.s, bh = uh * TT.s, cx = bx + bw / 2, cy = by + bh / 2, W = bw, H = bh, x0 = bx, y0 = by;
    switch (type) {
      case 'rug': { const p = wrect(x0, y0, W, H, k); fll(p, 'rgba(150,60,40,0.07)'); strk(p, ACC, 1.6); const inner = wrect(x0 + 6, y0 + 6, W - 12, H - 12, k + 'i'); strk(inner, 'rgba(150,60,40,0.55)', 1); for (let g = x0 + 9; g < x0 + W - 7; g += 7) ln(g, y0 + 7, g + 4, y0 + H - 7, 'rgba(150,60,40,0.32)', 0.8); break; }
      case 'column': { strk(wcirc(cx, cy, Math.min(W, H) * 0.42, k, 0.4), STONEI, 2); ctx.fillStyle = 'rgba(70,78,98,0.45)'; ctx.beginPath(); ctx.arc(cx, cy, Math.min(W, H) * 0.24, 0, 7); ctx.fill(); break; }
      case 'brazier': { strk(wcirc(cx, cy, Math.min(W, H) * 0.32, k, 0.5), STONEI, 2); ctx.fillStyle = ACC;[-4, 0, 4].forEach(dx => { ctx.beginPath(); ctx.moveTo(cx + dx, cy); ctx.quadraticCurveTo(cx + dx + 3, cy - H * 0.18, cx + dx, cy - H * 0.34); ctx.quadraticCurveTo(cx + dx - 3, cy - H * 0.18, cx + dx, cy); ctx.fill(); }); break; }
      case 'hearth': { const p = wrect(x0, y0, W, H, k); fll(p, STONEF); strk(p, STONEI, 2.4); ctx.strokeStyle = STONEI; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx, y0 + H, W * 0.34, Math.PI, 0); ctx.stroke(); ctx.fillStyle = ACC;[-5, 0, 5].forEach(dx => { ctx.beginPath(); ctx.moveTo(cx + dx, y0 + H * 0.95); ctx.quadraticCurveTo(cx + dx + 4, y0 + H * 0.7, cx + dx, y0 + H * 0.55); ctx.quadraticCurveTo(cx + dx - 4, y0 + H * 0.7, cx + dx, y0 + H * 0.95); ctx.fill(); }); break; }
      case 'altar': { const base = wrect(x0 + W * 0.12, cy - H * 0.02, W * 0.76, H * 0.42, k); fll(base, STONEF); strk(base, STONEI, 2.4); const top = wrect(x0 + W * 0.22, cy - H * 0.22, W * 0.56, H * 0.2, k + 't'); fll(top, STONEF); strk(top, STONEI, 1.8); ctx.fillStyle = ACC; ctx.beginPath(); ctx.moveTo(cx, cy - H * 0.46); ctx.quadraticCurveTo(cx + 5, cy - H * 0.3, cx, cy - H * 0.22); ctx.quadraticCurveTo(cx - 5, cy - H * 0.3, cx, cy - H * 0.46); ctx.fill(); break; }
      case 'statue': { const ped = wrect(cx - W * 0.2, y0 + H * 0.62, W * 0.4, H * 0.34, k); fll(ped, STONEF); strk(ped, STONEI, 2.2); strk(wcirc(cx, y0 + H * 0.28, Math.min(W, H) * 0.16, k + 'h', 0.4), STONEI, 1.8); const body = wrect(cx - W * 0.12, y0 + H * 0.38, W * 0.24, H * 0.26, k + 'b'); fll(body, STONEF); strk(body, STONEI, 1.6); break; }
      case 'table': { const p = wrect(x0 + W * 0.14, y0 + H * 0.14, W * 0.72, H * 0.72, k); fll(p, WOODF); strk(p, WOODI, 2); for (let i = 1; i < 3; i++) { const Y = y0 + H * 0.14 + i * (H * 0.72) / 3; ln(x0 + W * 0.18, Y, x0 + W * 0.82, Y, WOODI, 0.8); }[[0.3, -1], [0.7, -1], [0.3, 1], [0.7, 1]].forEach((c, i) => { const X = x0 + W * c[0], Y = c[1] < 0 ? y0 + H * 0.05 : y0 + H * 0.95; const cp = wrect(X - W * 0.08, Y - H * 0.05, W * 0.16, H * 0.1, k + 'c' + i); fll(cp, WOODF); strk(cp, WOODI, 1.3); }); break; }
      case 'longtable': { const p = wrect(x0 + W * 0.05, y0 + H * 0.27, W * 0.9, H * 0.46, k); fll(p, WOODF); strk(p, WOODI, 2); for (let i = 1; i < 3; i++) { const Y = y0 + H * 0.27 + i * (H * 0.46) / 3; ln(x0 + W * 0.08, Y, x0 + W * 0.92, Y, WOODI, 0.8); } const bt = wrect(x0 + W * 0.08, y0 + H * 0.06, W * 0.84, H * 0.13, k + 'bt'); fll(bt, WOODF); strk(bt, WOODI, 1.3); const bb = wrect(x0 + W * 0.08, y0 + H * 0.81, W * 0.84, H * 0.13, k + 'bb'); fll(bb, WOODF); strk(bb, WOODI, 1.3); break; }
      case 'throne': { const seat = wrect(cx - W * 0.2, cy - H * 0.05, W * 0.4, H * 0.42, k); fll(seat, WOODF); strk(seat, WOODI, 2); ctx.strokeStyle = WOODI; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(cx - W * 0.22, cy); ctx.lineTo(cx - W * 0.22, y0 + H * 0.1); ctx.lineTo(cx, y0 - H * 0.02); ctx.lineTo(cx + W * 0.22, y0 + H * 0.1); ctx.lineTo(cx + W * 0.22, cy); ctx.stroke(); ctx.fillStyle = ACC; ctx.beginPath(); ctx.arc(cx, y0 + H * 0.05, 3, 0, 7); ctx.fill(); ln(cx - W * 0.2, cy + H * 0.05, cx - W * 0.2, cy + H * 0.4, WOODI, 2); ln(cx + W * 0.2, cy + H * 0.05, cx + W * 0.2, cy + H * 0.4, WOODI, 2); break; }
      case 'chest': { const p = wrect(x0 + W * 0.12, y0 + H * 0.24, W * 0.76, H * 0.54, k); fll(p, WOODF); strk(p, WOODI, 2); ctx.strokeStyle = WOODI; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx, y0 + H * 0.42, W * 0.34, Math.PI, 0); ctx.stroke(); ln(x0 + W * 0.32, y0 + H * 0.1, x0 + W * 0.32, y0 + H * 0.78, METAL, 2); ln(x0 + W * 0.68, y0 + H * 0.1, x0 + W * 0.68, y0 + H * 0.78, METAL, 2); ctx.fillStyle = ACC; ctx.fillRect(cx - 3, y0 + H * 0.46, 6, 7); break; }
      case 'barrel': { const rr = Math.min(W, H) * 0.4; const ring = wcirc(cx, cy, rr, k, 0.5); fll(ring, WOODF); strk(ring, WOODI, 2); strk(wcirc(cx, cy, rr * 0.66, k + 'm', 0.35), WOODI, 1.1); strk(wcirc(cx, cy, rr * 0.3, k + 'i', 0.25), WOODI, 1); break; }
      case 'crate': { const p = wrect(x0 + W * 0.16, y0 + H * 0.16, W * 0.68, H * 0.68, k); fll(p, WOODF); strk(p, WOODI, 2); ln(x0 + W * 0.16, y0 + H * 0.16, x0 + W * 0.84, y0 + H * 0.84, WOODI, 1.3); ln(x0 + W * 0.84, y0 + H * 0.16, x0 + W * 0.16, y0 + H * 0.84, WOODI, 1.3); break; }
      // OBJ-RUBBLE-1 — the ONE generic wreck treatment: a dust smudge, three seeded
      // shards, a few splinters. Keyed by k so the SAME wreck always lies the same way.
      case 'rubble': { const rr = Math.min(W, H); ctx.fillStyle = 'rgba(70,78,98,0.10)'; ctx.beginPath(); ctx.arc(cx, cy, rr * 0.42, 0, 7); ctx.fill(); const s1 = wrect(cx - rr * 0.30, cy - rr * 0.16, rr * 0.26, rr * 0.16, k + 's1', 1.2); fll(s1, WOODF); strk(s1, WOODI, 1.3); const s2 = wrect(cx + rr * 0.02, cy - rr * 0.02, rr * 0.20, rr * 0.13, k + 's2', 1.2); fll(s2, WOODF); strk(s2, WOODI, 1.2); const s3 = wrect(cx - rr * 0.10, cy + rr * 0.14, rr * 0.16, rr * 0.11, k + 's3', 1.2); fll(s3, WOODF); strk(s3, WOODI, 1.1); ln(cx - rr * 0.36, cy + rr * 0.26, cx - rr * 0.16, cy + rr * 0.34, 'rgba(96,62,32,0.55)', 1.4); ln(cx + rr * 0.18, cy - rr * 0.24, cx + rr * 0.34, cy - rr * 0.14, 'rgba(96,62,32,0.55)', 1.4); ln(cx + rr * 0.10, cy + rr * 0.28, cx + rr * 0.30, cy + rr * 0.24, 'rgba(96,62,32,0.45)', 1.2); break; }
      case 'shelf': { const p = wrect(x0 + W * 0.1, y0, W * 0.8, H, k); fll(p, WOODF); strk(p, WOODI, 2); for (let i = 1; i < 3; i++) ln(x0 + W * 0.1, y0 + i * H / 3, x0 + W * 0.9, y0 + i * H / 3, WOODI, 1.3); for (let r = 0; r < 3; r++) for (let b = 0; b < 5; b++) { const X = x0 + W * 0.16 + b * (W * 0.68) / 5, base = y0 + (r + 1) * H / 3 - 3, hh = (H / 3) * (0.45 + 0.35 * (((b + r) % 3) / 2)); ln(X, base, X, base - hh, 'rgba(96,62,32,0.7)', 2); } break; }
      case 'bed': { const p = wrect(x0 + W * 0.12, y0 + H * 0.08, W * 0.76, H * 0.84, k); fll(p, WOODF); strk(p, WOODI, 2); const m = wrect(x0 + W * 0.18, y0 + H * 0.3, W * 0.64, H * 0.58, k + 'm'); fll(m, CLOTH); strk(m, WOODI, 1); const pil = wrect(x0 + W * 0.2, y0 + H * 0.12, W * 0.6, H * 0.15, k + 'p'); fll(pil, CLOTH); strk(pil, WOODI, 1.2); ln(x0 + W * 0.18, y0 + H * 0.6, x0 + W * 0.82, y0 + H * 0.6, WOODI, 1.2); break; }
      case 'bars': { const p = wrect(x0, y0, W, H, k); strk(p, METAL, 1.6); for (let i = 1; i < 5; i++) ln(x0 + W * i / 5, y0, x0 + W * i / 5, y0 + H, METAL, 2.2); break; }
    }
  }

  // ── tokens ──
  function token(t) {
    const x = gx(t.ux), y = gy(t.uy), r = TT.s * 0.34, type = t.type, label = t.label;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (type === 'player') { ctx.fillStyle = PLAYER; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = 'bold ' + (r * 1.3) + 'px ' + HAND; ctx.fillText('@', x, y + 1); }
    else if (type === 'npc') { ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.strokeStyle = NPC; ctx.lineWidth = 2.4; ctx.stroke(); ctx.fillStyle = NPC; ctx.font = 'bold ' + (r * 1.2) + 'px ' + HAND; ctx.fillText(label || '?', x, y + 1); }
    else if (type === 'mon') {
      // Creature silhouette when the token carries bestiary data; else a lettered disc.
      const info = t.info && (t.info.tags || t.info.ref || t.iconKind) ? t.info : null;
      if (info || t.iconKind) {
        ctx.fillStyle = 'rgba(107,43,43,0.14)'; ctx.beginPath(); ctx.arc(x, y, r * 1.15, 0, 7); ctx.fill(); // faint ground halo
        const ic = t.iconKind ? { kind: t.iconKind, color: t.iconColor, large: t.large, winged: t.winged, horned: t.horned } : iconKindFor(info);
        drawCreatureIcon(ctx, x, y, r * 0.95, { ...ic, seed: String((info && (info.ref || info.name)) || t.iconKind || label || 'mon') });
      } else {
        ctx.fillStyle = MON; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#1a0f0f'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = '#f0e6d8'; ctx.font = 'bold ' + (r * 1.2) + 'px ' + HAND; ctx.fillText(label || '?', x, y + 1); }
    }
    // CORPSE-TRUTH-1 finish — a body on the floor: the SAME fallen mark the other
    // sheets draw (grey body line + head circle, no living ring, no label ring).
    else if (type === 'dead') {
      ctx.strokeStyle = 'rgba(96,98,110,0.9)'; ctx.lineWidth = Math.max(1.2, r * 0.35); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - r * 0.9, y + r * 0.35); ctx.lineTo(x + r * 0.5, y + r * 0.35); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + r * 0.85, y + r * 0.35, r * 0.32, 0, Math.PI * 2); ctx.stroke();
    }
    else if (type === 'loot') { ctx.fillStyle = LOOT; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#15402a'; ctx.lineWidth = 1.4; ctx.stroke(); }
    else if (type === 'light') { ctx.fillStyle = LIGHT; ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, 7); ctx.fill(); ctx.strokeStyle = LIGHT; ctx.lineWidth = 1.4; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke(); } }
    HITBOXES.push({ x, y, r: r * 1.35, token: t });
  }

  // ── draw ──
  // opts.suppressFurnitureIds (Set|array of ids) — OBJ-INK-1: skip drawing the ink
  // glyph for any furniture whose real GLB successfully mounted in the 3-D view, so
  // the mini isn't doubled by an outline beneath it. Absent/empty (the live 2-D
  // LocalMap call) → every glyph is drawn, unchanged. Suppression short-circuits by
  // id but KEEPS the loop index, so the surviving glyphs stay byte-identical (their
  // seeded jitter key is 'F' + i).
  function draw(model, opts = {}) {
    HPAT = null; HITBOXES = [];
    const sup = opts.suppressFurnitureIds instanceof Set ? opts.suppressFurnitureIds
      : Array.isArray(opts.suppressFurnitureIds) ? new Set(opts.suppressFurnitureIds.map(String)) : null;
    const mat = MATERIALS[model.material] || MATERIALS.stone;
    fit(model, 46);
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, canvas.width, canvas.height); grid();
    const voids = [];
    model.rooms.forEach(r => voids.push({ room: r, p: roomPoly(r, mat.amp) }));
    (model.corridors || []).forEach(c => voids.push({ corr: c, p: corrPoly(c) }));
    // rock band
    ctx.strokeStyle = hatch(mat.hatch); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = TT.s * mat.band; voids.forEach(v => { trace(v.p, true); ctx.stroke(); });
    voids.forEach(v => { ctx.save(); trace(v.p, true); ctx.clip(); ctx.fillStyle = PAPER; ctx.fill(); grid(); ctx.restore(); });
    // current-room glow
    const cur = voids.find(v => v.room && v.room.current);
    if (cur) { ctx.save(); trace(cur.p, true); ctx.clip(); ctx.fillStyle = WARM; ctx.fill(); ctx.restore(); }
    // furniture
    (model.furniture || []).forEach((f, i) => { if (sup && f.id != null && sup.has(String(f.id))) return; furn(f.type, f.ux, f.uy, f.uw, f.uh, 'F' + i); });
    // walls
    voids.forEach(v => { if (v.room) inkLoop(v.p, mat.wall, mat.wallW, 2); else inkLoop(v.p, mat.wall, mat.wallW - 0.6, 2); });
    // openings + doors + windows
    (model.doors || []).forEach(d => openingGap(d, 1)); (model.mouths || []).forEach(d => openingGap(d, d.len || 0.8)); (model.doors || []).forEach(doorGlyph);
    (model.windows || []).forEach(windowGlyph);
    // labels
    model.rooms.forEach(r => { const cx = gx(r.cx), cy = gy(r.cy); ctx.save(); ctx.translate(cx, cy - (r.shape === 'round' ? TT.s * 0.9 : TT.s * 1.0)); ctx.rotate(jit('rot' + r.id, 0.03)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; if (r.name) { ctx.fillStyle = 'rgba(18,26,48,0.72)'; ctx.font = '11px ' + HAND; ctx.fillText(r.name, 0, 0); } ctx.restore(); });
    return { voids };
  }

  function drawTokens(model) { (model.tokens || []).forEach(token); return HITBOXES; }

  function screenToUnit(px, py) { const rect = canvas.getBoundingClientRect(); const x = (px - rect.left) * canvas.width / rect.width, y = (py - rect.top) * canvas.height / rect.height; return { ux: (x - TT.ox) / TT.s, uy: (y - TT.oy) / TT.s, x, y }; }
  function roomAtUnit(model, ux, uy) { for (const r of model.rooms) { if (r.shape === 'round') { if (Math.hypot(ux - r.cx, uy - r.cy) <= r.r) return r.id; } else if (ux >= r.cx - r.w / 2 && ux <= r.cx + r.w / 2 && uy >= r.cy - r.h / 2 && uy <= r.cy + r.h / 2) return r.id; } return null; }

  return {
    draw(model) { draw(model); return drawTokens(model); },
    drawBase: draw,
    drawTokens,
    screenToUnit,
    roomAtUnit,
    get hitboxes() { return HITBOXES; },
    get transform() { return { ...TT }; },
    gx, gy,
    setSeed(s) { SEED = String(s || 'map'); }
  };
}

// ── authored plan -> scene model (pure adapter) ─────────────────────────────
// A hand-authored plan from the structure catalog is already scene-model-shaped;
// this applies the dynamic bits: current room, optional fog-of-war, tokens.
export function planToSceneModel(plan, opts = {}) {
  const p = plan || {};
  const currentRoomId = String(opts.currentRoomId ?? p.entry ?? (p.rooms && p.rooms[0] && p.rooms[0].id) ?? '');
  const visited = Array.isArray(opts.visited) && opts.visited.length ? new Set(opts.visited.map(String)) : null;
  const seen = id => !visited || visited.has(String(id));
  const rooms = (Array.isArray(p.rooms) ? p.rooms : []).filter(r => seen(r.id)).map(r => ({
    id: String(r.id),
    shape: r.shape === 'round' ? 'round' : 'rect',
    cx: r.cx, cy: r.cy, w: r.w, h: r.h, r: r.r != null ? r.r : Math.min(r.w || 1, r.h || 1) / 2,
    name: r.name || r.role || r.id,
    current: String(r.id) === currentRoomId
  }));
  const doors = (Array.isArray(p.doors) ? p.doors : []).filter(d => d.a == null || (seen(d.a) && seen(d.b))).map(d => ({ x: d.x, y: d.y, orient: d.orient }));
  const corridors = (Array.isArray(p.corridors) ? p.corridors : []).map(c => ({ pts: c.pts, w: c.w != null ? c.w : 0.7 }));
  return {
    material: p.material || 'stone',
    rooms, doors, corridors,
    mouths: p.mouths || [],
    windows: p.windows || [],
    furniture: p.furniture || [],
    tokens: opts.tokens || []
  };
}

// ── floorPlan -> scene model (pure adapter; no engine imports) ──────────────
// Maps the engine's floorPlan() output onto the renderer's scene model so the
// live map draws real generated dungeons in the hand-drawn style. The shape
// derivation itself (room sizing, corridor dog-legs, door orientation,
// material) is the ONE shared plan-model (planModel.js, TT-DRAW-3) the
// outdoor sheet also consumes — this function only layers the interior
// view's OWN dynamic overlay on top: current-room highlight, fog-of-war
// (visited-filter), and tokens.
export function floorPlanToSceneModel(fp, opts = {}) {
  const currentRoomId = String(opts.currentRoomId ?? '');
  // Fog-of-war: when `visited` is supplied, only explored rooms (and the doors
  // between two explored rooms) are drawn — matching the live map's reveal.
  const visited = Array.isArray(opts.visited) && opts.visited.length ? new Set(opts.visited.map(String)) : null;
  const seen = id => !visited || visited.has(String(id));
  const shape = floorPlanToPlanModel(fp);
  const rooms = shape.rooms.filter(r => seen(r.id)).map(r => ({ ...r, current: String(r.id) === currentRoomId }));
  const corridors = shape.corridors.map(c => ({ pts: c.pts, w: c.w }));
  const doors = shape.doors.filter(d => seen(d.a) && seen(d.b)).map(d => ({ x: d.x, y: d.y, orient: d.orient }));
  return {
    material: shape.material,
    rooms, doors, corridors,
    windows: [],
    // OBJ-MOVE-1 — the floorPlan path draws the caller-supplied engine furniture (with
    // overrides already applied by LocalMap at the renderer boundary). Absent (the
    // procedural fallback + every existing caller) → [] exactly as before.
    furniture: Array.isArray(opts.furniture) ? opts.furniture : [],
    tokens: opts.tokens || []
  };
}
