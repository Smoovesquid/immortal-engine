// U479 — TT-INK: architecture is ink, never geometry (yet).
//
// render3d.js's node-dressing loop no longer mounts buildSettlement (houses +
// palisade wall) or buildChapelRuin (the ruined chapel) — their content is
// exactly the floor-plan ink the world sheet (TT-WORLD) already draws from
// drawnStructureModel (the "one drawing brain", TT-DRAW-3), so mounting the 3-D
// building meshes on top of that ink was a double-representation (a wall
// occluding the floor plan it's supposed to BE — the artifact this packet's
// live capture showed: the settlement's own walls/roofs almost entirely covered
// the ground, with only a sliver of ink peeking through at the edges).
//
// "(Yet)" is a hard requirement, not a suggestion: buildSettlement/
// buildChapelRuin must NOT be deleted from worldAssets.js (a future stage
// remounts real 3-D architecture) — they simply stop being CALLED from
// render3d.js's node-dressing loop. buildWilderness is UNCHANGED (it has no
// buildings — trees/tents/barrels only, already law).
//
// Source-contract tests (three.js never actually loads in this hermetic
// environment — no jsdom, no CDN; the dynamic import fails gracefully, the
// same no-WebGL fallback a real browser without WebGL takes), plus a check
// that worldAssets.js itself is untouched (the builders still exist, still
// exported, for the eventual re-mount).
// Hermetic — no network, no WebGL, no API key, no Math.random.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const RENDER3D_SRC = fs.readFileSync(path.join(__dirname, '..', 'public', 'map', 'render3d.js'), 'utf8');
const WORLD_ASSETS_SRC = fs.readFileSync(path.join(__dirname, '..', 'public', 'map', 'worldAssets.js'), 'utf8');

// Isolate the node-dressing loop (the ONLY place these builders were ever
// called from in render3d.js — everything else in the file is HUD/camera/
// combat-board wiring untouched by this packet).
function nodeDressingLoopBody() {
  const m = RENDER3D_SRC.match(/for \(const node of nodes\) \{([\s\S]*?)\n  \}\n\n  \/\/ Resolve each peelable/);
  assert.ok(m, 'the node-dressing loop must exist in render3d.js');
  return m[1];
}

test('U479: buildSettlement is never CALLED in the node-dressing loop (architecture stops mounting)', () => {
  const body = nodeDressingLoopBody();
  assert.ok(!/buildSettlement\(/.test(body), 'buildSettlement(...) must not be invoked in the node-dressing loop');
});

test('U479: buildChapelRuin is never CALLED in the node-dressing loop (architecture stops mounting)', () => {
  const body = nodeDressingLoopBody();
  assert.ok(!/buildChapelRuin\(/.test(body), 'buildChapelRuin(...) must not be invoked in the node-dressing loop');
});

test('U479: buildWilderness IS STILL called — trees/tents/props are unaffected by the ink-vs-geometry retirement', () => {
  const body = nodeDressingLoopBody();
  assert.ok(/buildWilderness\(/.test(body), 'buildWilderness(...) must still be invoked — it has no buildings, already the entities-are-minis law');
});

test('U479: settlement and dungeon_entrance nodes are explicitly skipped (not silently dressed with something else)', () => {
  const body = nodeDressingLoopBody();
  assert.ok(/node\.nodeType === 'settlement' \|\| node\.nodeType === 'dungeon_entrance'/.test(body),
    'the loop must explicitly recognize + skip settlement/dungeon_entrance nodes rather than falling through to buildWilderness for them');
});

test('U479: "(Yet)" is honored — buildSettlement/buildChapelRuin are NOT deleted from worldAssets.js, still exported for a future re-mount', () => {
  assert.ok(/export function buildSettlement\(/.test(WORLD_ASSETS_SRC), 'buildSettlement must remain exported in worldAssets.js');
  assert.ok(/export function buildChapelRuin\(/.test(WORLD_ASSETS_SRC), 'buildChapelRuin must remain exported in worldAssets.js');
  assert.ok(/export function buildWilderness\(/.test(WORLD_ASSETS_SRC), 'buildWilderness must remain exported in worldAssets.js');
});

test('U479: the peelable-roof-cutaway registry degrades gracefully to empty (no crash) now that nothing populates it', () => {
  // buildSettlement was the ONLY populator of `peelables` (its own peelables.push
  // calls, in worldAssets.js) — with it retired from the mount loop, `peelables`
  // stays empty for the whole scene's lifetime. updateCutaway must short-circuit
  // on an empty array rather than assume at least one entry.
  const m = RENDER3D_SRC.match(/function updateCutaway\(\)\s*\{([\s\S]*?)\n  \}/);
  assert.ok(m, 'updateCutaway must exist');
  assert.ok(/if \(!peelables\.length\) return;/.test(m[1]), 'updateCutaway guards an empty peelables array up front');
});

test('U479: no Math.random anywhere in render3d.js (purity rule unchanged by this stage)', () => {
  assert.ok(!/Math\.random/.test(RENDER3D_SRC), 'render3d.js must never call Math.random directly');
});

test('U479: the TT-INK rationale is documented in-source (a future reader can find why buildings stopped mounting)', () => {
  assert.ok(/TT-INK/.test(RENDER3D_SRC), 'the TT-INK packet name must appear as a source comment marker');
  assert.ok(/architecture is ink, never geometry \(yet\)/.test(RENDER3D_SRC), 'the exact packet framing must be preserved as documentation');
});
