// U434 — DEC-1 every settlement building has ONE true footprint
// (docs/briefs/DEC-1-structure-back-decoratives.md).
//
// The gap TT-DRAW-2 flagged and U416-G documented: a DECORATIVE-only settlement
// building (tallow's well / workshop / smithy — a `node.settlement.buildings[]`
// entry with NO `world.structures.byId` record) had no `structureWorldRect` to
// size against, so the outdoor sheet drew it at the OLD catalog-art scale — the
// catalog plan's ROOM bounding box (a "well" even mapped, by name-fallback, to a
// whole cottage: 36×20 wu vs the true cottage's ≈6.8×7.2 wu, ~15× the area). The
// last visible root of the "parade-balloon neighbour" class.
//
// DEC-1's fix (option (a) — a canonical per-type footprint TABLE, pure, seed-
// stable, NO world-state writes): every settlement building resolves to exactly
// ONE finite footprint (layout units) from ONE source
// (engine/structures/settlementFootprint.js), consumed BOTH by the village layout
// (placeFromNode's syntheticPlanForBuilding — so the DRAWN art is that footprint)
// AND by drawnStructureModel (a true world-unit rect for every building). This
// test locks: the well is SMALL (≤ ~2×2 cells), every building's footprint is
// finite and positive, and NO drawn art on any building exceeds its footprint
// (U416-C's assertion, now extended to the formerly-decorative set). Deterministic
// ×2. Pure, read-only — no engine writes, no Math.random, hermetic.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import {
  settlementBuildingFootprint, syntheticPlanForBuilding, SETTLEMENT_FOOTPRINTS, DEFAULT_FOOTPRINT
} from '../engine/structures/settlementFootprint.js';
import { drawnStructureModel, decorativeBuildingRects, catalogPlanBoundsInPlaceUnits, fitCatalogPointToRect } from '../public/map/drawModel.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';
import { placeFrame, structureWorldRect, PLACE_WU } from '../public/map/worldSpace.js';
import { wuToFt } from '../public/map/drawModel.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

// One cell = one wu = CELL_FT ft (drawModel.wuToFt): the "≤ ~2×2 cells" bound for
// a well is ≤ 2×2 wu. In footprint (layout) units that is ≤ 0.5×0.5 (× PLACE_WU).
const CELL_WU = wuToFt(1) / wuToFt(1); // == 1 wu per cell, kept explicit
const WELL_MAX_CELLS = 2;

test('U434-A: the table is well-formed — every entry (and the default) is finite and positive', () => {
  for (const [type, fp] of Object.entries(SETTLEMENT_FOOTPRINTS)) {
    assert.ok(Number.isFinite(fp.w) && fp.w > 0, `${type}.w finite positive`);
    assert.ok(Number.isFinite(fp.h) && fp.h > 0, `${type}.h finite positive`);
  }
  assert.ok(Number.isFinite(DEFAULT_FOOTPRINT.w) && DEFAULT_FOOTPRINT.w > 0);
  assert.ok(Number.isFinite(DEFAULT_FOOTPRINT.h) && DEFAULT_FOOTPRINT.h > 0);
});

test('U434-B: precondition — the tallow boot node has decorative-only settlement buildings (the class DEC-1 sizes)', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const place = placeFromWorldNode(w, nodeId);
  const decorative = (place.buildings || []).filter(b => !b.structureKey);
  assert.ok(decorative.length > 0, 'at least one decorative-only building must exist at the boot node');
  // And at least one is a "well" (the smallest-footprint case, the ≤2×2 bound).
  const names = decorative.map(b => String(b.buildingName || '').toLowerCase());
  assert.ok(names.some(n => n.includes('well')), 'the tallow village has a well (the small-feature case)');
});

test('U434-C: every settlement building resolves to exactly ONE finite footprint from the ONE source', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const node = w.map.nodes.find(n => String(n.id) === nodeId);
  const raw = (node.settlement && node.settlement.buildings) || [];
  assert.ok(raw.length > 0, 'precondition: the boot node is a settlement with buildings');
  for (const b of raw) {
    const fp = settlementBuildingFootprint(b.name);
    assert.ok(fp && Number.isFinite(fp.w) && fp.w > 0 && Number.isFinite(fp.h) && fp.h > 0,
      `settlement building "${b.name}" must resolve to one finite positive footprint`);
    // The synthetic plan the layout seats is sized to EXACTLY that footprint —
    // one source, no second independently-computed size.
    const plan = syntheticPlanForBuilding(b.name);
    assert.equal(plan.footprint.w, fp.w, `synthetic plan footprint.w == table footprint for "${b.name}"`);
    assert.equal(plan.footprint.h, fp.h, `synthetic plan footprint.h == table footprint for "${b.name}"`);
  }
});

test('U434-D: the well is SMALL — ≤ ~2×2 cells (never a whole house)', () => {
  const fp = settlementBuildingFootprint('well');
  const wCells = (fp.w * PLACE_WU) / CELL_WU, hCells = (fp.h * PLACE_WU) / CELL_WU;
  assert.ok(wCells <= WELL_MAX_CELLS + 1e-9, `well width ${wCells} cells must be ≤ ${WELL_MAX_CELLS}`);
  assert.ok(hCells <= WELL_MAX_CELLS + 1e-9, `well height ${hCells} cells must be ≤ ${WELL_MAX_CELLS}`);
  // Live: the actual drawn rect of every "well" building at the boot node is ≤2×2 wu.
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const deco = decorativeBuildingRects(w, nodeId);
  const wells = deco.buildings.filter(s => String(s.name).toLowerCase().includes('well'));
  assert.ok(wells.length > 0, 'the decorative rect model has at least one well');
  for (const s of wells) {
    assert.ok((s.rect.maxX - s.rect.minX) <= 2 * CELL_WU + 1e-6, 'drawn well rect width ≤ 2 cells');
    assert.ok((s.rect.maxY - s.rect.minY) <= 2 * CELL_WU + 1e-6, 'drawn well rect height ≤ 2 cells');
  }
});

test('U434-E: NO drawn art exceeds its footprint — every building (U416-C extended to the whole set)', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const place = placeFromWorldNode(w, nodeId);
  const frame = placeFrame(place);
  const node = w.map.nodes.find(n => String(n.id) === nodeId);
  const inside = (p, rect) => p.wx >= rect.minX - 1e-6 && p.wx <= rect.maxX + 1e-6 && p.wy >= rect.minY - 1e-6 && p.wy <= rect.maxY + 1e-6;

  let checked = 0;
  for (const b of (place.buildings || [])) {
    // The building's TRUE rect: for a decorative building this is
    // structureWorldRect over its (synthetic) footprint — the SAME rect
    // drawnStructureModel emits and the sheet clamps art to.
    const anchor = { ox: Number(b.ox) || 0, oy: Number(b.oy) || 0 };
    const rect = structureWorldRect(node, frame, anchor, b.plan);
    const bounds = catalogPlanBoundsInPlaceUnits(b);
    // Every room corner AND every furniture corner, fitted to the true rect,
    // lands INSIDE it (no overhang) — the roof/silhouette can never exceed the
    // footprint truth.
    for (const r of (b.plan?.rooms || [])) {
      const rw = (r.w ?? (r.r ?? 1) * 2), rh = (r.h ?? (r.r ?? 1) * 2);
      const p0 = fitCatalogPointToRect(bounds, rect, b.ox + r.cx - rw / 2, b.oy + r.cy - rh / 2);
      const p1 = fitCatalogPointToRect(bounds, rect, b.ox + r.cx + rw / 2, b.oy + r.cy + rh / 2);
      assert.ok(inside(p0, rect) && inside(p1, rect), `room ${r.id} of "${b.name || b.buildingName}" fits inside its true rect`);
      checked++;
    }
    for (const f of (b.plan?.furniture || [])) {
      const p0 = fitCatalogPointToRect(bounds, rect, b.ox + f.ux, b.oy + f.uy);
      const p1 = fitCatalogPointToRect(bounds, rect, b.ox + f.ux + (f.uw || 0.6), b.oy + f.uy + (f.uh || 0.6));
      assert.ok(inside(p0, rect) && inside(p1, rect), `furniture ${f.type} of "${b.name || b.buildingName}" fits inside its true rect`);
      checked++;
    }
  }
  assert.ok(checked > 0, 'precondition: at least one room/furniture corner was actually checked (not vacuous)');
});

test('U434-F: the parade balloon is gone — no decorative building draws bigger than the true cottage did', () => {
  // Regression floor for Tim's sighting: pre-DEC-1 a decorative well/workshop
  // drew at 32-36 wu wide (5× the true cottage). Assert every decorative rect is
  // now within a sane multiple of the real structure's rect at this node.
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const real = drawnStructureModel(w, nodeId).structures;
  const deco = decorativeBuildingRects(w, nodeId).buildings;
  assert.ok(real.length > 0 && deco.length > 0, 'precondition: both a real structure and decorative buildings present');
  const realMaxSpan = Math.max(...real.map(s => Math.max(s.rect.maxX - s.rect.minX, s.rect.maxY - s.rect.minY)));
  for (const s of deco) {
    const span = Math.max(s.rect.maxX - s.rect.minX, s.rect.maxY - s.rect.minY);
    // A craft building may be a touch larger than a cottage, but never a parade
    // balloon: cap at 1.5× the real structure's largest span (pre-DEC-1 was ~5×).
    assert.ok(span <= realMaxSpan * 1.5 + 1e-6, `decorative "${s.name}" span ${span.toFixed(1)}wu must be ≤ 1.5× the real cottage span ${realMaxSpan.toFixed(1)}wu`);
  }
});

test('U434-G: two independent builds of the same seed produce IDENTICAL footprints and drawn rects (determinism ×2)', () => {
  const project = () => {
    const w = boot();
    const nodeId = String(w.map.currentNodeId);
    const real = drawnStructureModel(w, nodeId).structures.map(s => ({ key: s.structureKey, rect: s.rect, decorative: false }));
    const deco = decorativeBuildingRects(w, nodeId).buildings.map(s => ({ key: s.key, rect: s.rect, decorative: true }));
    return [...real, ...deco];
  };
  const a = project();
  const b2 = project();
  assert.ok(a.length > 0, 'precondition: at least one building in the combined model');
  assert.deepEqual(b2, a, 'same seed → identical footprints + rects, every build');
});
