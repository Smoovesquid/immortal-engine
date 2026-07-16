import { hash32 } from './hash.js';
import { floorPlan } from '../../engine/structures/floorPlan.js';
import { buildingTypeFor } from '../../engine/structures/roomDetail.js';
import { createInteriorMap, floorPlanToSceneModel, planToSceneModel } from './handDrawnInterior.js';
import { createPlaceMap } from './handDrawnPlace.js';
import { placeModelFromNode, placeFromWorldNode } from './placeFromNode.js';
import { interiorPeopleTokens } from './interiorTokens.js';
import { ALL_PLANS } from './plans/planTopology.js';
import { seedFromString as seedStr } from '../../engine/rng.js';
// OBJ-MOVE-1 — the render join: draw the ENGINE's authored furniture (with real
// pieceIds) for Builder-authored buildings, and reposition a moved piece from its
// live placement override. Tactical cell → layout display coord at THIS boundary only.
import { authoredObjectId } from '../../engine/objects/identity.js';
import { resolvedObjectPlacement } from '../../engine/objects/placement.js';
import { PLACE_WU } from '../../engine/map/spatial/tacticalPos.js';
// INK-WRECK-1 — the ONE live destroyed-state authority, the same Set cover
// (coverFeatures.js) and walk-blocking (tacticalPos.js liveAuthoredBlockedCells)
// already read. The ink joins it here so the map cannot outlive the world.
import { destroyedAuthoredPieceIds, procgenPlanPieceStatus } from '../../engine/structures/authoredFurniture.js';
import { destroyedObjectPositionsAtNode } from '../../engine/objects/query.js';
// CORPSE-TRUTH-1b — the one canonical "what bodies lie here" read (deathFact.js).
import { remainsAtNode } from '../../engine/combat/deathFact.js';

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

// ── Theme colors ────────────────────────────────────────────────────────
const THEME = {
  bg: '#0d0d0d',
  gridLine: 'rgba(200,168,78,0.06)',
  gridFill: 'rgba(28,24,16,0.9)',
  hexEdge: 'rgba(200,168,78,0.25)',
  hexEdgeGlow: 'rgba(200,168,78,0.08)',
  obstacle: 'rgba(200,168,78,0.15)',
  structureFill: 'rgba(200,168,78,0.25)',
  structureStroke: 'rgba(200,168,78,0.6)',
  playerFill: '#c8a84e',
  playerGlow: 'rgba(200,168,78,0.4)',
  roomFloor: '#1c1810',
  roomWall: 'rgba(200,168,78,0.35)',
  doorStroke: '#c8a84e',
  roomLabel: '#b8a878',
  npcName: '#d4c5a9',
  coverStroke: 'rgba(200,168,78,0.9)',
};

// ── Graph-paper palette ───────────────────────────────────────────────────
// The interior map is a hand-drawn dungeon sketch on a cheap quadrille pad:
// greenish-cream paper, faint grid rule, dark-blue ballpoint ink for walls,
// graphite pencil for furniture, and a couple of colored-pencil accents. The
// look is deliberately imperfect — every wobble is the feature, not a bug.
const PAPER = {
  paper:      '#e7ecdd',                  // cheap greenish-cream pad stock
  gridMinor:  'rgba(92,134,120,0.22)',    // 1-square rule
  gridMajor:  'rgba(92,134,120,0.40)',    // every 5th line, darker
  ink:        'rgba(34,44,72,0.92)',      // dark-blue ballpoint walls
  inkSoft:    'rgba(34,44,72,0.42)',      // unexplored hints / door stubs
  pencil:     'rgba(74,78,92,0.80)',      // graphite furniture
  pencilSoft: 'rgba(74,78,92,0.42)',
  shade:      'rgba(74,78,92,0.16)',      // pencil shading for dark rooms
  highlight:  'rgba(248,226,120,0.34)',   // highlighter wash on current room
  token:      '#f6f4ea',                  // paper-white token fill
  player:     '#c0392b',                  // red felt-tip "you are here"
  npc:        '#2a6f8e',                  // blue pen for people
  light:      '#e8902a',                  // orange pencil light marks
  loot:       '#2e8b6f',                  // green pencil loot marks
  cover:      'rgba(74,78,92,0.72)',      // pencil cover ring
  label:      'rgba(34,44,72,0.92)',
};

// Casual marker/handwriting stack so labels read as hand-lettered, not typeset.
const HAND_FONT = '"Bradley Hand","Comic Sans MS","Chalkboard SE","Marker Felt",ui-rounded,cursive';

// Wall line character per outer shell — a stone chapel inks crisp and straight,
// a cave or hive wobbles organically. Keeps "a church ≠ a cave" on paper too.
function shellInk(shell) {
  if (shell === 'cave' || shell === 'chitin' || shell === 'round') return { amp: 2.6, lw: 2.2, passes: 2 };
  if (shell === 'open') return { amp: 1.0, lw: 1.6, passes: 1 };
  if (shell === 'fortified') return { amp: 0.7, lw: 2.8, passes: 2 };
  return { amp: 1.2, lw: 2.0, passes: 2 }; // stone / timber
}

// Deterministic signed jitter in [-amp, amp] from a stable string key. The map
// re-renders every turn, so jitter MUST be keyed (never Math.random) or the
// walls would shimmer between frames.
function jit(key, amp) {
  return (((seedStr('jit|' + key) % 2000) / 1000) - 1) * amp;
}

// ── Geometry helpers ────────────────────────────────────────────────────
function inHexMask(dx, dy, R) {
  const r = dy;
  const q = dx - Math.floor(dy / 2);
  const s = -q - r;
  const dist = (Math.abs(q) + Math.abs(r) + Math.abs(s)) / 2;
  return dist <= R;
}

function structuresAtCurrentNode(world) {
  const nodeId = String(world?.map?.currentNodeId || '');
  const byId = world?.structures?.byId && typeof world.structures.byId === 'object' ? world.structures.byId : {};
  return Object.values(byId)
    .filter(s => String(s?.nodeId || '') === nodeId)
    .sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || '')));
}

function roomLayoutFromTopology(topology) {
  const rooms = Array.isArray(topology?.rooms) ? topology.rooms : [];
  const out = [];
  const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, rooms.length))));
  for (let i = 0; i < rooms.length; i++) {
    out.push({ id: String(rooms[i]?.id || ''), col: i % cols, row: Math.floor(i / cols) });
  }
  return out;
}

function parseFeetIntent(text) {
  const t = String(text || '').toLowerCase();
  const m = t.match(/\b(?:move|step|go)\s+(\d+)\s*ft\s+(north|south|east|west|n|s|e|w)\b/);
  if (!m) return { dxFt: 0, dyFt: 0 };
  const ft = Math.max(0, Number(m[1] || 0));
  const d = String(m[2] || '');
  if (d === 'north' || d === 'n') return { dxFt: 0, dyFt: -ft };
  if (d === 'south' || d === 's') return { dxFt: 0, dyFt: ft };
  if (d === 'east' || d === 'e') return { dxFt: ft, dyFt: 0 };
  if (d === 'west' || d === 'w') return { dxFt: -ft, dyFt: 0 };
  return { dxFt: 0, dyFt: 0 };
}

function projectedFeetFromTimeline(world) {
  const tl = Array.isArray(world?.timeline) ? world.timeline : [];
  let x = 0;
  let y = 0;
  for (const ev of tl) {
    if (!ev || typeof ev !== 'object') continue;
    const data = ev.data && typeof ev.data === 'object' ? ev.data : {};
    const text = String(data.intent || data.text || data.intentText || '');
    const d = parseFeetIntent(text);
    x += d.dxFt;
    y += d.dyFt;
  }
  const clamp = (v) => Math.max(-150, Math.min(150, v));
  return { xFt: clamp(x), yFt: clamp(y) };
}

function playerFeet(world) {
  const pos = world?.party?.[0]?.position && typeof world.party[0].position === 'object' ? world.party[0].position : {};
  if (typeof pos.localFtX === 'number' || typeof pos.localFtY === 'number') {
    return { xFt: Number(pos.localFtX || 0), yFt: Number(pos.localFtY || 0) };
  }
  return projectedFeetFromTimeline(world);
}

// ── Exterior drawing (hex-masked tactical grid) ─────────────────────────
function drawExterior(ctx, world, w, size, cell) {
  const seed = String(world?.meta?.seed ?? 'seed');
  const nodeId = String(world?.map?.currentNodeId ?? '');
  const key = seed + '::' + nodeId;
  const radius = 30;
  const mid = Math.floor(size / 2);

  // Dark background
  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, w, w);

  // Draw hex-masked terrain cells
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - mid;
      const dy = y - mid;
      if (!inHexMask(dx, dy, radius)) continue;

      // Subtle cell fill
      ctx.fillStyle = THEME.gridFill;
      ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);

      // Sparse obstacles / features
      const h = hash32(key + ':' + x + ',' + y);
      if ((h % 97) <= 1) {
        ctx.fillStyle = THEME.obstacle;
        ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
      }
    }
  }

  // Subtle grid lines
  ctx.strokeStyle = THEME.gridLine;
  ctx.lineWidth = 0.5;
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

  // Hex boundary edge glow
  ctx.lineWidth = 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - mid;
      const dy = y - mid;
      if (!inHexMask(dx, dy, radius)) continue;
      const edge =
        !inHexMask(dx + 1, dy, radius) ||
        !inHexMask(dx - 1, dy, radius) ||
        !inHexMask(dx, dy + 1, radius) ||
        !inHexMask(dx, dy - 1, radius);
      if (edge) {
        // Outer glow
        ctx.strokeStyle = THEME.hexEdgeGlow;
        ctx.lineWidth = 4;
        ctx.strokeRect(x * cell, y * cell, cell, cell);
        // Sharp edge
        ctx.strokeStyle = THEME.hexEdge;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x * cell, y * cell, cell, cell);
      }
    }
  }

  // Structures
  const structures = structuresAtCurrentNode(world);
  if (structures.length) {
    for (let i = 0; i < structures.length; i++) {
      const st = structures[i] || {};
      const baseCol = mid - 8 + (i % 2) * 8;
      const baseRow = mid - 8 + Math.floor(i / 2) * 8;
      const layout = roomLayoutFromTopology(st.topology);
      for (const r of layout) {
        const x = (baseCol + r.col * 2) * cell;
        const y = (baseRow + r.row * 2) * cell;
        ctx.fillStyle = THEME.structureFill;
        ctx.fillRect(x + 1, y + 1, cell * 2 - 2, cell * 2 - 2);
        ctx.strokeStyle = THEME.structureStroke;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 1, y + 1, cell * 2 - 2, cell * 2 - 2);
      }
    }
  }

  // Player marker with glow
  const { xFt, yFt } = playerFeet(world);
  const ox = (xFt / 5) * cell;
  const oy = (yFt / 5) * cell;
  const px = mid * cell + cell / 2 + ox;
  const py = mid * cell + cell / 2 + oy;

  // Glow
  ctx.beginPath();
  ctx.arc(px, py, cell * 0.7, 0, Math.PI * 2);
  ctx.fillStyle = THEME.playerGlow;
  ctx.fill();

  // Marker
  ctx.beginPath();
  ctx.arc(px, py, cell * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = THEME.playerFill;
  ctx.fill();
}


// ── Hand-drawn primitives ─────────────────────────────────────────────────
function circlePts(cx, cy, r, n) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); }
  return out;
}
function rectPts(cx, cy, w, h) {
  const hw = w / 2, hh = h / 2;
  return [{ x: cx - hw, y: cy - hh }, { x: cx + hw, y: cy - hh }, { x: cx + hw, y: cy + hh }, { x: cx - hw, y: cy + hh }];
}

// Sample a room's outline as polygon corner points for the given architectural
// shape (same shapes roomPath draws). Curved shapes return pre-densified loops.
function roomCorners(shape, cx, cy, rw, rh, seed) {
  const hw = rw / 2, hh = rh / 2;
  const P = (x, y) => ({ x, y });
  if (shape === 'round' || shape === 'oval') {
    const ex = shape === 'round' ? Math.min(hw, hh) : hw;
    const ey = shape === 'round' ? Math.min(hw, hh) : hh;
    return circlePtsEll(cx, cy, ex, ey, 26);
  }
  if (shape === 'blob') {
    const N = 14, out = [];
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; const j = 0.74 + (seedStr('blob|' + seed + '|' + i) % 100) / 100 * 0.34; out.push(P(cx + Math.cos(a) * hw * j, cy + Math.sin(a) * hh * j)); }
    return out;
  }
  if (shape === 'octagon') {
    const c = Math.min(hw, hh) * 0.42;
    return [P(cx - hw + c, cy - hh), P(cx + hw - c, cy - hh), P(cx + hw, cy - hh + c), P(cx + hw, cy + hh - c), P(cx + hw - c, cy + hh), P(cx - hw + c, cy + hh), P(cx - hw, cy + hh - c), P(cx - hw, cy - hh + c)];
  }
  if (shape === 'cross') {
    const ax = hw * 0.42, ay = hh * 0.42;
    return [P(cx - ax, cy - hh), P(cx + ax, cy - hh), P(cx + ax, cy - ay), P(cx + hw, cy - ay), P(cx + hw, cy + ay), P(cx + ax, cy + ay), P(cx + ax, cy + hh), P(cx - ax, cy + hh), P(cx - ax, cy + ay), P(cx - hw, cy + ay), P(cx - hw, cy - ay), P(cx - ax, cy - ay)];
  }
  if (shape === 'ell') {
    const nx = cx + hw * 0.10, ny = cy - hh * 0.10;
    return [P(cx - hw, cy - hh), P(nx, cy - hh), P(nx, ny), P(cx + hw, ny), P(cx + hw, cy + hh), P(cx - hw, cy + hh)];
  }
  if (shape === 'apse') {
    const r = hw, springY = cy - hh + r, out = [P(cx - hw, cy + hh), P(cx - hw, springY)];
    const N = 12;
    for (let i = 0; i <= N; i++) { const t = (i / N) * Math.PI; out.push(P(cx - Math.cos(t) * r, springY - Math.sin(t) * r)); }
    out.push(P(cx + hw, cy + hh));
    return out;
  }
  return [P(cx - hw, cy - hh), P(cx + hw, cy - hh), P(cx + hw, cy + hh), P(cx - hw, cy + hh)];
}
function circlePtsEll(cx, cy, ex, ey, n) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push({ x: cx + Math.cos(a) * ex, y: cy + Math.sin(a) * ey }); }
  return out;
}

// Subdivide a polygon's edges so wobble shows ALONG each wall, not just at the
// corners. Returns a denser point loop.
function densify(pts, segLen) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const dx = b.x - a.x, dy = b.y - a.y;
    const steps = Math.max(1, Math.round(Math.hypot(dx, dy) / segLen));
    for (let s = 0; s < steps; s++) out.push({ x: a.x + dx * (s / steps), y: a.y + dy * (s / steps) });
  }
  return out;
}

// Ink a closed wobbly outline with a hand-drawn overdraw (a couple of passes,
// each jittered off a stable key) so the wall looks penned by hand.
function inkOutline(ctx, pts, key, amp, lw, passes) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (let p = 0; p < passes; p++) {
    ctx.lineWidth = lw * (p === 0 ? 1 : 0.7);
    ctx.beginPath();
    for (let i = 0; i <= pts.length; i++) {
      const a = pts[i % pts.length];
      const x = a.x + jit(key + '|' + p + '|' + i + '|x', amp);
      const y = a.y + jit(key + '|' + p + '|' + i + '|y', amp);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// A short wobbly open segment (corridors, door stubs).
function inkSegment(ctx, x1, y1, x2, y2, key, amp) {
  ctx.lineCap = 'round';
  ctx.beginPath();
  const N = 4;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = x1 + (x2 - x1) * t + jit(key + '|s|' + i + '|x', amp);
    const y = y1 + (y2 - y1) * t + jit(key + '|s|' + i + '|y', amp);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// ── Graph-paper plumbing ──────────────────────────────────────────────────
// The quadrille rule, drawn edge-to-edge so the whole canvas reads as one pad.
function drawGrid(ctx, w, step) {
  ctx.lineWidth = 1;
  for (let i = 0, x = 0; x <= w; i++, x += step) {
    ctx.strokeStyle = (i % 5 === 0) ? PAPER.gridMajor : PAPER.gridMinor;
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, w); ctx.stroke();
  }
  for (let i = 0, y = 0; y <= w; i++, y += step) {
    ctx.strokeStyle = (i % 5 === 0) ? PAPER.gridMajor : PAPER.gridMinor;
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
  }
}

// The iconic geomorph hatch: a tiny repeating diagonal-stroke tile. This is the
// SOLID ROCK the rooms are carved out of — the single most "hand-drawn dungeon"
// cue there is. Cached: a pattern object is stable, so the rock never shimmers.
let _hatch = null;
function hatchPattern(ctx) {
  if (_hatch) return _hatch;
  const t = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
  if (!t) return PAPER.shade;
  t.width = t.height = 6;
  const c = t.getContext('2d');
  c.strokeStyle = 'rgba(40,48,72,0.50)';
  c.lineWidth = 0.9;
  c.beginPath(); c.moveTo(-1, 7); c.lineTo(7, -1); c.stroke();           // main 45° stroke
  c.beginPath(); c.moveTo(-1, 1); c.lineTo(1, -1); c.stroke();           // wrap corner
  c.beginPath(); c.moveTo(5, 7); c.lineTo(7, 5); c.stroke();             // wrap corner
  _hatch = ctx.createPattern(t, 'repeat');
  return _hatch;
}

// Add a polygon / rect as a SUBPATH (no beginPath) so several can union.
function addPoly(ctx, pts) {
  for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
  ctx.closePath();
}
function addRect(ctx, x, y, w, h) {
  ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath();
}
// Axis-aligned segment → corridor rect of width cw.
function rectFromSeg(x0, y0, x1, y1, cw) {
  if (Math.abs(y1 - y0) < 0.5) return { x: Math.min(x0, x1), y: y0 - cw / 2, w: Math.abs(x1 - x0), h: cw };
  return { x: x0 - cw / 2, y: Math.min(y0, y1), w: cw, h: Math.abs(y1 - y0) };
}
function rectHitsAny(rc, boxes) {
  for (const b of boxes) {
    const bx0 = b.cx - b.rw / 2, bx1 = b.cx + b.rw / 2, by0 = b.cy - b.rh / 2, by1 = b.cy + b.rh / 2;
    if (rc.x < bx1 && rc.x + rc.w > bx0 && rc.y < by1 && rc.y + rc.h > by0) return true;
  }
  return false;
}

// A small hand-inked compass rose — the universal "this is a map" signature.
function drawCompass(ctx, x, y, r) {
  ctx.save();
  ctx.strokeStyle = PAPER.ink; ctx.fillStyle = PAPER.ink; ctx.lineWidth = 1.3;
  ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.2, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.2, y); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x, y + r * 0.2); ctx.lineTo(x + r, y); ctx.lineTo(x, y - r * 0.2); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.2, y); ctx.lineTo(x - r * 0.2, y); ctx.closePath(); ctx.fill(); // filled north tip
  ctx.font = Math.max(9, Math.round(r * 0.62)) + 'px ' + HAND_FONT;
  ctx.textAlign = 'center';
  ctx.fillText('N', x, y - r - 3);
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.save(); ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; const rr = i % 2 ? r * 0.45 : r; const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

// Pencil furniture: simple graphite glyphs (the DM's quick sketches), with a
// little colored-pencil accent for light, loot, and cover.
function pencilFurniture(ctx, f, cx, cy, rw, rh) {
  const u = Math.min(rw, rh);
  const px = cx + (f.fx - 0.5) * rw, py = cy + (f.fy - 0.5) * rh;
  const key = 'f|' + f.fx + '|' + f.fy;

  if (f.flat) { // rug / runner — a dashed pencil rectangle on the floor
    const wd = (f.w || 0.4) * rw, ht = (f.h || 0.3) * rh;
    ctx.save();
    ctx.strokeStyle = PAPER.pencilSoft;
    ctx.lineWidth = Math.max(0.8, u * 0.02);
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(px - wd / 2, py - ht / 2, wd, ht);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.strokeStyle = PAPER.pencil;
  const lw = Math.max(0.9, u * 0.022);
  if (f.shape === 'circle') {
    const r = Math.max(2, f.r * u);
    inkOutline(ctx, circlePts(px, py, r, 14), key, 0.6, lw, 1);
  } else if (f.shape === 'bed') {
    const wd = f.w * u, ht = f.h * u;
    inkOutline(ctx, rectPts(px, py, wd, ht), key, 0.6, lw, 1);
    ctx.lineWidth = lw; ctx.beginPath();
    ctx.moveTo(px - wd / 2, py - ht / 2 + ht * 0.3); ctx.lineTo(px + wd / 2, py - ht / 2 + ht * 0.3); ctx.stroke(); // pillow
  } else {
    const wd = (f.w || 0.16) * u, ht = (f.h || 0.16) * u;
    inkOutline(ctx, rectPts(px, py, wd, ht), key, 0.6, lw, 1);
  }
  ctx.restore();

  // Colored-pencil accents.
  if (f.light) {
    ctx.save();
    ctx.strokeStyle = PAPER.light; ctx.fillStyle = PAPER.light; ctx.lineWidth = Math.max(1, u * 0.02);
    const r = Math.max(2, u * 0.05);
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * r * 1.5, py + Math.sin(a) * r * 1.5); ctx.lineTo(px + Math.cos(a) * r * 2.3, py + Math.sin(a) * r * 2.3); ctx.stroke(); }
    ctx.restore();
  }
  if (f.cover) {
    ctx.save();
    ctx.strokeStyle = PAPER.cover; ctx.lineWidth = Math.max(1, u * 0.018);
    ctx.setLineDash(f.cover === 'three-quarter' ? [] : [3, 3]);
    ctx.beginPath(); ctx.arc(px, py, Math.max(3, u * 0.14), 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  if (f.loot) drawStar(ctx, px, py, Math.max(2.5, u * 0.06), PAPER.loot);
}

// ── Interior drawing (hand-drawn graph-paper dungeon map) ────────────────
// An interior is a CONTINUOUS SPACE, not a bubble diagram: rooms and corridors
// are one void CARVED OUT OF SOLID ROCK, and the rock is hand-hatched all around
// it. The grid shows through the floor; the wall is just the edge where hatch
// meets floor. The map fills in room-by-room as you explore (interior.visited).
// Every wobble is seeded off stable ids so the rock never shimmers between turns.
function drawInterior(ctx, world, w) {
  const step = Math.max(13, Math.round(w / 30));

  // ── 0) The pad: greenish-cream stock, grid, faint edge vignette. ─────────
  ctx.fillStyle = PAPER.paper;
  ctx.fillRect(0, 0, w, w);
  drawGrid(ctx, w, step);

  const interior = world?.scene?.interior && typeof world.scene.interior === 'object' ? world.scene.interior : null;
  const roomId = String(interior?.roomId || '');
  const structureKey = String(interior?.structureKey || '');
  const st = world?.structures?.byId?.[structureKey];

  const noPlan = () => {
    ctx.fillStyle = PAPER.label;
    ctx.font = '16px ' + HAND_FONT;
    ctx.fillText('Interior', 14, 26);
  };
  if (!st) { noPlan(); return; }

  const fp = floorPlan(st);
  if (!fp.rooms.length) { noPlan(); return; }

  const visited = Array.isArray(interior.visited) && interior.visited.length ? interior.visited : [roomId];
  const discovered = new Set(visited.map(String));

  const ink = shellInk(fp.shell);
  const margin = Math.max(10, w * 0.09);
  const scale = Math.min((w - 2 * margin) / fp.footprint.w, (w - 2 * margin) / fp.footprint.h);
  const offX = (w - fp.footprint.w * scale) / 2;
  const offY = (w - fp.footprint.h * scale) / 2;
  const PX = (u) => offX + u * scale;
  const PY = (u) => offY + u * scale;
  const unit = scale;
  const big = unit >= 30; // furniture legible at this zoom?

  const roomRect = (r) => ({ cx: PX(r.cx), cy: PY(r.cy), rw: r.w * scale * 0.92, rh: r.h * scale * 0.92 });

  // Only rooms we've actually entered get carved.
  const drooms = fp.rooms.filter(r => discovered.has(r.id));
  const pbox = new Map(drooms.map(r => [r.id, Object.assign(roomRect(r), { gx: r.gx, gy: r.gy, shape: r.shape, id: r.id })]));

  // ── 1) Thread corridors. Grid-adjacent rooms join with a straight passage;
  //       distant connections take a right-angle dog-leg through the rock IF it
  //       clears every other room, else they fall back to a dashed door-stub. ─
  const cw = Math.max(8, unit * 0.34);
  const corridors = []; // {x,y,w,h} floor rects (also part of the void)
  const stubs = [];     // {x0,y0,x1,y1,key} dashed hints into the unknown
  for (const d of fp.doors) {
    const aIn = discovered.has(String(d.a)), bIn = discovered.has(String(d.b));
    if (aIn !== bIn) { // one side unexplored → trailing stub
      const from = pbox.get(String(aIn ? d.a : d.b));
      if (from) { const dx = PX(d.x), dy = PY(d.y); stubs.push({ x0: from.cx + (dx - from.cx) * 0.45, y0: from.cy + (dy - from.cy) * 0.45, x1: dx, y1: dy, key: 'stub|' + d.a + d.b }); }
      continue;
    }
    if (!aIn) continue; // both unexplored
    const a = pbox.get(String(d.a)), b = pbox.get(String(d.b));
    const adj = Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy) === 1;
    if (adj) {
      if (a.gx !== b.gx) { const L = a.cx < b.cx ? a : b, R = a.cx < b.cx ? b : a; const y = (a.cy + b.cy) / 2; corridors.push(rectFromSeg(L.cx + L.rw / 2 - 1, y, R.cx - R.rw / 2 + 1, y, cw)); }
      else { const T = a.cy < b.cy ? a : b, B = a.cy < b.cy ? b : a; const x = (a.cx + b.cx) / 2; corridors.push(rectFromSeg(x, T.cy + T.rh / 2 - 1, x, B.cy - B.rh / 2 + 1, cw)); }
    } else {
      const obs = drooms.filter(r => r.id !== d.a && r.id !== d.b).map(roomRect);
      const tryL = (horizFirst) => {
        const ex = horizFirst ? b.cx : a.cx, ey = horizFirst ? a.cy : b.cy;
        const r1 = rectFromSeg(a.cx, a.cy, ex, ey, cw), r2 = rectFromSeg(ex, ey, b.cx, b.cy, cw);
        return (rectHitsAny(r1, obs) || rectHitsAny(r2, obs)) ? null : [r1, r2];
      };
      const L = tryL(true) || tryL(false);
      if (L) corridors.push(...L);
      else { const dx = PX(d.x), dy = PY(d.y); stubs.push({ x0: a.cx, y0: a.cy, x1: dx, y1: dy, key: 'sa|' + d.a + d.b }); stubs.push({ x0: b.cx, y0: b.cy, x1: dx, y1: dy, key: 'sb|' + d.a + d.b }); }
    }
  }

  // ── 2) THE ROCK. Hatch a band hugging the carved void: fill each room/corridor
  //       grown by the wall thickness with the geomorph hatch, then re-expose the
  //       floor inside. What's left is hand-scratched stone around the rooms. ──
  const hatch = hatchPattern(ctx);
  const W = Math.max(7, unit * 0.36); // rock wall thickness
  for (const r of drooms) {
    const b = pbox.get(r.id);
    ctx.save(); ctx.beginPath(); addPoly(ctx, roomCorners(r.shape, b.cx, b.cy, b.rw + 2 * W, b.rh + 2 * W, r.id)); ctx.clip();
    ctx.fillStyle = hatch; ctx.fillRect(0, 0, w, w); ctx.restore();
  }
  for (const c of corridors) {
    ctx.save(); ctx.beginPath(); addRect(ctx, c.x - W, c.y - W, c.w + 2 * W, c.h + 2 * W); ctx.clip();
    ctx.fillStyle = hatch; ctx.fillRect(0, 0, w, w); ctx.restore();
  }
  // Re-expose the floor (paper + grid) inside every room and corridor.
  const exposeFloor = (clipFn) => { ctx.save(); ctx.beginPath(); clipFn(); ctx.clip(); ctx.fillStyle = PAPER.paper; ctx.fillRect(0, 0, w, w); drawGrid(ctx, w, step); ctx.restore(); };
  for (const r of drooms) { const b = pbox.get(r.id); exposeFloor(() => addPoly(ctx, roomCorners(r.shape, b.cx, b.cy, b.rw, b.rh, r.id))); }
  for (const c of corridors) exposeFloor(() => addRect(ctx, c.x, c.y, c.w, c.h));

  // ── 3) Room washes + pencil furniture (clipped to the room void). ────────
  for (const r of drooms) {
    const { cx, cy, rw, rh } = pbox.get(r.id);
    const isCurrent = r.id === roomId;
    ctx.save();
    ctx.beginPath(); addPoly(ctx, roomCorners(r.shape, cx, cy, rw, rh, r.id)); ctx.clip();
    if (isCurrent) { ctx.fillStyle = PAPER.highlight; ctx.fillRect(cx - rw, cy - rh, rw * 2, rh * 2); }
    else if (r.dark) { ctx.fillStyle = PAPER.shade; ctx.fillRect(cx - rw, cy - rh, rw * 2, rh * 2); }
    if (big) {
      for (const f of r.furniture) if (f.flat) pencilFurniture(ctx, f, cx, cy, rw, rh);
      for (const f of r.furniture) if (!f.flat) pencilFurniture(ctx, f, cx, cy, rw, rh);
    } else {
      for (const f of r.furniture) {
        if (!f.cover) continue;
        const px = cx + (f.fx - 0.5) * rw, py = cy + (f.fy - 0.5) * rh;
        ctx.fillStyle = PAPER.cover;
        ctx.beginPath(); ctx.arc(px, py, Math.max(1.5, unit * 0.06), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ── 4) Ink the walls (wobbly room outlines), then re-open the corridor mouths
  //       and rail the corridor sides so passages read as carved hallways. ───
  ctx.strokeStyle = PAPER.ink;
  for (const r of drooms) {
    const { cx, cy, rw, rh } = pbox.get(r.id);
    const isCurrent = r.id === roomId;
    const dense = densify(roomCorners(r.shape, cx, cy, rw, rh, r.id), Math.max(8, unit * 0.5));
    inkOutline(ctx, dense, r.id, ink.amp, isCurrent ? ink.lw + 0.6 : ink.lw, ink.passes);
  }
  for (const c of corridors) exposeFloor(() => addRect(ctx, c.x, c.y, c.w, c.h)); // punch mouths through walls
  ctx.strokeStyle = PAPER.ink; ctx.lineWidth = ink.lw;
  for (let i = 0; i < corridors.length; i++) {
    const c = corridors[i];
    if (c.w >= c.h) { inkSegment(ctx, c.x, c.y, c.x + c.w, c.y, 'rl|' + i + '|t', 0.7); inkSegment(ctx, c.x, c.y + c.h, c.x + c.w, c.y + c.h, 'rl|' + i + '|b', 0.7); }
    else { inkSegment(ctx, c.x, c.y, c.x, c.y + c.h, 'rl|' + i + '|l', 0.7); inkSegment(ctx, c.x + c.w, c.y, c.x + c.w, c.y + c.h, 'rl|' + i + '|r', 0.7); }
  }

  // ── 5) Dashed stubs into the unexplored dark. ────────────────────────────
  ctx.strokeStyle = PAPER.inkSoft; ctx.lineWidth = ink.lw * 0.8;
  ctx.setLineDash([4, 4]);
  for (const s of stubs) inkSegment(ctx, s.x0, s.y0, s.x1, s.y1, s.key, 1.2);
  ctx.setLineDash([]);

  // ── 6) Handwritten room names, gently rotated. ───────────────────────────
  if (unit >= 28) {
    ctx.textAlign = 'center';
    for (const r of drooms) {
      const { cx, cy, rh } = pbox.get(r.id);
      ctx.save();
      ctx.translate(cx, cy - rh / 2 + Math.max(11, unit * 0.22));
      ctx.rotate(jit('lab|' + r.id, 0.05));
      ctx.font = Math.max(11, Math.round(unit * 0.26)) + 'px ' + HAND_FONT;
      ctx.fillStyle = PAPER.label;
      ctx.fillText(r.name || 'Room', 0, 0);
      ctx.restore();
    }
    ctx.textAlign = 'left';
  }

  // ── 7) Title cartouche + compass rose — the "this is a map" signatures. ───
  {
    const title = fp.name || 'Building';
    ctx.save();
    ctx.translate(margin * 0.6, margin * 1.0);
    ctx.rotate(-0.02);
    ctx.font = Math.max(14, Math.round(w * 0.034)) + 'px ' + HAND_FONT;
    ctx.fillStyle = PAPER.ink;
    ctx.fillText(title, 0, 0);
    const tw = ctx.measureText(title).width;
    ctx.strokeStyle = PAPER.inkSoft; ctx.lineWidth = 1.4;
    inkSegment(ctx, 0, 6, tw, 6, 'title|' + title, 1.0);
    ctx.restore();
  }
  drawCompass(ctx, w - margin * 0.9, w - margin * 1.1, Math.max(10, w * 0.028));

  // ── 8) People (blue-pen rings) — the engine's occupants of each discovered room.
  //      (MAP-OCC-1b: truth from roomOccupancy, never a seeded roster scatter.) ─────
  const discIds = drooms.map(r => r.id);
  if (unit >= 24 && discIds.length) {
    for (const t of interiorPeopleTokens(world, structureKey, discIds)) {
      const target = pbox.get(t.roomId);
      if (!target) continue;
      const { cx, cy, rw, rh } = target;
      const ang = (seedStr('npcang|' + t.nkey) % 360) * Math.PI / 180;
      const m = Math.min(rw, rh) * (0.16 + (seedStr('npcrad|' + t.nkey) % 100) / 100 * 0.18);
      const tx = cx + Math.cos(ang) * m, ty = cy + Math.sin(ang) * m;
      const tok = Math.max(3, unit * 0.1);
      // CORPSE-TRUTH-1b — a dead occupant draws the fallen mark (body line + head),
      // never a living blue-pen ring.
      if (t.dead) {
        ctx.strokeStyle = 'rgba(96,98,110,0.9)'; ctx.lineWidth = Math.max(1.2, tok * 0.35); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tx - tok * 0.9, ty + tok * 0.35); ctx.lineTo(tx + tok * 0.5, ty + tok * 0.35); ctx.stroke();
        ctx.beginPath(); ctx.arc(tx + tok * 0.85, ty + tok * 0.35, tok * 0.32, 0, Math.PI * 2); ctx.stroke();
        continue;
      }
      ctx.beginPath(); ctx.arc(tx, ty, tok, 0, Math.PI * 2);
      ctx.fillStyle = PAPER.token; ctx.fill();
      ctx.strokeStyle = PAPER.npc; ctx.lineWidth = Math.max(1.4, tok * 0.4); ctx.stroke();
    }
  }

  // ── 9) "You are here" — red felt-tip dot in the current room. ────────────
  const cur = pbox.get(roomId);
  if (cur) {
    const dot = Math.max(4, unit * 0.12);
    ctx.beginPath(); ctx.arc(cur.cx, cur.cy, dot, 0, Math.PI * 2);
    ctx.fillStyle = PAPER.player; ctx.fill();
    ctx.strokeStyle = PAPER.token; ctx.lineWidth = Math.max(1.5, dot * 0.3); ctx.stroke();
  }
}

// ── NPC roster ──────────────────────────────────────────────────────────
function npcsAtCurrentNode(world) {
  const nodeId = String(world?.map?.currentNodeId || '');
  const node = (world?.map?.nodes || []).find(n => n.id === nodeId);
  return Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
}

function renderNpcRoster(world) {
  const npcs = npcsAtCurrentNode(world);
  if (!npcs.length) {
    return el('div', { class: 'small', style: { opacity: '0.5', fontStyle: 'italic' } }, 'No known persons here.');
  }
  // CORPSE-TRUTH-1b — the roster tells the truth about the dead: a corpse keeps
  // its row (the body is here) but drops the living tags — no trust score, no
  // disposition, no pretending there's a person to talk to.
  const deadIds = new Set(remainsAtNode(world, String(world?.map?.currentNodeId || '')).filter(r => r.sourceNpcId).map(r => String(r.sourceNpcId)));
  const rows = npcs.map(n => {
    const name = String(n?.name || 'unknown').trim() || 'unknown';
    if (deadIds.has(String(n?.id || ''))) {
      return el('div', { class: 'small', style: { opacity: '0.6' } },
        el('strong', {}, name), ' — dead'
      );
    }
    const role = String(n?.role || '').trim();
    const trust = Number(n?.conversationState?.trustLevel ?? 5);
    const met = Boolean(n?.conversationState?.metPlayer);
    const disp = String(n?.disposition || '').trim();
    const tags = [
      role || null,
      disp || null,
      met ? `trust ${trust}/10` : null
    ].filter(Boolean).join(' · ');
    return el('div', { class: 'small' },
      el('strong', {}, name),
      tags ? ` — ${tags}` : ''
    );
  });
  return el('div', { class: 'stack', style: { gap: '3px' } }, ...rows);
}

// A tiny glyph legend so the furnished floor plan is self-explaining: a colored
// dot/ring next to its meaning. Only shown for interiors (the only view with
// furniture, cover, loot, and people).
function mapLegend() {
  const chip = (color, label, ring) => el('span', { class: 'map-legend-chip' },
    el('span', {
      class: 'map-legend-dot',
      style: ring
        ? { border: `2px solid ${color}`, background: 'transparent' }
        : { background: color }
    }),
    label
  );
  return el('div', { class: 'map-legend' },
    chip(PAPER.cover, 'cover', true),
    chip(PAPER.light, 'light'),
    chip(PAPER.loot, 'loot'),
    chip(PAPER.npc, 'person', true),
    chip(PAPER.player, 'you')
  );
}

// ── Public render function ──────────────────────────────────────────────
/**
 * @param {object} world
 * @param {object} [opts]
 * @param {boolean} [opts.compact] - If true, render a smaller map for embedding in the play screen
 */
// The polished shared renderer is now the DEFAULT for interiors (verified on real
// floorPlan output via /public/__preview/live.html: hand-drawn carve-void, creature
// icons, bent corridors, fog-of-war preserved). Falls back to the legacy drawInterior
// on any error (see renderLocalMap). Disable with localStorage.setItem('handDrawnMapV2','0').
function useHandDrawnV2(opts) {
  if (opts && opts.handDrawnV2 != null) return Boolean(opts.handDrawnV2);
  try { if (typeof localStorage !== 'undefined') { const v = localStorage.getItem('handDrawnMapV2'); if (v === '0' || v === 'false') return false; } } catch {}
  return true;
}

// Interior render via the shared hand-drawn module (carve-void + materials +
// windows + furniture + tokens), with fog-of-war from interior.visited and the
// player token placed in the current room. Pure draw; never mutates world.
// engine room ids end in ":<n>" (1-based; room 1 = entry).
function engineRoomIndex(roomId) {
  const m = String(roomId || '').match(/:(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

// OBJ-MOVE-1 — is this the interior of a FINALIZED authored (Builder) building?
// The durable marker is the stored authoredPlan (structuresState only carries it for
// authored canon; a procgen structure never has one). This — NOT "the floor plan has
// furniture" — is what selects the engine-furniture render branch, because EVERY
// procgen plan has furniture too and those must keep their hand-drawn catalog art.
export function isFinalizedAuthored(st) {
  return !!(st && st.authoredPlan && Array.isArray(st.authoredPlan.rooms) && st.authoredPlan.rooms.length);
}

// OBJ-MOVE-1 — the ONE render join: the ENGINE's authored furniture in scene-model
// shape ({type, ux, uy, uw, uh, id}), each piece at its live placement override when
// one exists (a moved barrel draws at its new cell), else its authored base position.
// Tactical cell → layout display coord happens HERE, at the renderer boundary only.
// ONLY genuine Builder-authored pieces (f.authored === 1) — never role-fallback /
// procedural room-detail furniture, which a procgen floor plan also carries.
//
// The scene model wants a TOP-LEFT corner (furn(): bx=gx(ux), cx=bx+bw/2) and
// dimensions in LAYOUT UNITS (bw=uw*TT.s). Model B stores room-RELATIVE fractions
// (w/h a fraction of the room box; a circle carries r, a fraction, with w=h=0), so
// each piece must be converted, not passed raw — passing a normalized f.w straight
// through (as the first cut did) drew every barrel as a zero-size point. The center
// is the authored fx/fy anchor (matching furnitureAnchorCell in tacticalPos), or,
// for a moved piece, its override cell brought back to layout units (cell / PLACE_WU).
const SAFE_FALLBACK_U = 0.5; // layout-unit size for malformed dimensions only
export function buildAuthoredSceneFurniture(fp, world, structureId) {
  const out = [];
  const rooms = Array.isArray(fp?.rooms) ? fp.rooms : [];
  // INK-WRECK-1 — the destroyed set, resolved ONCE per projection (it walks the node's
  // furniture, so per-piece calls would rescan it for every glyph). Keyed by plan
  // pieceId, exactly as cover and blocking consume it.
  const structure = world?.structures?.byId?.[String(structureId)];
  const dead = structure ? destroyedAuthoredPieceIds(world, structure) : null;
  // FURN-PARITY-1 — the procgen identity join (destroyed → rubble; taken → no
  // glyph; unseeded → nothing drawn here, matching the pre-parity empty array
  // for procgen structures whose loadout has no Model A twins yet... except the
  // interior render now passes procgen structures through this builder, so an
  // UNSEEDED procgen structure draws its full loadout INTACT — see the loop).
  const pgStatus = (structure && !structure.authoredPlan) ? procgenPlanPieceStatus(world, structure) : null;
  // U708 — terminal positions of salvage-removed pieces (a moved/thrown piece
  // destroyed away from its plan anchor leaves its rubble THERE; the event is
  // the record because the removal deleted the overlay).
  const deadPos = structure ? destroyedObjectPositionsAtNode(world, String(structure.nodeId || '')) : null;
  for (const r of rooms) {
    const roomW = Number(r.w) || 0, roomH = Number(r.h) || 0;
    for (const f of (Array.isArray(r.furniture) ? r.furniture : [])) {
      if (f == null || f.id == null) continue;
      let isDead;
      let oid;
      let ov = null;
      if (f.authored === 1) {
        // INK-WRECK-1 → OBJ-RUBBLE-1 — a DESTROYED piece draws as RUBBLE, never as its
        // intact glyph and never as a blank spot. Same authority (destroyedAuthoredPieceIds,
        // the Set cover and blocking subtract), same identity, same geometry source —
        // the entry is RE-TYPED, so the wreck sits exactly where the piece stood.
        // ONE generic treatment for both destroyed shapes (twin absent via the salvage
        // lane | twin terminal via the rulings lane), deliberately: the authority hands
        // back no discriminator and every other consumer treats them the same.
        isDead = !!(dead && dead.has(String(f.id)));
        oid = authoredObjectId(structureId, String(f.id));
        ov = resolvedObjectPlacement(world, oid);
        // OBJ-HOLD-6A — a HELD object rides in someone's arms: it is on no floor cell,
        // so the floor does not draw it (the in-hand panel shows it instead).
        if (ov && ov.status === 'held') continue;
      } else if (pgStatus) {
        // FURN-PARITY-1 — a PROCGEN loadout item: destroyed → rubble at its own
        // spot; taken (twin absent, no salvage record) → no glyph; unseeded
        // structure → the full loadout draws intact (the world hasn't
        // materialized twins yet, so nothing can honestly be missing).
        const pid = String(f.id);
        if (pgStatus.seeded && !pgStatus.destroyed.has(pid) && !pgStatus.present.has(pid)) continue;
        isDead = pgStatus.seeded && pgStatus.destroyed.has(pid);
        oid = authoredObjectId(structureId, pid);
      } else {
        // Role-fallback loadout items inside an AUTHORED building stay
        // narration-only (FUNC-MINIS ruling: an empty authored room stays
        // visibly empty) — exactly the pre-parity skip.
        continue;
      }

      // 1. display size in layout units.
      let uw, uh;
      if (String(f.shape || '') === 'circle') {
        // A circle's diameter in room-relative units is r*2 (tacticalPos uses the
        // same substitution); scale by the room width so it lands round and sized
        // like its catalog twin (barrel r=0.065, room w=6 → 0.78 ≈ catalog 0.8).
        const rad = Number(f.r);
        const dia = Number.isFinite(rad) && rad > 0 ? rad * 2 * roomW : 0;
        uw = uh = dia > 0 ? dia : SAFE_FALLBACK_U;
      } else {
        const fw = Number(f.w), fh = Number(f.h);
        uw = Number.isFinite(fw) && fw > 0 ? fw * roomW : SAFE_FALLBACK_U;
        uh = Number.isFinite(fh) && fh > 0 ? fh * roomH : SAFE_FALLBACK_U;
      }

      // 2. center in layout units. Position truth, in order: the live placed
      // overlay (a moved piece / a standing wreck) > the salvage event's terminal
      // position (a removed piece — U708) > the plan anchor.
      const termPos = isDead && deadPos ? deadPos.get(oid) : null;
      let centerX, centerY;
      if (ov && ov.status === 'placed' && ov.cell) {
        centerX = ov.cell.x / PLACE_WU;
        centerY = ov.cell.y / PLACE_WU;
      } else if (termPos && termPos.cell) {
        centerX = termPos.cell.x / PLACE_WU;
        centerY = termPos.cell.y / PLACE_WU;
      } else {
        centerX = Number(r.cx) + (Number(f.fx) - 0.5) * roomW;
        centerY = Number(r.cy) + (Number(f.fy) - 0.5) * roomH;
      }
      if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) continue;

      // 3. center → top-left. A destroyed piece keeps its entry — re-typed to rubble.
      out.push({ type: isDead ? 'rubble' : String(f.kind || f.type || ''), ux: centerX - uw / 2, uy: centerY - uh / 2, uw, uh, id: oid });
    }
  }
  return out;
}

function drawInteriorV2(canvas, world) {
  const interior = world?.scene?.interior;
  const st = world?.structures?.byId?.[String(interior?.structureKey || '')];
  if (!st) throw new Error('no structure');

  // OBJ-MOVE-1 — a FINALIZED authored (Builder) building draws the ENGINE's own
  // furniture (real pieceIds), so a moved piece is visibly repositioned by its
  // overlay. An authored building with nothing placed still renders its OWN
  // empty room shell (empty furniture array): an empty authored house must stay
  // visibly empty, never borrow a decorative catalog room.
  //
  // FURN-PARITY-1 (DEATH-TRUTH-1 finish, 2026-07-16) — PROCGEN interiors now
  // take this SAME engine-truth branch: the roomDetail loadout the engine
  // seeded as real Model A pieces is what this floor plan draws, so a smashed
  // barrel shows rubble and a carried-off lantern shows nothing — INSIDE the
  // building too, not just on the village sheet. This retires the old
  // catalog-art path (an index-mapping of engine rooms onto a DIFFERENT
  // building's hand-drawn plan — decorative fiction that could never register
  // destruction; it survives below only for a structure with no drawable
  // topology). Flagged against IMMORTAL_INVARIANTS #14 in the landing report:
  // the render pipeline is still the hand-drawn createInteriorMap — what
  // changed is WHICH truth it projects.
  const engineTruth = isFinalizedAuthored(st) || (() => {
    try { const p = floorPlan(st); return Array.isArray(p?.rooms) && p.rooms.length > 0; } catch { return false; }
  })();
  if (engineTruth) {
    const engFp = floorPlan(st);
    const authoredFurniture = buildAuthoredSceneFurniture(engFp, world, String(st.id || ''));
    const roomId = String(interior?.roomId || '');
    const visited = Array.isArray(interior?.visited) && interior.visited.length ? interior.visited : [roomId];
    const cur = engFp.rooms.find(r => String(r.id) === roomId);
    const tokens = cur ? [{ type: 'player', ux: cur.cx, uy: cur.cy }] : [];
    // CORPSE-TRUTH-1 finish — bodies draw in their DEATH room (fact.loc pins
    // them), in DISCOVERED rooms only, at an identity-keyed offset that no
    // roster change can re-scatter. Legacy dead (no loc) never reach here —
    // the plain renderer's occupancy flags own their honest node-level truth.
    const visitedIds = new Set(visited.map(String));
    for (const rr of remainsAtNode(world, String(world?.map?.currentNodeId || ''))) {
      if (!rr.loc || String(rr.loc.structureId || '') !== String(st.id || '')) continue;
      const rid = String(rr.loc.roomId || '');
      if (!rid || !visitedIds.has(rid)) continue;
      const room = engFp.rooms.find(r0 => String(r0.id) === rid);
      if (!room) continue;
      const key = String(rr.sourceNpcId || `remains:${rr.t != null ? rr.t : String(rr.name || '')}`);
      const ang = (seedStr('deadang|' + key) % 360) * Math.PI / 180;
      const rad = Math.min(Number(room.w) || 1, Number(room.h) || 1) * (0.18 + (seedStr('deadrad|' + key) % 100) / 100 * 0.15);
      tokens.push({ type: 'dead', ux: room.cx + Math.cos(ang) * rad, uy: room.cy + Math.sin(ang) * rad, label: String(rr.name || '') });
    }
    const model = floorPlanToSceneModel(engFp, { currentRoomId: roomId, visited, tokens, furniture: authoredFurniture });
    createInteriorMap(canvas, { seed: String(st.id || 'interior') }).draw(model);
    return;
  }

  // Prefer the authored building-catalog plan for this type — the good-looking
  // hand-drawn buildings — mapping the engine's current/visited rooms onto the
  // plan's rooms by index (engine room N ↔ plan room N-1). Fall back to the
  // procedural floor plan only when no authored plan exists for the type.
  const buildingType = st.buildingType || buildingTypeFor(String(st.id || ''));
  const plan = ALL_PLANS.find(p => p.type === buildingType);
  if (plan && Array.isArray(plan.rooms) && plan.rooms.length) {
    const aRooms = plan.rooms;
    const toAuthored = (engId) => { const n = engineRoomIndex(engId); const idx = (n != null ? n - 1 : 0); return aRooms[Math.max(0, Math.min(aRooms.length - 1, idx))]; };
    const curA = toAuthored(interior?.roomId);
    const visEng = Array.isArray(interior?.visited) && interior.visited.length ? interior.visited : [String(interior?.roomId || '')];
    const visited = [...new Set(visEng.map(id => toAuthored(id)?.id).filter(Boolean))];
    const tokens = curA ? [{ type: 'player', ux: curA.cx, uy: curA.cy }] : [];
    const model = planToSceneModel(plan, { currentRoomId: curA?.id, visited, tokens });
    const map = createInteriorMap(canvas, { seed: String(st.id || 'interior') });
    map.draw(model);
    return;
  }

  // Procedural fallback (no authored plan for this type).
  const fp = floorPlan(st);
  if (!fp.rooms.length) throw new Error('no rooms');
  const roomId = String(interior?.roomId || '');
  const visited = Array.isArray(interior?.visited) && interior.visited.length ? interior.visited : [roomId];
  const cur = fp.rooms.find(r => String(r.id) === roomId);
  const tokens = cur ? [{ type: 'player', ux: cur.cx, uy: cur.cy }] : [];
  const model = floorPlanToSceneModel(fp, { currentRoomId: roomId, visited, tokens });
  const map = createInteriorMap(canvas, { seed: String(interior?.structureKey || 'interior') });
  map.draw(model);
}

export function renderLocalMap(world, opts = {}) {
  const compact = Boolean(opts?.compact);
  // Compact is rendered at a higher internal resolution than it displays (CSS
  // scales it down), so the furnished floor plan stays crisp instead of blurry.
  const size = compact ? 60 : 61;
  const cell = compact ? 8 : 14;
  const w = size * cell;

  const canvas = el('canvas', {
    width: String(w),
    height: String(w),
    class: compact ? 'local-map-canvas compact' : 'local-map-canvas'
  });
  const ctx = canvas.getContext('2d');

  const isInterior = Boolean(world?.scene?.interior);
  if (isInterior) {
    // Opt-in: the polished shared hand-drawn renderer (materials/windows/furniture).
    // Default OFF so the proven live path is untouched; flip on to A/B it:
    //   localStorage.setItem('handDrawnMapV2','1')
    // Falls back to the existing drawInterior on any error.
    if (useHandDrawnV2(opts)) {
      // If the rich renderer can't handle this world (e.g. a stale save whose
      // structure shape predates the current floor-plan format), warn instead of
      // failing silently, then fall back to the plain renderer.
      try { drawInteriorV2(canvas, world); }
      catch (e) { try { console.warn('[map] hand-drawn interior fell back to plain:', e && (e.message || e)); } catch {} drawInterior(ctx, world, w); }
    } else {
      drawInterior(ctx, world, w);
    }
  }
  else {
    // No exterior "mode" / tile overworld — outside is the SAME hand-drawn local
    // scale as interiors: a continuous walkable place with the settlement's
    // buildings embedded. (The abstract overworld tile view lives only on the Map
    // tab as a zoom-out.) Falls back to the tile renderer on any error.
    try {
      const model = placeFromWorldNode(world, world?.map?.currentNodeId) || placeModelFromNode(world, world?.map?.currentNodeId);
      if (model) { const pm = createPlaceMap(canvas, { seed: String(model.seed || 'place') }); pm.draw(model); }
      else drawExterior(ctx, world, w, size, cell);
    } catch (e) { try { console.warn('[map] place render fell back to tiles:', e && (e.message || e)); } catch {} drawExterior(ctx, world, w, size, cell); }
  }

  const structures = structuresAtCurrentNode(world);
  const npcs = npcsAtCurrentNode(world);
  // Use the location's readable name, never the raw internal node id. The id is
  // an engine handle (e.g. "n5_1557310534") and must never surface in the UI.
  const curId = String(world?.map?.currentNodeId || '');
  const curNode = (world?.map?.nodes || []).find(n => n && String(n.id) === curId) || null;
  const nodeName = String(curNode?.name || '').trim() || 'Uncharted';

  if (compact) {
    // Compact mode: map canvas only, minimal chrome
    return el('div', { class: 'play-map' },
      el('div', { class: 'play-map-header' },
        el('span', { class: 'play-map-label' }, isInterior ? 'Interior' : nodeName),
        structures.length ? el('span', { class: 'play-map-tag' }, `${structures.length} structure${structures.length > 1 ? 's' : ''}`) : null,
        npcs.length ? el('span', { class: 'play-map-tag' }, `${npcs.length} NPC${npcs.length > 1 ? 's' : ''}`) : null
      ),
      canvas,
      isInterior ? mapLegend() : null
    );
  }

  // Full mode (used on the dedicated Map screen)
  return el('div', { class: 'card stack' },
    el('div', { class: 'local-map-header' },
      el('strong', {}, 'Local'),
      el('span', { class: 'small' }, isInterior
        ? `Inside · ${String(world?.scene?.interior?.structureKey || 'structure')}`
        : `${nodeName} · ${structures.length} structures · ${npcs.length} persons`)
    ),
    canvas,
    isInterior ? mapLegend() : null,
    el('div', { class: 'stack', style: { gap: '6px' } },
      el('div', { class: 'local-map-header' }, el('strong', {}, 'Persons of note')),
      renderNpcRoster(world)
    )
  );
}
