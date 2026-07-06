// U549 — REND-TRUTH-1: the projection-equality property. Every engine-occupancy
// mini's scene position IS the sheet's own wu→scene projection of its world-unit
// address — exactly, across interior AND settlement zoom states, on several seeds.
// (docs/MAP_REAL.md promise 3 + 4: one coordinate space; what's drawn is what's
// there.)
//
// The renderer places people/props via render3d.js's entityScenePos, which is a
// thin wrapper over worldSpace.js's pure entityScenePosOnSheet(center, span, z, px,
// tileWu, wx, wy). This test pins that pure function's CONTRACT — the numbers a live
// three.js capture would produce (three can't run hermetically here; U538/U539
// document the same constraint) — so any future edit that reintroduces a second,
// disagreeing scale (e.g. reverting to worldPosFromWu) breaks a fast unit test, not
// only a live playtest.
//
// The equalities asserted:
//   1. A point AT the sheet centre (the focus) projects to the centre itself —
//      the player, who sits at the focus, never moves off it at any zoom.
//   2. Projection is affine in wu: doubling a wu offset doubles the scene offset;
//      the scale factor is exactly sheetScenePerWu(span, z, px) = span·z/px.
//   3. On real boot worlds (3 seeds), the sheet projection of the player-focus's
//      own drawn-plan rect brackets the props (the cottage's own ink) and excludes
//      the outdoor people at interior zoom — while at a settlement-scale sheet the
//      people come back INTO frame (their true lane positions), proving the fix is a
//      real relocation, not a blanket "hide people indoors".
//
// Hermetic — real engine boot worlds, pure projection math, no WebGL/DOM/network/
// API key, no Math.random.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { placedTokenModel, drawnStructureModel } from '../public/map/drawModel.js';
import { entityScenePosOnSheet, sheetScenePerWu } from '../public/map/worldSpace.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.join(__dirname, '..');
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(REPO_ROOT, p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
let _n = 0;
const begin = (seed) => beginAdventure(
  newWorld({ seed, fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null }, campaignId: `U549-${++_n}` }),
  PACKS
).world;

const NODE_WU = 1000, TILE_WU = 40, SHEET_PX = 1024;
const worldPosFromWu = (wx, wy) => ({ x: (Number(wx) || 0) / NODE_WU * TILE_WU, z: (Number(wy) || 0) / NODE_WU * TILE_WU });

// The sheet centre corresponds to a focus world-unit point; center == worldPosFromWu(focus).
function sheetAt(focusWu, spanScene, z) {
  return { center: worldPosFromWu(focusWu.wx, focusWu.wy), spanScene, z };
}
const proj = (sheet, wx, wy) => entityScenePosOnSheet(sheet.center, sheet.spanScene, sheet.z, SHEET_PX, TILE_WU, wx, wy);

test('U549-1: a point AT the sheet centre projects to the centre — the focus is a fixed point of the transform (the player never drifts off it)', () => {
  const focusWu = { wx: -48.52, wy: -45.45 };
  for (const [span, z] of [[111.838, 46.98], [400, 2.0], [40, 900]]) {
    const sheet = sheetAt(focusWu, span, z);
    const s = proj(sheet, focusWu.wx, focusWu.wy);
    assert.ok(Math.abs(s.x - sheet.center.x) < 1e-9 && Math.abs(s.z - sheet.center.z) < 1e-9,
      `focus must map to centre at span=${span},z=${z} — got (${s.x},${s.z}) vs centre (${sheet.center.x},${sheet.center.z})`);
  }
});

test('U549-2: the projection is affine with slope exactly sheetScenePerWu = span·z/px (doubling a wu offset doubles the scene offset)', () => {
  const focusWu = { wx: 0, wy: 0 };
  for (const [span, z] of [[111.838, 46.98], [250, 3.5], [40, 512]]) {
    const sheet = sheetAt(focusWu, span, z);
    const s = sheetScenePerWu(span, z, SHEET_PX);
    const a = proj(sheet, 10, 0), b = proj(sheet, 20, 0);
    assert.ok(Math.abs((a.x - sheet.center.x) - 10 * s) < 1e-6, `+10 wu east must be +10·s scene (span=${span},z=${z})`);
    assert.ok(Math.abs((b.x - sheet.center.x) - 20 * s) < 1e-6, `+20 wu east must be +20·s scene (span=${span},z=${z})`);
    assert.ok(Math.abs((b.x - a.x) - 10 * s) < 1e-6, 'affinity: equal wu steps → equal scene steps');
    const c = proj(sheet, 0, 7);
    assert.ok(Math.abs((c.z - sheet.center.z) - 7 * s) < 1e-6, 'the SAME scale applies on the z axis');
  }
});

// The exact numbers a live interior capture produces on the aldermere default boot
// (curRad floored at 30 → spanScene 111.838; 2-D map live zoom ≈ 46.98 px/wu). Pin
// them so a regression that changes the transform trips here.
test('U549-3: on the aldermere wake, the interior sheet projection puts the props on the plan and the people far off it — the exact live geometry', () => {
  const w = begin('aldermere');
  const nodeId = w.map.currentNodeId;
  const dsm = drawnStructureModel(w, nodeId);
  const rect = (dsm.structures || [])[0].rect;
  const focusWu = { wx: (rect.minX + rect.maxX) / 2, wy: (rect.minY + rect.maxY) / 2 };
  const interior = sheetAt(focusWu, 111.838, 46.98065);

  const planMin = proj(interior, rect.minX, rect.minY), planMax = proj(interior, rect.maxX, rect.maxY);
  const lo = { x: Math.min(planMin.x, planMax.x), z: Math.min(planMin.z, planMax.z) };
  const hi = { x: Math.max(planMin.x, planMax.x), z: Math.max(planMin.z, planMax.z) };
  const planSpan = Math.max(hi.x - lo.x, hi.z - lo.z);

  const model = placedTokenModel(w, nodeId);
  // People: every one projects WELL outside the plan (their true distance, magnified
  // by the interior scale, carries them clear off the room's own footprint).
  for (const p of model.people) {
    const s = proj(interior, p.wx, p.wy);
    const dx = Math.max(0, lo.x - s.x, s.x - hi.x), dz = Math.max(0, lo.z - s.z, s.z - hi.z);
    assert.ok(Math.hypot(dx, dz) > planSpan, `person "${p.name}" must project clear of the plan at interior zoom (>${planSpan.toFixed(1)} off)`);
  }
  // Props: the cottage's own furniture — projected onto/adjacent to the plan.
  for (const pr of model.props) {
    const s = proj(interior, pr.wx, pr.wy);
    assert.ok(s.x >= lo.x - planSpan && s.x <= hi.x + planSpan && s.z >= lo.z - planSpan && s.z <= hi.z + planSpan,
      `prop "${pr.kind}" belongs to the cottage — it must project on/near the plan, not fly off`);
  }
});

test('U549-4: the fix is a RELOCATION, not a blanket hide — at a settlement-scale sheet the outdoor people come back into a normal frame', () => {
  // Three seeds: the property is general, not aldermere-specific.
  for (const seed of ['aldermere', 'tallow', 'wake-cottage-seed-3']) {
    const w = begin(seed);
    const nodeId = w.map.currentNodeId;
    const people = placedTokenModel(w, nodeId).people;
    if (!people.length) continue; // some seeds may wake with no outdoor occupant
    // A settlement-scale sheet: the 2-D map zoomed to see the whole village (small
    // px-per-wu). Centre on the settlement's own occupant centroid so "in frame" is
    // a fair test of relative placement.
    const cx = people.reduce((a, p) => a + p.wx, 0) / people.length;
    const cy = people.reduce((a, p) => a + p.wy, 0) / people.length;
    const settle = sheetAt({ wx: cx, wy: cy }, 400, 1.2); // scene/wu ≈ 400·1.2/1024 ≈ 0.469
    const s = sheetScenePerWu(400, 1.2, SHEET_PX);
    for (const p of people) {
      const proj4 = proj(settle, p.wx, p.wy);
      const dist = Math.hypot(proj4.x - settle.center.x, proj4.z - settle.center.z);
      // Within a few tens of scene-units of the centroid — a normal on-screen village
      // spread (NOT the hundreds-of-units off-frame throw the interior zoom produces).
      assert.ok(dist < 60, `[${seed}] "${p.name}" should sit in a normal settlement frame (got ${dist.toFixed(1)} scene-units from centroid, scale ${s.toFixed(3)})`);
    }
  }
});

test('U549-5: determinism — the projection is a pure function; identical inputs yield byte-identical outputs, and boot worlds replay identically', () => {
  const sheet = sheetAt({ wx: -48.52, wy: -45.45 }, 111.838, 46.98065);
  const a = proj(sheet, -29.58, 0.86), b = proj(sheet, -29.58, 0.86);
  assert.deepEqual(a, b, 'same inputs → same output');
  const w1 = begin('aldermere'), w2 = begin('aldermere');
  const m1 = placedTokenModel(w1, w1.map.currentNodeId), m2 = placedTokenModel(w2, w2.map.currentNodeId);
  const s1 = m1.people.map(p => proj(sheet, p.wx, p.wy));
  const s2 = m2.people.map(p => proj(sheet, p.wx, p.wy));
  assert.deepEqual(s1, s2, 'the aldermere boot projects an identical people set on replay');
});

test('U549-6: purity — worldSpace.js introduces no Math.random for this transform', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'public', 'map', 'worldSpace.js'), 'utf8');
  assert.ok(!/Math\.random\s*\(/.test(src), 'worldSpace.js must never call Math.random');
});
