// U336 — coherence-audit.mjs detector unit tests (docs/playtests/COHERENCE_SEAMS_2026-07-02.md,
// seams C1–C5). Pure-function checks over synthetic turn fixtures: one positive
// (must flag) and one negative (must NOT flag, guarding against the false
// positives this lane hunted down against the real corpus — e.g. "At Wayfarers'"
// mis-parsed as a person, "who is Dalla?" mis-read as materialization). No LLM
// calls, no server, no engine import — $0 and deterministic.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectMaterialization, detectMaterialFlip, detectObjectRelocation,
  detectLocationTeleport, detectScaleContradiction, analyzeCoherence, parseJsonl,
  renderReport, summaryLine,
} from '../scripts/coherence-audit.mjs';

// Minimal turn fixture builder — only the fields the detectors read.
function turn(i, persona, dm, player = '', mechanics = '') {
  return { type: 'turn', seed: 's', persona, i, player, dm, mechanics, route: 'action', canon: {}, judgeError: false, v1: null, v2: null };
}

// ── C1 — NPC materialization ────────────────────────────────────────────────
test('U336: C1 flags an NPC who speaks with no prior introduction', () => {
  const session = [
    turn(0, 'p', 'A straw pallet catches fire in the cottage.'),
    turn(1, 'p', 'Elske Nightherd shrugs. "Can\'t say."'), // never introduced before this
  ];
  const flags = detectMaterialization(session);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].seam, 'C1');
  assert.equal(flags[0].turn, 1);
});

test('U336: C1 does NOT flag an NPC properly introduced before speaking', () => {
  const session = [
    turn(0, 'p', 'Elske Nightherd stands near the doorway of the cottage.'),
    turn(1, 'p', 'Elske Nightherd shrugs. "Can\'t say."'),
  ];
  assert.equal(detectMaterialization(session).length, 0);
});

test('U336: C1 does NOT flag introducing a NEW npc in answer to a "who is X" question (normal DM behavior)', () => {
  const session = [
    turn(0, 'p', 'Elske Nightherd stands near the doorway.', 'who owns this cottage?'),
    turn(1, 'p', 'At Wayfarers\' Outpost, Dalla is the innkeeper — a woman known to all here.', 'who is Dalla?'),
  ];
  assert.equal(detectMaterialization(session).length, 0, 'a first-time named introduction is not materialization');
});

test('U336: C1 regression — sentence-initial "At Wayfarers\'" is not mis-parsed as a person (the false positive this lane fixed)', () => {
  const session = [
    turn(0, 'p', 'At Wayfarers\' Outpost, a single sturdy building stands nearby with smoke curling from its chimney.'),
  ];
  assert.equal(detectMaterialization(session).length, 0);
});

test('U336: C1 only flags a materialized NPC ONCE (no repeat-fire on later turns)', () => {
  const session = [
    turn(0, 'p', 'Elske Nightherd shrugs. "Can\'t say."'),
    turn(1, 'p', 'Elske Nightherd nods slowly.'),
    turn(2, 'p', 'Elske Nightherd says, "Enough."'),
  ];
  assert.equal(detectMaterialization(session).length, 1);
});

// ── C2 — material flip ──────────────────────────────────────────────────────
test('U336: C2 flags the same surface noun asserted with two different materials', () => {
  const session = [
    turn(0, 'p', 'The wooden wall stands untouched.'),
    turn(1, 'p', 'The stone wall holds firm against your fist.'),
  ];
  const flags = detectMaterialFlip(session);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].seam, 'C2');
  assert.match(flags[0].detail, /wooden.*stone|stone.*wooden/);
});

test('U336: C2 does NOT flag two different objects with different materials (no cross-noun noise)', () => {
  const session = [
    turn(0, 'p', 'The stone basin sits in the corner.'),
    turn(1, 'p', 'You lean against the wooden door.'),
  ];
  assert.equal(detectMaterialFlip(session).length, 0);
});

test('U336: C2 does NOT flag consistent re-mentions of the same material', () => {
  const session = [
    turn(0, 'p', 'The stone wall is cold.'),
    turn(1, 'p', 'The stone wall holds firm.'),
    turn(2, 'p', 'You lean on the stone wall again.'),
  ];
  assert.equal(detectMaterialFlip(session).length, 0);
});

// ── C3 — object relocation ──────────────────────────────────────────────────
test('U336: C3 flags an object declared absent that later reappears', () => {
  const session = [
    turn(0, 'p', 'There is no letter here — only the chest and lantern.'),
    turn(1, 'p', 'You pry open the chest.'),
    turn(2, 'p', 'The chest\'s contents spill out — a single folded letter, its seal broken.'),
  ];
  const flags = detectObjectRelocation(session);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].seam, 'C3');
  assert.equal(flags[0].turn, 2);
});

test('U336: C3 does NOT flag an object mentioned consistently across turns (no absence claim)', () => {
  const session = [
    turn(0, 'p', 'A folded letter sits atop the chest.'),
    turn(1, 'p', 'You pick up the letter from the chest.'),
    turn(2, 'p', 'You read the letter aloud.'),
  ];
  assert.equal(detectObjectRelocation(session).length, 0);
});

// ── C4 — location teleport ──────────────────────────────────────────────────
test('U336: C4 flags a new room qualifier with no travel mechanics this turn', () => {
  const session = [
    turn(0, 'p', 'You stand in the cottage at Wayfarers\' Outpost.'),
    turn(1, 'p', 'Blood marks the basin here in the back room of the cottage.', 'I check my knuckles.', '[roll:10 vs DC:12 -> mixed]'),
  ];
  const flags = detectLocationTeleport(session);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].seam, 'C4');
});

test('U336: C4 does NOT flag a room qualifier when travel mechanics are present that turn', () => {
  const session = [
    turn(0, 'p', 'You stand in the cottage.'),
    turn(1, 'p', 'You step into the back room of the cottage.', 'I walk into the back room.', '[move: back room | entered]'),
  ];
  assert.equal(detectLocationTeleport(session).length, 0);
});

test('U336: C4 does NOT repeat-flag consistent reuse of the SAME room qualifier', () => {
  const session = [
    turn(0, 'p', 'You stand in the back room of the cottage.', '', '[move | entered]'),
    turn(1, 'p', 'The back room is dim and quiet.'),
    turn(2, 'p', 'You look around the back room again.'),
  ];
  // First mention establishes the qualifier WITH travel mechanics -> not flagged;
  // subsequent re-mentions of the SAME phrase are consistent, not a teleport.
  assert.equal(detectLocationTeleport(session).length, 0);
});

// ── C5 — settlement scale contradiction ─────────────────────────────────────
test('U336: C5 flags "single building" then "handful of buildings" (variable determiner)', () => {
  const session = [
    turn(0, 'p', 'Wayfarers\' Outpost stands as its single building along the road.'),
    turn(1, 'p', 'You can find her somewhere among its handful of buildings.'),
  ];
  const flags = detectScaleContradiction(session);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].seam, 'C5');
});

test('U336: C5 does NOT flag consistent single-building description', () => {
  const session = [
    turn(0, 'p', 'Wayfarers\' Outpost stands as a single building.'),
    turn(1, 'p', 'The single building holds a few travelers.'),
  ];
  assert.equal(detectScaleContradiction(session).length, 0);
});

// ── analyzeCoherence / report plumbing ──────────────────────────────────────
test('U336: analyzeCoherence groups by persona session and aggregates all detectors', () => {
  const run = { type: 'run', runId: 'test-run', regime: 'v1', personas: ['a', 'b'], seeds: ['s'], engineVersion: '0.0.0' };
  const turns = [
    turn(0, 'a', 'Elske Nightherd shrugs.'),
    turn(0, 'b', 'The stone wall is cold.'),
    turn(1, 'b', 'The wooden wall creaks.'),
  ];
  const result = analyzeCoherence({ run, turns });
  assert.equal(result.sessionCount, 2);
  assert.equal(result.totalTurns, 3);
  assert.ok(result.count >= 2, 'both the C1 and C2 synthetic breaks should surface');
  assert.ok(result.bySeam.C1?.length >= 1);
  assert.ok(result.bySeam.C2?.length >= 1);
});

test('U336: analyzeCoherence returns zero flags for a fully consistent transcript', () => {
  const turns = [
    turn(0, 'a', 'You stand in the cottage. A straw pallet lies on the floor.'),
    turn(1, 'a', 'You pick up the pallet.'),
    turn(2, 'a', 'Elske Nightherd stands near the doorway and greets you.'),
    turn(3, 'a', 'Elske Nightherd nods.'),
  ];
  const result = analyzeCoherence({ run: null, turns });
  assert.equal(result.count, 0);
});

test('U336: parseJsonl skips a corrupt line without crashing and keeps valid turns', () => {
  const text = [
    JSON.stringify({ type: 'run', runId: 'x' }),
    '{not valid json',
    JSON.stringify(turn(0, 'a', 'hello')),
  ].join('\n');
  const { run, turns } = parseJsonl(text);
  assert.equal(run.runId, 'x');
  assert.equal(turns.length, 1);
});

test('U336: renderReport and summaryLine produce readable output with turn citations', () => {
  const turns = [turn(0, 'a', 'Elske Nightherd shrugs.')];
  const result = analyzeCoherence({ run: null, turns });
  const report = renderReport(result);
  assert.match(report, /coherence breaks found: 1/);
  assert.match(report, /\[a t1\]/);
  const summary = summaryLine(result);
  assert.match(summary, /COHERENCE: 1 break/);
});
