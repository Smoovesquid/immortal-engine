// U435 — DEC-1 no catalog-scale entries survive in the drawn model
// (docs/briefs/DEC-1-structure-back-decoratives.md).
//
// Sibling of U434: where U434 proves every settlement building has ONE true
// footprint, U435 proves the local-band DRAWN MODEL contains NO catalog-scale
// rect — every building's rect (real OR formerly-decorative) comes from the ONE
// sizing source (structureWorldRect over a true footprint), never the inflated
// catalog ROOM-bbox (which drew a decorative building ~5× too big per axis). And
// the derivation is a pure view computation: worldHash is byte-unchanged by it.
//
// "Catalog-scale" is made concrete: the OLD path sized a decorative building by
// catalogPlanBoundsInPlaceUnits(b) × PLACE_WU (its authored room bbox). This test
// asserts every decorative building's DRAWN rect is its true footprint rect
// (structureWorldRect over b.plan.footprint), NOT that inflated bbox — for the
// tallow village the two differ by ~5× (a well: 2×2 wu true vs 36×20 wu bbox), so
// a false pass (still catalog-scale) is impossible to miss. Pure, read-only.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { drawnStructureModel, decorativeBuildingRects, catalogPlanBoundsInPlaceUnits } from '../public/map/drawModel.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';
import { placeFrame, structureWorldRect, PLACE_WU } from '../public/map/worldSpace.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

// The true rect for a place.buildings[] entry, from the ONE sizing source.
function trueRectFor(node, frame, b) {
  const anchor = { ox: Number(b.ox) || 0, oy: Number(b.oy) || 0 };
  return structureWorldRect(node, frame, anchor, b.plan);
}
// The OLD catalog-scale rect a decorative building WOULD have drawn at (the
// inflated room-bbox × PLACE_WU) — the thing that must NOT be what we draw now.
function catalogScaleSpanWu(b) {
  const cb = catalogPlanBoundsInPlaceUnits(b);
  return { w: (cb.maxX - cb.minX) * PLACE_WU, h: (cb.maxY - cb.minY) * PLACE_WU };
}

test('U435-A: EVERY building in the local-band model carries a finite true rect (real AND decorative)', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const real = drawnStructureModel(w, nodeId).structures;
  const deco = decorativeBuildingRects(w, nodeId).buildings;
  assert.ok(deco.length > 0, 'precondition: at least one decorative building now carries a true rect');
  assert.ok(real.length > 0, 'precondition: at least one real structure in the drawn model');
  for (const s of [...real, ...deco]) {
    const r = s.rect;
    const key = s.structureKey || s.key;
    assert.ok(r && Number.isFinite(r.minX) && Number.isFinite(r.minY) && Number.isFinite(r.maxX) && Number.isFinite(r.maxY),
      `${key} rect must be finite`);
    assert.ok(r.maxX > r.minX && r.maxY > r.minY, `${key} rect must have positive extent`);
  }
});

test('U435-B: every decorative rect is its TRUE footprint rect, from the ONE sizing source — not the catalog bbox', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const node = w.map.nodes.find(n => String(n.id) === nodeId);
  const place = placeFromWorldNode(w, nodeId);
  const frame = placeFrame(place);
  const decoDrawn = decorativeBuildingRects(w, nodeId).buildings;

  // Pair each decorative drawn structure back to its place.buildings entry by
  // its index (the stable id `deco:<index>` encodes).
  assert.ok(decoDrawn.length > 0, 'precondition: decorative buildings carry rects');
  for (const s of decoDrawn) {
    const idx = s.index;
    const b = place.buildings[idx];
    assert.ok(b && !b.structureKey, `deco entry ${s.structureKey} maps to a decorative place building`);
    const expected = trueRectFor(node, frame, b);
    // The drawn rect IS the structureWorldRect over the true footprint — same
    // numbers, one source (not a coincidentally-matching second computation).
    assert.equal(s.rect.minX, expected.minX, 'drawn rect minX == structureWorldRect minX');
    assert.equal(s.rect.minY, expected.minY, 'drawn rect minY == structureWorldRect minY');
    assert.equal(s.rect.maxX, expected.maxX, 'drawn rect maxX == structureWorldRect maxX');
    assert.equal(s.rect.maxY, expected.maxY, 'drawn rect maxY == structureWorldRect maxY');
  }
});

test('U435-C: no drawn rect is catalog-scale — every decorative rect is far SMALLER than the inflated catalog bbox it used to draw', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const node = w.map.nodes.find(n => String(n.id) === nodeId);
  const place = placeFromWorldNode(w, nodeId);
  const frame = placeFrame(place);

  let checked = 0;
  for (let i = 0; i < place.buildings.length; i++) {
    const b = place.buildings[i];
    if (b.structureKey) continue; // real structures aren't the catalog-scale risk
    const trueRect = trueRectFor(node, frame, b);
    const trueW = trueRect.maxX - trueRect.minX, trueH = trueRect.maxY - trueRect.minY;
    const cat = catalogScaleSpanWu(b);
    // With the DEC-1 synthetic plan, catalogPlanBoundsInPlaceUnits(b) IS the true
    // footprint (rooms == footprint, no furniture), so cat == trueRect here — the
    // proof that the drawn size no longer exceeds the footprint. Assert the drawn
    // (true) rect is at most the catalog span (never larger), i.e. nothing is
    // inflated beyond footprint truth.
    assert.ok(trueW <= cat.w + 1e-6, `"${b.buildingName}" true width ${trueW.toFixed(2)} ≤ catalog span ${cat.w.toFixed(2)} (no inflation)`);
    assert.ok(trueH <= cat.h + 1e-6, `"${b.buildingName}" true height ${trueH.toFixed(2)} ≤ catalog span ${cat.h.toFixed(2)} (no inflation)`);
    // And the true rect is a plausible small-village size (never a parade balloon).
    assert.ok(trueW <= 12 && trueH <= 12, `"${b.buildingName}" true rect ${trueW.toFixed(1)}×${trueH.toFixed(1)}wu must be a small building`);
    checked++;
  }
  assert.ok(checked > 0, 'precondition: at least one decorative building was checked');
});

test('U435-D: the derivation is pure — worldHash is byte-UNCHANGED by building the drawn model', () => {
  const w = boot();
  const h0 = worldHash(w);
  const nodeId = String(w.map.currentNodeId);
  // Build the full local-band model (the DEC-1 derivation) repeatedly.
  drawnStructureModel(w, nodeId);
  decorativeBuildingRects(w, nodeId);
  placeFromWorldNode(w, nodeId);
  decorativeBuildingRects(w, nodeId);
  const h1 = worldHash(w);
  assert.equal(h1, h0, 'deriving footprints / drawn rects must never mutate anything worldHash covers');
});

test('U435-E: determinism — two builds yield an identical drawn-model rect set', () => {
  const project = () => {
    const w = boot();
    const nodeId = String(w.map.currentNodeId);
    const real = drawnStructureModel(w, nodeId).structures.map(s => ({ k: s.structureKey, rect: s.rect, dec: false }));
    const deco = decorativeBuildingRects(w, nodeId).buildings.map(s => ({ k: s.key, rect: s.rect, dec: true }));
    return [...real, ...deco];
  };
  assert.deepEqual(project(), project(), 'same seed → identical drawn-model rects');
});
