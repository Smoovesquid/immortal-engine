// U419 — TT-DRAW-3 the quadrille band (docs/briefs/TT-DRAW-3-graphpaper-real-
// plans.md, docs/GRAPH_PAPER_UI.md). Tim's live sighting: "In the preview, I
// do not see the graphpaper view, either. At the closest view, we need the
// graphpaper." The outdoor sheet (oneMap.js) had NO grid at any zoom — this
// packet fades in a REAL 5-ft tactical quadrille at the deep zoom band.
//
// Grid pitch must equal CELL_FT (TAC-1's pinned constant,
// engine/map/spatial/tacticalPos.js) through the pinned wu↔ft mapping — NEVER
// a re-derived conversion. The identity proven here: one floorPlan layout unit
// is tacticalPos.PLACE_WU (4) cells * CELL_FT (5 ft) = 20 ft (already pinned,
// POSITION_AS_CANON.md), and that SAME layout unit is worldSpace.PLACE_WU (4)
// world units (already pinned, ONE_MAP.md/worldSpace.js — interiorRoomToWu
// applies no additional scale between a floorPlan layout unit and a wu) — so
// 1 wu = 20ft/4 = CELL_FT ft, exactly. drawModel.js's wuToFt/ftToWu compose
// these two ALREADY-PINNED constants; this test proves the composition is
// exact and round-trips, and that quadrilleAlpha is a pure, named-threshold
// function of z. Pure math — no DOM/canvas required (mirrors U417's approach:
// the camera's world-to-pixel projection is linear, so "the grid pitch in
// world units" is what matters, not any particular canvas pixel size).
// Hermetic — no network, no API key, no Math.random.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { INK_PARAMS, quadrilleAlpha, quadrilleStroke, wuToFt, ftToWu } from '../public/map/drawModel.js';
import { CELL_FT, PLACE_WU as TAC_PLACE_WU } from '../engine/map/spatial/tacticalPos.js';
import { PLACE_WU as RENDER_PLACE_WU, Z_MIN, Z_MAX } from '../public/map/worldSpace.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

test('U419-A: quadrilleAlpha is a pure function of z with a named threshold — invisible below the fade-start, opaque at/above the fade-end, monotonic between', () => {
  assert.equal(quadrilleAlpha(0), 0, 'zero zoom: grid fully invisible');
  assert.equal(quadrilleAlpha(INK_PARAMS.gridFadeZStart), 0, 'at the named fade-start threshold, alpha is exactly 0 (not visible yet)');
  assert.equal(quadrilleAlpha(INK_PARAMS.gridFadeZEnd), 1, 'at the named fade-end threshold, alpha is exactly 1 (fully resolved)');
  assert.equal(quadrilleAlpha(INK_PARAMS.gridFadeZEnd + 100), 1, 'past the fade-end, alpha saturates at 1 (never exceeds opaque)');
  assert.equal(quadrilleAlpha(-5), 0, 'a negative/degenerate z never yields a negative or NaN alpha');

  const mid = (INK_PARAMS.gridFadeZStart + INK_PARAMS.gridFadeZEnd) / 2;
  const aStart = quadrilleAlpha(INK_PARAMS.gridFadeZStart + 0.001);
  const aMid = quadrilleAlpha(mid);
  const aEnd = quadrilleAlpha(INK_PARAMS.gridFadeZEnd - 0.001);
  assert.ok(aStart < aMid && aMid < aEnd, 'quadrilleAlpha must be strictly monotonic increasing across the fade band (never a pop)');
});

test('U419-B: quadrilleAlpha is called with THE closest reachable view (Z_MAX) and is fully or nearly-fully opaque there — "at the closest view we need the graphpaper" must actually be true at the camera\'s own ceiling', () => {
  assert.ok(Z_MAX > INK_PARAMS.gridFadeZEnd, 'the fade-end threshold must sit BELOW the zoom ceiling — the grid resolves before you hit max zoom, not exactly at an unreachable edge');
  assert.equal(quadrilleAlpha(Z_MAX), 1, 'at the deepest reachable zoom (Z_MAX), the quadrille is fully opaque');
});

test('U419-C: the grid is invisible at the far/region/settlement bands (no regression — the quadrille never bleeds into the world/region view)', () => {
  const a = quadrilleAlpha(Z_MIN);
  assert.equal(a, 0, 'at Z_MIN (whole-world view), the quadrille must be invisible');
  // BAND.settlement/street-scale zoom (per worldSpace.js's BAND constants) must
  // also be well below the fade-start — the grid is a DEEP-zoom feature only.
  assert.ok(INK_PARAMS.gridFadeZStart > 4, 'the fade-start must sit above the street band (BAND.street=4) — the grid is a plan-legible-depth feature, not a street-level one');
});

test('U419-D: grid pitch equals CELL_FT through the pinned wu<->ft mapping — wuToFt(1 world unit) is EXACTLY CELL_FT feet (the grid draws one line per 1 wu in oneMap.js, so this is the actual on-screen pitch)', () => {
  assert.equal(wuToFt(1), CELL_FT, 'one world unit (the outdoor sheet\'s grid pitch) must equal exactly CELL_FT feet — the REAL 5-ft tactical square, not an invented scale');
});

test('U419-E: the wu<->ft conversion is exact and round-trips perfectly (no drift, no rounding surprises) — ftToWu(wuToFt(x)) === x for whole and fractional world-unit values', () => {
  for (const wu of [0, 1, 2, 5, 0.5, 3.25, 100, -4]) {
    const ft = wuToFt(wu);
    const back = ftToWu(ft);
    assert.equal(back, wu, `round-trip must be EXACT for wu=${wu} (got ft=${ft}, back=${back})`);
  }
  // And the reverse direction: ftToWu(CELL_FT) must be exactly 1 (one tactical
  // cell's worth of feet maps to exactly one world unit).
  assert.equal(ftToWu(CELL_FT), 1, 'CELL_FT feet must convert to exactly 1 world unit — the pinned identity this whole packet rests on');
});

test('U419-F: the wu<->ft identity is DERIVED, not invented — composing the two ALREADY-PINNED constants (tacticalPos.js\'s CELL_FT/PLACE_WU, worldSpace.js\'s PLACE_WU) by hand yields the SAME number wuToFt(1) returns, proving drawModel.js never re-derived its own conversion', () => {
  // One floorPlan layout unit = TAC_PLACE_WU cells (tacticalPos.js's pinned
  // conversion) = TAC_PLACE_WU * CELL_FT feet (also pinned).
  const ftPerLayoutUnit = TAC_PLACE_WU * CELL_FT;
  // That SAME layout unit = RENDER_PLACE_WU world units (worldSpace.js's own
  // pinned constant — interiorRoomToWu/structureWorldRect apply no additional
  // scale between a floorPlan layout unit and a wu).
  const ftPerWu = ftPerLayoutUnit / RENDER_PLACE_WU;
  assert.equal(ftPerWu, CELL_FT, 'composing the two independently-pinned constants by hand must land on CELL_FT exactly (this is an IDENTITY of existing pins, not a new number)');
  assert.equal(wuToFt(1), ftPerWu, 'drawModel.js\'s wuToFt(1) must equal the hand-composed value exactly — same conversion, not a parallel one');
});

test('U419-G: INK_PARAMS carries the quadrille tunables in the ONE ink-params place — named, finite, sane, fade-start strictly before fade-end', () => {
  assert.ok(Number.isFinite(INK_PARAMS.gridFadeZStart) && INK_PARAMS.gridFadeZStart > 0, 'gridFadeZStart must be a finite positive constant');
  assert.ok(Number.isFinite(INK_PARAMS.gridFadeZEnd) && INK_PARAMS.gridFadeZEnd > INK_PARAMS.gridFadeZStart, 'gridFadeZEnd must be finite and strictly greater than gridFadeZStart (a real band, not degenerate)');
  assert.ok(INK_PARAMS.gridMinorAlpha > 0 && INK_PARAMS.gridMinorAlpha < 1, 'gridMinorAlpha must be a faint (non-zero, non-opaque) value — "faint, under the ink"');
  assert.ok(INK_PARAMS.gridMajorAlpha > INK_PARAMS.gridMinorAlpha, 'the major (every-5th) rule must be more visible than the minor rule — matches handDrawnInterior.js\'s GMIN/GMAJ convention');
  assert.equal(typeof INK_PARAMS.gridRGB, 'string', 'gridRGB must be a defined color token (the teal quadrille rule, GRAPH_PAPER_UI.md)');
  assert.match(INK_PARAMS.gridRGB, /^92,\s*134,\s*120$/, 'gridRGB must be the teal hue GRAPH_PAPER_UI.md/handDrawnInterior.js\'s GMIN/GMAJ already use (92,134,120), not an invented color');
});

test('U419-J: quadrilleStroke composes the pinned teal RGB with the correct per-line alpha (minor vs major) scaled by the fade progress — explicit composition, not a string-hack on a baked color literal', () => {
  const minorAt50 = quadrilleStroke(false, 0.5);
  const majorAt50 = quadrilleStroke(true, 0.5);
  assert.equal(minorAt50, `rgba(${INK_PARAMS.gridRGB},${INK_PARAMS.gridMinorAlpha * 0.5})`, 'minor-line stroke must be the pinned RGB at gridMinorAlpha*fadeAlpha');
  assert.equal(majorAt50, `rgba(${INK_PARAMS.gridRGB},${INK_PARAMS.gridMajorAlpha * 0.5})`, 'major-line stroke must be the pinned RGB at gridMajorAlpha*fadeAlpha');
  assert.notEqual(minorAt50, majorAt50, 'a major (every-5th) line must render at a DIFFERENT (more visible) alpha than a minor line');
  // At full fade-in (alpha=1), the resulting alpha channel equals the raw named constant exactly.
  assert.equal(quadrilleStroke(false, 1), `rgba(${INK_PARAMS.gridRGB},${INK_PARAMS.gridMinorAlpha})`);
  assert.equal(quadrilleStroke(true, 1), `rgba(${INK_PARAMS.gridRGB},${INK_PARAMS.gridMajorAlpha})`);
  // At zero fade-in, alpha channel is exactly 0 (fully invisible).
  assert.equal(quadrilleStroke(false, 0), `rgba(${INK_PARAMS.gridRGB},0)`);
});

test('U419-H: worldHash is UNCHANGED by any quadrille computation (read-only proof — this is pure client-side rendering math, never engine state)', () => {
  const w = boot();
  const h0 = worldHash(w);
  quadrilleAlpha(INK_PARAMS.gridFadeZStart);
  quadrilleAlpha(INK_PARAMS.gridFadeZEnd);
  wuToFt(5);
  ftToWu(CELL_FT);
  const h1 = worldHash(w);
  assert.equal(h1, h0, 'deriving quadrille alpha/conversions must never mutate anything worldHash covers');
});

test('U419-I: quadrilleAlpha is a pure function — identical z yields identical alpha across independent calls (no hidden state, no drift)', () => {
  const zs = [0, 1, 5, 8, 10, 12, 16, 30, 60];
  for (const z of zs) {
    const a = quadrilleAlpha(z);
    const b = quadrilleAlpha(z);
    assert.equal(a, b, `quadrilleAlpha(${z}) must be identical across repeated calls`);
  }
});
