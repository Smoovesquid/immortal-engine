// U416 — TT-DRAW-2 one sizing truth (docs/briefs/TT-DRAW-2-one-sizing-truth.md).
// TT-DRAW landed the drawn-plan layer (drawnStructureModel, U409) but the live
// sheet had TWO sizing systems: the entered cottage drew at its TRUE
// structureWorldRect (~9.5x9.9 wu) while every unentered building still drew at
// the old catalog-art scale (placeFromNode.js's plans/index.js shapes, ~2-4x
// larger per axis, ~7-8x larger in area — the ROOT of the roof-overhang class:
// art bigger than footprint truth reads as a roof floating off its building).
//
// The fix (oneMap.js's drawLayout) is: for any building backed by a real engine
// structure (a `structureKey` resolving in drawnStructureModel), EVERY draw —
// roofed silhouette, furniture marks, room-name labels — fits INSIDE that
// structure's structureWorldRect, never the catalog footprint. The two new pure
// helpers this test locks down (drawModel.js, no canvas/DOM):
//   - catalogPlanBoundsInPlaceUnits(b): a catalog building entry's own bounding
//     box in place-units (rooms AND furniture — furniture anchors are ABSOLUTE
//     catalog-local coordinates, not room-relative, so a fixture near a plan
//     edge needs the wider box or it fits-projects outside the room-only bbox).
//   - fitCatalogPointToRect(catalogBounds, trueRect, px, py): re-maps a point
//     from the catalog bbox onto the SAME relative position inside the TRUE
//     world-unit rect — the "ONE sizing source" both entered (wall ink, via
//     drawnStructureModel directly) and unentered (roofed silhouette, via this
//     fit) building draws now share.
// Pure, deterministic, read-only — no engine writes, no Math.random, worldHash
// unchanged. Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { drawnStructureModel, catalogPlanBoundsInPlaceUnits, fitCatalogPointToRect } from '../public/map/drawModel.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

// Every structureKey-backed building at this node, paired with its
// drawnStructureModel entry (the ground truth both sizing paths must agree on).
function structureKeyedBuildings(w, nodeId) {
  const place = placeFromWorldNode(w, nodeId);
  const model = drawnStructureModel(w, nodeId);
  const byKey = new Map(model.structures.map(s => [s.structureKey, s]));
  return (place.buildings || [])
    .filter(b => b.structureKey && byKey.has(String(b.structureKey)))
    .map(b => ({ b, realPlan: byKey.get(String(b.structureKey)) }));
}

test('U416-A: precondition — the tallow boot node has at least one structureKey-backed building AND at least one structureless decorative one', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const place = placeFromWorldNode(w, nodeId);
  const keyed = place.buildings.filter(b => b.structureKey);
  const decorative = place.buildings.filter(b => !b.structureKey);
  assert.ok(keyed.length > 0, 'at least one building must be backed by a real engine structure');
  assert.ok(decorative.length > 0, 'precondition for the "no ground truth to clip to" branch: at least one decorative-only building must exist');
});

test('U416-B: catalogPlanBoundsInPlaceUnits covers every room AND every furniture anchor (not room-only)', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const pairs = structureKeyedBuildings(w, nodeId);
  assert.ok(pairs.length > 0);
  for (const { b } of pairs) {
    const bounds = catalogPlanBoundsInPlaceUnits(b);
    assert.ok(bounds.maxX > bounds.minX && bounds.maxY > bounds.minY, 'catalog bounds must have positive extent');
    for (const r of (b.plan?.rooms || [])) {
      const rw = (r.w ?? (r.r ?? 1) * 2), rh = (r.h ?? (r.r ?? 1) * 2);
      const x0 = b.ox + r.cx - rw / 2, x1 = b.ox + r.cx + rw / 2, y0 = b.oy + r.cy - rh / 2, y1 = b.oy + r.cy + rh / 2;
      assert.ok(x0 >= bounds.minX - 1e-9 && x1 <= bounds.maxX + 1e-9, `room ${r.id} x-extent must be covered by catalog bounds`);
      assert.ok(y0 >= bounds.minY - 1e-9 && y1 <= bounds.maxY + 1e-9, `room ${r.id} y-extent must be covered by catalog bounds`);
    }
    for (const f of (b.plan?.furniture || [])) {
      const x0 = b.ox + f.ux, x1 = x0 + (f.uw || 0), y0 = b.oy + f.uy, y1 = y0 + (f.uh || 0);
      assert.ok(x0 >= bounds.minX - 1e-9 && x1 <= bounds.maxX + 1e-9, `furniture ${f.type} x-extent must be covered by catalog bounds`);
      assert.ok(y0 >= bounds.minY - 1e-9 && y1 <= bounds.maxY + 1e-9, `furniture ${f.type} y-extent must be covered by catalog bounds`);
    }
  }
});

test('U416-C: sizing unification — every fitted catalog point (room corners + furniture corners) lands INSIDE its structureWorldRect (no overhang, no exceptions)', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const pairs = structureKeyedBuildings(w, nodeId);
  assert.ok(pairs.length > 0, 'precondition: at least one structureKey-backed building at the boot node');

  const inside = (p, rect) => p.wx >= rect.minX - 1e-6 && p.wx <= rect.maxX + 1e-6 && p.wy >= rect.minY - 1e-6 && p.wy <= rect.maxY + 1e-6;

  let furnitureChecked = 0;
  for (const { b, realPlan } of pairs) {
    const bounds = catalogPlanBoundsInPlaceUnits(b);
    // The bbox's own corners must fit exactly to the true rect's corners (by construction).
    const c0 = fitCatalogPointToRect(bounds, realPlan.rect, bounds.minX, bounds.minY);
    const c1 = fitCatalogPointToRect(bounds, realPlan.rect, bounds.maxX, bounds.maxY);
    assert.ok(Math.abs(c0.wx - realPlan.rect.minX) < 1e-6, 'catalog bbox min-x fits exactly to true rect min-x');
    assert.ok(Math.abs(c0.wy - realPlan.rect.minY) < 1e-6, 'catalog bbox min-y fits exactly to true rect min-y');
    assert.ok(Math.abs(c1.wx - realPlan.rect.maxX) < 1e-6, 'catalog bbox max-x fits exactly to true rect max-x');
    assert.ok(Math.abs(c1.wy - realPlan.rect.maxY) < 1e-6, 'catalog bbox max-y fits exactly to true rect max-y');

    // Every room's fitted corners land inside the true rect (the roofed-state silhouette source).
    for (const r of (b.plan?.rooms || [])) {
      const rw = (r.w ?? (r.r ?? 1) * 2), rh = (r.h ?? (r.r ?? 1) * 2);
      const p0 = fitCatalogPointToRect(bounds, realPlan.rect, b.ox + r.cx - rw / 2, b.oy + r.cy - rh / 2);
      const p1 = fitCatalogPointToRect(bounds, realPlan.rect, b.ox + r.cx + rw / 2, b.oy + r.cy + rh / 2);
      assert.ok(inside(p0, realPlan.rect) && inside(p1, realPlan.rect), `room ${r.id}'s fitted corners must land inside structureWorldRect`);
    }
    // Every furniture item's fitted corners land inside the true rect.
    for (const f of (b.plan?.furniture || [])) {
      const p0 = fitCatalogPointToRect(bounds, realPlan.rect, b.ox + f.ux, b.oy + f.uy);
      const p1 = fitCatalogPointToRect(bounds, realPlan.rect, b.ox + f.ux + (f.uw || 0.6), b.oy + f.uy + (f.uh || 0.6));
      assert.ok(inside(p0, realPlan.rect) && inside(p1, realPlan.rect), `furniture ${f.type}'s fitted corners must land inside structureWorldRect`);
      furnitureChecked++;
    }
  }
  assert.ok(furnitureChecked > 0, 'precondition: at least one furniture item was actually checked (not a vacuously-true pass)');
});

test('U416-D: entered AND unentered share the SAME sizing source — the room set drawnStructureModel inks (entered walls) matches the room set the catalog fit targets (unentered silhouette), same rect', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const structureKey = String(w.scene.interior.structureKey);
  const pairs = structureKeyedBuildings(w, nodeId);
  const entry = pairs.find(p => String(p.b.structureKey) === structureKey);
  assert.ok(entry, 'the structure the player booted inside must be among the structureKey-backed buildings');

  const { b, realPlan } = entry;
  // The rect the ENTERED path inks walls against (realPlan.rooms/.rect from
  // drawnStructureModel) is the exact SAME rect object the UNENTERED path fits
  // catalog art into (fitCatalogPointToRect's second argument) — one sizing
  // source, not two independently-computed sizes that happen to agree today.
  const bounds = catalogPlanBoundsInPlaceUnits(b);
  const roofCorner = fitCatalogPointToRect(bounds, realPlan.rect, bounds.maxX, bounds.maxY);
  assert.equal(roofCorner.wx, realPlan.rect.maxX, 'the unentered roofed silhouette\'s far corner is DEFINED as the entered structure\'s own rect corner');
  assert.equal(roofCorner.wy, realPlan.rect.maxY, 'same, y-axis — literally the same number, not a coincidentally-matching one');

  // And every real room (the entered wall-ink source) lies inside that same rect.
  assert.ok(realPlan.rooms.length > 0);
  for (const r of realPlan.rooms) {
    assert.ok(r.wx >= realPlan.rect.minX - 1e-6 && r.wx <= realPlan.rect.maxX + 1e-6, 'entered room center inside the shared rect (x)');
    assert.ok(r.wy >= realPlan.rect.minY - 1e-6 && r.wy <= realPlan.rect.maxY + 1e-6, 'entered room center inside the shared rect (y)');
  }
});

test('U416-E: two independent builds of the same seed produce IDENTICAL catalog bounds and fitted points (determinism x2)', () => {
  const project = () => {
    const w = boot();
    const nodeId = String(w.map.currentNodeId);
    const pairs = structureKeyedBuildings(w, nodeId);
    return pairs.map(({ b, realPlan }) => {
      const bounds = catalogPlanBoundsInPlaceUnits(b);
      const fitted = (b.plan?.furniture || []).map(f => fitCatalogPointToRect(bounds, realPlan.rect, b.ox + f.ux, b.oy + f.uy));
      return { structureKey: b.structureKey, bounds, rect: realPlan.rect, fitted };
    });
  };
  const a = project();
  const b2 = project();
  assert.ok(a.length > 0, 'precondition: at least one structureKey-backed building to compare');
  assert.deepEqual(b2, a, 'the same seed must yield identical catalog bounds + fitted points, every build');
});

test('U416-F: worldHash is UNCHANGED by the sizing helpers (read-only proof)', () => {
  const w = boot();
  const h0 = worldHash(w);
  const nodeId = String(w.map.currentNodeId);
  const pairs = structureKeyedBuildings(w, nodeId);
  for (const { b, realPlan } of pairs) {
    const bounds = catalogPlanBoundsInPlaceUnits(b);
    fitCatalogPointToRect(bounds, realPlan.rect, b.ox, b.oy);
  }
  const h1 = worldHash(w);
  assert.equal(h1, h0, 'deriving catalog bounds / fitted points must never mutate anything worldHash covers');
});

test('U416-G: a structureless decorative building (no structureKey) has NO structureWorldRect to fit against — never fabricated, always the explicit skip case', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const place = placeFromWorldNode(w, nodeId);
  const model = drawnStructureModel(w, nodeId);
  const byKey = new Map(model.structures.map(s => [s.structureKey, s]));
  const decorative = place.buildings.filter(b => !b.structureKey);
  assert.ok(decorative.length > 0, 'precondition: at least one decorative-only building exists at the boot node');
  for (const b of decorative) {
    assert.equal(byKey.get(String(b.structureKey)), undefined, 'a decorative building must never resolve a drawnStructureModel entry (no fabricated rect)');
  }
});
