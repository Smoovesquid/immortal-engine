// U553 — VIS-ORACLE: the live wake RED (the independent repro of REND-TRUTH-1).
//
// The oracle must INDEPENDENTLY rediscover the live wake-scene bug as a RED
// PROJECTION_EQUALITY finding — the reproduce-first proof that the screen-truth
// gate can see the class of bug that broke twice in one night. At the wake scene
// the player token in the walkable-place drawn model is seated from the engine
// floorPlan, but the building it stands in is DRAWN from getPlan's catalog plan,
// so the token renders OFF its own building: a figure drawn indoors-but-wrong,
// REND-TRUTH-1's exact target class.
//
// This is the U497-todo pattern for pixels:
//   • the currently-TRUE facts are asserted for real (LIVE, green): the wake scene
//     emits exactly one finding, and it is the PROJECTION_EQUALITY red; no OTHER
//     scene is red; and the run is deterministic;
//   • the DESIRED post-fix state — the wake scene runs clean — is an EXPECTED-FAIL
//     (`todo`) that REND-TRUTH-1's landing flips ON (delete the `todo` option, the
//     assertion already reads the right thing).
//
// docs/briefs/VIS-ORACLE.md · docs/MAP_REAL.md promise 2. Sibling: U551/U552.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runScreenTruth, EXPECTED_RED } from '../scripts/screenTruth.mjs';
import { buildScenes, drawnModel, engineTruth } from '../scripts/screenTruth.scenes.mjs';
import { runAllAssertions } from '../scripts/screenTruth.assertions.mjs';

// ── LIVE (currently TRUE): the wake scene surfaces the projection RED ──────────
test('U553: the wake scene emits a PROJECTION_EQUALITY finding (the live figure-off-its-building bug)', () => {
  const r = runScreenTruth();
  const wake = r.scenes.find(s => s.id === 'wake_interior');
  assert.ok(wake, 'the wake scene is present');
  const proj = wake.findings.filter(f => f.class === 'PROJECTION_EQUALITY');
  assert.equal(proj.length, 1, `exactly one projection finding on wake; got ${JSON.stringify(wake.findings)}`);
  assert.match(proj[0].detail, /OUTSIDE its own structure/, 'the finding names the figure drawn off its own building');
});

// ── LIVE: it is marked EXPECTED-RED, so the run stays legibly non-regressed ────
test('U553: the wake red is registered as EXPECTED (REND-TRUTH-1 flips it), and no other scene is red', () => {
  const r = runScreenTruth();
  assert.ok(EXPECTED_RED.has('wake_interior'), 'wake_interior is a registered expected-red');
  const unexpected = r.findings.filter(f => !f.expected);
  assert.equal(unexpected.length, 0, `only the wake red is expected; any other finding is a regression. got: ${JSON.stringify(unexpected)}`);
  // The wake finding is tagged expected:
  const wakeFindings = r.findings.filter(f => f.step === 'wake_interior');
  assert.ok(wakeFindings.length >= 1 && wakeFindings.every(f => f.expected), 'the wake finding is tagged expected');
});

// ── LIVE: the diagnosis is precise — engine cell IS a real room cell, the DRAWN
//    token is the liar (this is the layer-diagnosis the fix targets). ──────────
test('U553: the engine says the body is inside a real room; the DRAWN token is the one off the building', () => {
  const wake = buildScenes().find(s => s.id === 'wake_interior');
  const truth = engineTruth(wake.world, wake.nodeId);
  const model = drawnModel(wake.world, wake.nodeId); model.__world = wake.world;

  // Engine truth: an interior is active and the player has a struct-frame cell.
  assert.ok(truth.interior && truth.interior.structureKey, 'engine: an interior is active at wake');
  assert.ok(truth.playerCell && String(truth.playerCell.frame).startsWith('struct:'), 'engine: player has a struct-frame cell');
  assert.ok(truth.playerPlaceUnitRect, 'engine: the interior structure has a place-unit floorPlan rect');

  // The drawn token exists and sits OUTSIDE that engine-plan rect (the bug).
  const tok = model.placeUnit?.tokens?.find(t => t.type === 'player');
  assert.ok(tok, 'a player token is drawn in the walkable place');
  const R = truth.playerPlaceUnitRect;
  const inside = tok.ux >= R.minX && tok.ux <= R.maxX && tok.uy >= R.minY && tok.uy <= R.maxY;
  assert.equal(inside, false, 'the DRAWN token is off its own building (this is what REND-TRUTH-1 fixes)');
});

// ── LIVE: the wu MARKER (playerFocusWu) is already honest (MR-1b landed) — the
//    RED is specifically the walkable-place token, not the marker. ────────────
test('U553: the wu player marker is already inside the wake structure (only the place-unit token is red)', () => {
  const wake = buildScenes().find(s => s.id === 'wake_interior');
  const truth = engineTruth(wake.world, wake.nodeId);
  const model = drawnModel(wake.world, wake.nodeId); model.__world = wake.world;
  assert.ok(model.wu.player && truth.playerRect, 'a wu marker + an engine rect exist');
  const R = truth.playerRect, p = model.wu.player;
  const inside = p.wx >= R.minX && p.wx <= R.maxX && p.wy >= R.minY && p.wy <= R.maxY;
  assert.equal(inside, true, 'the wu marker is honest (MR-1b) — the projection RED is the place-unit token alone');
});

// ── EXPECTED-FAIL (todo): the POST-FIX target — the wake scene runs clean. When
//    REND-TRUTH-1 lands (one plan drives both the building ink and the figure),
//    the wake token sits inside its own building and this passes; delete the
//    `todo` option to flip it ON (and drop wake_interior from EXPECTED_RED, then
//    capture its golden via `npm run screen-goldens:accept`).
test('U553: (post-REND-TRUTH-1) the wake scene runs clean of projection findings', { todo: 'flips ON when REND-TRUTH-1 lands: one plan drives building ink + figure' }, () => {
  const wake = buildScenes().find(s => s.id === 'wake_interior');
  const truth = engineTruth(wake.world, wake.nodeId);
  const model = drawnModel(wake.world, wake.nodeId); model.__world = wake.world;
  const findings = runAllAssertions(model, truth, 'wake_interior');
  assert.deepEqual(findings, [], `wake must run clean once the figure and its building share one plan; got: ${JSON.stringify(findings)}`);
});
