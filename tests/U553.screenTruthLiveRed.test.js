// U553 — VIS-ORACLE: the wake scene, before and after PLAN-SPLIT-1.
//
// The oracle independently rediscovered a live bug as a RED PROJECTION_EQUALITY
// finding: at the wake scene, the player token in the walkable-place drawn model
// was seated from the engine floorPlan, but the building it stood in was DRAWN
// from getPlan's catalog plan — two different-scale plans for one building, so
// the token rendered OFF its own drawn walls. REND-TRUTH-1 (b100) fixed the
// wu-space (3-D people) split; this RED survived it — a DISTINCT split in
// place-unit space (the walkable-place view), closed by PLAN-SPLIT-1: real
// structures now draw from engineBackedPlan(st) (placeFromNode.js), the same
// floorPlan the token already read, so the two layers finally share one
// geometry.
//
// This was the U497-todo pattern for pixels: the pre-fix RED was asserted for
// real (LIVE, green against the THEN-true bug), and the desired post-fix state
// (the wake scene runs clean) was a `todo` that PLAN-SPLIT-1's landing flips ON.
// It is now ON: the wake scene runs clean, tests 1–2 (which used to assert the
// RED) now assert the GREEN, and wake_interior is dropped from EXPECTED_RED.
//
// docs/briefs/PLAN-SPLIT-1-one-geometry.md · docs/MAP_REAL.md promise 2 & 3.
// Sibling: U551/U552.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runScreenTruth, EXPECTED_RED } from '../scripts/screenTruth.mjs';
import { buildScenes, drawnModel, engineTruth } from '../scripts/screenTruth.scenes.mjs';
import { runAllAssertions } from '../scripts/screenTruth.assertions.mjs';

// ── POST-FIX: the wake scene emits NO PROJECTION_EQUALITY finding ──────────────
test('U553: the wake scene emits no PROJECTION_EQUALITY finding (PLAN-SPLIT-1: one plan drives building ink + figure)', () => {
  const r = runScreenTruth();
  const wake = r.scenes.find(s => s.id === 'wake_interior');
  assert.ok(wake, 'the wake scene is present');
  const proj = wake.findings.filter(f => f.class === 'PROJECTION_EQUALITY');
  assert.equal(proj.length, 0, `wake must run clean of projection findings now the figure and its building share one plan; got ${JSON.stringify(wake.findings)}`);
});

// ── POST-FIX: wake_interior is no longer a registered expected-red, and the run
//    has zero findings anywhere (fully green) ──────────────────────────────────
test('U553: wake_interior is no longer EXPECTED_RED, and no scene carries any finding', () => {
  const r = runScreenTruth();
  assert.ok(!EXPECTED_RED.has('wake_interior'), 'wake_interior must be dropped from EXPECTED_RED once fixed');
  assert.equal(r.findings.length, 0, `the run must be fully green — any finding here is a regression. got: ${JSON.stringify(r.findings)}`);
});

// ── POST-FIX: the diagnosis inverts — the engine says the body is inside a real
//    room, and the DRAWN token now agrees (inside the SAME rect). ─────────────
test('U553: the engine says the body is inside a real room; the DRAWN token now agrees (inside its own building)', () => {
  const wake = buildScenes().find(s => s.id === 'wake_interior');
  const truth = engineTruth(wake.world, wake.nodeId);
  const model = drawnModel(wake.world, wake.nodeId); model.__world = wake.world;

  // Engine truth: an interior is active and the player has a struct-frame cell.
  assert.ok(truth.interior && truth.interior.structureKey, 'engine: an interior is active at wake');
  assert.ok(truth.playerCell && String(truth.playerCell.frame).startsWith('struct:'), 'engine: player has a struct-frame cell');
  assert.ok(truth.playerPlaceUnitRect, 'engine: the interior structure has a place-unit floorPlan rect');

  // The drawn token exists and now sits INSIDE that engine-plan rect.
  const tok = model.placeUnit?.tokens?.find(t => t.type === 'player');
  assert.ok(tok, 'a player token is drawn in the walkable place');
  const R = truth.playerPlaceUnitRect;
  const inside = tok.ux >= R.minX && tok.ux <= R.maxX && tok.uy >= R.minY && tok.uy <= R.maxY;
  assert.equal(inside, true, 'the DRAWN token is inside its own building (PLAN-SPLIT-1: one plan, one geometry)');
});

// ── The wu MARKER (playerFocusWu) was already honest (MR-1b/REND-TRUTH-1) and
//    stays honest — both spaces now agree. ─────────────────────────────────────
test('U553: the wu player marker is inside the wake structure (both the wu marker AND the place-unit token now agree)', () => {
  const wake = buildScenes().find(s => s.id === 'wake_interior');
  const truth = engineTruth(wake.world, wake.nodeId);
  const model = drawnModel(wake.world, wake.nodeId); model.__world = wake.world;
  assert.ok(model.wu.player && truth.playerRect, 'a wu marker + an engine rect exist');
  const R = truth.playerRect, p = model.wu.player;
  const inside = p.wx >= R.minX && p.wx <= R.maxX && p.wy >= R.minY && p.wy <= R.maxY;
  assert.equal(inside, true, 'the wu marker is honest (MR-1b/REND-TRUTH-1) — and now the place-unit token matches it (PLAN-SPLIT-1)');
});

// ── POST-FIX (was the todo target): the wake scene runs fully clean of ANY
//    finding class, not just PROJECTION_EQUALITY. ──────────────────────────────
test('U553: the wake scene runs clean of every assertion class (PROJECTION_EQUALITY, PHANTOM, MISSING, LAYER_ORIGIN, INK_EXCLUSION)', () => {
  const wake = buildScenes().find(s => s.id === 'wake_interior');
  const truth = engineTruth(wake.world, wake.nodeId);
  const model = drawnModel(wake.world, wake.nodeId); model.__world = wake.world;
  const findings = runAllAssertions(model, truth, 'wake_interior');
  assert.deepEqual(findings, [], `wake must run clean now the figure and its building share one plan; got: ${JSON.stringify(findings)}`);
});
