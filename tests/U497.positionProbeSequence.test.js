// U497 — MR-ORACLE: the real boot-and-transition sequence.
//
// Runs the probe's canonical sequence (wake → look → go outside → re-enter →
// walk → journey) against the REAL slice boot, LLM off. It asserts only the
// invariants that are TRUE on today's build, so it stays GREEN:
//
//   • wake lands the body INSIDE the wake room (true today);
//   • the sequence is deterministic (two runs → identical findings);
//   • the probe produces exactly the POSITION_DESYNC exit finding today, and its
//     layer diagnosis names the lie — i.e. the oracle is RED-against-today by
//     design (this is asserted as a positive fact, so it's green while the bug
//     lives, and U497's EXPECTED-FAIL block below flips when MR-1 lands).
//
// The KNOWN-RED exit invariant (the post-MR-1 target: exit lands on the doorstep)
// is encoded as an EXPECTED-FAIL (`todo`) test that fails today and turns green
// the moment MR-1 makes exit honest. A failing `todo` does NOT fail the suite.
//
// docs/MAP_REAL.md stage 0 (MR-ORACLE) · docs/POSITION_AS_CANON.md §7 (MR-1).
// Sibling: U496 (assertion helpers on synthetic fixtures).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runSequence, bootSlice, assertWakeInsideRoom, assertExitOnDoorstep, playerPos } from '../scripts/positionProbe.mjs';
import { playerMove } from '../engine/playloop.js';

const PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'], starterObjectives: ['find the key'],
    skills: ['Steel'], locations: ['tower'], objectives: ['find the key'],
    complications: ['a clock starts'], npcArchetypes: ['wary guide'],
    sensoryMotifs: ['air tastes of dust'],
  },
};

// ── Currently-TRUE invariant: wake is inside the wake room ────────────────────
test('U497: the slice boot wakes the player INSIDE the wake room (struct frame + real room cell)', () => {
  const world = bootSlice();
  const findings = assertWakeInsideRoom(world, 'wake');
  assert.deepEqual(findings, [], `wake should be inside the room; got: ${JSON.stringify(findings)}`);
  const pos = playerPos(world);
  assert.ok(pos && String(pos.frame).startsWith('struct:'), 'wake pos is a struct frame');
  assert.ok(world.scene?.interior?.roomId, 'scene.interior names the wake room');
});

// ── The probe runs end to end and produces structured output ──────────────────
test('U497: runSequence returns the six canonical steps and a layer diagnosis', () => {
  const r = runSequence();
  assert.equal(r.seed, 'aldermere');
  assert.deepEqual(r.steps.map(s => s.label), ['wake', 'look', 'go-outside', 're-enter', 'walk', 'journey']);
  // Each step carries both layers of the position story.
  for (const s of r.steps) {
    assert.ok('engine' in s && 'renderer' in s, `step ${s.label} carries engine + renderer snapshots`);
    assert.ok('pos' in s.engine, `step ${s.label} records engine pos`);
  }
  assert.ok(r.diagnosis && typeof r.diagnosis.sentence === 'string' && r.diagnosis.sentence.length > 0, 'diagnosis has a plain sentence');
  assert.ok(['engine', 'view-model', 'both', 'none'].includes(r.diagnosis.layer), 'diagnosis names a layer');
});

// ── Determinism: two runs → byte-identical findings + diagnosis ───────────────
test('U497: the sequence is deterministic (LLM off) — two runs produce identical findings', () => {
  const a = runSequence();
  const b = runSequence();
  assert.equal(JSON.stringify(a.findings), JSON.stringify(b.findings), 'findings identical across runs');
  assert.equal(JSON.stringify(a.diagnosis), JSON.stringify(b.diagnosis), 'diagnosis identical across runs');
  assert.deepEqual(a.steps.map(s => s.engine.pos), b.steps.map(s => s.engine.pos), 'engine positions identical across runs');
});

// ── The oracle is RED-against-today BY DESIGN (asserted as a positive fact) ────
// This is GREEN while the bug lives: the probe MUST surface the exit teleport and
// name the lie. When MR-1 lands, this test flips to failing — a loud signal to
// update U497 (delete this block; the EXPECTED-FAIL below becomes the live check).
test('U497: TODAY the probe catches the exit teleport (POSITION_DESYNC) and diagnoses the layer', () => {
  const r = runSequence();
  const exitFindings = r.findings.filter(f => f.step === 'go-outside' && f.class === 'POSITION_DESYNC');
  assert.equal(exitFindings.length, 1, 'exactly one POSITION_DESYNC on go-outside today');
  assert.match(exitFindings[0].detail, /teleport, not a doorstep/, 'the finding names the teleport');
  // The layer diagnosis must implicate the engine pos (the lie is engine-side; the
  // renderer also does not consume pos, so "both" is the correct verdict today).
  assert.ok(['engine', 'both'].includes(r.diagnosis.layer), `diagnosis implicates the engine; got "${r.diagnosis.layer}"`);
  assert.equal(r.diagnosis.engine.lies, true, 'engine pos is diagnosed as lying');
});

// ── EXPECTED FAIL until MR-1 (docs/POSITION_AS_CANON.md §7) ───────────────────
// The post-MR-1 TARGET invariant: "go outside" lands the body on the DOORSTEP of
// the structure it left. This FAILS today (the exit re-rolls a region cell up to
// ~50 cells from the node centre) and turns GREEN when MR-1 makes egress route
// through the door to doorstep coords. A failing `todo` does not fail the suite.
test('U497: EXPECTED-FAIL until MR-1 — go outside lands on the doorstep, not a teleport',
  { todo: 'MR-1 (docs/POSITION_AS_CANON.md §7): egress-through-the-door → doorstep coords. Flip when it lands.' },
  () => {
    // Boot and drive to the exit exactly as the sequence does.
    let world = bootSlice();
    ({ world } = playerMove(world, PACKS, 'look around'));
    const exitedStructureKey = world?.scene?.interior?.structureKey
      || world?.party?.[0]?.position?.interior?.structureId
      || null;
    assert.ok(exitedStructureKey, 'an interior is active before exit');
    ({ world } = playerMove(world, PACKS, 'go outside'));
    const findings = assertExitOnDoorstep(world, exitedStructureKey, 'go-outside');
    assert.deepEqual(findings, [], `exit must land on the doorstep; got: ${JSON.stringify(findings)}`);
  });
