// U548 — REND-TRUTH-1: the "four people in the bedroom" falsifier, reproduced,
// then closed. (docs/MAP_REAL.md promise 3: what's drawn there is what's there.)
//
// PROVENANCE (Tim's v0.30.0 wake, 3-D tilt view, ~5 m interior zoom): four NPC
// figures rendered piled on the player IN the bedchamber. The engine was honest —
// placedTokenModel(world, node).people put them 12–60 world-units (≈60–300 ft)
// away, outside the wake cottage's plan rect — and the 2-D ink drew them there.
// The 3-D MINIS did not: render3d.js placed them with worldPosFromWu, a FIXED
// node-tile scale (÷NODE_WU × TILE_WU = 0.04 scene-units/wu) that is right only for
// the region lattice. But the ground SHEET the minis stand on paints the 2-D map's
// ink at the map's LIVE zoom — at interior zoom that is a MUCH larger scene/wu.
// The two scales disagreed (≈128× at the deep interior zoom, curRad floored), so
// every occupant collapsed into a ~2-unit huddle at the plane centre = the player.
//
// BISECT VERDICT (stated for the record): this was NOT a regression from MR-3b
// (b098). The people-placement code (worldPosFromWu) AND the sheet/mini scale
// constants (TILE_WU, SHEET_PX, SHEET_SPAN_MARGIN) are byte-identical at b096
// (fc9019df, the "known-good" baseline) and HEAD — proven by `git show` below —
// so the mismatch reproduces identically on both. b096's "Galen drawn correctly"
// receipt was the 2-D INK (still correct); the 3-D mini layer was never its subject.
//
// THE FIX: engine-occupancy minis project through the sheet's OWN transform
// (worldSpace.js's entityScenePosOnSheet) instead of worldPosFromWu, so a person
// lands exactly on their ink at any zoom — off-frame at interior (they ARE 60–300
// ft away), on their lane when zoomed out.
//
// Hermetic — reads real engine boot worlds (beginAdventure), exercises the true
// occupancy → world-unit pipeline, tests the pure projection math directly (no
// WebGL/DOM — three.js can't run here, same constraint U538/U539 document). No
// network, no API key, no Math.random.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

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
  newWorld({ seed, fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null }, campaignId: `U548-${++_n}` }),
  PACKS
).world;

// render3d.js's own constants, re-stated so the test projects with the SAME numbers
// the renderer uses (asserted still-current by the source check at the bottom).
const NODE_WU = 1000, TILE_WU = 40, SHEET_PX = 1024;
// The OLD (buggy) placement: worldPosFromWu — a fixed node-tile scale.
const worldPosFromWu = (wx, wy) => ({ x: (Number(wx) || 0) / NODE_WU * TILE_WU, z: (Number(wy) || 0) / NODE_WU * TILE_WU });

// A representative DEEP-INTERIOR sheet state, taken from the live wake capture on
// the aldermere default boot (curRad floored at 30 → spanScene 111.838; the 2-D
// map's live zoom at that depth → ~46.98 px/wu). center == the player focus's own
// worldPosFromWu, i.e. the sheet is centred on the player (the camera target).
function interiorSheetFor(world, nodeId) {
  const node = world.map.nodes.find(n => String(n.id) === String(nodeId));
  // The player focus in wu (the cottage the player wakes in) → the sheet centre.
  // We derive it from the drawn plan's own centre (the room the marker sits in),
  // which is what the live camera targets at the wake.
  const dsm = drawnStructureModel(world, nodeId);
  const rect = (dsm.structures || [])[0].rect;
  const focusWu = { wx: (rect.minX + rect.maxX) / 2, wy: (rect.minY + rect.maxY) / 2 };
  const center = worldPosFromWu(focusWu.wx, focusWu.wy);
  return { center, spanScene: 111.838, z: 46.98065, focusWu, plan: rect, node };
}

test('U548 (BEFORE — the bug reproduces): at interior zoom the OLD worldPosFromWu scale collapses every outdoor occupant onto the player, reading as "in the room"', () => {
  const w = begin('aldermere');
  const nodeId = w.map.currentNodeId;
  const model = placedTokenModel(w, nodeId);
  const people = model.people;
  assert.ok(people.length >= 3, `precondition: the aldermere wake has multiple outdoor occupants (got ${people.length})`);

  const sheet = interiorSheetFor(w, nodeId);
  const playerScene = worldPosFromWu(sheet.focusWu.wx, sheet.focusWu.wy); // where the player mini sits (== centre)

  // The OLD path: every person placed via worldPosFromWu. Because their wu offsets
  // from the focus are small (tens of wu) and the scale is 0.04, they all land
  // within ~2.5 scene-units of the player — visually piled ON them in the room.
  let maxDistOld = 0;
  for (const p of people) {
    const s = worldPosFromWu(p.wx, p.wy);
    maxDistOld = Math.max(maxDistOld, Math.hypot(s.x - playerScene.x, s.z - playerScene.z));
  }
  assert.ok(maxDistOld < 4,
    `BUG witnessed: with worldPosFromWu every occupant lands < 4 scene-units from the player (max ${maxDistOld.toFixed(2)}) — a huddle in the bedchamber`);
});

test('U548 (AFTER — the fix): the SAME occupants, projected through the sheet transform, land far OUTSIDE the plan at interior zoom (they are 60–300 ft away)', () => {
  const w = begin('aldermere');
  const nodeId = w.map.currentNodeId;
  const people = placedTokenModel(w, nodeId).people;
  const sheet = interiorSheetFor(w, nodeId);

  // The plan rect projected to scene via the SAME sheet transform (this is where the
  // ink of the cottage is drawn).
  const planMin = entityScenePosOnSheet(sheet.center, sheet.spanScene, sheet.z, SHEET_PX, TILE_WU, sheet.plan.minX, sheet.plan.minY);
  const planMax = entityScenePosOnSheet(sheet.center, sheet.spanScene, sheet.z, SHEET_PX, TILE_WU, sheet.plan.maxX, sheet.plan.maxY);
  const inPlan = (s) => s.x >= Math.min(planMin.x, planMax.x) && s.x <= Math.max(planMin.x, planMax.x)
                     && s.z >= Math.min(planMin.z, planMax.z) && s.z <= Math.max(planMin.z, planMax.z);

  for (const p of people) {
    const s = entityScenePosOnSheet(sheet.center, sheet.spanScene, sheet.z, SHEET_PX, TILE_WU, p.wx, p.wy);
    assert.ok(!inPlan(s),
      `person "${p.name}" (wu ${p.wx.toFixed(1)},${p.wy.toFixed(1)}) must NOT project inside the cottage plan ink — got scene (${s.x.toFixed(1)},${s.z.toFixed(1)})`);
  }
});

test('U548 (AFTER — the fix): props inside the cottage still land INSIDE the plan (the fix does not banish everything — it puts each mini on its own ink)', () => {
  const w = begin('aldermere');
  const nodeId = w.map.currentNodeId;
  const props = placedTokenModel(w, nodeId).props;
  assert.ok(props.length > 0, 'precondition: the wake cottage has furniture props (bed/barrel)');
  const sheet = interiorSheetFor(w, nodeId);
  // Furniture props sit within the cottage's own world rect — projected through the
  // sheet they must stay within a small margin of that rect's projected footprint
  // (they are the cottage's own ink, unlike the outdoor people above).
  const planMin = entityScenePosOnSheet(sheet.center, sheet.spanScene, sheet.z, SHEET_PX, TILE_WU, sheet.plan.minX, sheet.plan.minY);
  const planMax = entityScenePosOnSheet(sheet.center, sheet.spanScene, sheet.z, SHEET_PX, TILE_WU, sheet.plan.maxX, sheet.plan.maxY);
  const lo = { x: Math.min(planMin.x, planMax.x), z: Math.min(planMin.z, planMax.z) };
  const hi = { x: Math.max(planMin.x, planMax.x), z: Math.max(planMin.z, planMax.z) };
  const span = Math.max(hi.x - lo.x, hi.z - lo.z);
  const margin = span; // one plan-width of slack: a prop just outside a room wall still belongs to the building
  for (const pr of props) {
    const s = entityScenePosOnSheet(sheet.center, sheet.spanScene, sheet.z, SHEET_PX, TILE_WU, pr.wx, pr.wy);
    assert.ok(s.x >= lo.x - margin && s.x <= hi.x + margin && s.z >= lo.z - margin && s.z <= hi.z + margin,
      `prop "${pr.kind}" should project onto/near the cottage plan, not fly off — got scene (${s.x.toFixed(1)},${s.z.toFixed(1)}) vs plan [${lo.x.toFixed(1)},${lo.z.toFixed(1)}..${hi.x.toFixed(1)},${hi.z.toFixed(1)}]`);
  }
});

test('U548 (BISECT, documented): worldPosFromWu AND the sheet/mini scale constants are byte-identical at b096 (fc9019df) and HEAD — the mismatch is pre-existing, not an MR-3b regression', () => {
  const grab = (rev, file, re) => {
    let src = '';
    try { src = execFileSync('git', ['show', `${rev}:${file}`], { encoding: 'utf8', cwd: REPO_ROOT }); } catch { src = ''; }
    const m = src.match(re);
    return m ? m[0] : null;
  };
  // The people-placement line in render3d.js (worldPosFromWu on placedTokenModel people).
  // b096 placed people via worldPosFromWu (the buggy fixed scale); HEAD no longer
  // does (this packet replaced it with entityScenePos). The point of THIS assertion
  // is the constants below — the scale mismatch's ingredients were already present
  // at the "known-good" baseline, so b096 rendered the same huddle.
  const peopleRe = /const p = worldPosFromWu\(npc\.wx, npc\.wy\);/;
  const base = grab('fc9019df', 'public/map/render3d.js', peopleRe);
  assert.ok(base, 'b096 placed people via worldPosFromWu — the fixed-scale placement that produced the bug at the "known-good" baseline');
  // The three scale constants.
  for (const re of [/const TILE_WU = 40;/, /const SHEET_PX = 1024;/, /const SHEET_SPAN_MARGIN = 4\.5;/]) {
    const b = grab('fc9019df', 'public/map/render3d.js', re);
    const h = grab('HEAD', 'public/map/render3d.js', re);
    assert.ok(b, `precondition: b096 defines ${re}`);
    assert.equal(b, h, `${re} must be byte-identical at b096 and HEAD — proving the scale mismatch predates MR-3b`);
  }
});

test('U548 (pure math): sheetScenePerWu is span·z/px, and equals worldPosFromWu\'s 0.04 ONLY when the sheet is at the region-lattice scale — otherwise they diverge (the root cause)', () => {
  // At the deep interior sheet state the factor is huge (≈5.13), 128× the fixed 0.04.
  const interior = sheetScenePerWu(111.838, 46.98065, SHEET_PX);
  assert.ok(interior > 5 && interior < 6, `interior scene/wu ≈ 5.13 (got ${interior.toFixed(3)})`);
  assert.ok(interior / 0.04 > 100, `the interior sheet scale is >100× the fixed mini scale — the collapse (ratio ${(interior / 0.04).toFixed(0)})`);
  // A sheet drawn at exactly the node-tile scale (z chosen so span·z/px == 0.04) agrees.
  const zMatch = 0.04 * SHEET_PX / 111.838;
  assert.ok(Math.abs(sheetScenePerWu(111.838, zMatch, SHEET_PX) - 0.04) < 1e-9, 'the two scales coincide only at one specific zoom');
});
