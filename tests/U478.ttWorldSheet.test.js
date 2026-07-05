// U478 — TT-WORLD: the world sheet's sizing/bridge math, and the flat-ground law.
//
// render3d.js's tilt-view ground is no longer a local heightfield — it's ONE flat
// plane textured with the 2-D sheet's own live drawing (docs/briefs/TT-WORLD-
// paper-world.md Stage 1). Three.js never actually loads in this hermetic test
// environment (no jsdom, no CDN — the dynamic `import('three')` fails gracefully,
// the same no-WebGL fallback a real browser without WebGL takes), so this suite
// locks the PURE, DOM/THREE-free contracts a live capture can't easily assert —
// the exact numbers this packet's live debugging found broken:
//   1. spanWorldForRad — the plane's span comes from the 3-D CAMERA's own ground
//      footprint (rad × vFovTan), NOT the unrelated 2-D map's canvas pixel size
//      (the sizing bug: that produced a plane a tiny fraction of the camera's
//      distance — a mostly-empty patch adrift in the scene).
//   2. worldPosFromWu — the ONE wu -> 3-D world-unit bridge (÷NODE_WU × TILE_WU),
//      matching the SAME bridge setPlayerFocus/wPos already use elsewhere in the
//      file, so the sheet's plane and the mini/nodes never disagree on scale.
//   3. The centering law (source-contract): the sheet must re-center on `target`
//      (the point setCamera authoritatively points the 3-D camera at) — never a
//      second independently-resolved focus (the centering bug this packet found
//      live: a test-script drive that moved the camera's target without moving a
//      SEPARATE focus reproduced a plane centered on the "right" point while the
//      camera looked entirely elsewhere — invisible no matter what material/
//      texture it had, because it was simply outside the frustum).
//   4. The flat-ground law (source-contract): heightAt always returns 0 — no
//      heightAt() relief remains wired into buildWorldSheet.
// Hermetic — no network, no WebGL, no API key, no Math.random.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NODE_WU } from '../public/map/worldSpace.js';
import { spanWorldForRad, worldPosFromWu } from '../public/map/render3d.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const SRC = fs.readFileSync(path.join(__dirname, '..', 'public', 'map', 'render3d.js'), 'utf8');

test('U478: spanWorldForRad grows monotonically with camera distance (never shrinks below the camera close-up floor)', () => {
  const near = spanWorldForRad(30, 0.4142); // the tilt band's typical close-in distance (curRad's own 30-wu clamp floor)
  const mid = spanWorldForRad(200, 0.4142);
  const far = spanWorldForRad(4000, 0.4142); // curRad's own far clamp ceiling
  assert.ok(near > 0, 'a positive span at the closest camera distance');
  assert.ok(mid > near, 'span grows as the camera pulls back');
  assert.ok(far > mid, 'span keeps growing at the far clamp — no premature ceiling');
});

test('U478: spanWorldForRad is proportional to rad (the sizing-bug regression guard) — doubling distance roughly doubles span once past the min floor', () => {
  const a = spanWorldForRad(500, 0.4142);
  const b = spanWorldForRad(1000, 0.4142);
  // Both comfortably above SHEET_MIN_SPAN_WU (40) so the floor never masks the ratio.
  assert.ok(a > 200 && b > 200, 'both samples are past the close-up floor');
  const ratio = b / a;
  assert.ok(Math.abs(ratio - 2) < 0.05, `span scales linearly with camera distance (ratio ${ratio}, expected ~2)`);
});

test('U478: spanWorldForRad never sizes off viewport pixels — same rad+vFovTan input is invariant to any external viewport-shaped argument', () => {
  // The function's signature takes only (rad, vFovTan) — no third viewport-px
  // parameter exists to leak in. This is itself the regression guard: the first
  // cut of this packet passed a 2-D canvas clientHeight through an unrelated
  // formula and produced a plane sized to a tiny fraction of the camera distance.
  assert.equal(spanWorldForRad.length, 2, 'spanWorldForRad takes exactly (rad, vFovTan) — no viewport-px input to regress on');
  const s1 = spanWorldForRad(60, 0.4142);
  const s2 = spanWorldForRad(60, 0.4142);
  assert.equal(s1, s2, 'deterministic — the same camera geometry always yields the same span');
});

test('U478: worldPosFromWu is the exact ÷NODE_WU × TILE_WU bridge (round-trips exactly, matches the node/mini convention elsewhere in the file)', () => {
  const TILE_WU = 40; // pinned in render3d.js; asserted indirectly below via the round-trip
  const p = worldPosFromWu(2957.8912567287684, 5938.504690954139);
  assert.equal(p.x, (2957.8912567287684 / NODE_WU) * TILE_WU, 'x bridges wu -> 3-D units via ÷NODE_WU × TILE_WU exactly');
  assert.equal(p.z, (5938.504690954139 / NODE_WU) * TILE_WU, 'z bridges wu -> 3-D units via ÷NODE_WU × TILE_WU exactly');
  // Round-trip: wu -> 3-D -> wu (÷TILE_WU × NODE_WU) recovers the original wu point.
  const backWx = p.x / TILE_WU * NODE_WU, backWy = p.z / TILE_WU * NODE_WU;
  assert.ok(Math.abs(backWx - 2957.8912567287684) < 1e-9, 'round-trips back to the exact wu-x');
  assert.ok(Math.abs(backWy - 5938.504690954139) < 1e-9, 'round-trips back to the exact wu-y');
});

test('U478: worldPosFromWu handles non-finite/absent input gracefully (never NaN onto the scene graph)', () => {
  assert.deepEqual(worldPosFromWu(undefined, undefined), { x: 0, z: 0 }, 'undefined -> origin, not NaN');
  assert.deepEqual(worldPosFromWu(NaN, NaN), { x: 0, z: 0 }, 'NaN -> origin, not NaN propagated');
});

test('U478: deterministic x2 — the sizing/bridge functions are pure (no Math.random, no hidden state)', () => {
  const a = { span: spanWorldForRad(90, 0.4142), pos: worldPosFromWu(1200, -800) };
  const b = { span: spanWorldForRad(90, 0.4142), pos: worldPosFromWu(1200, -800) };
  assert.deepEqual(a, b, 'identical inputs always yield identical outputs');
});

test('U478: no Math.random anywhere in render3d.js (purity rule — rng.js is the only randomness source)', () => {
  assert.ok(!/Math\.random/.test(SRC), 'render3d.js must never call Math.random directly');
});

test('U478: source contract — buildWorldSheet\'s heightAt is a hard-coded flat 0 (the tabletop law: terrain is ink, never relief)', () => {
  const m = SRC.match(/function buildWorldSheet\([^)]*\)\s*\{([\s\S]*?)\n  return \{ mesh, heightAt, refresh/);
  assert.ok(m, 'buildWorldSheet must exist and return heightAt/refresh');
  const body = m[1];
  assert.ok(/const heightAt = \(\) => 0;/.test(body), 'heightAt is a constant 0 — no heightAt() relief wired into the tilt-view ground');
  // buildTerrain may still be MENTIONED in a comment (worldAssets.js's export list),
  // but must never be imported or called — the actual regression this guards.
  assert.ok(!/import\s*\{[^}]*\bbuildTerrain\b/.test(SRC), 'buildTerrain is not imported — the old local heightfield builder is retired from this view');
  assert.ok(!/\bbuildTerrain\(/.test(SRC), 'buildTerrain is never called — heightAt comes from buildWorldSheet only');
});

test('U478: source contract — the sheet centers on `target` (setCamera\'s own camera look-at), never a second independent focus', () => {
  const m = SRC.match(/function setCamera\(o = \{\}\)\s*\{([\s\S]*?)\n  \}\n\n  return \{ dispose/);
  assert.ok(m, 'setCamera must exist');
  const body = m[1];
  // The refresh call must read target.x/target.z directly (the centering-bug fix);
  // it must NOT reference a separately-tracked focus wu variable independent of target.
  assert.ok(/worldSheet\.refresh\(_sheetTarget/.test(body), 'setCamera drives the sheet refresh from _sheetTarget, seeded from target');
  assert.ok(/target\.x - _sheetTarget\.x/.test(body) && /target\.z - _sheetTarget\.z/.test(body),
    'the drift check compares against the live `target` the camera itself looks at — one source of truth');
});

test('U478: source contract — setPlayerFocus no longer drives a sheet refresh (setCamera owns it exclusively, per the centering fix)', () => {
  const m = SRC.match(/function setPlayerFocus\(tx, ty\)\s*\{([\s\S]*?)\n  \}/);
  assert.ok(m, 'setPlayerFocus must exist');
  const body = m[1];
  assert.ok(!/worldSheet\.refresh/.test(body), 'setPlayerFocus must not call worldSheet.refresh — that would reintroduce a second independent focus path');
});

test('U478: mountSlice3D docblock documents opts.world (TT-WORLD threading contract)', () => {
  assert.ok(/opts\.world: the RAW world object \(TT-WORLD\)/.test(SRC), 'the API doc must record why opts.world exists');
});
