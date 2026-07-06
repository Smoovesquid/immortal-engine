// U550 — REND-TRUTH-1: the ONE-TRANSFORM regression guard. The people group, the
// prop group, and the ground-sheet ink they stand on must all resolve through the
// SAME wu→scene projection (worldSpace.js's entityScenePosOnSheet), reprojected as
// one whenever the sheet re-zooms/re-centres — so no future layer rework can drag a
// single layer onto a private scale again (the "four people in the bedroom" class).
//
// render3d.js's specific wiring is proven via source-contract checks against its
// actual text — the convention U538/U539 established for this file, because three.js
// genuinely can't run hermetically here (no jsdom/WebGL). The projection MATH itself
// is exercised numerically in U548/U549; this file guards that the renderer is
// actually plumbed to it and nothing bypasses it.
//
// Hermetic — reads source text + the pure module; no WebGL/DOM/network/API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { entityScenePosOnSheet } from '../public/map/worldSpace.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.join(__dirname, '..');
const RENDER3D = fs.readFileSync(path.join(REPO_ROOT, 'public', 'map', 'render3d.js'), 'utf8');
const WORLDSPACE = fs.readFileSync(path.join(REPO_ROOT, 'public', 'map', 'worldSpace.js'), 'utf8');

test('U550-1: worldSpace.js exports the shared projection (entityScenePosOnSheet) — the ONE derivation the renderer and the tests both consume', () => {
  assert.equal(typeof entityScenePosOnSheet, 'function', 'entityScenePosOnSheet must be an exported function');
  assert.ok(/export function entityScenePosOnSheet\s*\(/.test(WORLDSPACE), 'worldSpace.js must export entityScenePosOnSheet');
  assert.ok(/export function sheetScenePerWu\s*\(/.test(WORLDSPACE), 'worldSpace.js must export sheetScenePerWu (the span·z/px factor)');
});

test('U550-2: render3d.js imports the shared projection and its entityScenePos delegates to it — no private second copy of the scale math', () => {
  assert.ok(/import\s*\{[^}]*entityScenePosOnSheet[^}]*\}\s*from\s*'\.\/worldSpace\.js';/.test(RENDER3D),
    'render3d.js must import entityScenePosOnSheet from worldSpace.js');
  assert.ok(/function entityScenePos\s*\([^)]*\)\s*\{[\s\S]*entityScenePosOnSheet\(/.test(RENDER3D),
    'render3d.js\'s entityScenePos must delegate to entityScenePosOnSheet (one derivation)');
});

test('U550-3: BOTH engine-occupancy layers — people AND props — are placed via entityScenePos (one transform for both)', () => {
  // The people loop and the prop loop each call entityScenePos on their own wu.
  assert.ok(/for \(const npc of \(tok\.people \|\| \[\]\)\)\s*\{[\s\S]*?entityScenePos\(npc\.wx, npc\.wy\)/.test(RENDER3D),
    'the people loop must place each npc via entityScenePos(npc.wx, npc.wy)');
  assert.ok(/for \(const prop of \(tok\.props \|\| \[\]\)\)\s*\{[\s\S]*?entityScenePos\(prop\.wx, prop\.wy\)/.test(RENDER3D),
    'the prop loop must place each prop via entityScenePos(prop.wx, prop.wy)');
});

test('U550-4: neither engine-occupancy layer uses the old fixed-scale worldPosFromWu — the region-lattice scale that caused the collapse', () => {
  // Isolate the TT-PROPS block (people + props placement) and assert worldPosFromWu
  // appears nowhere inside it. (worldPosFromWu legitimately remains for the wild
  // bubble / camera-seed / node math elsewhere — this guard is scoped to the
  // occupancy layer that had the bug.)
  const start = RENDER3D.indexOf('if (opts.world && !sceneData?.combat) {');
  assert.ok(start > 0, 'precondition: found the TT-PROPS occupancy block');
  // The block runs until the wild-mini section (MR-3b) begins.
  const end = RENDER3D.indexOf('THE WILD DRAWN', start);
  assert.ok(end > start, 'precondition: found the end of the occupancy block (before the wild section)');
  const block = RENDER3D.slice(start, end);
  assert.ok(/entityScenePos\(/.test(block), 'sanity: the occupancy block uses entityScenePos');
  assert.ok(!/worldPosFromWu\(/.test(block),
    'the occupancy (people+props) block must NOT use worldPosFromWu — that fixed scale collapsed them onto the player');
});

test('U550-5: the entities reproject as ONE on every sheet change — repositionEntities is called at mount AND after the sheet re-centres in setCamera', () => {
  assert.ok(/function repositionEntities\s*\(/.test(RENDER3D), 'render3d.js must define repositionEntities()');
  // It must iterate the shared entity list and reproject each via entityScenePos.
  assert.ok(/function repositionEntities\s*\([\s\S]*?for \(const m of entityMinis\)[\s\S]*?entityScenePos\(m\.wx, m\.wy\)/.test(RENDER3D),
    'repositionEntities must reproject every entityMinis record through entityScenePos');
  // Called after the sheet refresh inside setCamera (so people track a zoom/pan).
  assert.ok(/worldSheet\.refresh\([\s\S]*?\);[\s\S]*?repositionEntities\(\);/.test(RENDER3D),
    'setCamera must call repositionEntities() right after worldSheet.refresh (people follow the ink when the sheet moves)');
});

test('U550-6: people and props feed ONE list (entityMinis) — the shared origin the reprojection drives; both push to it', () => {
  assert.ok(/const entityMinis = \[\];/.test(RENDER3D), 'render3d.js must declare the shared entityMinis list');
  // Each occupancy record is pushed to BOTH sliceMinis (for breathe) and entityMinis
  // (for reprojection) — the "one origin transform" both layers share.
  const pushes = RENDER3D.match(/sliceMinis\.push\(rec\);\s*entityMinis\.push\(rec\);/g) || [];
  assert.ok(pushes.length >= 2, `people and props must each register in entityMinis (found ${pushes.length} of the paired pushes, need ≥2)`);
});

test('U550-7: the sheet transform is symmetric across layers — projecting any two wu points shares the SAME centre and scale (an algebraic guard on entityScenePosOnSheet itself)', () => {
  // If a "per-layer fudge offset" ever crept back in, two layers would resolve the
  // same wu to different scene points. entityScenePosOnSheet is a single pure
  // function of (center, span, z, px, tileWu), so this is guaranteed by construction
  // — assert it: the midpoint of two projected points equals the projection of the
  // midpoint (affinity ⇒ one transform, no per-point offset).
  const center = { x: -1.941, z: -1.858 }, span = 111.838, z = 46.98, px = 1024, tile = 40;
  const A = entityScenePosOnSheet(center, span, z, px, tile, -29.58, 0.86);
  const B = entityScenePosOnSheet(center, span, z, px, tile, 21.67, -8.35);
  const Mid = entityScenePosOnSheet(center, span, z, px, tile, (-29.58 + 21.67) / 2, (0.86 - 8.35) / 2);
  assert.ok(Math.abs((A.x + B.x) / 2 - Mid.x) < 1e-6 && Math.abs((A.z + B.z) / 2 - Mid.z) < 1e-6,
    'one transform: midpoint-of-projections == projection-of-midpoint (no per-layer offset)');
});
