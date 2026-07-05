// U497 — MR-ORACLE: the real boot-and-transition sequence.
//
// Runs the probe's canonical sequence (wake → look → go outside → re-enter →
// walk → journey) against the REAL slice boot, LLM off, and asserts the position
// story is coherent at every transition:
//
//   • wake lands the body INSIDE the wake room;
//   • the sequence is deterministic (two runs → identical findings);
//   • MR-1a LANDED — "go outside" lands the body on the DOORSTEP of the structure
//     it left (egress writes the doorstep pos through applyDeltas). The probe now
//     runs CLEAN of position findings and the layer diagnosis clears the ENGINE.
//     (The renderer view-model still does not consume pos — that lie is MR-1b/TAC-4
//     turf, out of the engine's scope.)
//
// The doorstep invariant that was an EXPECTED-FAIL (`todo`) before MR-1a is now a
// LIVE assertion (the `todo` marker is flipped OFF — see the block below).
//
// docs/MAP_REAL.md stage 0 (MR-ORACLE) · docs/POSITION_AS_CANON.md §2/§3 (MR-1a).
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

// ── MR-1a LANDED: exit is honest — the probe finds NO exit teleport ───────────
// Before MR-1a the probe surfaced a POSITION_DESYNC on go-outside (the exit re-rolled
// a region cell ~49 cells / 247 ft from the door — a teleport). MR-1a makes egress
// write the doorstep through applyDeltas, so the sequence now runs CLEAN: zero
// position findings, and the layer diagnosis clears the engine (the only remaining
// lie is the RENDERER view-model, which MR-1b/TAC-4 own — it does not consume pos yet).
test('U497: MR-1a — the probe finds no exit teleport; the engine pos is honest', () => {
  const r = runSequence();
  const exitFindings = r.findings.filter(f => f.step === 'go-outside' && f.class === 'POSITION_DESYNC');
  assert.equal(exitFindings.length, 0, 'no POSITION_DESYNC on go-outside after MR-1a (exit lands on the doorstep)');
  assert.equal(r.findings.length, 0, 'the whole sequence is clean of position findings after MR-1a');
  // The engine is now cleared; the remaining lie (if any) is renderer-side only.
  assert.equal(r.diagnosis.engine.lies, false, 'engine pos is diagnosed as honest after MR-1a');
  assert.ok(['view-model', 'none'].includes(r.diagnosis.layer), `engine is exonerated; got "${r.diagnosis.layer}"`);
});

// ── THE DOORSTEP INVARIANT — LIVE (docs/POSITION_AS_CANON.md §2/§3) ───────────
// The post-MR-1a target, now asserted for real (the expected-fail `todo` is FLIPPED
// ON): "go outside" lands the body on the DOORSTEP of the structure it left — same
// node, within the probe's doorstep threshold of that structure's footprint, NEVER
// re-rolled to a far cell. assertExitOnDoorstep is the same check the probe runs.
test('U497: go outside lands on the doorstep, not a teleport', () => {
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
