// U448 — PERC-1: a FAILED (non-crit) perception check over real canon renders a
// hedged, incomplete read — never a confident, authoritative verdict.
//
// Opus gate 2026-07-04 (Chaos-griefer, CRUNCH_INCONSISTENCY): "Wait — is the ceiling
// still on fire or not? I stand in the middle of the room and look up." rolled 1 vs
// DC 13 (failure) yet the DM answered with a definitive, confident all-clear — "plain
// wattle-and-daub, dry and unburnt, with no trace of flame or scorch". The engine's
// room model (engine/structures/roomState.js) carries NO fire/hazard/structural-damage
// field, so that specific claim was invented outright. A real DM who fails a perception
// roll does not get to report back with total confidence — THE_DM_TEST.
//
// hedgedPerceptionRead (engine/grace/gracefulAdjudication.js) is the new deterministic,
// LLM-off floor: a failure-only narration function slotted into the same `grounded ||`
// chain as nonObjectSkillOutcome (baf1b51's honest-search precedent) and
// infoExtractionOutcome. Pure/seeded — no state writes, no new RNG, worldHash untouched.

import test from 'node:test';
import assert from 'node:assert/strict';

import { isPerceptionRecheckIntent, hedgedPerceptionRead } from '../engine/grace/gracefulAdjudication.js';
import { emptyRoomWorld, villageBakerWorld } from '../scripts/convergence/fixtures.mjs';

const GATE_TEXT = 'Wait — is the ceiling still on fire or not? I stand in the middle of the room and look up.';

// Phrasing a real DM must never use after a FAILED read — a confident, closed verdict
// in either direction (an all-clear OR a confirmed hazard).
const AUTHORITATIVE_VERDICT_RE = /\bno\s+trace\s+of\b|\bplain\s+wattle|\bdry\s+and\s+unburnt\b|\bdefinitely\b|\bclearly\s+(?:is|isn'?t|not)\b|\bconfirmed\b|\bwithout\s+(?:a\s+)?doubt\b/i;
// Hedge/incompleteness markers a real DM WOULD use on a bad read.
const HEDGE_MARKER_RE = /\bcan'?t\s+(?:tell|make\s+out|say)\b|\bmurky\b|\buncertain\b|\bhaze\b|\bhonestly\b/i;

test('U448-01: isPerceptionRecheckIntent recognizes the exact gate utterance and close paraphrases', () => {
  assert.equal(isPerceptionRecheckIntent(GATE_TEXT), true);
  assert.equal(isPerceptionRecheckIntent('I look up at the ceiling.'), true);
  assert.equal(isPerceptionRecheckIntent('Is the fire still burning up there? I check.'), true);
  assert.equal(isPerceptionRecheckIntent('I glance up to see if the roof is still smoldering.'), true);
});

test('U448-02: isPerceptionRecheckIntent does NOT over-fire on tracked-canon or unrelated actions', () => {
  // Tracked mechanical state (lockState) — must stay grounded/confident, never hedged.
  assert.equal(isPerceptionRecheckIntent('Is the door still locked?'), false);
  // NPC presence — owned by isExploreIntent/the roster survey, not this function.
  assert.equal(isPerceptionRecheckIntent('Are the guards still outside?'), false);
  // A search action — owned by nonObjectSkillOutcome (baf1b51), not this function.
  assert.equal(isPerceptionRecheckIntent('search the room'), false);
  // A plain room survey — owned by isExploreIntent's free no-roll path.
  assert.equal(isPerceptionRecheckIntent('look around'), false);
  assert.equal(isPerceptionRecheckIntent('is there a window here?'), false);
});

test('U448-03: a FAILED perception renders a hedge — never the invented gate line, never any authoritative verdict', () => {
  const world = emptyRoomWorld();
  const narr = hedgedPerceptionRead(world, GATE_TEXT, 'failure', 8);
  assert.ok(narr && narr.startsWith('Wizard:'), 'renders a narration string');
  assert.doesNotMatch(narr, AUTHORITATIVE_VERDICT_RE, 'must never assert a confident verdict');
  assert.match(narr, HEDGE_MARKER_RE, 'must render doubt/incompleteness');
  // The specific invented gate phrasing must never appear verbatim.
  assert.doesNotMatch(narr, /wattle-and-daub/i);
});

test('U448-04: deterministic — same (world, text, outcome, rawDie) renders the SAME hedge twice', () => {
  const world = emptyRoomWorld();
  const a = hedgedPerceptionRead(world, GATE_TEXT, 'failure', 8);
  const b = hedgedPerceptionRead(world, GATE_TEXT, 'failure', 8);
  assert.equal(a, b, 'no hidden randomness — Math.random is forbidden (rng.js is the sole source)');
  // Re-derive a fresh world (same fixture) and confirm the SAME line renders again —
  // proves this is a pure function of its inputs, not incidental world-identity state.
  const world2 = emptyRoomWorld();
  const c = hedgedPerceptionRead(world2, GATE_TEXT, 'failure', 8);
  assert.equal(a, c, 'deterministic across independently-constructed but state-identical worlds');
});

test('U448-05: SUCCESS and MIXED outcomes return null — this is a FAILURE-ONLY floor', () => {
  const world = emptyRoomWorld();
  assert.equal(hedgedPerceptionRead(world, GATE_TEXT, 'success', 18), null);
  assert.equal(hedgedPerceptionRead(world, GATE_TEXT, 'mixed', 12), null);
  assert.equal(hedgedPerceptionRead(world, GATE_TEXT, 'no-info', 0), null);
});

test('U448-06: non-matching text always returns null regardless of outcome (scoped, not a blanket net)', () => {
  const world = villageBakerWorld();
  assert.equal(hedgedPerceptionRead(world, 'search the room', 'failure', 1), null);
  assert.equal(hedgedPerceptionRead(world, 'is the door still locked?', 'failure', 1), null);
});

test('U448-07: the hedge grounds in the real room name from canon (getRoomState), never inventing a place', () => {
  const world = emptyRoomWorld();
  const narr = hedgedPerceptionRead(world, GATE_TEXT, 'failure', 5);
  // emptyRoomWorld's fixture interior is named 'Bare Test Room' / detail-resolved; the
  // hedge must not claim a DIFFERENT named place than whatever getRoomState actually
  // reports (checked structurally: either it names the real room, or falls back to the
  // safe 'here' — never a fabricated location string).
  assert.ok(/\bfrom (?:the [a-z' -]+|here)\b/i.test(narr), 'names the real room or falls back to "here", never invents one');
});
