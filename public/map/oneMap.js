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
  nodeToWu, fadeIn, discoveryTiers,
  placeFrame, placeUnitToWu
} from './worldSpace.js';
import { worldGeography, terrainStamps } from './geography.js';
import { placeFromWorldNode } from './placeFromNode.js';
import { isDungeonStructureId } from '../../engine/dungeon/generate.js';
import { interiorCompassLayout } from '../../engine/structures/topology.js';
import { dayPhase, clockLabel } from '../../engine/dayNight.js';

// The compass facing of the window you JUST climbed out of (the latest interior-exit event), so the
// map can place your marker on that side of the building. '' once you act again or move on.
function lastWindowExitFacing(world) {
  const tl = Array.isArray(world?.timeline) ? world.timeline : [];
  const last = tl[tl.length - 1];
  const d = last && last.data ? last.data : null;
  return (d && d.updateKind === 'interior-exit' && d.windowFacing) ? String(d.windowFacing) : '';
}

// A small world-unit nudge in a compass direction (north is -y; the engine's grid grows south = +y).
function facingNudge(facing) {
  const D = 0.35; // ~a third of a cell — just off the building wall
  return ({ north: [0, -D], south: [0, D], east: [D, 0], west: [-D, 0] }[String(facing)] || [0, 0]);
}

// Time-of-day badge (top-right): a sun by day, a moon at night, with the wall-clock time. This is
// how day/night reads on the map (alongside the dimming veil drawn over the whole canvas).
function drawTimeOfDay(ctx, world, W) {
  const phase = dayPhase(world);
  const night = phase === 'night';
  const dim = phase === 'dawn' || phase === 'dusk';
  const cx = W - 22, cy = 22;
  ctx.save();
  ctx.textAlign = 'right';
  ctx.font = '12px ' + HAND;
  ctx.fillStyle = night ? 'rgba(222,226,255,0.95)' : 'rgba(38,28,16,0.92)';
  ctx.fillText(clockLabel(world), cx - 12, cy + 4);
  if (night) {
    ctx.fillStyle = 'rgba(226,230,255,0.95)';
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(12,16,40,0.95)';
    ctx.beginPath(); ctx.arc(cx + 3.2, cy - 2.4, 6, 0, 7); ctx.fill(); // crescent bite
  } else {
    ctx.fillStyle = dim ? 'rgba(240,168,86,0.95)' : 'rgba(250,206,86,0.97)';
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 7); ctx.fill();
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.4;
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 7.5, cy + Math.sin(a) * 7.5); ctx.lineTo(cx + Math.cos(a) * 10.5, cy + Math.sin(a) * 10.5); ctx.stroke(); }
  }
  ctx.restore();
}

const PAPER = '#e8ecdd';
const INK = 'rgba(18,26,48,0.96)', INKSOFT = 'rgba(18,26,48,0.5)';
const ROAD = 'rgba(110,84,52,0.62)', ROAD_GHOST = 'rgba(110,84,52,0.22)';
const GROVE = 'rgba(92,134,120,0.16)', GROVE_DARK = 'rgba(74,112,98,0.28)';
const WATERY = 'rgba(96,128,148,0.12)';
const PLAYER = '#c0392b', NPC = '#2a6f8e';
const HAND = '"Iowan Old Style","Palatino",Georgia,serif';

// M5/M6 — the Lord-of-the-Rings hand-drawn palette (sepia ink on aged parchment).
const SEPIA = 'rgba(96,72,44,0.85)', SEPIA_SOFT = 'rgba(96,72,44,0.45)';
const WATER_FILL = 'rgba(120,156,176,0.22)', WATER_LINE = 'rgba(86,124,150,0.5)';

// M6 — biome inks. Each canonical biome (biomeForNode) gets a hand-drawn motif
// so the painted ground AGREES with what the DM narrates. Fills stay faint —
// the parchment shows through; M7 does the cohesive color grade.
const BIOME_INK = {
  conifer: 'rgba(46,82,58,0.66)', decid: 'rgba(92,124,82,0.62)', trunk: 'rgba(74,52,30,0.5)',
  reed: 'rgba(96,112,66,0.66)', marshWater: 'rgba(40,54,50,0.42)',
  dune: 'rgba(150,120,72,0.55)', rock: 'rgba(110,98,86,0.74)', rockShadow: 'rgba(96,80,60,0.34)',
  snow: 'rgba(244,248,250,0.9)', arcticDot: 'rgba(150,178,196,0.62)',
  grass: 'rgba(140,142,86,0.46)', scrub: 'rgba(120,108,78,0.5)'
};
const BIOME_FILL = {
  forest: 'rgba(110,144,110,0.13)', marsh: 'rgba(92,108,84,0.14)', desert: 'rgba(208,182,126,0.12)',
  mountains: 'rgba(150,140,128,0.06)', arctic: 'rgba(212,228,238,0.13)', plains: 'rgba(178,176,120,0.045)',
  coastal: 'rgba(206,194,150,0.05)', wilderness: 'rgba(150,140,104,0.045)'
};
const OCEAN_FILL = 'rgba(108,148,170,0.30)', WAVE = 'rgba(78,116,142,0.42)';
// Cool stony grey (not warm brown) so a grey peak never blends with green woods.
const RANGE_INK = 'rgba(58,58,56,0.84)', RANGE_FILL = 'rgba(126,126,122,0.52)';
const HEATH_FILL = 'rgba(36,30,34,0.74)', HEATH_EDGE = 'rgba(24,20,24,0.78)', HEATH_CRACK = 'rgba(122,40,32,0.66)', HEATH_GLOW = 'rgba(120,40,30,0.14)';
const RIVER_INK = 'rgba(96,140,168,0.64)';

// ── biome motif drawers (px-space; called when a clump is big enough to read) ─
// A conifer: a fir silhouette over a hair of trunk.
function drawConifer(ctx, x, y, s) {
  ctx.strokeStyle = BIOME_INK.trunk; ctx.lineWidth = Math.max(0.4, s * 0.16);
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.5); ctx.lineTo(x, y + s); ctx.stroke();
  ctx.fillStyle = BIOME_INK.conifer;
  ctx.beginPath();
  ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.6, y + s * 0.55); ctx.lineTo(x - s * 0.6, y + s * 0.55);
  ctx.closePath(); ctx.fill();
}
// A deciduous: an irregular blobby crown over a trunk (three lobes, no lollipop).
function drawDeciduous(ctx, x, y, s) {
  ctx.strokeStyle = BIOME_INK.trunk; ctx.lineWidth = Math.max(0.4, s * 0.16);
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.2); ctx.lineTo(x, y + s); ctx.stroke();
  ctx.fillStyle = BIOME_INK.decid;
  ctx.beginPath();
  ctx.arc(x - s * 0.34, y - s * 0.02, s * 0.5, 0, 7);
  ctx.arc(x + s * 0.32, y, s * 0.46, 0, 7);
  ctx.arc(x, y - s * 0.4, s * 0.5, 0, 7);
  ctx.fill();
}
// A peak: a RIDGE of two peaks (a little range), not a lone triangle — so a
// forest's single firs can never read as mountains. Wide jagged base, a tall
// main peak with a snow cap and a shorter shoulder, cool grey stone.
function drawPeak(ctx, x, y, s, snow) {
  const w = s * 1.2, apexX = x - s * 0.38, apexY = y - s;
  ctx.fillStyle = RANGE_FILL;
  ctx.beginPath();
  ctx.moveTo(x - w, y + s * 0.7);
  ctx.lineTo(apexX, apexY);              // main peak
  ctx.lineTo(x + s * 0.02, y - s * 0.12); // saddle
  ctx.lineTo(x + s * 0.5, y - s * 0.62);  // shoulder peak
  ctx.lineTo(x + w, y + s * 0.7);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = RANGE_INK; ctx.lineWidth = Math.max(0.5, s * 0.1); ctx.lineJoin = 'round';
  ctx.stroke();
  // shadow flank down the main peak's near side
  ctx.strokeStyle = BIOME_INK.rockShadow; ctx.lineWidth = Math.max(0.4, s * 0.08);
  ctx.beginPath(); ctx.moveTo(apexX, apexY); ctx.lineTo(apexX + s * 0.26, y + s * 0.1); ctx.stroke();
  if (snow && s > 3) {
    ctx.fillStyle = BIOME_INK.snow;
    ctx.beginPath();
    ctx.moveTo(apexX, apexY); ctx.lineTo(apexX + s * 0.22, apexY + s * 0.42);
    ctx.lineTo(apexX, apexY + s * 0.3); ctx.lineTo(apexX - s * 0.22, apexY + s * 0.42);
    ctx.closePath(); ctx.fill();
  }
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

function cameraFor(world, initialZoom) {
  const key = String(world?.meta?.campaignId || 'campaign');
  const hereId = String(world?.map?.currentNodeId || '');
  const here = (world?.map?.nodes || []).find(n => n && n.id === hereId);
  if (!CAMS.has(key)) {
    const c = here ? nodeToWu(here) : { x: 0, y: 0 };
    // Default opens in the region band; the in-play embed seeds its own band
    // via initialZoom.
    const z = Number.isFinite(initialZoom) ? initialZoom : 0.12;
    CAMS.set(key, { cx: c.x, cy: c.y, z, nodeId: hereId });
  }
  const cam = CAMS.get(key);
  // Map-fidelity law (2026-07-03): when the ENGINE moves you to a different
  // node — typed travel, dungeon descent, journey — the map follows the story:
  // recenter on the new node, preserving the player's chosen zoom. The camera
  // used to be write-once, so after "go to The Greenwood" the narration moved
  // and the map stayed on Aldermere with the marker off-frame. Panning around
  // WITHIN a node is untouched (same nodeId → camera left alone). View state
  // only — world/determinism untouched.
  if (here && cam.nodeId !== hereId) {
    const c = nodeToWu(here);
    cam.cx = c.x; cam.cy = c.y; cam.nodeId = hereId;
  }
  return cam;
}

// M7 — beautification (docs/WORLD_AND_DUNGEONS.md). The pen turns ink-on-paper
// into illustrated antique cartography: real parchment fiber/stain, a compass
// rose, paper-haloed calligraphic labels, an aged grade. Pure + deterministic.
const HALO = 'rgba(233,237,222,0.92)';  // paper-coloured halo so names read over terrain

// A name in a cartographer's hand: a soft paper halo, then the ink.
function inkLabel(ctx, text, x, y, font, fill, align, baseline, haloW = 3.2) {
  ctx.font = font; ctx.textAlign = align; ctx.textBaseline = baseline;
  ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  ctx.strokeStyle = HALO; ctx.lineWidth = haloW; ctx.strokeText(text, x, y);
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

// A real parchment sheet: base paper + per-pixel fibre grain + a few age stains.
// Rendered ONCE to an offscreen canvas (screen-space, so panning doesn't churn
// it), cached per seed+size. Deterministic: seeded rng, drawn in a fixed order.
const PARCH = new Map();
function parchmentFor(seed, W, H, dpr) {
  const cw = Math.max(1, Math.round(W * dpr)), ch = Math.max(1, Math.round(H * dpr));
  const key = `${seed}|${cw}x${ch}`;
  if (PARCH.has(key)) return PARCH.get(key);
  const oc = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
  if (!oc) return null;
  oc.width = cw; oc.height = ch;
  const o = oc.getContext('2d');
  o.fillStyle = PAPER; o.fillRect(0, 0, cw, ch);
  const rng = makeRng(seedFromString(`${seed}|parchment`));
  const img = o.getImageData(0, 0, cw, ch), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng.nextFloat() - 0.5) * 16;            // subtle fibre flecking
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.85));
  }
  o.putImageData(img, 0, 0);
  const stains = 8 + rng.int(0, 6);                     // soft age blotches
  for (let i = 0; i < stains; i++) {
    const sx = rng.nextFloat() * cw, sy = rng.nextFloat() * ch;
    const sr = (0.1 + rng.nextFloat() * 0.28) * Math.min(cw, ch);
    const a = 0.03 + rng.nextFloat() * 0.05;
    const g = o.createRadialGradient(sx, sy, 0, sx, sy, sr);
    g.addColorStop(0, `rgba(122,92,46,${a})`); g.addColorStop(1, 'rgba(122,92,46,0)');
    o.fillStyle = g; o.beginPath(); o.arc(sx, sy, sr, 0, 7); o.fill();
  }
  PARCH.set(key, oc);
  return oc;
}

// A cartographer's compass rose (screen-space, north up) on a paper medallion
// so it reads over any terrain (ocean, the dead Heath, a forest).
function drawCompass(ctx, cx, cy, R) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(233,237,222,0.84)';
  ctx.beginPath(); ctx.arc(0, 0, R * 1.46, 0, 7); ctx.fill();
  ctx.strokeStyle = SEPIA_SOFT; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, R * 1.46, 0, 7); ctx.stroke();
  ctx.strokeStyle = SEPIA; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, R * 0.74, 0, 7); ctx.stroke();
  // four diagonal minor rays
  ctx.strokeStyle = SEPIA_SOFT; ctx.lineWidth = 0.8;
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R * 0.72, Math.sin(a) * R * 0.72); ctx.stroke();
  }
  // four cardinal star points (N emphasised, dark)
  for (let k = 0; k < 4; k++) {
    const a = -Math.PI / 2 + k * Math.PI / 2;            // start at N (up)
    ctx.fillStyle = k === 0 ? 'rgba(86,62,36,0.95)' : SEPIA_SOFT;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R);
    ctx.lineTo(Math.cos(a + 0.16) * R * 0.3, Math.sin(a + 0.16) * R * 0.3);
    ctx.lineTo(Math.cos(a - 0.16) * R * 0.3, Math.sin(a - 0.16) * R * 0.3);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgba(86,62,36,0.95)';
  ctx.font = `bold ${Math.round(R * 0.36)}px ${HAND}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('N', 0, -R * 1.16);
  ctx.restore();
}

// M6 — the illustrated geography, computed once per world (deterministic, pure;
// docs/WORLD_AND_DUNGEONS.md Part A). geography.js is the "author" (data); this
// file is the pen. Cached like the camera so v1's per-turn re-render doesn't
// regenerate ~5k stamps each frame.
const GEO = new Map();
function geoFor(world) {
  const seed = String(world?.meta?.seed || 'seed');
  const key = String(world?.meta?.campaignId || seed) + '|' + seed;
  if (!GEO.has(key)) {
    const nodes = Array.isArray(world?.map?.nodes) ? world.map.nodes : [];
    const geo = worldGeography(seed, nodes);
    GEO.set(key, { geo, stamps: terrainStamps(seed, geo) });
  }
  return GEO.get(key);
}

// A wobbled ellipse path from per-vertex radius multipliers (organic, never clean).
function blobPath(ctx, x, y, rx, ry, radii) {
  const n = radii.length; ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = ((i % n) / n) * Math.PI * 2, m = radii[i % n];
    const px = x + Math.cos(a) * rx * m, py = y + Math.sin(a) * ry * m;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
function blobFill(ctx, x, y, rx, ry, radii, fill) { ctx.fillStyle = fill; blobPath(ctx, x, y, rx, ry, radii); ctx.fill(); }

// One biome clump in px. Far zoom: a faint regional fill (no blank parchment);
// closer: the hand-drawn motifs read.
function drawStamp(ctx, st, cx, cy, rPx, fillScale = 1) {
  const b = st.biome;
  const fill = BIOME_FILL[b];
  // The soft regional fill reads as colored country when the whole world is in
  // frame, but turns to overlapping blobs up close — so fade it out as motifs
  // (the trees/dunes/peaks) grow in to carry the biome read (M7-S4).
  if (fill && fillScale > 0.01) {
    const pa = ctx.globalAlpha; ctx.globalAlpha = pa * fillScale;
    ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(cx, cy, rPx * 0.92, rPx * 0.78, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = pa;
  }
  if (rPx < 7) return;
  if (b === 'marsh') { // black standing water under the reeds
    ctx.fillStyle = BIOME_INK.marshWater; ctx.beginPath(); ctx.ellipse(cx, cy, rPx * 0.3, rPx * 0.2, 0, 0, 7); ctx.fill();
  }
  for (const [ox, oy, s, aux] of st.pts) {
    const x = cx + ox * rPx, y = cy + oy * rPx, sz = Math.max(1, s * rPx * 0.4);
    if (b === 'forest') { (aux ? drawConifer : drawDeciduous)(ctx, x, y, sz); }
    else if (b === 'marsh') {
      // Short UPRIGHT reed ticks rising from the waterline (a small lean), not
      // curves radiating out of the pool — which read as worms. Cattails, not worms.
      ctx.strokeStyle = BIOME_INK.reed; ctx.lineWidth = Math.max(0.5, sz * 0.16); ctx.lineCap = 'round';
      const lean = (aux - 0.5) * sz * 0.28;
      ctx.beginPath(); ctx.moveTo(x, y + sz * 0.5); ctx.lineTo(x + lean, y - sz * 0.8); ctx.stroke();
      ctx.lineCap = 'butt';
    } else if (b === 'desert') {
      const a = (aux - 0.5) * 0.7; ctx.strokeStyle = BIOME_INK.dune; ctx.lineWidth = Math.max(0.5, sz * 0.18); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - sz, y + a * sz); ctx.quadraticCurveTo(x, y - sz * 0.5, x + sz, y - a * sz); ctx.stroke();
      ctx.lineCap = 'butt';
    } else if (b === 'mountains') { drawPeak(ctx, x, y, sz * 0.8, s > 0.85); }
    else if (b === 'arctic') {
      ctx.fillStyle = BIOME_INK.arcticDot; ctx.beginPath(); ctx.arc(x, y, Math.max(0.6, sz * 0.3), 0, 7); ctx.fill();
    } else if (b === 'plains' || b === 'coastal') {
      ctx.strokeStyle = BIOME_INK.grass; ctx.lineWidth = Math.max(0.4, sz * 0.12); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y + sz * 0.3); ctx.lineTo(x - sz * 0.3, y - sz * 0.5);
      ctx.moveTo(x, y + sz * 0.3); ctx.lineTo(x, y - sz * 0.6);
      ctx.moveTo(x, y + sz * 0.3); ctx.lineTo(x + sz * 0.3, y - sz * 0.5);
      ctx.stroke(); ctx.lineCap = 'butt';
    } else if (b === 'wilderness') {
      ctx.strokeStyle = BIOME_INK.scrub; ctx.lineWidth = Math.max(0.4, sz * 0.14);
      ctx.beginPath();
      ctx.moveTo(x - sz * 0.4, y); ctx.lineTo(x + sz * 0.4, y);
      ctx.moveTo(x, y - sz * 0.4); ctx.lineTo(x, y + sz * 0.4);
      ctx.stroke();
    }
  }
}

// The sea on its seeded edge: fill the water side of the ragged coast, ink the
// shore + a couple of wave contours, set the offshore islands.
function drawOcean(ctx, geo, P, W, H, z) {
  const o = geo.ocean, rect = geo.rect;
  const seaExtreme = o.axis === 'x' ? (o.sign > 0 ? rect.maxX : rect.minX) : (o.sign > 0 ? rect.maxY : rect.minY);
  const a0 = o.along === 'x' ? rect.minX : rect.minY;
  const a1 = o.along === 'x' ? rect.maxX : rect.maxY;
  const cLo = o.axis === 'x' ? [seaExtreme, a0] : [a0, seaExtreme];
  const cHi = o.axis === 'x' ? [seaExtreme, a1] : [a1, seaExtreme];
  ctx.fillStyle = OCEAN_FILL; ctx.beginPath();
  for (let i = 0; i < o.coast.length; i++) { const [x, y] = P(o.coast[i][0], o.coast[i][1]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  { const [x, y] = P(cHi[0], cHi[1]); ctx.lineTo(x, y); }
  { const [x, y] = P(cLo[0], cLo[1]); ctx.lineTo(x, y); }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = WAVE; ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const off = k * o.sign * NODE_WU * 0.85;
    ctx.lineWidth = Math.max(0.5, z * (k === 0 ? 9 : 5));
    ctx.beginPath();
    for (let i = 0; i < o.coast.length; i++) {
      let wx = o.coast[i][0], wy = o.coast[i][1];
      if (o.axis === 'x') wx += off; else wy += off;
      const [x, y] = P(wx, wy); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  for (const isl of (o.islands || [])) {
    const [x, y] = P(isl.cx, isl.cy), rr = isl.r * z;
    if (rr < 1) continue;
    blobFill(ctx, x, y, rr, rr * 0.82, isl.blob, 'rgba(150,140,104,0.5)');
    ctx.strokeStyle = SEPIA_SOFT; ctx.lineWidth = Math.max(0.4, rr * 0.06); blobPath(ctx, x, y, rr, rr * 0.82, isl.blob); ctx.stroke();
  }
}

// The Blasted Heath: dead, ashen, cracked — deliberately WRONG against the warm
// parchment, with a sickly blight haze creeping at its edge.
function drawHeath(ctx, heath, P) {
  const pts = heath.poly.map(([wx, wy]) => P(wx, wy));
  const path = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  ctx.lineJoin = 'round';
  // a sickly red-black blight bleeding past the edge
  path(); ctx.strokeStyle = HEATH_GLOW; ctx.lineWidth = 16; ctx.stroke();
  // the dead ashen ground
  path(); ctx.fillStyle = HEATH_FILL; ctx.fill();
  // the burnt rim
  path(); ctx.strokeStyle = HEATH_EDGE; ctx.lineWidth = 1.5; ctx.stroke();
  // the red-black fissures
  ctx.strokeStyle = HEATH_CRACK; ctx.lineWidth = 1; ctx.lineCap = 'round';
  for (const cr of (heath.cracks || [])) {
    if (cr.length < 2) continue;
    ctx.beginPath();
    for (let i = 0; i < cr.length; i++) { const [x, y] = P(cr[i][0], cr[i][1]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

// Paint the whole illustrated ground: ocean → biome clumps → lakes → rivers →
// the mountain range backbone → the dead Heath. All under the caller's alpha
// (it fades out across the settlement band so village layouts own the close ground).
function drawGeography(ctx, geo, stamps, toPx, W, H, z) {
  const P = (wx, wy) => toPx(wx, wy, W, H);
  if (geo.ocean) drawOcean(ctx, geo, P, W, H, z);
  const cull = 60;
  // regional fills full when the whole world frames; gone by the region band so
  // the close view is clean parchment + hand-drawn motifs (no blob soup).
  const fillScale = 1 - fadeIn(z, 0.05, 0.13);
  for (const st of stamps) {
    const [cx, cy] = P(st.wx, st.wy), rPx = st.r * z;
    if (cx < -cull - rPx || cx > W + cull + rPx || cy < -cull - rPx || cy > H + cull + rPx) continue;
    drawStamp(ctx, st, cx, cy, rPx, fillScale);
  }
  for (const lk of (geo.lakes || [])) {
    const [x, y] = P(lk.cx, lk.cy), rx = lk.rx * z, ry = lk.ry * z;
    if (rx < 1.2 || x < -rx || x > W + rx || y < -ry || y > H + ry) continue;
    blobFill(ctx, x, y, rx, ry, lk.blob, WATER_FILL);
    ctx.strokeStyle = WATER_LINE; ctx.lineWidth = Math.max(0.5, rx * 0.045);
    blobPath(ctx, x, y, rx * 0.86, ry * 0.86, lk.blob); ctx.stroke();
  }
  ctx.strokeStyle = RIVER_INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const rv of (geo.rivers || [])) {
    if (rv.length < 2) continue;
    ctx.lineWidth = Math.max(0.7, Math.min(4, z * 80));
    ctx.beginPath();
    for (let i = 0; i < rv.length; i++) { const [x, y] = P(rv[i][0], rv[i][1]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  for (const pk of (geo.range?.peaks || [])) {
    const [x, y] = P(pk.x, pk.y), s = pk.r * z;
    if (s < 1 || x < -s * 2 || x > W + s * 2 || y < -s * 2 || y > H + s * 2) continue;
    drawPeak(ctx, x, y, s, pk.snow);
  }
  if (geo.heath?.poly?.length) drawHeath(ctx, geo.heath, P);
}

// ── D0: the underworld cutaway — dark chambers inked on the parchment when you
// descend (docs/WORLD_AND_DUNGEONS.md Part B). The dungeon is a structure with a
// room graph; we lay its rooms on a compass grid (matching how you navigate it)
// and draw each as a chamber, the current one holding the player marker. Fog law:
// register only what you've SEEN — but DEV EXCEPTION (now) renders all unfogged
// so Tim can see the whole place; the fog hood goes back on before play.
const DUNG_FLOOR = 'rgba(30,28,36,0.88)', DUNG_FLOOR_FOG = 'rgba(30,28,36,0.30)';
const DUNG_WALL = 'rgba(16,14,20,0.96)', DUNG_DOOR = 'rgba(74,62,46,0.92)';
const DUNG_LABEL = 'rgba(228,224,212,0.92)', DUNG_FEATURE = 'rgba(208,150,68,0.96)';
const DUNG_FOG = false;            // dev: render everything unfogged (see the spec)
const ROOM_WU = 360;               // grid spacing between dungeon rooms (wu)
const ROOM_BOX = 250;              // a chamber's drawn size (wu)

function dungeonRoomGrid(topology) {
  const layout = interiorCompassLayout(topology);
  const rooms = Array.isArray(topology?.rooms) ? topology.rooms : [];
  const pos = new Map();
  if (!rooms.length) return pos;
  const entry = (rooms.find(r => (r.tags || []).includes('entry')) || rooms[0]).id;
  pos.set(entry, { c: 0, r: 0 });
  const queue = [entry];
  const STEP = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
  while (queue.length) {
    const id = queue.shift();
    const ex = layout.get(id) || {};
    for (const d of ['north', 'east', 'south', 'west']) {
      const nb = ex[d];
      if (nb && !pos.has(nb)) {
        const here = pos.get(id), [dc, dr] = STEP[d];
        pos.set(nb, { c: here.c + dc, r: here.r + dr });
        queue.push(nb);
      }
    }
  }
  let extra = 1;
  for (const rm of rooms) if (!pos.has(rm.id)) pos.set(rm.id, { c: 0, r: extra++ });
  return pos;
}

function drawDungeonCutaway(ctx, world, interior, nodes, toPx, W, H, z) {
  const st = world.structures?.byId?.[String(interior.structureKey)];
  if (!st || !st.topology) return;
  const node = nodes.find(n => String(n?.id || '') === String(st.nodeId || ''));
  if (!node) return;
  const c = nodeToWu(node);
  const grid = dungeonRoomGrid(st.topology);
  const rooms = st.topology.rooms || [];
  const visited = new Set(Array.isArray(interior.visited) ? interior.visited : []);
  const P = (cc, rr) => toPx(c.x + cc * ROOM_WU, c.y + rr * ROOM_WU, W, H);
  const s = ROOM_BOX * z;
  // corridors between connected rooms, under the chambers
  ctx.strokeStyle = DUNG_DOOR; ctx.lineWidth = Math.max(1.5, s * 0.1); ctx.lineCap = 'round';
  for (const e of (st.topology.edges || [])) {
    const ga = grid.get(e.a), gb = grid.get(e.b); if (!ga || !gb) continue;
    const [ax, ay] = P(ga.c, ga.r), [bx, by] = P(gb.c, gb.r);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  }
  ctx.lineCap = 'butt';
  for (const rm of rooms) {
    const g = grid.get(rm.id) || { c: 0, r: 0 };
    const [px, py] = P(g.c, g.r);
    if (s < 3 || px < -s || px > W + s || py < -s || py > H + s) continue;
    const seen = !DUNG_FOG || visited.has(rm.id);
    ctx.fillStyle = seen ? DUNG_FLOOR : DUNG_FLOOR_FOG;
    ctx.fillRect(px - s / 2, py - s / 2, s, s);
    ctx.strokeStyle = DUNG_WALL; ctx.lineWidth = Math.max(1, s * 0.045);
    ctx.strokeRect(px - s / 2, py - s / 2, s, s);
    if (s > 26 && seen) {
      const role = (rm.tags || []).find(t => !['entry', 'stairs-down', 'stairs-up'].includes(t)) || 'chamber';
      ctx.fillStyle = DUNG_FEATURE;     // a feature glyph at the room's heart
      ctx.beginPath();
      ctx.moveTo(px, py - s * 0.14); ctx.lineTo(px + s * 0.12, py); ctx.lineTo(px, py + s * 0.14); ctx.lineTo(px - s * 0.12, py); ctx.closePath(); ctx.fill();
      inkLabel(ctx, role, px, py - s * 0.22, `${Math.round(Math.min(15, s * 0.14))}px ${HAND}`, DUNG_LABEL, 'center', 'bottom', 2.4);
    }
    if (rm.id === String(interior.roomId)) {
      const my = py + s * 0.3;
      ctx.strokeStyle = PLAYER; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, my, Math.max(4, s * 0.08), 0, 7); ctx.stroke();
      ctx.fillStyle = PLAYER; ctx.beginPath(); ctx.arc(px, my, Math.max(1.5, s * 0.032), 0, 7); ctx.fill();
    }
  }
}

// M7 — an organic road: a seeded meandering polyline, not a single clean arc.
// Wander is a few low-frequency anchors (the road choosing its way around the
// country) plus a touch of high-frequency jitter, tapered to meet both nodes.
// Computed in px so the shape stays consistent across zoom; identical every
// render (seeded by the sorted edge key).
function roadMeanderPts(aId, bId, x1, y1, x2, y2) {
  const key = aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`;
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;                 // perpendicular unit
  const N = Math.max(8, Math.min(24, Math.round(len / 34)));
  const amp = Math.min(len * 0.16, 90);                // wander, capped
  const A = 5;
  const anchor = [];
  for (let i = 0; i <= A; i++) anchor.push(((seedFromString(`${key}|rd|${i}`) % 2000) / 2000 - 0.5) * 2);
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const env = Math.sin(Math.PI * t);                 // 0 at the nodes, max mid-route
    const k = t * A, k0 = Math.floor(k), f = k - k0;
    const lo = anchor[k0] ?? 0, hi = anchor[k0 + 1] ?? lo, sm = f * f * (3 - 2 * f);
    const low = lo * (1 - sm) + hi * sm;
    const high = ((seedFromString(`${key}|h|${i}`) % 1000) / 1000 - 0.5) * 0.4;
    const off = (low + high) * amp * env;
    pts.push([x1 + dx * t + nx * off, y1 + dy * t + ny * off]);
  }
  return pts;
}
// Stroke a polyline as a smooth curve (quadratics through the midpoints).
function strokeSmooth(ctx, pts) {
  if (!pts || pts.length < 2) return;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  ctx.stroke();
}

export function renderOneMap(world, opts = {}) {
  const map = world?.map || {};
  const nodes = Array.isArray(map.nodes) ? map.nodes : [];
  const cam = cameraFor(world, opts.initialZoom);
  const seed = String(world?.meta?.seed || 'seed');
  const { geo, stamps } = geoFor(world);
  const { known, rumor } = discoveryTiers(map);
  const hereId = String(map.currentNodeId || '');

  // Height: by default a fixed pixel canvas (the standalone Map screen). When the
  // caller passes a CSS height (opts.heightCss, e.g. '100%'), the canvas FILLS its
  // container instead — the in-play embed sizes the map to ~60% of the viewport —
  // and the draw loop reads the live clientHeight (kept fresh by a ResizeObserver).
  const fixedH = Math.max(320, Number(opts.height) || 520);
  const fillMode = typeof opts.heightCss === 'string' && opts.heightCss;
  const curH = () => fillMode ? Math.max(120, canvas.clientHeight || fixedH) : fixedH;
  const wrap = document.createElement('div');
  wrap.style.cssText = fillMode
    ? 'position:relative;width:100%;height:100%;user-select:none;'
    : 'position:relative;width:100%;user-select:none;';
  const canvas = document.createElement('canvas');
  const hCss = fillMode ? opts.heightCss : `${fixedH}px`;
  canvas.style.cssText = `display:block;width:100%;height:${hCss};border-radius:6px;cursor:grab;touch-action:none;`;
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
        inkLabel(ctx, label, (bx0 + bx1) / 2, by0 - 2, `10px ${HAND}`, INKSOFT, 'center', 'bottom', 2.4);
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
    const cssH = curH();
    if (canvas.width !== Math.round(cssW * dpr)) canvas.width = Math.round(cssW * dpr);
    if (canvas.height !== Math.round(cssH * dpr)) canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = cssW, H = cssH;
    const z = cam.z;

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    // M7 — real parchment under the ink (fibre grain + soft age stains).
    const parch = parchmentFor(seed, W, H, dpr);
    if (parch) ctx.drawImage(parch, 0, 0, W, H);

    // ── M6: the illustrated biome ground + set-pieces (geography.js). Fades OUT
    // across the settlement band so real village layouts own the close ground (M2).
    const washAlpha = 1 - fadeIn(z, BAND.settlement * 0.7, BAND.settlement * 4);
    if (washAlpha > 0.02) {
      ctx.globalAlpha = washAlpha;
      drawGeography(ctx, geo, stamps, toPx, W, H, z);
      ctx.globalAlpha = 1;
    }

    // ── M7: aged grade + edge wear — a warm sepia bloom into the corners that
    // ties the biome inks into one antique palette. Over the ground, under roads.
    {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.26, W / 2, H / 2, Math.max(W, H) * 0.78);
      g.addColorStop(0, 'rgba(122,98,52,0.015)');
      g.addColorStop(0.66, 'rgba(110,84,44,0.07)');
      g.addColorStop(1, 'rgba(70,50,26,0.26)');
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
        ctx.strokeStyle = (aKnown && bKnown) ? ROAD : ROAD_GHOST;
        ctx.globalAlpha = roadAlpha * ((aKnown && bKnown) ? 1 : 0.7);
        strokeSmooth(ctx, roadMeanderPts(String(a.id), String(b.id), x1, y1, x2, y2));
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
        // calligrapher's registers: towns upright, everything else italic — each
        // on a paper halo so the name reads cleanly over terrain.
        const font = type === 'settlement' ? `13px ${HAND}` : `italic 11px ${HAND}`;
        inkLabel(ctx, String(n.name), x, y + r + 3, font, INK, 'center', 'top');
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
        inkLabel(ctx, line1, x, y + rPx * 0.82 + 3, `italic ${Math.round(fs)}px ${HAND}`, SEPIA, 'center', 'top', 2.4);
        ctx.font = `italic ${Math.round(fs * 0.82)}px ${HAND}`;
        ctx.fillStyle = SEPIA_SOFT;
        ctx.fillText('— up here somewhere', x, y + rPx * 0.82 + 3 + fs * 1.1);
        ctx.globalAlpha = 1;
      }
    }

    // ── D0: the dungeon cutaway, when you're below ground ──
    const dintr = (world.scene && typeof world.scene.interior === 'object') ? world.scene.interior : null;
    const inDungeon = dintr && isDungeonStructureId(dintr.structureKey);
    if (inDungeon) drawDungeonCutaway(ctx, world, dintr, nodes, toPx, W, H, z);

    // ── the player ──
    // M4: place the marker where you actually STAND when the live walk
    // position is known (opts.playerPos from ui.place, in place units), so the
    // dot sits in your room/street — not at the node midpoint. Falls back to
    // node-center when no walk position is available (e.g. viewing a far node).
    // (In a dungeon the cutaway above draws its own marker.)
    const here = nodes.find(n => String(n.id) === hereId);
    if (here && !inDungeon) {
      let p = nodeToWu(here);
      const pos = opts.playerPos;
      // #4: if you just climbed out a NAMED window, stand on that side of the building (the map must
      // reflect the side you left by). This wins over the walk position for that one beat.
      const exitFacing = lastWindowExitFacing(world);
      if (exitFacing) {
        const [dx, dy] = facingNudge(exitFacing);
        p = { x: p.x + dx, y: p.y + dy };
      } else if (pos && String(pos.nodeId || '') === hereId && Number.isFinite(+pos.ux) && Number.isFinite(+pos.uy)) {
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

    // ── M7: the compass rose (screen-space, lower-right) ──
    drawCompass(ctx, W - 48, H - 54, 25);

    // ── M8: time of day — a sun by day, a moon at night, with the wall-clock (no dimming) ──
    drawTimeOfDay(ctx, world, W);

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

    // ── continuous-zoom hook: mirror the live 2D camera to any stacked layer
    // (the 3D overworld overlay). Pure read of camera state; never mutates world.
    if (typeof opts.onCamera === 'function') {
      try { opts.onCamera({ z: cam.z, cx: cam.cx, cy: cam.cy, W, H }); } catch {}
    }
  }

  // ── interactions: wheel zoom at the cursor, drag pan ──
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
    const W = canvas.clientWidth, H = curH();
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

  // No zoom buttons by design: this is ONE continuous map you zoom all the way
  // through with the wheel/trackpad (handler above), pan by drag. Per directive —
  // "there should be no button for zoom." Wheel-out reaches Z_MIN (the whole
  // world, the far Heath included); double-click-to-fit can return as a gesture
  // if wheel-out ever proves insufficient, but never as a screen-space button.

  // First paint after mount (clientWidth needs layout).
  requestAnimationFrame(draw);
  // Fill mode: the canvas tracks its container (a vh-based height), so redraw
  // whenever that container resizes — keeps the backing store crisp on window
  // resize without waiting for the next turn's full re-render.
  if (fillMode) {
    try { const ro = new ResizeObserver(() => draw()); ro.observe(canvas); wrap.__ro = ro; } catch {}
  }
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
