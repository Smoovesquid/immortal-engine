// ONE MAP — M1: the continuous world camera (docs/ONE_MAP.md).
//
// One canvas, one camera {cx, cy, z}: wheel zoom on the cursor, drag pan,
// semantic LOD that FADES across bands (world → region → settlement) — the
// camera never cuts. Draws the REAL geography (node.x,y in world units) for
// the first time; the old WorldMap's ring layout was a synthetic diagram.
//
// Read-only by design (DM TEST: the map is an aid — travel stays prose/intent
// through playerMove; M2 wires click-to-intent). Camera state is client-only,
// per campaign, never serialized, never hashed. Deterministic terrain: seeded
// from world seed via engine rng — no Math.random.

import { seedFromString, makeRng } from '../../engine/rng.js';
import {
  NODE_WU, Z_MIN, Z_MAX, BAND,
  nodeToWu, worldBounds, fadeIn, discoveryTiers
} from './worldSpace.js';

const PAPER = '#e8ecdd';
const INK = 'rgba(18,26,48,0.96)', INKSOFT = 'rgba(18,26,48,0.5)';
const ROAD = 'rgba(110,84,52,0.55)', ROAD_GHOST = 'rgba(110,84,52,0.22)';
const GROVE = 'rgba(92,134,120,0.16)', GROVE_DARK = 'rgba(74,112,98,0.28)';
const WATERY = 'rgba(96,128,148,0.12)';
const PLAYER = '#c0392b';
const HAND = '"Iowan Old Style","Palatino",Georgia,serif';

// Camera survives v1's full-DOM re-renders: module singleton, per campaign.
const CAMS = new Map();

function cameraFor(world) {
  const key = String(world?.meta?.campaignId || 'campaign');
  if (!CAMS.has(key)) {
    const here = (world?.map?.nodes || []).find(n => n && n.id === world?.map?.currentNodeId);
    const c = here ? nodeToWu(here) : { x: 0, y: 0 };
    CAMS.set(key, { cx: c.x, cy: c.y, z: 0.12 }); // region band — the county frames on open
  }
  return CAMS.get(key);
}

// Deterministic terrain wash: soft groves and pools scattered over the world
// bounds. Pure function of the seed — identical every render, every session.
function terrainFor(world, bounds) {
  const rng = makeRng(seedFromString(`${String(world?.meta?.seed || 'seed')}|onemap|terrain`));
  const w = bounds.maxX - bounds.minX, h = bounds.maxY - bounds.minY;
  const blobs = [];
  const n = 140;
  for (let i = 0; i < n; i++) {
    const kind = rng.nextFloat() < 0.12 ? 'water' : rng.nextFloat() < 0.3 ? 'darkGrove' : 'grove';
    blobs.push({
      kind,
      x: bounds.minX + rng.nextFloat() * w,
      y: bounds.minY + rng.nextFloat() * h,
      r: NODE_WU * (0.12 + rng.nextFloat() * 0.55),
      squash: 0.55 + rng.nextFloat() * 0.6
    });
  }
  return blobs;
}

// A road bows gently and identically forever: bow from the edge key's hash.
function roadBow(aId, bId) {
  const k = aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`;
  return ((seedFromString(`road|${k}`) % 1000) / 1000 - 0.5) * 0.3;
}

export function renderOneMap(world, opts = {}) {
  const map = world?.map || {};
  const nodes = Array.isArray(map.nodes) ? map.nodes : [];
  const cam = cameraFor(world);
  const bounds = worldBounds(nodes);
  const terrain = terrainFor(world, bounds);
  const { known, rumor } = discoveryTiers(map);
  const hereId = String(map.currentNodeId || '');

  const cssH = Math.max(320, Number(opts.height) || 520);
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:100%;user-select:none;';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `display:block;width:100%;height:${cssH}px;border-radius:6px;cursor:grab;touch-action:none;`;
  wrap.appendChild(canvas);

  const hud = document.createElement('div');
  hud.style.cssText = 'position:absolute;left:10px;bottom:8px;font:12px ' + HAND + ';color:rgba(18,26,48,0.75);pointer-events:none;';
  wrap.appendChild(hud);

  const ctx = canvas.getContext('2d');
  const dpr = Math.max(1, Math.min(2, (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1)));

  const toPx = (wx, wy, W, H) => [W / 2 + (wx - cam.cx) * cam.z, H / 2 + (wy - cam.cy) * cam.z];

  function draw() {
    const cssW = Math.max(200, canvas.clientWidth || 700);
    if (canvas.width !== Math.round(cssW * dpr)) canvas.width = Math.round(cssW * dpr);
    if (canvas.height !== Math.round(cssH * dpr)) canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = cssW, H = cssH;
    const z = cam.z;

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);

    // ── terrain wash — the far-band texture. It fades OUT entirely across
    // the settlement band (real layouts own the ground there, M2): overlapping
    // giant ellipses re-stack any residual alpha to solid at street zoom, so
    // the only honest floor is zero.
    const washAlpha = 1 - fadeIn(z, BAND.settlement * 0.7, BAND.settlement * 4);
    if (washAlpha > 0.02) {
      ctx.globalAlpha = washAlpha;
      for (const b of terrain) {
        const [x, y] = toPx(b.x, b.y, W, H);
        const r = b.r * z;
        if (x < -r || x > W + r || y < -r || y > H + r || r < 1.2) continue;
        ctx.fillStyle = b.kind === 'water' ? WATERY : b.kind === 'darkGrove' ? GROVE_DARK : GROVE;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * b.squash, 0, 0, 7);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ── roads (fade in entering the region band) ──
    const roadAlpha = fadeIn(z, BAND.region * 0.75, BAND.region * 1.9);
    if (roadAlpha > 0) {
      ctx.lineWidth = Math.max(1, Math.min(3.2, z * 14));
      for (const e of (Array.isArray(map.edges) ? map.edges : [])) {
        const a = nodes.find(n => n.id === e.a), b = nodes.find(n => n.id === e.b);
        if (!a || !b) continue;
        const aKnown = known.has(String(a.id)), bKnown = known.has(String(b.id));
        if (!aKnown && !bKnown) continue;
        const pa = nodeToWu(a), pb = nodeToWu(b);
        const [x1, y1] = toPx(pa.x, pa.y, W, H);
        const [x2, y2] = toPx(pb.x, pb.y, W, H);
        if (Math.max(x1, x2) < 0 || Math.min(x1, x2) > W || Math.max(y1, y2) < 0 || Math.min(y1, y2) > H) continue;
        const bow = roadBow(String(a.id), String(b.id));
        const mx = (x1 + x2) / 2 - (y2 - y1) * bow, my = (y1 + y2) / 2 + (x2 - x1) * bow;
        ctx.strokeStyle = (aKnown && bKnown) ? ROAD : ROAD_GHOST;
        ctx.globalAlpha = roadAlpha * ((aKnown && bKnown) ? 1 : 0.8);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // ── nodes ──
    const nameAllAlpha = fadeIn(z, BAND.region, BAND.region * 2.2);
    const footAlpha = fadeIn(z, BAND.settlement * 0.8, BAND.settlement * 1.8);
    for (const n of nodes) {
      const id = String(n.id);
      const tier = known.has(id) ? 'known' : rumor.has(id) ? 'rumor' : 'dark';
      if (tier === 'dark') continue;
      const p = nodeToWu(n);
      const [x, y] = toPx(p.x, p.y, W, H);
      if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
      const ghost = tier === 'rumor';
      ctx.globalAlpha = ghost ? 0.28 : 1;

      const type = String(n.nodeType || '');
      const r = Math.max(3, Math.min(13, 3 + z * 18));

      // Settlement footprint hint — lives only in the settlement band window
      // (M2 replaces it with the real layout; at street zoom a 2000px ink
      // disc is just a grey screen).
      const footWindow = footAlpha * (1 - fadeIn(z, BAND.street * 0.5, BAND.street * 1.5));
      if (type === 'settlement' && footWindow > 0.02 && !ghost) {
        ctx.globalAlpha = footWindow * 0.18;
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.arc(x, y, 122 * z, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }

      if (type === 'settlement') {
        ctx.fillStyle = INK;
        const s = r * 0.9;
        ctx.fillRect(x - s, y - s * 0.4, s * 0.85, s * 0.85);
        ctx.fillRect(x + s * 0.15, y - s * 0.1, s * 0.85, s * 0.7);
        ctx.beginPath(); ctx.moveTo(x - s * 1.15, y - s * 0.4); ctx.lineTo(x - s * 0.575, y - s * 1.05); ctx.lineTo(x, y - s * 0.4); ctx.closePath(); ctx.fill();
      } else if (/dungeon/.test(type)) {
        ctx.fillStyle = 'rgba(60,24,28,0.92)';
        ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.8); ctx.lineTo(x - r, y + r * 0.8); ctx.closePath(); ctx.fill();
      } else if (type === 'landmark') {
        ctx.fillStyle = INKSOFT;
        ctx.beginPath(); ctx.moveTo(x, y - r * 0.9); ctx.lineTo(x + r * 0.7, y); ctx.lineTo(x, y + r * 0.9); ctx.lineTo(x - r * 0.7, y); ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = INKSOFT;
        ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, 7); ctx.fill();
      }

      // Names: settlements always; everything else as the region band arrives.
      const showName = !ghost && n.name && (type === 'settlement' || nameAllAlpha > 0);
      if (showName) {
        ctx.globalAlpha = type === 'settlement' ? 1 : nameAllAlpha;
        ctx.fillStyle = INK;
        ctx.font = `${type === 'settlement' ? 13 : 11}px ${HAND}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(String(n.name), x, y + r + 3);
      }
      ctx.globalAlpha = 1;
    }

    // ── the player ──
    const here = nodes.find(n => String(n.id) === hereId);
    if (here) {
      const p = nodeToWu(here);
      const [x, y] = toPx(p.x, p.y, W, H);
      ctx.strokeStyle = PLAYER; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(x, y, 14, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = PLAYER;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
    }

    // ── HUD: a Google-maps scale bar (1 wu ≈ 1 m) ──
    const target = 100 / z; // ~100 px worth of wu
    const nice = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000].find(v => v * z >= 60) || 25000;
    const px = nice * z;
    const label = nice >= 1000 ? `${nice / 1000} km` : `${nice} m`;
    hud.innerHTML = '';
    hud.textContent = `${label} ─ `;
    const bar = document.createElement('span');
    bar.style.cssText = `display:inline-block;width:${Math.round(px)}px;border-bottom:2px solid rgba(18,26,48,0.75);vertical-align:middle;margin-left:4px;`;
    hud.appendChild(bar);
    void target;
  }

  // ── interactions: wheel zoom at the cursor, drag pan ──
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
    const W = canvas.clientWidth, H = cssH;
    const wx = cam.cx + (mx - W / 2) / cam.z;
    const wy = cam.cy + (my - H / 2) / cam.z;
    const factor = Math.exp(-ev.deltaY * 0.0016);
    cam.z = Math.max(Z_MIN, Math.min(Z_MAX, cam.z * factor));
    // keep the point under the cursor under the cursor
    cam.cx = wx - (mx - W / 2) / cam.z;
    cam.cy = wy - (my - H / 2) / cam.z;
    draw();
  }, { passive: false });

  let dragging = null;
  canvas.addEventListener('pointerdown', (ev) => {
    dragging = { x: ev.clientX, y: ev.clientY };
    canvas.setPointerCapture(ev.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    cam.cx -= (ev.clientX - dragging.x) / cam.z;
    cam.cy -= (ev.clientY - dragging.y) / cam.z;
    dragging = { x: ev.clientX, y: ev.clientY };
    draw();
  });
  const endDrag = (ev) => { dragging = null; canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // First paint after mount (clientWidth needs layout).
  requestAnimationFrame(draw);
  return wrap;
}
