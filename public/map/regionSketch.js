/**
 * Region sketch renderer — the zoomed-out world in the same grubby ink.
 *
 * Draws a generateRegion() model: biome-shaded land, the watershed of streams and
 * rivers, roads threading between settlements with bridges at the crossings, and
 * place markers coloured by their geographic tier (safe green near home, deadly
 * red at the edges). This is the travel scale; you zoom IN to a place to walk it.
 */

const HAND = '"Bradley Hand","Comic Sans MS","Chalkboard SE","Marker Felt",cursive';
const BIOME = {
  water: 'rgba(70,118,140,0.55)', forest: 'rgba(74,108,62,0.5)', plains: 'rgba(150,158,92,0.42)',
  marsh: 'rgba(82,98,68,0.6)', desert: 'rgba(200,180,120,0.5)', mountains: 'rgba(122,122,130,0.5)'
};
const TIER_COL = { 1: '#2e8b57', 2: '#b5902e', 3: '#c0612a', 4: '#a02b2b' };
const h01 = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

export function createRegionSketch(canvas) {
  const ctx = canvas.getContext('2d');
  let T = { s: 16, ox: 0, oy: 0 };
  const gx = x => T.ox + x * T.s, gy = y => T.oy + y * T.s;
  function fit(region, pad) { const s = Math.min((canvas.width - pad * 2) / region.W, (canvas.height - pad * 2) / region.H); T = { s, ox: pad + ((canvas.width - pad * 2) - region.W * s) / 2, oy: pad + ((canvas.height - pad * 2) - region.H * s) / 2 }; }

  function draw(region) {
    fit(region, 20);
    ctx.fillStyle = '#e8ecdd'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < region.H; y++) for (let x = 0; x < region.W; x++) {
      const b = region.biome[y * region.W + x]; ctx.globalAlpha = 0.7 + h01('a' + x + ',' + y) * 0.3;
      ctx.fillStyle = BIOME[b] || '#cdd2c4'; ctx.fillRect(gx(x), gy(y), T.s + 1, T.s + 1);
    }
    ctx.globalAlpha = 1;
    for (let y = 0; y < region.H; y++) for (let x = 0; x < region.W; x++) {
      const b = region.biome[y * region.W + x]; const cx = gx(x) + T.s / 2, cy = gy(y) + T.s / 2;
      if (b === 'mountains' && h01('m' + x + ',' + y) > 0.5) { ctx.strokeStyle = 'rgba(60,60,68,0.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx - T.s * 0.25, cy + T.s * 0.18); ctx.lineTo(cx, cy - T.s * 0.22); ctx.lineTo(cx + T.s * 0.25, cy + T.s * 0.18); ctx.stroke(); }
      else if (b === 'forest' && h01('f' + x + ',' + y) > 0.55) { ctx.fillStyle = 'rgba(48,84,44,0.7)'; ctx.beginPath(); ctx.arc(cx, cy, T.s * 0.16, 0, 7); ctx.fill(); }
    }
    ctx.strokeStyle = 'rgba(92,134,120,0.18)'; ctx.lineWidth = 1;
    for (let x = 0; x <= region.W; x++) { ctx.beginPath(); ctx.moveTo(gx(x), gy(0)); ctx.lineTo(gx(x), gy(region.H)); ctx.stroke(); }
    for (let y = 0; y <= region.H; y++) { ctx.beginPath(); ctx.moveTo(gx(0), gy(y)); ctx.lineTo(gx(region.W), gy(y)); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(40,90,115,0.85)'; ctx.lineWidth = Math.max(1.5, T.s * 0.18); ctx.lineCap = 'round';
    for (const [x1, y1, x2, y2] of region.riverSegs) { ctx.beginPath(); ctx.moveTo(gx(x1) + T.s / 2, gy(y1) + T.s / 2); ctx.lineTo(gx(x2) + T.s / 2, gy(y2) + T.s / 2); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(110,86,48,0.9)'; ctx.lineWidth = Math.max(1.4, T.s * 0.14); ctx.setLineDash([T.s * 0.5, T.s * 0.35]);
    for (const rd of region.roads) { ctx.beginPath(); rd.pts.forEach((p, i) => { const X = gx(p[0]) + T.s / 2, Y = gy(p[1]) + T.s / 2; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(70,50,28,0.95)'; ctx.lineWidth = 1.6;
    for (const b of region.bridges) { const X = gx(b.x) + T.s / 2, Y = gy(b.y) + T.s / 2, s = T.s * 0.4; ctx.beginPath(); ctx.moveTo(X - s, Y - s * 0.5); ctx.lineTo(X + s, Y - s * 0.5); ctx.moveTo(X - s, Y + s * 0.5); ctx.lineTo(X + s, Y + s * 0.5); ctx.stroke(); }
    for (const p of region.places) {
      const X = gx(p.x) + T.s / 2, Y = gy(p.y) + T.s / 2, r = T.s * 0.42, col = TIER_COL[p.tier] || '#666';
      ctx.fillStyle = '#e8ecdd'; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.fillStyle = col; ctx.font = 'bold ' + (r * 1.1) + 'px ' + HAND; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.home ? '@' : ({ town: 'T', hamlet: 'h', keep: 'K', wild: '*', ruin: 'r' }[p.nodeType] || '.'), X, Y + 1);
      ctx.fillStyle = 'rgba(18,26,48,0.78)'; ctx.font = '10px ' + HAND;
      ctx.fillText(`${p.nodeType} T${p.tier}`, X, Y + r + 9);
    }
  }
  return { draw, get transform() { return { ...T }; } };
}
