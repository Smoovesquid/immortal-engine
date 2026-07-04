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
  placeFrame, placeUnitToWu, resolveEntityWuFromWorld
} from './worldSpace.js';
import { worldGeography, terrainStamps } from './geography.js';
import { placeFromWorldNode } from './placeFromNode.js';
import { roadNetwork } from './roadNetwork.js';
import { isDungeonStructureId } from '../../engine/dungeon/generate.js';
import { interiorCompassLayout } from '../../engine/structures/topology.js';
import { dayPhase, clockLabel } from '../../engine/dayNight.js';
// TT-DRAW (docs/TABLETOP_MAP.md): structure is DRAWN from the REAL floorPlan
// (not the catalog placeFromNode.js shape), entities (people/trees) are PLACED
// tokens, and a settlement-local fog wash distinguishes explored/unexplored.
// TT-DRAW-3: quadrilleAlpha/quadrilleStroke — the graph paper at the closest view.
import { drawnStructureModel, placedTokenModel, fogMask, INK_PARAMS, catalogPlanBoundsInPlaceUnits, fitCatalogPointToRect, quadrilleAlpha, quadrilleStroke } from './drawModel.js';

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

// TT-DRAW-3 — the graph paper at the closest view: a REAL 5-ft tactical
// quadrille (CELL_FT, engine/map/spatial/tacticalPos.js, imported through
// drawModel.js's wuToFt — never a re-derived conversion), teal rule per
// GRAPH_PAPER_UI.md/handDrawnInterior.js's GMIN/GMAJ idiom, faint, drawn UNDER
// every other ink (biome wash, roads, buildings, tokens all paint over it).
// Fades in purely as a function of z (quadrilleAlpha, drawModel.js's ONE
// ink-params place) — never a pop, matching every other band crossing on
// this map. World-anchored (grid lines land on exact multiples of one
// world-unit = CELL_FT feet in WORLD space, not screen space) so the grid
// holds still under the camera exactly like every other drawn feature.
function drawQuadrille(ctx, toPx, W, H, z, camCx, camCy) {
  const a = quadrilleAlpha(z);
  if (a <= 0) return;
  // One grid line every 1 world unit (== CELL_FT == 5 ft, the pinned identity
  // — see drawModel.js's wuToFt). Pixel pitch at this zoom:
  const pitchPx = z; // 1 wu * z px/wu
  if (!(pitchPx > 1)) return; // degenerate/too-fine to matter — never divide by ~0 below
  // World-space line positions visible in [0,W]x[0,H]: the leftmost/topmost
  // whole-wu grid line inside frame, stepping by 1 wu (pitchPx) thereafter.
  const leftWu = camCx - W / 2 / z, topWu = camCy - H / 2 / z;
  const startX = Math.floor(leftWu);
  const startY = Math.floor(topWu);
  const countX = Math.ceil(W / pitchPx) + 2;
  const countY = Math.ceil(H / pitchPx) + 2;
  ctx.save();
  ctx.lineWidth = 1;
  for (let i = 0; i <= countX; i++) {
    const wuX = startX + i;
    const [px] = toPx(wuX, 0, W, H);
    if (px < -2 || px > W + 2) continue;
    const major = Math.round(wuX) % 5 === 0;
    ctx.strokeStyle = quadrilleStroke(major, a);
    ctx.beginPath(); ctx.moveTo(px + 0.5, 0); ctx.lineTo(px + 0.5, H); ctx.stroke();
  }
  for (let j = 0; j <= countY; j++) {
    const wuY = startY + j;
    const [, py] = toPx(0, wuY, W, H);
    if (py < -2 || py > H + 2) continue;
    const major = Math.round(wuY) % 5 === 0;
    ctx.strokeStyle = quadrilleStroke(major, a);
    ctx.beginPath(); ctx.moveTo(0, py + 0.5); ctx.lineTo(W, py + 0.5); ctx.stroke();
  }
  ctx.restore();
}

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

// ── FP-2: walls with mass — poché (docs/briefs/FP-2-walls-with-mass.md) ──────
// The plan band draws walls as solid MASS, not thin outlines: the wall band (the
// building shell minus the room floor polys) fills in the material's ink with a
// hatch, doorways pierce it and swing, windows the engine treats as CANON draw on
// exterior walls. This ports handDrawnInterior.js's retired MATERIALS/window/door
// vocabulary onto FP-1's honest tiled geometry (floorPlan WALL=0.12 band, U429).
// Tunables live in drawModel.js's INK_PARAMS (Tim tunes by eye later).

// A 10×10 repeating hatch pattern per material character (diag / cross / stipple),
// matched to handDrawnInterior.js's hatch() so the map shell reads like the old
// grubby graph-paper rock band. Cached per-kind on the module (built once).
const _hatchCache = new Map();
function pocheHatch(ctx, kind, rgba) {
  const key = kind + '|' + rgba;
  if (_hatchCache.has(key)) return _hatchCache.get(key);
  if (typeof document === 'undefined') return null; // no DOM (tests) — renderer only
  const t = document.createElement('canvas'); t.width = t.height = 10;
  const x = t.getContext('2d');
  x.strokeStyle = rgba; x.fillStyle = rgba; x.lineWidth = 1;
  if (kind === 'stipple') {
    [[2, 3], [6, 7], [8, 2], [3, 8]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 0.85, 0, 7); x.fill(); });
  } else {
    x.beginPath(); x.moveTo(-2, 12); x.lineTo(12, -2); x.stroke();
    x.beginPath(); x.moveTo(-2, 5); x.lineTo(5, -2); x.stroke();
    x.beginPath(); x.moveTo(5, 12); x.lineTo(12, 5); x.stroke();
    if (kind === 'cross') { x.beginPath(); x.moveTo(-2, -2); x.lineTo(12, 12); x.stroke(); }
  }
  const pat = ctx.createPattern(t, 'repeat');
  _hatchCache.set(key, pat);
  return pat;
}

// Bump an rgba's alpha to a fixed value (for a hatch overlay derived from a fill).
function withAlpha(rgba, a) {
  const m = /rgba?\(([^)]+)\)/.exec(String(rgba));
  if (!m) return rgba;
  const parts = m[1].split(',').map(s => s.trim());
  return `rgba(${parts[0]},${parts[1]},${parts[2]},${a})`;
}

// Trace the shell rect (outer) then every room floor polygon (inner) as ONE path,
// so an even-odd fill paints the wall BAND (shell minus rooms) — the space between
// rooms becomes wall, not paper. `toPxFn(wx,wy) -> [px,py]`.
function tracePocheBand(ctx, rect, rooms, toPxFn) {
  const [ax, ay] = toPxFn(rect.minX, rect.minY);
  const [bx, by] = toPxFn(rect.maxX, rect.maxY);
  ctx.beginPath();
  ctx.rect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
  for (const room of rooms) {
    const segs = room.walls;
    if (!segs || !segs.length) continue;
    const [mx, my] = toPxFn(segs[0].a.wx, segs[0].a.wy);
    ctx.moveTo(mx, my);
    for (const s of segs) { const [px, py] = toPxFn(s.b.wx, s.b.wy); ctx.lineTo(px, py); }
    ctx.closePath();
  }
}

// A door gap + swing arc, drawn in PAPER over the poché so the doorway reads as an
// opening one room into the next (FP-2 #2). `dir` is the compass side the door
// pierces; `gapPx` is the pre-scaled opening width; `wallPx` is the wall-band
// thickness the gap must clear. The door LEAF (and its swing arc) is one gap-width
// long — a real door swings its own width, so the arc stays inside a room instead
// of sweeping across it. Ported from handDrawnInterior.js's openingGap + doorGlyph.
function drawDoorOnPoche(ctx, dpx, dpy, dir, gapPx, wallPx) {
  const horiz = dir === 'east' || dir === 'west'; // the shared wall runs vertically → gap spans y
  const leaf = gapPx * (INK_PARAMS.doorSwingMul || 1); // leaf length / swing radius = a multiple of the opening width
  const clear = Math.max(wallPx, gapPx * 0.55); // paper cut spans the wall thickness so the mass truly opens
  ctx.fillStyle = PAPER;
  if (horiz) ctx.fillRect(dpx - clear * 0.5, dpy - gapPx * 0.5, clear, gapPx);
  else ctx.fillRect(dpx - gapPx * 0.5, dpy - clear * 0.5, gapPx, clear);
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, gapPx * 0.14); ctx.lineCap = 'round';
  const half = gapPx * 0.5;
  if (horiz) {
    // jambs at top & bottom of the gap, then a quarter-circle swing (radius = leaf).
    ctx.beginPath(); ctx.moveTo(dpx - 2.5, dpy - half); ctx.lineTo(dpx + 2.5, dpy - half); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dpx - 2.5, dpy + half); ctx.lineTo(dpx + 2.5, dpy + half); ctx.stroke();
    ctx.strokeStyle = INKSOFT; ctx.lineWidth = Math.max(0.8, gapPx * 0.1);
    ctx.beginPath(); ctx.arc(dpx, dpy - half, leaf, Math.PI * 0.5, 0, true); ctx.stroke(); // hinge at top jamb
    ctx.beginPath(); ctx.moveTo(dpx, dpy - half); ctx.lineTo(dpx, dpy - half + leaf); ctx.stroke(); // the leaf itself
  } else {
    ctx.beginPath(); ctx.moveTo(dpx - half, dpy - 2.5); ctx.lineTo(dpx - half, dpy + 2.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dpx + half, dpy - 2.5); ctx.lineTo(dpx + half, dpy + 2.5); ctx.stroke();
    ctx.strokeStyle = INKSOFT; ctx.lineWidth = Math.max(0.8, gapPx * 0.1);
    ctx.beginPath(); ctx.arc(dpx - half, dpy, leaf, 0, Math.PI * 0.5); ctx.stroke(); // hinge at left jamb
    ctx.beginPath(); ctx.moveTo(dpx - half, dpy); ctx.lineTo(dpx - half + leaf, dpy); ctx.stroke(); // the leaf
  }
}

// A window on an exterior wall: glazed double-tick when open (casement), shutter
// marks when closed (FP-2 #3). Ported from handDrawnInterior.js's windowGlyph.
// `orient` 'h' = window runs horizontally (on a north/south wall); 'v' = vertical.
function drawWindowGlyph(ctx, wpx, wpy, orient, shuttered, lenPx) {
  const H = orient === 'h', th = Math.max(3, lenPx * 0.22), half = lenPx * 0.5;
  // Clear the wall behind the glass so it reads as an opening in the mass.
  ctx.fillStyle = PAPER;
  if (H) ctx.fillRect(wpx - half, wpy - th / 2, half * 2, th);
  else ctx.fillRect(wpx - th / 2, wpy - half, th, half * 2);
  const ln = (x1, y1, x2, y2, col, lw) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  // Frame.
  if (H) {
    ln(wpx - half, wpy - th / 2, wpx + half, wpy - th / 2, INK, 1.6);
    ln(wpx - half, wpy + th / 2, wpx + half, wpy + th / 2, INK, 1.6);
    ln(wpx - half, wpy - th / 2, wpx - half, wpy + th / 2, INK, 1.4);
    ln(wpx + half, wpy - th / 2, wpx + half, wpy + th / 2, INK, 1.4);
  } else {
    ln(wpx - th / 2, wpy - half, wpx - th / 2, wpy + half, INK, 1.6);
    ln(wpx + th / 2, wpy - half, wpx + th / 2, wpy + half, INK, 1.6);
    ln(wpx - th / 2, wpy - half, wpx + th / 2, wpy - half, INK, 1.4);
    ln(wpx - th / 2, wpy + half, wpx + th / 2, wpy + half, INK, 1.4);
  }
  if (shuttered) {
    // Shutter leaves: two hatched panels closed over the opening.
    ctx.strokeStyle = withAlpha(WOODI, 0.85); ctx.lineWidth = 1;
    if (H) { for (let gx = wpx - half + 2; gx < wpx + half - 1; gx += 3) ln(gx, wpy - th / 2 + 1, gx, wpy + th / 2 - 1, withAlpha(WOODI, 0.7), 1); ln(wpx, wpy - th / 2, wpx, wpy + th / 2, INK, 1.4); }
    else { for (let gy = wpy - half + 2; gy < wpy + half - 1; gy += 3) ln(wpx - th / 2 + 1, gy, wpx + th / 2 - 1, gy, withAlpha(WOODI, 0.7), 1); ln(wpx - th / 2, wpy, wpx + th / 2, wpy, INK, 1.4); }
  } else {
    // Glazed: the mullion tick across the light (casement double-tick).
    if (H) ln(wpx, wpy - th / 2, wpx, wpy + th / 2, INKSOFT, 1.1);
    else ln(wpx - th / 2, wpy, wpx + th / 2, wpy, INKSOFT, 1.1);
  }
}

// ── WS-2: the player's one resolved focus point ─────────────────────────────
// playerFocusWu(world) -> { wx, wy, sig } | null
// The ONE place the camera/marker anchor to: engine-truthful, room-granular
// indoors, walk-position outdoors — read through WS-1's resolveEntityWuFromWorld
// (docs/POSITION_AS_CANON.md §6). `sig` is a location signature (changes iff the
// engine actually moved the player to a new room/node/inside-outside state) so
// the camera can tell "the world moved me" from "I'm just re-rendering the same
// spot." Pure + read-only: never touches world.party/world.scene, only reads them.
// Exported for U407/U408 (hermetic camera-math + no-write proofs) — pure
// functions, safe to call directly with no DOM/canvas required. Each test uses
// a unique campaignId so the CAMS module singleton doesn't leak across cases.
export function playerFocusWu(world) {
  const nodeId = String(world?.map?.currentNodeId || '');
  if (!nodeId) return null;
  const node = (world?.map?.nodes || []).find(n => n && String(n.id) === nodeId);
  if (!node) return null;
  const interior = (world?.scene && typeof world.scene.interior === 'object') ? world.scene.interior : null;
  const pos = (Array.isArray(world?.party) && world.party[0] && typeof world.party[0].position === 'object')
    ? world.party[0].position : null;
  // TAC-4: the player's canonical tactical cell (engine/map/spatial/tacticalPos.js).
  // When present it moves the marker cell-by-cell (a within-room walk registers on the
  // map); when null the legacy room/walk-position path resolves exactly as before.
  const tacPos = (Array.isArray(world?.party) && world.party[0]
    && world.party[0].pos && typeof world.party[0].pos === 'object'
    && Number.isInteger(world.party[0].pos.gx) && Number.isInteger(world.party[0].pos.gy))
    ? world.party[0].pos : null;

  let place = null, frame = null;
  try {
    place = node.settlement ? placeFromWorldNode(world, nodeId) : null;
    if (place) frame = placeFrame(place);
  } catch { place = null; frame = null; }

  let loc, sig;
  if (interior) {
    const structureKey = String(interior.structureKey || '');
    const roomId = String(interior.roomId || '');
    loc = { nodeId, structureKey, roomId, pos: tacPos };
    sig = `in|${nodeId}|${structureKey}|${roomId}`;
  } else if (pos && String(pos.nodeId || '') === nodeId && Number.isFinite(+pos.ux) && Number.isFinite(+pos.uy)) {
    loc = { nodeId, ux: +pos.ux, uy: +pos.uy, pos: tacPos };
    sig = `out|${nodeId}|${(+pos.ux).toFixed(2)}|${(+pos.uy).toFixed(2)}`;
  } else {
    loc = { nodeId, pos: tacPos };
    sig = `node|${nodeId}`;
  }
  // TAC-4: fold the tactical cell into the signature so the follow-camera treats a
  // pos walk as a real move (recenters), even a WITHIN-room one where the room label
  // is unchanged. The inside/outside prefix (`in|`/`out|`/`node|`) is preserved, so
  // WS-3's "only re-snap the zoom on an indoor↔outdoor crossing" still reads correctly
  // (sigIsIndoors keys off that prefix, which a same-frame pos step never changes).
  if (tacPos) sig += `|@${tacPos.frame}:${tacPos.gx},${tacPos.gy}`;

  const p = resolveEntityWuFromWorld(world, place, frame, loc);
  if (!p) return null;
  return { wx: p.wx, wy: p.wy, sig };
}

// Camera survives v1's full-DOM re-renders: module singleton, per campaign.
const CAMS = new Map();

// WS-3 — a focus signature is "indoors" iff playerFocusWu tagged it 'in|...'
// (see playerFocusWu above: 'in|' room-granular, 'out|'/'node|' otherwise). The
// ONE place that string convention is interpreted as a boolean, so the indoor
// default-zoom band and the outdoor one never drift from playerFocusWu's own sig format.
function sigIsIndoors(sig) { return typeof sig === 'string' && sig.startsWith('in|'); }

export function cameraFor(world, initialZoom, focus) {
  const key = String(world?.meta?.campaignId || 'campaign');
  const hereId = String(world?.map?.currentNodeId || '');
  const here = (world?.map?.nodes || []).find(n => n && n.id === hereId);
  // The band a fresh mount (or an indoor<->outdoor crossing) snaps to: plan
  // scale indoors (BAND.plan, framing the room), the caller's outdoor default
  // otherwise (opts.initialZoom — the in-play embed's street band, or the
  // region band on the standalone Map screen). docs/briefs/WS-3-one-surface.md
  // scope #2: this is the ONE thing that changes SIZE on that crossing — never
  // which renderer runs.
  const outdoorZ = Number.isFinite(initialZoom) ? initialZoom : 0.12;
  const bandZFor = (sig) => sigIsIndoors(sig) ? BAND.plan : outdoorZ;
  if (!CAMS.has(key)) {
    const c = focus || (here ? nodeToWu(here) : { x: 0, y: 0 });
    const sig = focus ? focus.sig : '';
    CAMS.set(key, { cx: c.x ?? c.wx, cy: c.y ?? c.wy, z: bandZFor(sig), focusSig: sig, lookingAway: false });
  }
  const cam = CAMS.get(key);
  // The camera keeps the player centered (docs/POSITION_AS_CANON.md §6, Tim
  // 2026-07-04-pm): every render, re-derive the player's engine-truthful focus
  // point (node change, room-to-room move, inside<->outside — anything WS-1's
  // resolveEntityWuFromWorld can see) and recenter on it, UNLESS the player is
  // mid-manual-pan ("looking"). A manual pan sets lookingAway; the next actual
  // player move (a changed focus signature) snaps focus back — generalizing the
  // old node-only recenter to every move. Panning within the SAME resolved spot
  // (re-render, no move) is left alone so a look-around isn't fought every frame.
  // View state only — world/determinism untouched.
  if (focus && focus.sig !== cam.focusSig) {
    // WS-3: only re-snap the ZOOM when the move actually crosses the indoor/
    // outdoor threshold (the "band widens/narrows" behavior the brief asks
    // for) — a room-to-room move that stays on the SAME side (walking through
    // your house, or walking outdoors) recenters position only, so a player
    // who wheel-zoomed in to read the furniture never gets fought by the very
    // next move.
    if (sigIsIndoors(focus.sig) !== sigIsIndoors(cam.focusSig)) cam.z = bandZFor(focus.sig);
    cam.cx = focus.wx; cam.cy = focus.wy;
    cam.focusSig = focus.sig;
    cam.lookingAway = false;
  } else if (!cam.lookingAway && focus) {
    // No move since last render, and the user isn't mid-pan: keep centered
    // (covers the very first render matching the initial CAMS.set above, and
    // any external nudge — e.g. wrap.__oneMapFocus — that isn't a real move).
    cam.cx = focus.wx; cam.cy = focus.wy;
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
// ROADS-1: RETIRED from the live draw — the road ink now comes from the ONE
// world-unit network (roadNetwork.js), whose terminals join each village's lane
// (no node-to-node seam). Kept for lab/reference use; not called by renderOneMap.
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
  const playerFocus = playerFocusWu(world);
  const cam = cameraFor(world, opts.initialZoom, playerFocus);
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

  // ROADS-1 — the ONE road network in world units, derived once per mount (same
  // lifetime as the layout cache; deterministic per world). Every band's road ink
  // consumes THIS geometry — the lane through a village and the road to the next
  // town are the same polyline, so roads continue seamlessly out of every town.
  let roadNet = null;
  try { roadNet = roadNetwork(world); } catch { roadNet = { segments: [], byNode: new Map() }; }

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
    // TT-DRAW: a tree is a PIECE you set down, not ground ink (the tabletop
    // spec's tell for structure-vs-entity). Each grove's trees are individually
    // PLACED tokens (placedTokenModel — deterministic, same scatter the old
    // ellipse painted over) rather than one filled blob per grove.
    const treeTokens = placedTokenModel(world, node.id).trees;
    for (const t of treeTokens) {
      const [tx, ty] = toPx(t.wx, t.wy, W, H);
      const tr = Math.max(0.6, t.r * z * 0.55);
      if (tr < 0.6) continue;
      ctx.fillStyle = GROVE_DARK;
      ctx.beginPath(); ctx.arc(tx, ty + tr * 0.12, tr, 0, 7); ctx.fill();
      ctx.strokeStyle = GROVE; ctx.lineWidth = Math.max(0.5, tr * 0.16); ctx.stroke();
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
    // TT-DRAW: the REAL per-structure plan (floorPlan fitted to its world rect),
    // keyed by structureKey — drawn instead of the catalog b.plan shape for any
    // building that's open (the WS-1-flagged fork this packet resolves).
    const drawnStructures = new Map((drawnStructureModel(world, node.id)?.structures || []).map(s => [s.structureKey, s]));
    // TT-DRAW-2 — paint order: a structureKey-backed (true-rect) building draws
    // LAST (on top). Layout anchors were spaced by placeFromNode.js's rejection
    // sampling assuming EVERY neighbor is catalog-sized; a decorative building
    // (no structureKey, no structureWorldRect to clip its unfitted catalog art
    // to — the one case with no ground truth) can still visually overlap a
    // now-true-sized neighbor at close zoom. Painting true-sized buildings last
    // keeps the fitted plan legible on top rather than buried under an
    // oversized decorative roof — a pure paint-order fix, no sizing invented.
    // The anchors themselves aren't colliding (this is a still-catalog-scale
    // decorative building's own unfitted footprint reaching a shrunk neighbor)
    // — flagged in the TT-DRAW-2 report as village-layout spacing, not fixed here.
    const paintOrder = [...(place.buildings || [])].sort((a, b2) => (a.structureKey ? 1 : 0) - (b2.structureKey ? 1 : 0));
    for (const b of paintOrder) {
      const material = String(b?.plan?.material || 'timber');
      const openable = b.structureKey && (b.structureKey === interiorKey || String(node.id) === homeNodeId);
      const cut = openable ? fadeIn(z, BAND.street, BAND.street * 1.8) : 0;
      const realPlan = b.structureKey ? drawnStructures.get(String(b.structureKey)) : null;

      // helper: project a room/furniture rect (catalog place-units) to px corners.
      const rectPx = (ux, uy, w, h) => {
        const [x0, y0] = P(ux, uy); const [x1, y1] = P(ux + w, uy + h);
        return [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)];
      };

      // TT-DRAW-2 — ONE sizing source: any building backed by a real engine
      // structure (realPlan, from drawnStructureModel) draws its roof/floor
      // silhouette, furniture marks, and room-name labels FITTED INSIDE its true
      // structureWorldRect — never the inflated catalog-art footprint (the root
      // of the roof-overhang class; a structureless decorative building — no
      // structureKey, no floorPlan, no ground truth to clip to — keeps drawing
      // its catalog art unchanged, the one case with nothing to fit against).
      // `PT` replaces `P` for every catalog-derived coordinate on this building:
      // it re-maps the catalog plan's own local bounding box onto realPlan.rect
      // 1:1 (same relative layout, true absolute scale) so furniture/labels stay
      // INSIDE the walls realPlan.rooms[].walls (already world-unit-true) inks.
      let PT = P, bx0, by0, bx1, by1;
      if (realPlan) {
        // catalogPlanBoundsInPlaceUnits/fitCatalogPointToRect (drawModel.js, pure
        // + U416-tested) do the actual bbox+fit math — this closure just wraps
        // the world-unit result through toPx for the canvas. world-space fit:
        // catalog local coords -> world units directly (bypassing the place-unit
        // P() the catalog shape would otherwise use), so the fitted silhouette
        // shares the SAME projection realPlan's own wall ink uses.
        const catBounds = catalogPlanBoundsInPlaceUnits(b);
        PT = (ux, uy) => { const p = fitCatalogPointToRect(catBounds, realPlan.rect, ux, uy); return toPx(p.wx, p.wy, W, H); };
        [bx0, by0] = toPx(realPlan.rect.minX, realPlan.rect.minY, W, H);
        [bx1, by1] = toPx(realPlan.rect.maxX, realPlan.rect.maxY, W, H);
      } else {
        bx0 = Infinity; by0 = Infinity; bx1 = -Infinity; by1 = -Infinity;
      }
      const rectPxT = (ux, uy, w, h) => {
        const [x0, y0] = PT(ux, uy); const [x1, y1] = PT(ux + w, uy + h);
        return [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)];
      };

      if (realPlan) {
        const toPxB = (wx, wy) => toPx(wx, wy, W, H);
        const [rx0, ry0] = toPxB(realPlan.rect.minX, realPlan.rect.minY);
        const [rx1, ry1] = toPxB(realPlan.rect.maxX, realPlan.rect.maxY);
        const rx = Math.min(rx0, rx1), ry = Math.min(ry0, ry1), rw = Math.abs(rx1 - rx0), rh = Math.abs(ry1 - ry0);

        // FLOOR + POCHÉ state (roof lifted): warm floor under everything, then the
        // wall band drawn as solid MASS (FP-2 #1) — no more empty paper between
        // rooms. Only once the cutaway has genuinely opened (cut > 0.2); below that
        // the roof block below cross-fades in.
        if (cut > 0.2) {
          const poche = INK_PARAMS.pocheByShell[realPlan.shell] || INK_PARAMS.pocheByShell.stone;
          // 1) warm floor fills the whole shell (rooms carve back to paper+grid,
          //    the wall band paints over the rest as mass).
          ctx.globalAlpha = alpha * cut;
          ctx.fillStyle = FLOOR_WARM;
          ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.fill();
          // 2) poché: shell MINUS room floors, even-odd → the wall band. Solid
          //    material fill, then a hatch overlay for wall character (stone diag,
          //    fortified cross, timber warm diag, cave stipple).
          tracePocheBand(ctx, realPlan.rect, realPlan.rooms, toPxB);
          ctx.fillStyle = poche.fill; ctx.fill('evenodd');
          const hpat = pocheHatch(ctx, poche.hatch, withAlpha(poche.ink, poche.hatchAlpha));
          if (hpat) { tracePocheBand(ctx, realPlan.rect, realPlan.rooms, toPxB); ctx.fillStyle = hpat; ctx.fill('evenodd'); }
          ctx.globalAlpha = alpha;
        } else if (cut > 0) {
          // Barely-open: a plain warm floor block (the poché resolves as the
          // cutaway completes) — keeps the cross-fade smooth, never a hard pop.
          ctx.globalAlpha = alpha * cut;
          ctx.fillStyle = FLOOR_WARM; ctx.strokeStyle = INK; ctx.lineWidth = wall;
          ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.fill(); ctx.stroke();
          ctx.globalAlpha = alpha;
        }
        if (cut < 1) {
          ctx.globalAlpha = alpha * (1 - cut);
          ctx.fillStyle = ROOF[material] || ROOF.timber; ctx.strokeStyle = INK; ctx.lineWidth = wall;
          ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.fill(); ctx.stroke();
          // A subtle roof ridge-line, INSET from the true rect edge (never on or
          // outside it) — keeps the roofed read without any art exceeding the
          // footprint truth.
          const insetPx = INK_PARAMS.roofLineInsetWu * z;
          if (rw > insetPx * 3 && rh > insetPx * 3) {
            ctx.strokeStyle = INK; ctx.lineWidth = INK_PARAMS.roofLineWeight;
            ctx.beginPath();
            ctx.moveTo(rx + insetPx, ry + rh / 2);
            ctx.lineTo(rx + rw - insetPx, ry + rh / 2);
            ctx.stroke();
          }
        }
      }
      // WS-3 (#4, "keep the interior niceties") — a per-room wash OVER the poché
      // floor: the room you're CURRENTLY standing in gets the highlighter wash, and
      // any room in this SAME open building you haven't yet visited (interior.visited)
      // dims. Drawn after the mass so the highlight reads inside the walls.
      if (realPlan && cut > 0.2 && b.structureKey === interiorKey) {
        const curRoomId = String(world?.scene?.interior?.roomId || '');
        const visitedRooms = new Set((Array.isArray(world?.scene?.interior?.visited) ? world.scene.interior.visited : []).map(String));
        for (const room of realPlan.rooms) {
          const segs = room.walls;
          if (!segs || !segs.length) continue;
          const isCurrent = String(room.id) === curRoomId;
          const isVisited = visitedRooms.size === 0 || visitedRooms.has(String(room.id));
          if (!isCurrent && isVisited) continue; // ordinary visited room: no wash, just the poché floor
          ctx.globalAlpha = alpha * cut * (isCurrent ? 1 : INK_PARAMS.unvisitedRoomDim);
          ctx.fillStyle = isCurrent ? INK_PARAMS.currentRoomWash : FLOOR_WARM;
          ctx.beginPath();
          const [mx, my] = toPx(segs[0].a.wx, segs[0].a.wy, W, H);
          ctx.moveTo(mx, my);
          for (const seg of segs) { const [px, py] = toPx(seg.b.wx, seg.b.wy, W, H); ctx.lineTo(px, py); }
          ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = alpha;
      }
      // FP-2 #1 — the bold hand-drawn ink on the wall/floor boundary (every room
      // box outline), so the mass reads hand-drawn, not vector-CAD. On TOP of the
      // poché fill, in the material's ink.
      if (realPlan && cut > 0.2) {
        const poche = INK_PARAMS.pocheByShell[realPlan.shell] || INK_PARAMS.pocheByShell.stone;
        ctx.globalAlpha = alpha * cut;
        ctx.strokeStyle = poche.ink;
        ctx.lineWidth = (INK_PARAMS.wallInkWeight[realPlan.shell] || INK_PARAMS.wallInkWeight.stone) * Math.max(0.5, Math.min(1.2, z * 0.6));
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // shell outline (the building's outer wall) + every room box.
        const [sx0, sy0] = toPx(realPlan.rect.minX, realPlan.rect.minY, W, H);
        const [sx1, sy1] = toPx(realPlan.rect.maxX, realPlan.rect.maxY, W, H);
        ctx.beginPath(); ctx.rect(Math.min(sx0, sx1), Math.min(sy0, sy1), Math.abs(sx1 - sx0), Math.abs(sy1 - sy0)); ctx.stroke();
        for (const room of realPlan.rooms) {
          const segs = room.walls; if (!segs || !segs.length) continue;
          ctx.beginPath();
          const [mx, my] = toPx(segs[0].a.wx, segs[0].a.wy, W, H); ctx.moveTo(mx, my);
          for (const seg of segs) { const [px, py] = toPx(seg.b.wx, seg.b.wy, W, H); ctx.lineTo(px, py); }
          ctx.closePath(); ctx.stroke();
        }
        // FP-2 #2 — doorways pierce the mass + swing (paper gap + swing arc over
        // the poché, so a doorway opens one room into the next). The gap is the
        // shared-wall band width (floorPlan WALL=0.12 lu); the leaf swings its own
        // width so the arc stays inside a room, not sweeping across it.
        const gapPx = Math.max(3, INK_PARAMS.doorGapLu * PLACE_WU * z);
        const wallBandPx = Math.max(3, 0.12 * PLACE_WU * z); // floorPlan.js WALL — the mass a door pierces
        for (const d of (realPlan.doors || [])) {
          const [dpx, dpy] = toPx(d.wx, d.wy, W, H);
          drawDoorOnPoche(ctx, dpx, dpy, d.dir || 'north', gapPx, wallBandPx);
        }
        // FP-2 #3 — windows: CANON, on exterior walls only, dark rooms none. Glazed
        // casement when open, shutter marks when closed (roomWindows()-derived).
        const winLenPx = Math.max(4, INK_PARAMS.windowLenLu * PLACE_WU * z);
        for (const list of Object.values(realPlan.windows || {})) {
          for (const win of list) {
            const [wpx, wpy] = toPx(win.wx, win.wy, W, H);
            drawWindowGlyph(ctx, wpx, wpy, win.orient, win.shuttered, winLenPx);
          }
        }
        ctx.globalAlpha = alpha;
      }
      ctx.globalAlpha = alpha;

      // structureless decorative buildings (no realPlan, no ground truth to clip
      // to) — keep drawing the catalog art unchanged, the one case with nothing
      // to fit against; still track its own bx0/by0/bx1 for the name label.
      if (!realPlan) {
        for (const r of (b.plan?.rooms || [])) {
          const isRound = r.shape === 'round';
          if (cut > 0) {
            ctx.globalAlpha = alpha * cut;
            ctx.fillStyle = FLOOR_WARM; ctx.strokeStyle = INK; ctx.lineWidth = wall;
            if (isRound) { const [cx2, cy2] = P(b.ox + r.cx, b.oy + r.cy); const rr = (r.r || 1) * PLACE_WU * z; ctx.beginPath(); ctx.arc(cx2, cy2, rr, 0, 7); ctx.fill(); ctx.stroke(); }
            else { const [x, y, w, h] = rectPx(b.ox + r.cx - (r.w || 2) / 2, b.oy + r.cy - (r.h || 2) / 2, (r.w || 2), (r.h || 2)); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke(); }
          }
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
      }

      // furniture marks, once the roof is mostly off (the lid-lifted reveal).
      // Projected through PT (the catalog->true-rect fit) so furniture stays
      // INSIDE the true walls realPlan.rooms[].walls just inked above.
      if (cut > 0.15) {
        for (const f of (b.plan?.furniture || [])) {
          const t = String(f.type || '');
          if (SKIP_FURN.has(t)) continue;
          const [fx, fy, fw, fh] = rectPxT(b.ox + f.ux, b.oy + f.uy, (f.uw || 0.6), (f.uh || 0.6));
          if (fw < 1.2 && fh < 1.2) continue;
          ctx.globalAlpha = alpha * cut;
          const stone = STONE_FURN.has(t), bars = t === 'bars';
          ctx.fillStyle = bars ? 'rgba(34,40,54,0.12)' : stone ? STONEF : WOODF;
          ctx.strokeStyle = bars ? METAL : stone ? STONEI : WOODI;
          ctx.lineWidth = Math.max(0.6, wall * 0.6);
          ctx.beginPath(); ctx.rect(fx, fy, fw, fh); ctx.fill(); ctx.stroke();
          if (t === 'bed') { ctx.fillStyle = CLOTH; ctx.fillRect(fx + fw * 0.18, fy + fh * 0.28, fw * 0.64, fh * 0.6); }
        }
        // room names at the plan band ONLY — you're reading the floor plan now,
        // roof lifted (FP-2 #6: never at street/settlement zoom where they collide).
        // Read from realPlan.rooms (TRUE world-unit centers) when available so a
        // name lands on the room the true walls actually drew, not the catalog's
        // old (oversized) center; falls back to the catalog projection only for
        // the structureless decorative case.
        if (z >= INK_PARAMS.labelPlanBandZ && cut > 0.5) {
          ctx.globalAlpha = alpha * cut;
          ctx.fillStyle = 'rgba(18,26,48,0.66)'; ctx.font = `${Math.round(Math.min(14, 1.1 * PLACE_WU * z))}px ${HAND}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          if (realPlan) {
            for (const r of realPlan.rooms) { if (!r.name) continue; const [rx, ry] = toPx(r.wx, r.wy, W, H); ctx.fillText(String(r.name), rx, ry); }
          } else {
            for (const r of (b.plan?.rooms || [])) { if (!r.name) continue; const [rx, ry] = P(b.ox + r.cx, b.oy + r.cy); ctx.fillText(String(r.name), rx, ry); }
          }
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

    // people: standing tokens (a base ring at the feet + a body disc) at street
    // approach (the village is inhabited, visibly). TT-DRAW: upgraded from a
    // plain ring to a base-ring + body so a person reads as a piece set down on
    // the grid, not a dot painted on the ground.
    const npcAlpha = fadeIn(z, 1.4, 2.4);
    if (npcAlpha > 0) {
      for (const t of (place.tokens || [])) {
        if (t?.type !== 'npc') continue;
        const [nx, ny] = P(t.ux, t.uy);
        const nr = Math.max(2, Math.min(6, 0.5 * PLACE_WU * z));
        ctx.globalAlpha = alpha * npcAlpha;
        // base ring — a soft ellipse at the feet, the tabletop-mini "standing on
        // a base" cue (docs/TABLETOP_MAP.md miniature art direction).
        ctx.strokeStyle = 'rgba(18,26,48,0.28)'; ctx.lineWidth = Math.max(0.6, nr * 0.18);
        ctx.beginPath(); ctx.ellipse(nx, ny + nr * 0.72, nr * 0.95, nr * 0.38, 0, 0, 7); ctx.stroke();
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

    // TT-DRAW fog restore: a settlement the player has only SIGHTED (discovered
    // from a distance) but never actually stood in reads as a faint haze over the
    // ink, distinguishing it from a settlement the player has genuinely visited —
    // the visited-vs-sighted signal drawModel.fogMask derives from
    // world.map.memory.visitedTurnByNodeId (the live U42 visit stamp; every
    // `known` node reaching drawLayout is already witnessed at the region tier,
    // but only a VISITED one has had its ground truly walked). Unexplored ground
    // stays blank paper elsewhere (draw() only calls drawLayout for known nodes
    // at all); here the haze is the "glimpsed, not walked" middle tier.
    if (!fogMask(world).isExplored(node.id)) {
      ctx.globalAlpha = alpha * INK_PARAMS.hazeAlpha * fadeIn(z, BAND.settlement * 0.6, BAND.settlement * 2);
      ctx.fillStyle = 'rgba(150,158,140,1)';
      ctx.beginPath(); ctx.arc(...P(frame.cx, frame.cy), Math.max(20, 130 * z), 0, 7); ctx.fill();
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

    // TT-DRAW-3 — the graph paper at the closest view: the REAL 5-ft tactical
    // quadrille, faint, UNDER every other ink (biome/roads/buildings/tokens
    // all paint over it below). Invisible until the deep zoom band, then
    // fades in (quadrilleAlpha, drawModel.js).
    drawQuadrille(ctx, toPx, W, H, z, cam.cx, cam.cy);

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

    // ── ROADS-1 — the ONE road network (roadNetwork.js), drawn from the SAME
    // world-unit polylines at every band. Far out it's a dashed sepia
    // cartographer's track; as the camera dives it thickens into a solid ribbon —
    // only the STYLE (dash/weight/alpha) varies with zoom, never the geometry, so
    // the lane through a village and the road to the next town are one continuous
    // line that reaches the horizon. (This retires the old node-center
    // roadMeanderPts live draw; the two disconnected road systems are now one.) ──
    const roadAlpha = fadeIn(z, BAND.region * 0.75, BAND.region * 1.9);
    if (roadAlpha > 0 && roadNet && roadNet.segments.length) {
      // ribbon lerp: 0 at the region band (dashed thin track), 1 by the street
      // band (solid ribbon). Weight in wu so the ribbon scales like real ground.
      const ribbon = fadeIn(z, BAND.settlement * 0.6, BAND.street);
      const trackW = Math.max(0.8, Math.min(2, z * 9));               // far-out track weight (px)
      const ribbonW = INK_PARAMS.roadBandWu * PLACE_WU * z * 0.6;     // close-up ribbon (px, wu-scaled, matches the lane draw)
      ctx.lineWidth = trackW * (1 - ribbon) + Math.max(trackW, ribbonW) * ribbon;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const dash = Math.max(3, Math.min(10, z * 26));
      if (ribbon < 0.98) ctx.setLineDash([dash, dash * 0.8 * (1 - ribbon) + 0.001]);
      else ctx.setLineDash([]);
      for (const s of roadNet.segments) {
        if (!s.aKnown && !s.bKnown) continue;                        // undiscovered on both ends → blank parchment
        const pts = s.pts;
        // cull if the whole polyline is off-screen (cheap AABB in px)
        let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
        const px = [];
        for (const p of pts) { const q = toPx(p[0], p[1], W, H); px.push(q); if (q[0] < bx0) bx0 = q[0]; if (q[1] < by0) by0 = q[1]; if (q[0] > bx1) bx1 = q[0]; if (q[1] > by1) by1 = q[1]; }
        if (bx1 < 0 || bx0 > W || by1 < 0 || by0 > H) continue;
        const bothKnown = s.aKnown && s.bKnown;
        ctx.strokeStyle = bothKnown ? ROAD : ROAD_GHOST;
        ctx.globalAlpha = roadAlpha * (bothKnown ? 1 : 0.7);
        strokeSmooth(ctx, px);
      }
      ctx.setLineDash([]); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
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
    // WS-2: the marker derives from the SAME resolveEntityWuFromWorld rail the
    // camera centers on (playerFocusWu, computed once above for cameraFor) —
    // engine-truthful, room-granular indoors, walk-position outdoors. This
    // retires the legacy opts.playerPos/ui.place-only placement (VG-F3: the
    // marker used to lag a room behind, or read stale on the fullscreen Map
    // screen where no playerPos was ever passed at all). Falls back to
    // node-center only if the resolution genuinely fails.
    // (In a dungeon the cutaway above draws its own marker.)
    const here = nodes.find(n => String(n.id) === hereId);
    if (here && !inDungeon) {
      let p = playerFocus ? { x: playerFocus.wx, y: playerFocus.wy } : nodeToWu(here);
      // #4: if you just climbed out a NAMED window, stand on that side of the building (the map must
      // reflect the side you left by). This wins over the resolved position for that one beat.
      const exitFacing = lastWindowExitFacing(world);
      if (exitFacing) {
        const [dx, dy] = facingNudge(exitFacing);
        p = { x: p.x + dx, y: p.y + dy };
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
    // Manual pan-to-look (read-only aid, per POSITION_AS_CANON §6): the player
    // is deliberately looking away from their own position. The next real
    // player move (a changed focus signature, checked in cameraFor on the next
    // mount) snaps focus back — this flag just holds the view still until then.
    cam.lookingAway = true;
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
  // Read-only camera snapshot — pairs with __oneMapFocus for lab pages/tests
  // that need to nudge the CURRENT view (e.g. TT-DRAW's screenshot lab) rather
  // than jump to an absolute point. Never used by production draw logic.
  wrap.__oneMapCamera = () => ({ cx: cam.cx, cy: cam.cy, z: cam.z });
  return wrap;
}
