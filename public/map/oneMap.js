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
  NODE_WU, PLACE_WU, Z_MIN, Z_MAX, BAND,
  nodeToWu, worldBounds, fadeIn, discoveryTiers,
  placeFrame, placeUnitToWu
} from './worldSpace.js';
import { placeFromWorldNode } from './placeFromNode.js';

const PAPER = '#e8ecdd';
const INK = 'rgba(18,26,48,0.96)', INKSOFT = 'rgba(18,26,48,0.5)';
const ROAD = 'rgba(110,84,52,0.62)', ROAD_GHOST = 'rgba(110,84,52,0.22)';
const GROVE = 'rgba(92,134,120,0.16)', GROVE_DARK = 'rgba(74,112,98,0.28)';
const WATERY = 'rgba(96,128,148,0.12)';
const PLAYER = '#c0392b', NPC = '#2a6f8e';
const HAND = '"Iowan Old Style","Palatino",Georgia,serif';

// M5 — the Lord-of-the-Rings hand-drawn palette (sepia ink on aged parchment).
const SEPIA = 'rgba(96,72,44,0.85)', SEPIA_SOFT = 'rgba(96,72,44,0.45)';
const FOREST_FILL = 'rgba(120,150,118,0.18)', FOREST_TREE = 'rgba(58,96,74,0.62)';
const HILL_INK = 'rgba(120,92,56,0.6)';
const WATER_FILL = 'rgba(120,156,176,0.22)', WATER_LINE = 'rgba(86,124,150,0.5)';

// A wee map-tree: a stippled canopy dot over a hair of trunk. The classic
// forest stipple — a hundred of these read as woods at a glance.
function drawTree(ctx, x, y, s) {
  ctx.strokeStyle = 'rgba(74,52,30,0.5)'; ctx.lineWidth = Math.max(0.5, s * 0.18);
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.2); ctx.lineTo(x, y + s); ctx.stroke();
  ctx.fillStyle = FOREST_TREE;
  ctx.beginPath(); ctx.arc(x, y - s * 0.1, s * 0.72, 0, 7); ctx.fill();
}

// A wobbly hand-inked ellipse — the look of a circle drawn with a real nib.
// Seeded jitter so the same mark wavers identically every render.
function inkEllipse(ctx, x, y, rx, ry, seed) {
  const jr = makeRng(seedFromString(`ink|${seed}`));
  const segs = 26;
  ctx.beginPath();
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const w = 1 + (jr.nextFloat() - 0.5) * 0.12;
    const px = x + Math.cos(a) * rx * w, py = y + Math.sin(a) * ry * w;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
}

// M2 — building fills by plan material (M3 lifts these roofs into cutaways).
const ROOF = {
  timber: 'rgba(158,134,94,0.92)',
  stone: 'rgba(150,150,142,0.92)',
  fortified: 'rgba(106,108,118,0.95)'
};

// M3 — roof-cutaway palette (matched to handDrawnInterior.js so a building's
// lifted lid reads the same as standing inside it).
const FLOOR_WARM = 'rgba(232,160,60,0.14)';
const WOODI = 'rgba(96,62,32,0.92)', WOODF = 'rgba(150,96,48,0.30)';
const STONEI = 'rgba(70,78,98,0.92)', STONEF = 'rgba(70,78,98,0.22)';
const METAL = 'rgba(34,40,54,0.95)', CLOTH = 'rgba(232,236,221,0.85)';
const STONE_FURN = new Set(['hearth', 'altar', 'statue', 'column', 'brazier']);
const SKIP_FURN = new Set(['rug']);

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

// Deterministic terrain: forests (tree stipple), hills (hatched chevrons), and
// water (feathered shorelines) scattered over the world bounds — the illustrated
// backdrop of a hand-drawn map. Pure function of the seed; detail offsets are
// pre-generated on a unit disc and scaled at draw time. NOT gameplay terrain —
// it's the parchment's painted ground, identical every render.
function terrainFor(world, bounds) {
  const seed = String(world?.meta?.seed || 'seed');
  const rng = makeRng(seedFromString(`${seed}|onemap|terrain`));
  const w = bounds.maxX - bounds.minX, h = bounds.maxY - bounds.minY;
  const feats = [];
  const n = 110;
  for (let i = 0; i < n; i++) {
    const roll = rng.nextFloat();
    const kind = roll < 0.14 ? 'water' : roll < 0.36 ? 'hills' : 'forest';
    const f = {
      kind,
      x: bounds.minX + rng.nextFloat() * w,
      y: bounds.minY + rng.nextFloat() * h,
      r: NODE_WU * (0.12 + rng.nextFloat() * 0.5),
      squash: 0.6 + rng.nextFloat() * 0.55
    };
    const dr = makeRng(seedFromString(`tfeat|${seed}|${i}`));
    f.seedKey = `${seed}|${i}`;
    if (kind === 'forest') {
      f.trees = [];
      const m = 7 + dr.int(0, 12);
      for (let k = 0; k < m; k++) {
        const a = dr.nextFloat() * Math.PI * 2, rad = Math.sqrt(dr.nextFloat());
        f.trees.push([Math.cos(a) * rad, Math.sin(a) * rad * f.squash, 0.55 + dr.nextFloat() * 0.6]);
      }
    } else if (kind === 'hills') {
      f.bumps = [];
      const m = 3 + dr.int(0, 4);
      for (let k = 0; k < m; k++) {
        const a = dr.nextFloat() * Math.PI * 2, rad = Math.sqrt(dr.nextFloat());
        f.bumps.push([Math.cos(a) * rad * 0.85, Math.sin(a) * rad * 0.6, 0.6 + dr.nextFloat() * 0.5]);
      }
    }
    feats.push(f);
  }
  return feats;
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

  // M2 — village layouts, computed once per mount (deterministic per world;
  // a turn re-renders the whole view, so the cache lifetime is exactly right).
  const placeCache = new Map();
  function layoutFor(node) {
    const id = String(node.id);
    if (!placeCache.has(id)) {
      let entry = null;
      try {
        const place = node.settlement ? placeFromWorldNode(world, id) : null;
        if (place && Array.isArray(place.buildings) && place.buildings.length) {
          entry = { place, frame: placeFrame(place) };
        }
      } catch { entry = null; }
      placeCache.set(id, entry);
    }
    return placeCache.get(id);
  }

  // Draw one settlement's real layout in world space. Roofs stay ON in M2
  // (material fills); M3 lifts them into cutaways at the deepest zoom.
  function drawLayout(node, layout, alpha, W, H, z) {
    const { place, frame } = layout;
    const P = (ux, uy) => { const p = placeUnitToWu(node, frame, ux, uy); return toPx(p.x, p.y, W, H); };
    ctx.globalAlpha = alpha;

    // ground: paths first, then groves, then the well.
    for (const path of (place.terrain?.paths || [])) {
      const pts = path?.pts || [];
      if (pts.length < 2) continue;
      ctx.strokeStyle = ROAD;
      ctx.lineWidth = Math.max(1, (path.w || 1) * PLACE_WU * z * 0.6);
      ctx.beginPath();
      const [sx, sy] = P(pts[0][0], pts[0][1]);
      ctx.moveTo(sx, sy);
      for (let i = 1; i < pts.length; i++) { const [px, py] = P(pts[i][0], pts[i][1]); ctx.lineTo(px, py); }
      ctx.stroke();
    }
    for (const g of (place.terrain?.groves || [])) {
      const [gx, gy] = P(g.cx, g.cy);
      const gr = g.r * PLACE_WU * z;
      if (gr < 1) continue;
      ctx.fillStyle = GROVE_DARK;
      ctx.beginPath(); ctx.ellipse(gx, gy, gr, gr * 0.8, 0, 0, 7); ctx.fill();
    }
    for (const prop of (place.terrain?.props || [])) {
      if (prop?.type !== 'well') continue;
      const [wx, wy] = P(prop.ux, prop.uy);
      // A well is a small thing — cap it so deep zoom doesn't make a plaza of it.
      const wr = Math.max(1.5, Math.min(10, 0.45 * PLACE_WU * z));
      ctx.strokeStyle = INKSOFT; ctx.lineWidth = Math.max(1, wr * 0.28);
      ctx.beginPath(); ctx.arc(wx, wy, wr, 0, 7); ctx.stroke();
    }

    // buildings: a material roof, OR — for the building you're in or your own
    // home (the only ones you've honestly seen inside) — the roof lifts off at
    // street zoom to a furnished floor (M3). Settlement buildings you've never
    // entered stay roofed: the map is no spoiler.
    const homeNodeId = String(world?.meta?.homeNodeId || '');
    const interiorKey = String(world?.scene?.interior?.structureKey || '');
    const labelAlpha = fadeIn(z, 2.2, 3.6);
    const wall = Math.max(0.8, Math.min(2.6, z * 0.5));
    for (const b of (place.buildings || [])) {
      const material = String(b?.plan?.material || 'timber');
      const openable = b.structureKey && (b.structureKey === interiorKey || String(node.id) === homeNodeId);
      const cut = openable ? fadeIn(z, BAND.street, BAND.street * 1.8) : 0;

      // helper: project a room/furniture rect to px corners.
      const rectPx = (ux, uy, w, h) => {
        const [x0, y0] = P(ux, uy); const [x1, y1] = P(ux + w, uy + h);
        return [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)];
      };

      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity;
      for (const r of (b.plan?.rooms || [])) {
        const isRound = r.shape === 'round';
        // floor (cutaway) under roof, so the fade reads as the lid lifting.
        if (cut > 0) {
          ctx.globalAlpha = alpha * cut;
          ctx.fillStyle = FLOOR_WARM; ctx.strokeStyle = INK; ctx.lineWidth = wall;
          if (isRound) { const [cx2, cy2] = P(b.ox + r.cx, b.oy + r.cy); const rr = (r.r || 1) * PLACE_WU * z; ctx.beginPath(); ctx.arc(cx2, cy2, rr, 0, 7); ctx.fill(); ctx.stroke(); }
          else { const [x, y, w, h] = rectPx(b.ox + r.cx - (r.w || 2) / 2, b.oy + r.cy - (r.h || 2) / 2, (r.w || 2), (r.h || 2)); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke(); }
        }
        // roof on top, fading out as the cutaway fades in.
        if (cut < 1) {
          ctx.globalAlpha = alpha * (1 - cut);
          ctx.fillStyle = ROOF[material] || ROOF.timber; ctx.strokeStyle = INK; ctx.lineWidth = wall;
          if (isRound) { const [cx2, cy2] = P(b.ox + r.cx, b.oy + r.cy); const rr = (r.r || 1) * PLACE_WU * z; ctx.beginPath(); ctx.arc(cx2, cy2, rr, 0, 7); ctx.fill(); ctx.stroke(); }
          else { const [x, y, w, h] = rectPx(b.ox + r.cx - (r.w || 2) / 2, b.oy + r.cy - (r.h || 2) / 2, (r.w || 2), (r.h || 2)); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke(); }
        }
        const [bxx, byy] = P(b.ox + r.cx - (r.w || (r.r || 1) * 2) / 2, b.oy + r.cy - (r.h || (r.r || 1) * 2) / 2);
        bx0 = Math.min(bx0, bxx); by0 = Math.min(by0, byy);
        const [bxe] = P(b.ox + r.cx + (r.w || (r.r || 1) * 2) / 2, b.oy + r.cy);
        bx1 = Math.max(bx1, bxe);
      }
      ctx.globalAlpha = alpha;

      // furniture marks, once the roof is mostly off (the lid-lifted reveal).
      if (cut > 0.15) {
        for (const f of (b.plan?.furniture || [])) {
          const t = String(f.type || '');
          if (SKIP_FURN.has(t)) continue;
          const [fx, fy, fw, fh] = rectPx(b.ox + f.ux, b.oy + f.uy, (f.uw || 0.6), (f.uh || 0.6));
          if (fw < 1.2 && fh < 1.2) continue;
          ctx.globalAlpha = alpha * cut;
          const stone = STONE_FURN.has(t), bars = t === 'bars';
          ctx.fillStyle = bars ? 'rgba(34,40,54,0.12)' : stone ? STONEF : WOODF;
          ctx.strokeStyle = bars ? METAL : stone ? STONEI : WOODI;
          ctx.lineWidth = Math.max(0.6, wall * 0.6);
          ctx.beginPath(); ctx.rect(fx, fy, fw, fh); ctx.fill(); ctx.stroke();
          if (t === 'bed') { ctx.fillStyle = CLOTH; ctx.fillRect(fx + fw * 0.18, fy + fh * 0.28, fw * 0.64, fh * 0.6); }
        }
        // room names at the deepest zoom — you're reading the floor plan now.
        if (z >= 6) {
          ctx.globalAlpha = alpha * cut;
          ctx.fillStyle = 'rgba(18,26,48,0.66)'; ctx.font = `${Math.round(Math.min(14, 1.1 * PLACE_WU * z))}px ${HAND}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          for (const r of (b.plan?.rooms || [])) { if (!r.name) continue; const [rx, ry] = P(b.ox + r.cx, b.oy + r.cy); ctx.fillText(String(r.name), rx, ry); }
        }
        ctx.globalAlpha = alpha;
      }

      const label = String(b.name || b.buildingName || '');
      if (label && labelAlpha > 0 && cut < 0.5 && Number.isFinite(bx0)) {
        ctx.globalAlpha = alpha * labelAlpha * (1 - cut * 2 > 0 ? 1 - cut * 2 : 0);
        ctx.fillStyle = INKSOFT;
        ctx.font = `10px ${HAND}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(label, (bx0 + bx1) / 2, by0 - 2);
        ctx.globalAlpha = alpha;
      }
    }

    // people: dots at street approach (the village is inhabited, visibly).
    const npcAlpha = fadeIn(z, 1.4, 2.4);
    if (npcAlpha > 0) {
      for (const t of (place.tokens || [])) {
        if (t?.type !== 'npc') continue;
        const [nx, ny] = P(t.ux, t.uy);
        const nr = Math.max(2, Math.min(6, 0.5 * PLACE_WU * z));
        ctx.globalAlpha = alpha * npcAlpha;
        ctx.fillStyle = PAPER;
        ctx.beginPath(); ctx.arc(nx, ny, nr, 0, 7); ctx.fill();
        ctx.strokeStyle = NPC; ctx.lineWidth = Math.max(1, nr * 0.35); ctx.stroke();
        if (z >= 6 && t.label) {
          ctx.fillStyle = NPC; ctx.font = `bold ${Math.round(nr * 1.1)}px ${HAND}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(t.label), nx, ny + 0.5);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    const cssW = Math.max(200, canvas.clientWidth || 700);
    if (canvas.width !== Math.round(cssW * dpr)) canvas.width = Math.round(cssW * dpr);
    if (canvas.height !== Math.round(cssH * dpr)) canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = cssW, H = cssH;
    const z = cam.z;

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);

    // ── terrain — the hand-drawn ground (forests/hills/water). Fades OUT across
    // the settlement band (real layouts own the ground there, M2) so the street
    // band is clean parchment, not painted-over woods.
    const washAlpha = 1 - fadeIn(z, BAND.settlement * 0.7, BAND.settlement * 4);
    if (washAlpha > 0.02) {
      ctx.globalAlpha = washAlpha;
      for (const f of terrain) {
        const [x, y] = toPx(f.x, f.y, W, H);
        const r = f.r * z, ry = r * f.squash;
        if (x < -r - 24 || x > W + r + 24 || y < -r - 24 || y > H + r + 24 || r < 1) continue;
        if (f.kind === 'water') {
          ctx.fillStyle = WATER_FILL;
          ctx.beginPath(); ctx.ellipse(x, y, r, ry, 0, 0, 7); ctx.fill();
          if (r > 7) {
            ctx.strokeStyle = WATER_LINE;
            for (let s = 1; s <= 2; s++) {
              ctx.lineWidth = Math.max(0.6, r * 0.012);
              ctx.beginPath(); ctx.ellipse(x, y, r * (1 - 0.14 * s), ry * (1 - 0.14 * s), 0, 0, 7); ctx.stroke();
            }
          }
        } else if (f.kind === 'hills') {
          // bare chevrons on the parchment — the classic map hill hatch.
          if (r > 5) {
            ctx.strokeStyle = HILL_INK; ctx.lineCap = 'round';
            for (const [ox, oy, s] of f.bumps) {
              const hx = x + ox * r, hy = y + oy * ry, hs = Math.max(2, s * r * 0.34);
              ctx.lineWidth = Math.max(0.7, hs * 0.16);
              ctx.beginPath(); ctx.moveTo(hx - hs, hy + hs * 0.45);
              ctx.quadraticCurveTo(hx, hy - hs * 0.75, hx + hs, hy + hs * 0.45); ctx.stroke();
            }
            ctx.lineCap = 'butt';
          }
        } else { // forest
          ctx.fillStyle = FOREST_FILL;
          ctx.beginPath(); ctx.ellipse(x, y, r, ry, 0, 0, 7); ctx.fill();
          if (r > 9) for (const [ox, oy, s] of f.trees) {
            drawTree(ctx, x + ox * r, y + oy * ry, Math.max(1.4, s * r * 0.17));
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    // ── aged-parchment vignette: edges darken to old-paper sepia. Cheap, and
    // it's most of the "this is a real map" feeling.
    {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.72);
      g.addColorStop(0, 'rgba(120,96,52,0)');
      g.addColorStop(1, 'rgba(96,74,40,0.16)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    // ── roads — dashed sepia, the way a cartographer dots a track between
    // towns. (fade in entering the region band) ──
    const roadAlpha = fadeIn(z, BAND.region * 0.75, BAND.region * 1.9);
    if (roadAlpha > 0) {
      const dash = Math.max(3, Math.min(10, z * 26));
      ctx.lineWidth = Math.max(0.8, Math.min(2, z * 9));
      ctx.lineCap = 'round';
      ctx.setLineDash([dash, dash * 0.8]);
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
        ctx.globalAlpha = roadAlpha * ((aKnown && bKnown) ? 1 : 0.7);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.lineCap = 'butt';
      ctx.globalAlpha = 1;
    }

    // ── nodes ──
    const nameAllAlpha = fadeIn(z, BAND.region, BAND.region * 2.2);
    const footAlpha = fadeIn(z, BAND.settlement * 0.8, BAND.settlement * 1.8);
    for (const n of nodes) {
      const id = String(n.id);
      // Only WITNESSED places get inked here. Heard-of (rumor) places are your
      // own scrawled annotations, drawn in a separate pass below; the unknown
      // stays blank parchment. (The map shows only what you've earned.)
      if (!known.has(id)) continue;
      const p = nodeToWu(n);
      const [x, y] = toPx(p.x, p.y, W, H);
      // Cull by node center — but a settlement's layout extends ~120 wu out, so
      // a village can be on-screen while its node center isn't (zoomed in at the
      // edge). Give settlements a layout-sized margin or the whole place vanishes.
      const margin = 40 + (String(n.nodeType || '') === 'settlement' ? 200 * z : 0);
      if (x < -margin || x > W + margin || y < -margin || y > H + margin) continue;
      const ghost = false;
      const type = String(n.nodeType || '');
      const r = Math.max(3, Math.min(13, 3 + z * 18));

      // M2 — the real village arrives across the settlement band, and the
      // abstract glyph + footprint disc hand over to it (fade, never pop).
      const layout = (type === 'settlement' && !ghost) ? layoutFor(n) : null;
      const layoutAlpha = layout ? fadeIn(z, 0.55, 1.1) : 0;
      if (layoutAlpha > 0.02) drawLayout(n, layout, layoutAlpha, W, H, z);

      ctx.globalAlpha = ghost ? 0.28 : 1;

      const footWindow = footAlpha * (1 - layoutAlpha);
      if (type === 'settlement' && footWindow > 0.02 && !ghost && !layout) {
        ctx.globalAlpha = footWindow * 0.18;
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.arc(x, y, 122 * z, 0, 7); ctx.fill();
        ctx.globalAlpha = ghost ? 0.28 : 1;
      }

      const glyphAlpha = (ghost ? 0.28 : 1) * (1 - layoutAlpha);
      ctx.globalAlpha = glyphAlpha;
      if (glyphAlpha < 0.03) {
        // glyph fully handed over to the layout — name still draws below.
      } else if (type === 'settlement') {
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

    // ── heard-of places — your own annotations ──────────────────────────────
    // Someone told you of a shrine to the north; we pretend they tapped your
    // map and you drew a loose circle and scrawled a guess. A rumor in your
    // own hand — uncertain, wobbly, never the clean ink of a place you've SEEN.
    // (The map gives you a destination, never the answers waiting there.)
    const annotAlpha = fadeIn(z, BAND.region * 0.4, BAND.region * 1.1);
    if (annotAlpha > 0.02) {
      for (const n of nodes) {
        const id = String(n.id);
        if (!rumor.has(id) || known.has(id)) continue;
        const p = nodeToWu(n);
        const [x, y] = toPx(p.x, p.y, W, H);
        if (x < -60 || x > W + 60 || y < -60 || y > H + 60) continue;
        const rPx = Math.max(16, Math.min(120, 0.5 * NODE_WU * z));
        ctx.globalAlpha = annotAlpha;
        ctx.strokeStyle = SEPIA_SOFT;
        ctx.lineWidth = Math.max(1, rPx * 0.018);
        ctx.lineCap = 'round';
        inkEllipse(ctx, x, y, rPx, rPx * 0.82, n.id);
        ctx.stroke();
        ctx.lineCap = 'butt';
        // the scrawl: a name if you caught one, else the kind, always with a
        // hand-written shrug of uncertainty.
        const type = String(n.nodeType || '');
        const noun = type === 'settlement' ? 'a village' : /dungeon/.test(type) ? 'something' : type === 'landmark' ? 'a landmark' : 'a place';
        const line1 = n.name ? `${n.name}?` : `${noun}?`;
        const fs = Math.max(9, Math.min(14, rPx * 0.16));
        ctx.fillStyle = SEPIA;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.font = `italic ${Math.round(fs)}px ${HAND}`;
        ctx.fillText(line1, x, y + rPx * 0.82 + 3);
        ctx.font = `italic ${Math.round(fs * 0.82)}px ${HAND}`;
        ctx.fillStyle = SEPIA_SOFT;
        ctx.fillText('— up here somewhere', x, y + rPx * 0.82 + 3 + fs * 1.1);
        ctx.globalAlpha = 1;
      }
    }

    // ── the player ──
    // M4: place the marker where you actually STAND when the live walk
    // position is known (opts.playerPos from ui.place, in place units), so the
    // dot sits in your room/street — not at the node midpoint. Falls back to
    // node-center when no walk position is available (e.g. viewing a far node).
    const here = nodes.find(n => String(n.id) === hereId);
    if (here) {
      let p = nodeToWu(here);
      const pos = opts.playerPos;
      if (pos && String(pos.nodeId || '') === hereId && Number.isFinite(+pos.ux) && Number.isFinite(+pos.uy)) {
        const layout = layoutFor(here);
        if (layout) p = placeUnitToWu(here, layout.frame, +pos.ux, +pos.uy);
      }
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
  // A camera-focus seam: deep-link the view to a world point + zoom. Future
  // "show me on the map" / quest pins use this; tests drive it directly.
  wrap.__oneMapFocus = (wx, wy, zz) => {
    if (Number.isFinite(wx)) cam.cx = wx;
    if (Number.isFinite(wy)) cam.cy = wy;
    if (Number.isFinite(zz)) cam.z = Math.max(Z_MIN, Math.min(Z_MAX, zz));
    draw();
  };
  return wrap;
}
