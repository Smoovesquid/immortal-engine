#!/usr/bin/env node

/**
 * VIS-ORACLE — the golden-image beauty lock (docs/briefs/VIS-ORACLE.md).
 *
 * "Golden per scene, perceptual diff with tolerance; NO new heavy deps."
 * There is no WebGL/canvas in a headless Node run (and the 0×0-canvas-black trap
 * makes a real screenshot a liability), so the golden is a DETERMINISTIC raster of
 * the drawn model, produced by a tiny dependency-free rasterizer here: the scene's
 * building rects, people/prop/player positions rendered into a small grayscale
 * grid. This locks the LOOK — the LAYOUT of ink and figures in frame — so a
 * regression that moves a wall or a mini shifts pixels and trips the diff, while a
 * pure re-run reproduces the identical raster (byte-for-byte). The image is stored
 * as PGM (P2 ASCII), a trivial, human-inspectable, diffable grayscale format — no
 * PNG encoder, no image library, zero dependencies.
 *
 * The diff is a pixel-delta with a tolerance threshold (perceptual enough for a
 * layout lock, dependency-free): count pixels whose grayscale differs by more than
 * PIXEL_TOL; fail if that fraction exceeds AREA_TOL. `screen-goldens:accept`
 * regenerates goldens deliberately and prints exactly which scenes changed and by
 * how much.
 *
 * Determinism: the rasterizer is pure integer math over the drawn model (itself
 * deterministic); no Math.random, no time, no float-formatting drift (grays are
 * integers). Two renders of the same scene → identical PGM text.
 */

import fs from 'node:fs';
import path from 'node:path';

// Raster size — small on purpose (a layout lock, not a texture lock): big enough
// that a moved wall/figure shifts several cells, small enough to store as terse
// ASCII and diff by eye. 64×48 keeps the village square legible at ~1 cell/px.
export const RASTER_W = 64;
export const RASTER_H = 48;

// Diff tolerances. PIXEL_TOL — a per-pixel grayscale delta below which two pixels
// are "the same" (absorbs nothing today since grays are exact integers, but leaves
// headroom if a future gray ramp is added). AREA_TOL — the fraction of differing
// pixels above which two rasters are "different looks". A single moved figure at
// this resolution paints ~1-2% of the frame, so 0.5% cleanly separates "identical"
// from "something moved" while ignoring a lone stray pixel.
export const PIXEL_TOL = 8;
export const AREA_TOL = 0.005;

// Grayscale ink levels (0 = black ink, 255 = blank paper). Distinct levels so the
// diff (and the eye) can tell a wall from a person from the player.
const PAPER = 255, WALL = 120, DECO = 170, PERSON = 40, PLAYER = 0, PROP = 200, ENEMY = 70, CORPSE = 210;

// ── The rasterizer ───────────────────────────────────────────────────────────
// Projects the drawn model's own coordinate frame into the raster. For a
// settlement we use the wu structure/decorative rects + wu people/props/player
// (one coherent wu space). For combat we use the cell grid. The frame is the AABB
// of everything drawn, with a small margin, mapped to the raster — so the whole
// scene is always in frame regardless of absolute offset (a layout lock is
// translation-invariant by construction; it catches RELATIVE moves, which is
// exactly what a figure-off-its-building regression is).

function newRaster() { return new Uint8Array(RASTER_W * RASTER_H).fill(PAPER); }

function boundsOf(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 1; maxY = 1; }
  // pad so nothing sits on the very edge
  const pw = (maxX - minX) || 1, ph = (maxY - minY) || 1;
  return { minX: minX - pw * 0.08, minY: minY - ph * 0.08, maxX: maxX + pw * 0.08, maxY: maxY + ph * 0.08 };
}

function makeMapper(b) {
  const sx = (RASTER_W - 1) / ((b.maxX - b.minX) || 1);
  const sy = (RASTER_H - 1) / ((b.maxY - b.minY) || 1);
  // Uniform scale (preserve aspect) so a square building reads square; center.
  const s = Math.min(sx, sy);
  const offX = (RASTER_W - 1 - s * (b.maxX - b.minX)) / 2;
  const offY = (RASTER_H - 1 - s * (b.maxY - b.minY)) / 2;
  return (x, y) => [
    Math.round(offX + (x - b.minX) * s),
    Math.round(offY + (y - b.minY) * s),
  ];
}

function put(r, px, py, ink) {
  if (px < 0 || px >= RASTER_W || py < 0 || py >= RASTER_H) return;
  const i = py * RASTER_W + px;
  // darker ink wins (painter's model: ink over paper, figures over walls)
  if (ink < r[i]) r[i] = ink;
}

function strokeRect(r, map, rect, ink) {
  if (!rect || !Number.isFinite(rect.minX)) return;
  const [x0, y0] = map(rect.minX, rect.minY);
  const [x1, y1] = map(rect.maxX, rect.maxY);
  const lo = (a, b) => Math.min(a, b), hi = (a, b) => Math.max(a, b);
  const ax = lo(x0, x1), bx = hi(x0, x1), ay = lo(y0, y1), by = hi(y0, y1);
  for (let x = ax; x <= bx; x++) { put(r, x, ay, ink); put(r, x, by, ink); }
  for (let y = ay; y <= by; y++) { put(r, ax, y, ink); put(r, bx, y, ink); }
}

function dot(r, map, x, y, ink) {
  const [px, py] = map(x, y);
  put(r, px, py, ink);
  // a 3×3 stamp so a figure reads as a mark, not a speck (and a 1px move shows)
  put(r, px - 1, py, ink); put(r, px + 1, py, ink);
  put(r, px, py - 1, ink); put(r, px, py + 1, ink);
}

/**
 * rasterizeScene(model) -> Uint8Array (RASTER_W*RASTER_H grayscale).
 * `model` is drawnModel(world) (augmented with __world for combat). Deterministic.
 */
export function rasterizeScene(model) {
  const r = newRaster();

  // Combat scene: the cell grid (model.combat is the board read contract).
  if (model.combat) {
    const c = model.combat;
    const w = Math.max(1, c.grid?.w || 12), h = Math.max(1, c.grid?.h || 10);
    const b = { minX: 0, minY: 0, maxX: w, maxY: h };
    const map = makeMapper(b);
    // board outline
    strokeRect(r, map, { minX: 0, minY: 0, maxX: w, maxY: h }, WALL);
    // player + enemies at cell centers
    const pc = c.player || {};
    if (Number.isInteger(pc.cx)) dot(r, map, pc.cx + 0.5, pc.cy + 0.5, PLAYER);
    for (const e of (c.enemies || [])) {
      if (!Number.isInteger(e?.cx)) continue;
      dot(r, map, e.cx + 0.5, e.cy + 0.5, e.defeated ? CORPSE : ENEMY);
    }
    return r;
  }

  // Settlement / wild: the wu drawn model.
  const rects = [
    ...model.wu.structures.map(s => ({ ink: WALL, rect: s.rect })),
    ...model.wu.decoratives.map(d => ({ ink: DECO, rect: d.rect })),
  ].filter(x => x.rect && Number.isFinite(x.rect.minX));

  const pts = [];
  for (const { rect } of rects) { pts.push([rect.minX, rect.minY], [rect.maxX, rect.maxY]); }
  for (const p of model.wu.people) pts.push([p.wx, p.wy]);
  for (const p of model.wu.props) pts.push([p.wx, p.wy]);
  if (model.wu.player) pts.push([model.wu.player.wx, model.wu.player.wy]);
  // A wild scene with no structures/people still gets a stable 1-unit frame so the
  // player mark lands centre — a blank-but-deterministic golden.
  if (!pts.length && model.wu.player) pts.push([model.wu.player.wx - 1, model.wu.player.wy - 1], [model.wu.player.wx + 1, model.wu.player.wy + 1]);

  const b = boundsOf(pts.length ? pts : [[0, 0], [1, 1]]);
  const map = makeMapper(b);

  for (const { ink, rect } of rects) strokeRect(r, map, rect, ink);
  for (const p of model.wu.props) dot(r, map, p.wx, p.wy, PROP);
  for (const p of model.wu.people) dot(r, map, p.wx, p.wy, PERSON);
  if (model.wu.player) dot(r, map, model.wu.player.wx, model.wu.player.wy, PLAYER);

  return r;
}

// ── PGM (P2 ASCII) serialize / parse — trivial, dependency-free, diffable ─────
export function toPGM(raster, id = '') {
  const rows = [];
  for (let y = 0; y < RASTER_H; y++) {
    const row = [];
    for (let x = 0; x < RASTER_W; x++) row.push(raster[y * RASTER_W + x]);
    rows.push(row.join(' '));
  }
  return `P2\n# VIS-ORACLE golden${id ? ' ' + id : ''}\n${RASTER_W} ${RASTER_H}\n255\n${rows.join('\n')}\n`;
}

export function fromPGM(text) {
  const toks = String(text)
    .split('\n').filter(l => !l.startsWith('#')).join(' ')
    .trim().split(/\s+/);
  // toks: P2 W H 255 <pixels...>
  const magic = toks.shift();
  if (magic !== 'P2') throw new Error(`not a P2 PGM (got ${magic})`);
  const w = parseInt(toks.shift(), 10), h = parseInt(toks.shift(), 10);
  toks.shift(); // maxval
  const data = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) data[i] = parseInt(toks[i], 10) || 0;
  return { w, h, data };
}

/**
 * diffRasters(a, b) -> { w, h, changed, total, fraction, withinTolerance }.
 * a/b are Uint8Array of the same size. A pixel counts as changed when its
 * grayscale delta exceeds PIXEL_TOL; withinTolerance is fraction <= AREA_TOL.
 */
export function diffRasters(a, b) {
  const total = Math.min(a.length, b.length);
  let changed = 0;
  for (let i = 0; i < total; i++) if (Math.abs(a[i] - b[i]) > PIXEL_TOL) changed++;
  const fraction = total ? changed / total : 0;
  return { total, changed, fraction, withinTolerance: fraction <= AREA_TOL };
}

// ── Golden file I/O ──────────────────────────────────────────────────────────
export const GOLDENS_DIR = path.resolve(new URL('..', import.meta.url).pathname, 'tests/goldens/screen');

export function goldenPath(id) { return path.join(GOLDENS_DIR, `${id}.pgm`); }
export function goldenExists(id) { return fs.existsSync(goldenPath(id)); }
export function readGolden(id) { return fromPGM(fs.readFileSync(goldenPath(id), 'utf8')); }
export function writeGolden(id, raster) {
  fs.mkdirSync(GOLDENS_DIR, { recursive: true });
  fs.writeFileSync(goldenPath(id), toPGM(raster, id));
}

/**
 * checkGolden(id, raster) -> { id, status, ... }
 *   status: 'ok' (matches within tolerance) | 'drift' (exists but differs) |
 *           'missing' (no golden on disk).
 */
export function checkGolden(id, raster) {
  if (!goldenExists(id)) return { id, status: 'missing' };
  const golden = readGolden(id);
  if (golden.w * golden.h !== raster.length) return { id, status: 'drift', reason: 'size', fraction: 1 };
  const d = diffRasters(golden.data, raster);
  return { id, status: d.withinTolerance ? 'ok' : 'drift', fraction: d.fraction, changed: d.changed, total: d.total };
}
