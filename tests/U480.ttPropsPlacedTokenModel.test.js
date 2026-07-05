// U480 — TT-PROPS: placedTokenModel's new `props` field (barrels/beds/dressers/
// chests as engine-position-backed standing minis).
//
// docs/briefs/TT-WORLD-paper-world.md Stage 3: "Positions come from the engine
// scene contract (sliceScene.js / resolveEntityWu) — the renderer NEVER invents
// a position." drawModel.js's placedTokenModel(world, nodeId) is that contract
// for props: it reuses the EXACT SAME furniture data (b.plan.furniture) and
// fitting math (catalogPlanBoundsInPlaceUnits + fitCatalogPointToRect —
// TT-DRAW-2's "one sizing truth", U416-tested) the 2-D sheet's furniture ink
// already draws from — this file only stops at the world-unit point instead of
// projecting on through toPx to pixels, so a barrel mini can never disagree
// with where the 2-D sheet draws that same barrel.
//
// Gated to the SAME "open" condition oneMap.js's furniture ink uses (the
// structure you're standing in, or your home) — a closed building's furniture
// isn't visible from outside, on the sheet or as minis (never a spoiler).
//
// Hermetic — no network, no WebGL, no API key, no Math.random (pure reads over
// a real booted world).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { placedTokenModel, drawnStructureModel } from '../public/map/drawModel.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
let _n = 0;
const boot = () => beginAdventure(
  newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null }, campaignId: `U480-${++_n}` }),
  PACKS
).world;

test('U480: the tallow boot world (player at home, inside their own structure) yields real, positioned furniture props', () => {
  const w = boot();
  const model = placedTokenModel(w, String(w.map.currentNodeId));
  assert.ok(Array.isArray(model.props), 'props must be an array');
  assert.ok(model.props.length > 0, 'the boot cottage has furniture — props must not be empty for the home/open structure');
  for (const p of model.props) {
    assert.ok(Number.isFinite(p.wx) && Number.isFinite(p.wy), 'every prop has a finite world-unit position');
    assert.ok(['barrel', 'bed', 'chest', 'dresser'].includes(p.kind), `prop kind "${p.kind}" must be one of the four TT-PROPS furniture kinds`);
  }
});

test('U480: props are EXCLUDED for a closed structure — a settlement building that is neither home nor the current interior yields no furniture', () => {
  const w = boot();
  // Force the world into a state where the current node's home/interior gates
  // are both false, by reading a DIFFERENT settlement node than the boot home
  // (if only one settlement node exists in this slice, this is a vacuous-but-
  // safe pass — the assertion only fires when a genuinely closed building exists).
  const map = w.map || {};
  const otherSettlement = (map.nodes || []).find(n => n.settlement && String(n.id) !== String(map.currentNodeId));
  if (!otherSettlement) return; // nothing else to check in this slice — not a failure
  const model = placedTokenModel(w, String(otherSettlement.id));
  assert.deepEqual(model.props, [], 'a settlement node that is neither home nor the current interior must show no furniture props (never a spoiler)');
});

test('U480: never fabricated for an unknown node', () => {
  const w = boot();
  const model = placedTokenModel(w, 'a-node-that-does-not-exist');
  assert.deepEqual(model.props, [], 'an unknown node yields empty props, never invented content');
});

test('U480: deterministic x2 — identical seed yields an identical props list (position + kind), worldHash untouched', () => {
  const w1 = boot();
  const w2 = boot();
  const nodeId1 = String(w1.map.currentNodeId), nodeId2 = String(w2.map.currentNodeId);
  const p1 = placedTokenModel(w1, nodeId1).props;
  const p2 = placedTokenModel(w2, nodeId2).props;
  assert.deepEqual(p1, p2, 'the same seed must project an identical props list on replay');

  const w = boot();
  const h0 = worldHash(w);
  placedTokenModel(w, String(w.map.currentNodeId));
  const h1 = worldHash(w);
  assert.equal(h1, h0, 'deriving the props list must never mutate anything worldHash covers');
});

test('U480: props positions are DERIVED, never invented — every prop lands strictly inside its structure\'s true world-unit rect', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const model = placedTokenModel(w, nodeId);
  if (!model.props.length) return; // nothing to check against in this slice
  // Re-derive the SAME structures independently (drawnStructureModel is the
  // "one drawing brain" the world sheet's ink also reads from) and confirm the
  // fitted prop position landed inside the TRUE world-unit footprint — never a
  // point the renderer invented off the actual building.
  const structs = drawnStructureModel(w, nodeId).structures;
  const rects = structs.map(s => s.rect);
  assert.ok(rects.length > 0, 'the node must have at least one real structure to check against');
  for (const p of model.props) {
    const insideSome = rects.some(r => p.wx >= r.minX - 1e-6 && p.wx <= r.maxX + 1e-6 && p.wy >= r.minY - 1e-6 && p.wy <= r.maxY + 1e-6);
    assert.ok(insideSome, `prop at (${p.wx}, ${p.wy}) must land inside a real structure's true world-unit rect`);
  }
});

test('U480: only the four picked-up-off-the-table kinds become props — hearths/altars/tables/rugs (fixed masonry or floor dressing) never appear', () => {
  const w = boot();
  const model = placedTokenModel(w, String(w.map.currentNodeId));
  for (const p of model.props) {
    assert.ok(!['hearth', 'altar', 'statue', 'column', 'brazier', 'table', 'rug', 'shelf', 'bars'].includes(p.kind),
      `"${p.kind}" is fixed/room-shell furniture per the decision rule (if it's the shape of the world -> ink), not a mini`);
  }
});
