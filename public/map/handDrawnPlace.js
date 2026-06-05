/**
 * Hand-drawn PLACE renderer — the unified-scale prototype.
 *
 * One continuous surface, drawn in the same grubby graph-paper ink as the dungeon:
 * terrain (paths, a stream, groves, fields, fences, a well) with catalog building
 * plans set down ON the land as floor-plan footprints you can see into and walk
 * between. No "you entered a structure" mode switch — the houses are part of the
 * landscape, and room scale is the scale you walk the world at.
 *
 * Reuses the plan format (plans/index.js) and creature icons. Deterministic wobble.
 *
 * createPlaceMap(canvas,{seed}) -> { draw(place), screenToUnit, room/buildingAt, hitboxes }
 *
 * place model:
 * { terrain:{ paths:[{pts,w}], streams:[{pts,w}], bridges:[{x,y}], groves:[{cx,cy,r,n}],
 *             fields:[{cx,cy,w,h}], fences:[{pts}], props:[{type,ux,uy}] },
 *   buildings:[{ plan, ox, oy }],
 *   tokens:[{ type, ux, uy, label, info }] }
 */

import { iconKindFor, drawCreatureIcon } from './creatureIcons.js';

const PAPER = '#e8ecdd', FLOOR = '#efe9d6';
const GMIN = 'rgba(92,134,120,0.18)', GMAJ = 'rgba(92,134,120,0.34)';
const INK = 'rgba(18,26,48,0.96)', INKSOFT = 'rgba(18,26,48,0.5)';
const DIRT = 'rgba(150,120,72,0.5)', DIRTE = 'rgba(110,86,48,0.7)';
const WATER = 'rgba(70,120,140,0.42)', WATERE = 'rgba(40,90,110,0.7)';
const GRASS = 'rgba(70,120,70,0.5)', LEAF = 'rgba(74,120,64,0.85)', LEAFD = 'rgba(48,86,44,0.9)';
const STONE = 'rgba(110,114,124,0.6)';
const WOODI = 'rgba(96,62,32,0.92)', WOODF = 'rgba(150,96,48,0.16)';
const STONEI = 'rgba(70,78,98,0.92)', STONEF = 'rgba(70,78,98,0.08)';
const METAL = 'rgba(34,40,54,0.95)', CLOTH = 'rgba(232,236,221,0.7)', ACC = 'rgba(150,60,40,0.85)';
const PLAYER = '#c0392b', NPC = '#2a6f8e';
const HAND = '"Bradley Hand","Comic Sans MS","Chalkboard SE","Marker Felt",cursive';
const MAT = {
  stone: { wall: INK, w: 3.0 }, fortified: { wall: 'rgba(14,20,40,0.98)', w: 3.4 },
  timber: { wall: 'rgba(74,52,30,0.95)', w: 2.6 }, cave: { wall: 'rgba(30,34,44,0.95)', w: 2.4 }
};

export function createPlaceMap(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  let SEED = String(opts.seed || 'place');
  let TT = { s: 24, ox: 0, oy: 0 };
  let HITBOXES = [];
  const h32 = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const jit = (k, a) => (((h32(SEED + '|' + k) % 1000) / 500) - 1) * a;
  const gx = x => TT.ox + x * TT.s, gy = y => TT.oy + y * TT.s;
  const ln = (x1, y1, x2, y2, col, lw) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };

  function wrect(x, y, w, h, k, amp = 0.8) { const p = [], pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; for (let e = 0; e < 4; e++) { const a = pts[e], b = pts[(e + 1) % 4]; const segs = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 12)); for (let s = 0; s < segs; s++) { const t = s / segs; p.push([a[0] + (b[0] - a[0]) * t + jit(k + e + s + 'x', amp), a[1] + (b[1] - a[1]) * t + jit(k + e + s + 'y', amp)]); } } return p; }
  function wcirc(cx, cy, r, k, amp = 0.6) { const n = 22, p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; p.push([cx + Math.cos(a) * r + jit(k + i + 'x', amp), cy + Math.sin(a) * r + jit(k + i + 'y', amp)]); } return p; }
  const path = (p, close) => { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); if (close) ctx.closePath(); };
  const strk = (p, col, lw, close = true) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; path(p, close); ctx.stroke(); };
  const fll = (p, col) => { ctx.fillStyle = col; path(p, true); ctx.fill(); };

  function fit(place, pad) {
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    const ext = (x, y) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
    for (const b of (place.buildings || [])) for (const r of b.plan.rooms) { const cx = r.cx + b.ox, cy = r.cy + b.oy, rw = (r.w || r.r * 2) / 2, rh = (r.h || r.r * 2) / 2; ext(cx - rw, cy - rh); ext(cx + rw, cy + rh); }
    const T = place.terrain || {};
    (T.paths || []).concat(T.streams || []).forEach(s => s.pts.forEach(p => ext(p[0], p[1])));
    (T.groves || []).forEach(g => { ext(g.cx - g.r, g.cy - g.r); ext(g.cx + g.r, g.cy + g.r); });
    (T.fields || []).forEach(f => { ext(f.cx - f.w / 2, f.cy - f.h / 2); ext(f.cx + f.w / 2, f.cy + f.h / 2); });
    (T.props || []).forEach(p => ext(p.ux, p.uy));
    if (!Number.isFinite(minX)) { TT = { s: 24, ox: pad, oy: pad }; return; }
    const B = 1; minX -= B; minY -= B; maxX += B; maxY += B; const sx = maxX - minX, sy = maxY - minY;
    const s = Math.min((canvas.width - pad * 2) / sx, (canvas.height - pad * 2) / sy);
    TT = { s, ox: pad - minX * s + ((canvas.width - pad * 2) - sx * s) / 2, oy: pad - minY * s + ((canvas.height - pad * 2) - sy * s) / 2 };
  }

  function grid() {
    for (let x = 0; x <= canvas.width; x += TT.s) { const v = Math.round((x - TT.ox) / TT.s); ctx.strokeStyle = v % 5 === 0 ? GMAJ : GMIN; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, canvas.height); ctx.stroke(); }
    for (let y = 0; y <= canvas.height; y += TT.s) { const v = Math.round((y - TT.oy) / TT.s); ctx.strokeStyle = v % 5 === 0 ? GMAJ : GMIN; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(canvas.width, y + .5); ctx.stroke(); }
  }

  // ── terrain ──
  function ribbon(seg, fill, edge, kk) {
    const w = seg.w * TT.s / 2, L = [], R = [];
    for (let i = 0; i < seg.pts.length; i++) { const p = seg.pts[i], pr = seg.pts[Math.max(0, i - 1)], nx = seg.pts[Math.min(seg.pts.length - 1, i + 1)]; let dx = gx(nx[0]) - gx(pr[0]), dy = gy(nx[1]) - gy(pr[1]); const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; const px = gx(p[0]), py = gy(p[1]); L.push([px - dy * w + jit(kk + i + 'a', 2), py + dx * w]); R.push([px + dy * w + jit(kk + i + 'b', 2), py - dx * w]); }
    const poly = L.concat(R.reverse()); fll(poly, fill); strk(poly, edge, 1.4);
  }
  function tree(x, y, r, k) { const cx = gx(x), cy = gy(y), rr = r * TT.s; fll(wcirc(cx, cy + rr * 0.1, rr, k, rr * 0.18), LEAF); strk(wcirc(cx, cy + rr * 0.1, rr, k, rr * 0.18), LEAFD, 1.4); ctx.fillStyle = LEAFD; ctx.beginPath(); ctx.arc(cx + jit(k + 'c', 2), cy, rr * 0.28, 0, 7); ctx.fill(); }
  function drawTerrain(T) {
    (T.fields || []).forEach((f, i) => { const x0 = gx(f.cx - f.w / 2), y0 = gy(f.cy - f.h / 2), W = f.w * TT.s, H = f.h * TT.s; ctx.save(); path(wrect(x0, y0, W, H, 'fld' + i), true); ctx.clip(); ctx.fillStyle = 'rgba(150,140,70,0.22)'; ctx.fillRect(x0, y0, W, H); ctx.strokeStyle = 'rgba(120,100,50,0.5)'; ctx.lineWidth = 1.4; for (let gxr = x0 + 4; gxr < x0 + W; gxr += 7) { ctx.beginPath(); ctx.moveTo(gxr, y0); ctx.lineTo(gxr, y0 + H); ctx.stroke(); } ctx.restore(); strk(wrect(x0, y0, W, H, 'fle' + i), 'rgba(90,70,40,0.6)', 1.4); });
    (T.streams || []).forEach((s, i) => { ribbon(s, WATER, WATERE, 'str' + i); s.pts.forEach((p, j) => { if (j % 1 === 0) { const X = gx(p[0]), Y = gy(p[1]); ln(X - 4, Y, X + 4, Y + jit('rip' + i + j, 2), WATERE, 1); } }); });
    (T.paths || []).forEach((p, i) => ribbon(p, DIRT, DIRTE, 'pth' + i));
    (T.bridges || []).forEach((b, i) => { const X = gx(b.x), Y = gy(b.y), s = TT.s * 0.7; ctx.strokeStyle = WOODI; ctx.lineWidth = 2; for (let k = -2; k <= 2; k++) ln(X - s, Y + k * s * 0.4, X + s, Y + k * s * 0.4, WOODI, 1.6); });
    (T.groves || []).forEach((g, i) => { for (let k = 0; k < g.n; k++) { const a = h32('grv' + i + k) % 1000 / 1000 * Math.PI * 2, rad = (h32('grr' + i + k) % 1000 / 1000) * g.r; tree(g.cx + Math.cos(a) * rad, g.cy + Math.sin(a) * rad, 0.55 + (h32('grs' + i + k) % 100) / 300, 't' + i + k); } });
    (T.fences || []).forEach((f, i) => { for (let j = 0; j < f.pts.length - 1; j++) { const a = f.pts[j], b = f.pts[j + 1]; ln(gx(a[0]), gy(a[1]), gx(b[0]), gy(b[1]), 'rgba(90,70,40,0.7)', 1.6); } f.pts.forEach((p, j) => { ctx.fillStyle = 'rgba(90,70,40,0.8)'; ctx.beginPath(); ctx.arc(gx(p[0]), gy(p[1]), 1.8, 0, 7); ctx.fill(); }); });
    (T.props || []).forEach((p, i) => prop(p, i));
  }
  function prop(p, i) {
    const X = gx(p.ux), Y = gy(p.uy);
    if (p.type === 'well') { strk(wcirc(X, Y, TT.s * 0.38, 'wl' + i, 1), STONEI, 2.2); ctx.fillStyle = STONE; ctx.beginPath(); ctx.arc(X, Y, TT.s * 0.22, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(20,30,40,0.5)'; ctx.beginPath(); ctx.arc(X, Y, TT.s * 0.12, 0, 7); ctx.fill(); }
    else if (p.type === 'tree') tree(p.ux, p.uy, p.r || 0.7, 'pt' + i);
    else if (p.type === 'shrub') { ctx.fillStyle = LEAF; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(X + jit('sh' + i + k, 4), Y + jit('shy' + i + k, 4), TT.s * 0.14, 0, 7); ctx.fill(); } }
    else if (p.type === 'rock') { fll(wcirc(X, Y, TT.s * 0.26, 'rk' + i, 2), STONE); strk(wcirc(X, Y, TT.s * 0.26, 'rk' + i, 2), STONEI, 1.4); }
  }

  // ── furniture (subset for buildings on land) ──
  function furn(type, ux, uy, uw, uh, k) {
    const bx = gx(ux), by = gy(uy), W = uw * TT.s, H = uh * TT.s, cx = bx + W / 2, cy = by + H / 2, x0 = bx, y0 = by;
    switch (type) {
      case 'rug': { const p = wrect(x0, y0, W, H, k); fll(p, 'rgba(150,60,40,0.08)'); strk(p, ACC, 1.4); break; }
      case 'hearth': { const p = wrect(x0, y0, W, H, k); fll(p, STONEF); strk(p, STONEI, 2.2); ctx.fillStyle = ACC;[-4, 0, 4].forEach(dx => { ctx.beginPath(); ctx.moveTo(cx + dx, y0 + H * 0.9); ctx.quadraticCurveTo(cx + dx + 3, y0 + H * 0.6, cx + dx, y0 + H * 0.45); ctx.quadraticCurveTo(cx + dx - 3, y0 + H * 0.6, cx + dx, y0 + H * 0.9); ctx.fill(); }); break; }
      case 'table': { const p = wrect(x0 + W * 0.12, y0 + H * 0.12, W * 0.76, H * 0.76, k); fll(p, WOODF); strk(p, WOODI, 1.8); break; }
      case 'longtable': { const p = wrect(x0 + W * 0.05, y0 + H * 0.25, W * 0.9, H * 0.5, k); fll(p, WOODF); strk(p, WOODI, 1.8); break; }
      case 'throne': { const p = wrect(cx - W * 0.2, cy - H * 0.05, W * 0.4, H * 0.4, k); fll(p, WOODF); strk(p, WOODI, 1.8); break; }
      case 'bed': { const p = wrect(x0 + W * 0.12, y0 + H * 0.1, W * 0.76, H * 0.8, k); fll(p, WOODF); strk(p, WOODI, 1.8); const pil = wrect(x0 + W * 0.2, y0 + H * 0.12, W * 0.6, H * 0.18, k + 'p'); fll(pil, CLOTH); strk(pil, WOODI, 1); break; }
      case 'chest': { const p = wrect(x0 + W * 0.12, y0 + H * 0.22, W * 0.76, H * 0.56, k); fll(p, WOODF); strk(p, WOODI, 1.8); ctx.fillStyle = ACC; ctx.fillRect(cx - 2, y0 + H * 0.42, 5, 6); break; }
      case 'barrel': { const rr = Math.min(W, H) * 0.4; fll(wcirc(cx, cy, rr, k, 0.4), WOODF); strk(wcirc(cx, cy, rr, k, 0.4), WOODI, 1.6); break; }
      case 'crate': { const p = wrect(x0 + W * 0.16, y0 + H * 0.16, W * 0.68, H * 0.68, k); fll(p, WOODF); strk(p, WOODI, 1.8); ln(x0 + W * 0.16, y0 + H * 0.16, x0 + W * 0.84, y0 + H * 0.84, WOODI, 1); break; }
      case 'shelf': { const p = wrect(x0 + W * 0.1, y0, W * 0.8, H, k); fll(p, WOODF); strk(p, WOODI, 1.8); for (let i = 1; i < 3; i++) ln(x0 + W * 0.1, y0 + i * H / 3, x0 + W * 0.9, y0 + i * H / 3, WOODI, 1); break; }
      case 'brazier': { strk(wcirc(cx, cy, Math.min(W, H) * 0.3, k, 0.4), STONEI, 1.8); ctx.fillStyle = ACC; ctx.beginPath(); ctx.arc(cx, cy, Math.min(W, H) * 0.14, 0, 7); ctx.fill(); break; }
      case 'altar': { const p = wrect(x0 + W * 0.15, cy - H * 0.05, W * 0.7, H * 0.4, k); fll(p, STONEF); strk(p, STONEI, 2); ctx.fillStyle = ACC; ctx.beginPath(); ctx.arc(cx, cy - H * 0.2, 3, 0, 7); ctx.fill(); break; }
      case 'column': { strk(wcirc(cx, cy, Math.min(W, H) * 0.4, k, 0.3), STONEI, 1.8); ctx.fillStyle = 'rgba(70,78,98,0.4)'; ctx.beginPath(); ctx.arc(cx, cy, Math.min(W, H) * 0.22, 0, 7); ctx.fill(); break; }
      case 'bars': { const p = wrect(x0, y0, W, H, k); strk(p, METAL, 1.4); for (let i = 1; i < 4; i++) ln(x0 + W * i / 4, y0, x0 + W * i / 4, y0 + H, METAL, 1.8); break; }
      case 'statue': { const ped = wrect(cx - W * 0.18, y0 + H * 0.6, W * 0.36, H * 0.34, k); fll(ped, STONEF); strk(ped, STONEI, 1.8); strk(wcirc(cx, y0 + H * 0.3, Math.min(W, H) * 0.16, k + 'h', 0.4), STONEI, 1.6); break; }
      default: { const p = wrect(x0 + W * 0.2, y0 + H * 0.2, W * 0.6, H * 0.6, k); fll(p, WOODF); strk(p, WOODI, 1.4); }
    }
  }

  function roomPoly(r, ox, oy, amp) {
    const k = 'B' + (r._bid || '') + r.id;
    if (r.shape === 'round') { const n = 40, p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; p.push([gx(r.cx + ox) + Math.cos(a) * r.r * TT.s + jit(k + i + 'x', amp), gy(r.cy + oy) + Math.sin(a) * r.r * TT.s + jit(k + i + 'y', amp)]); } return p; }
    const x0 = r.cx + ox - r.w / 2, y0 = r.cy + oy - r.h / 2, c = [[x0, y0], [x0 + r.w, y0], [x0 + r.w, y0 + r.h], [x0, y0 + r.h]], p = [];
    for (let e = 0; e < 4; e++) { const a = c[e], b = c[(e + 1) % 4], ax = gx(a[0]), ay = gy(a[1]), bx = gx(b[0]), by = gy(b[1]); const segs = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 16)); for (let s = 0; s < segs; s++) { const t = s / segs; p.push([ax + (bx - ax) * t + jit(k + e + s + 'x', amp), ay + (by - ay) * t + jit(k + e + s + 'y', amp)]); } }
    return p;
  }

  function drawBuilding(b) {
    const plan = b.plan, ox = b.ox, oy = b.oy, mat = MAT[plan.material] || MAT.stone;
    // drop shadow lifts the footprint off the grass
    ctx.save(); ctx.globalAlpha = 0.13; ctx.fillStyle = '#000';
    for (const r of plan.rooms) { path(roomPoly(r, ox + 0.12, oy + 0.16, 1.2), true); ctx.fill(); }
    ctx.restore();
    // floor fill (warm — reads as 'indoors')
    for (const r of plan.rooms) { const p = roomPoly(r, ox, oy, 1.2); ctx.save(); path(p, true); ctx.clip(); ctx.fillStyle = FLOOR; ctx.fill(); ctx.restore(); }
    // furniture
    for (let i = 0; i < (plan.furniture || []).length; i++) { const f = plan.furniture[i]; furn(f.type, f.ux + ox, f.uy + oy, f.uw, f.uh, 'BF' + plan.id + i); }
    // walls
    for (const r of plan.rooms) { const p = roomPoly(r, ox, oy, 1.2); strk(p, mat.wall, mat.w); strk(p, mat.wall, mat.w); }
    // corridors (as thin floor links)
    for (const c of (plan.corridors || [])) { ctx.strokeStyle = FLOOR; ctx.lineWidth = (c.w || 0.7) * TT.s; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); c.pts.forEach((p, i) => { const X = gx(p[0] + ox), Y = gy(p[1] + oy); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke(); }
    // doors (gap + jamb) and the entry mouth
    const open = (d, len) => { const x = gx(d.x + ox), y = gy(d.y + oy), half = TT.s * len / 2, t = TT.s * 0.5; ctx.fillStyle = FLOOR; if (d.orient === 'v') ctx.fillRect(x - t / 2, y - half, t, half * 2); else ctx.fillRect(x - half, y - t / 2, half * 2, t); };
    for (const d of (plan.doors || [])) { open(d, 0.9); const x = gx(d.x + ox), y = gy(d.y + oy), half = TT.s * 0.45; ctx.strokeStyle = mat.wall; ctx.lineWidth = 1.8; if (d.orient === 'v') { ln(x - 3, y - half, x + 3, y - half, mat.wall, 1.8); ln(x - 3, y + half, x + 3, y + half, mat.wall, 1.8); } else { ln(x - half, y - 3, x - half, y + 3, mat.wall, 1.8); ln(x + half, y - 3, x + half, y + 3, mat.wall, 1.8); } }
    for (const m of (plan.mouths || [])) open(m, m.len || 0.9);
    // windows (simple glazed slot)
    for (const w of (plan.windows || [])) { const x = gx(w.x + ox), y = gy(w.y + oy), half = TT.s * 0.32, th = 6; ctx.fillStyle = FLOOR; if (w.orient === 'h') { ctx.fillRect(x - half, y - th / 2, half * 2, th); ln(x - half, y - th / 2, x + half, y - th / 2, mat.wall, 1.4); ln(x - half, y + th / 2, x + half, y + th / 2, mat.wall, 1.4); } else { ctx.fillRect(x - th / 2, y - half, th, half * 2); ln(x - th / 2, y - half, x - th / 2, y + half, mat.wall, 1.4); ln(x + th / 2, y - half, x + th / 2, y + half, mat.wall, 1.4); } }
    // label
    const e = plan.rooms.find(r => r.id === plan.entry) || plan.rooms[0];
    ctx.fillStyle = 'rgba(18,26,48,0.6)'; ctx.font = '11px ' + HAND; ctx.textAlign = 'center';
    ctx.fillText(plan.name, gx(e.cx + ox), gy(Math.min(...plan.rooms.map(r => r.cy + oy - (r.h || r.r * 2) / 2)) - 0.3));
  }

  function token(t) {
    const x = gx(t.ux), y = gy(t.uy), r = TT.s * 0.34;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (t.type === 'player') { ctx.fillStyle = PLAYER; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = 'bold ' + (r * 1.3) + 'px ' + HAND; ctx.fillText('@', x, y + 1); }
    else if (t.type === 'npc') { ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.strokeStyle = NPC; ctx.lineWidth = 2.2; ctx.stroke(); ctx.fillStyle = NPC; ctx.font = 'bold ' + (r * 1.1) + 'px ' + HAND; ctx.fillText(t.label || '?', x, y + 1); }
    else if (t.type === 'mon') { ctx.fillStyle = 'rgba(107,43,43,0.14)'; ctx.beginPath(); ctx.arc(x, y, r * 1.15, 0, 7); ctx.fill(); const ic = t.info ? iconKindFor(t.info) : { kind: 'quadruped', color: '#6b4a2b' }; drawCreatureIcon(ctx, x, y, r * 0.95, { ...ic, seed: String((t.info && (t.info.ref || t.info.name)) || 'mon') }); }
    HITBOXES.push({ x, y, r: r * 1.3, t });
  }

  // ── fog of war (XCom-style line-of-sight) ──────────────────────────────────
  let EXPLORED = new Set(), LASTPLACE = null, OPAC = null, BOUNDS = null, LASTBLAST = null, CURRENTPLACE = null;
  let SIGHT = opts.sight || 9;

  function placeBounds(place) {
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9; const ext = (x, y) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
    for (const b of (place.buildings || [])) for (const r of b.plan.rooms) { const cx = r.cx + b.ox, cy = r.cy + b.oy, rw = (r.w || r.r * 2) / 2, rh = (r.h || r.r * 2) / 2; ext(cx - rw, cy - rh); ext(cx + rw, cy + rh); }
    const T = place.terrain || {};
    (T.paths || []).concat(T.streams || []).forEach(s => s.pts.forEach(p => ext(p[0], p[1])));
    (T.groves || []).forEach(g => { ext(g.cx - g.r, g.cy - g.r); ext(g.cx + g.r, g.cy + g.r); });
    (T.fields || []).forEach(f => { ext(f.cx - f.w / 2, f.cy - f.h / 2); ext(f.cx + f.w / 2, f.cy + f.h / 2); });
    (T.props || []).forEach(p => ext(p.ux, p.uy));
    if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1, W: 1, H: 1 };
    minX = Math.floor(minX - 2); minY = Math.floor(minY - 2); maxX = Math.ceil(maxX + 2); maxY = Math.ceil(maxY + 2);
    return { minX, minY, maxX, maxY, W: maxX - minX, H: maxY - minY };
  }

  function buildOpacity(place, B) {
    const W = B.W, H = B.H, op = new Uint8Array(W * H);
    const at = (i, j) => (i >= 0 && j >= 0 && i < W && j < H) ? i * H + j : -1;
    const cux = i => B.minX + i + 0.5, cuy = j => B.minY + j + 0.5;
    const setU = (ux, uy, v) => { const k = at(Math.floor(ux - B.minX), Math.floor(uy - B.minY)); if (k >= 0) op[k] = v; };
    // building walls are opaque (you can't see through a wall)
    for (const b of (place.buildings || [])) for (const r of b.plan.rooms) {
      const cx = r.cx + b.ox, cy = r.cy + b.oy;
      if (r.shape === 'round') { for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) { const d = Math.hypot(cux(i) - cx, cuy(j) - cy); if (d >= r.r - 0.6 && d <= r.r + 0.5) { const k = at(i, j); if (k >= 0) op[k] = 1; } } }
      else { const x0 = cx - r.w / 2, x1 = cx + r.w / 2, y0 = cy - r.h / 2, y1 = cy + r.h / 2; for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) { const ux = cux(i), uy = cuy(j); const outer = ux >= x0 - 0.5 && ux <= x1 + 0.5 && uy >= y0 - 0.5 && uy <= y1 + 0.5; const inner = ux >= x0 + 0.5 && ux <= x1 - 0.5 && uy >= y0 + 0.5 && uy <= y1 - 0.5; if (outer && !inner) { const k = at(i, j); if (k >= 0) op[k] = 1; } } }
    }
    // trees + rocks block sight
    const T = place.terrain || {};
    (T.groves || []).forEach((g, gi) => { for (let k = 0; k < g.n; k++) { const a = h32('grv' + gi + k) % 1000 / 1000 * Math.PI * 2, rad = (h32('grr' + gi + k) % 1000 / 1000) * g.r; setU(g.cx + Math.cos(a) * rad, g.cy + Math.sin(a) * rad, 1); } });
    (T.props || []).forEach(p => { if (p.type === 'tree' || p.type === 'rock') setU(p.ux, p.uy, 1); });
    // doors / windows / mouths are see-through — carve them open last
    for (const b of (place.buildings || [])) { const carve = d => setU(d.x + b.ox, d.y + b.oy, 0); (b.plan.doors || []).forEach(carve); (b.plan.mouths || []).forEach(carve); (b.plan.windows || []).forEach(carve); }
    return { op, W, H, at, minX: B.minX, minY: B.minY };
  }

  function visibleFrom(O, px, py, R) {
    const vis = new Set(); const pcx = Math.floor(px - O.minX), pcy = Math.floor(py - O.minY);
    vis.add(pcx + '_' + pcy); const R2 = R * R;
    for (let i = 0; i < O.W; i++) for (let j = 0; j < O.H; j++) {
      const dx = i - pcx, dy = j - pcy; if (dx * dx + dy * dy > R2) continue;
      let cx = pcx, cy = pcy; const ddx = Math.abs(i - pcx), ddy = Math.abs(j - pcy), sx = pcx < i ? 1 : -1, sy = pcy < j ? 1 : -1; let e = ddx - ddy, blocked = false;
      while (!(cx === i && cy === j)) { const e2 = 2 * e; if (e2 > -ddy) { e -= ddy; cx += sx; } if (e2 < ddx) { e += ddx; cy += sy; } if (cx === i && cy === j) break; const k = O.at(cx, cy); if (k >= 0 && O.op[k]) { blocked = true; break; } }
      if (!blocked) vis.add(i + '_' + j);
    }
    return vis;
  }

  function computeFog(place) {
    if (place !== LASTPLACE) { EXPLORED = new Set(); LASTPLACE = place; BOUNDS = placeBounds(place); OPAC = buildOpacity(place, BOUNDS); LASTBLAST = null; }
    const pl = (place.tokens || []).find(t => t.type === 'player'); const px = pl ? pl.ux : BOUNDS.minX, py = pl ? pl.uy : BOUNDS.minY;
    const visible = visibleFrom(OPAC, px, py, SIGHT);
    if (LASTBLAST) { const bi = Math.floor(LASTBLAST.ux - BOUNDS.minX), bj = Math.floor(LASTBLAST.uy - BOUNDS.minY), rr = Math.ceil(LASTBLAST.r); for (let i = -rr; i <= rr; i++) for (let j = -rr; j <= rr; j++) if (i * i + j * j <= LASTBLAST.r * LASTBLAST.r) visible.add((bi + i) + '_' + (bj + j)); }
    for (const k of visible) EXPLORED.add(k);
    return { visible, B: BOUNDS };
  }

  function draw(place) {
    HITBOXES = []; CURRENTPLACE = place; fit(place, 40);
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, canvas.width, canvas.height); grid();
    const fog = (opts.fog !== false) ? computeFog(place) : null;
    const B = fog ? fog.B : null;
    const cellRect = key => { const u = key.indexOf('_'); const i = +key.slice(0, u), j = +key.slice(u + 1); return [gx(B.minX + i) - 0.6, gy(B.minY + j) - 0.6, TT.s + 1.2, TT.s + 1.2]; };

    ctx.save();
    if (fog) { ctx.beginPath(); for (const key of EXPLORED) { const r = cellRect(key); ctx.rect(r[0], r[1], r[2], r[3]); } ctx.clip(); }
    ctx.strokeStyle = GRASS; ctx.lineWidth = 1;
    for (let i = 0; i < 240; i++) { const gxr = (h32('g' + i) % canvas.width), gyr = (h32('gy' + i) % canvas.height); ctx.beginPath(); ctx.moveTo(gxr, gyr); ctx.lineTo(gxr + jit('gt' + i, 2), gyr - 3); ctx.stroke(); }
    drawTerrain(place.terrain || {});
    for (const b of (place.buildings || [])) drawBuilding(b);
    ctx.restore();

    if (fog) { ctx.fillStyle = 'rgba(150,158,140,0.46)'; for (const key of EXPLORED) { if (fog.visible.has(key)) continue; const r = cellRect(key); ctx.fillRect(r[0], r[1], r[2], r[3]); } }
    if (LASTBLAST) { const X = gx(LASTBLAST.ux), Y = gy(LASTBLAST.uy), r = LASTBLAST.r * TT.s; ctx.fillStyle = 'rgba(232,120,40,0.28)'; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(200,80,30,0.85)'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = ACC; for (let a = 0; a < 8; a++) { const ang = a / 8 * Math.PI * 2; ctx.beginPath(); ctx.arc(X + Math.cos(ang) * r * 0.6, Y + Math.sin(ang) * r * 0.6, 2, 0, 7); ctx.fill(); } }

    for (const t of (place.tokens || [])) { if (fog) { const ci = Math.floor(t.ux - B.minX) + '_' + Math.floor(t.uy - B.minY); if (!fog.visible.has(ci)) continue; } token(t); }
    return HITBOXES;
  }

  // Blind-fire: resolve an area-of-effect at a point even in fog. Returns whatever
  // is actually there — hidden enemy, or your ally if you're unlucky.
  function castAt(ux, uy, radius = 1.6) {
    LASTBLAST = { ux, uy, r: radius };
    const hits = [];
    for (const t of ((CURRENTPLACE && CURRENTPLACE.tokens) || [])) { if (t.type === 'player') continue; if (Math.hypot(t.ux - ux, t.uy - uy) <= radius) hits.push(t); }
    return hits;
  }
  function clearBlast() { LASTBLAST = null; }

  function screenToUnit(px, py) { const rect = canvas.getBoundingClientRect(); const x = (px - rect.left) * canvas.width / rect.width, y = (py - rect.top) * canvas.height / rect.height; return { ux: (x - TT.ox) / TT.s, uy: (y - TT.oy) / TT.s }; }
  return { draw, screenToUnit, castAt, clearBlast, get hitboxes() { return HITBOXES; }, gx, gy, get transform() { return { ...TT }; }, setSeed(s) { SEED = String(s || 'place'); }, setSight(n) { SIGHT = n; } };
}
