// U252 — D-B4 gate residual (a) part 2: roll-on-demand (C3).
//
// When a Rules-Lawyer explicitly COMMANDS the DM to roll a named save/check and
// show the result ("roll the GRIT save: show me d20 result, plus the modifier,
// plus the total. Numbers only."), the engine must actually ROLL — d20 + the
// stat modifier vs a DC, with the outcome — not recite the breakpoint table
// (the "show me the modifier" phrasing used to divert to META_MODIFIER_FORMULA)
// and not bounce "tell me what you get" (the player has no physical die).
//
// Determinism is sacred: the d20 is drawn from a seed built off world state +
// the request text via the same makeRng/seedFromString path resolveMove uses —
// so it is a pure function of state (replay-stable) and consumes no global RNG
// cursor. The roll is demonstrative; it mutates nothing (narration != canon).
//
// docs/playtests/opus-gate-2026-06-24.md (Rules Lawyer DM — DM_TEST_DEADEND /
// DM_ARTIFACT_LEAK: "A roll was demanded and none was produced").

import test from 'node:test';
import assert from 'node:assert/strict';

import { handleMetaQuestion, isMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { statMod } from '../engine/ruleset/core/stats.js';

// The exact low-score character from the failing transcript, in a settlement
// with no NPC (DC stays at the base 12).
function world() {
  return {
    meta: { seed: 'tallow' },
    timeline: { length: 3 },
    scene: { promptSeed: 'p1' },
    party: [{ level: 1, stats: { MIGHT: 6, AGILITY: 6, WITS: 6, GRIT: 8, CHARM: 6 }, foci: [] }],
    map: { nodes: [], currentNodeId: null },
  };
}

const DEMANDS = [
  'I make a GRIT save right now — roll it and show me the math, including the modifier you add.',
  'Roll the GRIT save: show me d20 result, plus the modifier, plus the total. Numbers only.',
];

// ── (a) the demand actually rolls ───────────────────────────────────────────

test('U252-a: an explicit roll demand is a recognized meta-question', () => {
  for (const q of DEMANDS) assert.ok(isMetaQuestion(q), `must be a meta-question: ${q}`);
});

test('U252-a: a roll demand produces a real d20 + modifier + total vs DC + outcome', () => {
  for (const q of DEMANDS) {
    const ans = handleMetaQuestion(q, world());
    assert.ok(ans, 'must return an answer');
    // A produced die, the GRIT modifier, a total, a DC, and a verdict.
    const m = ans.match(/d20\s+(\d+)\s+(-?\d+)\s+=\s+(-?\d+)\s+vs DC\s+(\d+)\s+—\s+(success|failure)/i);
    assert.ok(m, `must show "d20 N mod = total vs DC d — outcome"; got: ${ans}`);
    const [, die, mod, total, dc, verdict] = m;
    // The die is a real 1–20 result.
    assert.ok(Number(die) >= 1 && Number(die) <= 20, 'die in [1,20]');
    // The modifier equals statMod(GRIT 8) = −1, and the math is internally sound.
    assert.equal(Number(mod), statMod(8), 'modifier is statMod(GRIT 8) = −1');
    assert.equal(Number(total), Number(die) + Number(mod), 'total = die + modifier');
    assert.equal(verdict.toLowerCase() === 'success', Number(total) >= Number(dc), 'verdict matches total vs DC');
    // And it is NOT the breakpoint table or the collaborative bounce.
    assert.doesNotMatch(ans, /breakpoints:/i, 'must not recite the breakpoint table');
    assert.doesNotMatch(ans, /tell me what you get/i, 'must not bounce the roll back to the player');
  }
});

// ── (b) determinism — same state + text → identical roll ────────────────────

test('U252-b: the roll is deterministic (pure function of world state + text)', () => {
  for (const q of DEMANDS) {
    const a = handleMetaQuestion(q, world());
    const b = handleMetaQuestion(q, world());
    assert.equal(a, b, 'identical state + text must yield an identical roll');
  }
});

// ── (c) the collaborative explicit-check path is unchanged ──────────────────

test('U252-c: a collaborative "let me make a WITS check" still sets a DC and asks the player to roll', () => {
  const ans = handleMetaQuestion('Let me make a WITS check to see through his calm', world());
  assert.match(ans, /tell me what you get/i, 'collaborative path keeps the DC-prompt, player rolls');
  assert.doesNotMatch(ans, /Rolling WITS: d20 \d+/, 'must NOT auto-roll a collaborative declaration');
});

test('U252-c: "I want to roll MIGHT against him" stays collaborative', () => {
  const ans = handleMetaQuestion('I want to roll MIGHT against him', world());
  assert.match(ans, /tell me what you get/i);
});

// ── (d) guard — a roll demand with NO named stat must not fabricate a roll ───

test('U252-d: a bare "show me the math" with no named stat does NOT fabricate a roll', () => {
  const ans = handleMetaQuestion('Just show me the math.', world());
  // Either it falls through to some other handler or returns null — but it must
  // NEVER produce a "Rolling <stat>" line out of an unnamed check.
  if (ans) assert.doesNotMatch(ans, /Rolling (?:MIGHT|AGILITY|WITS|GRIT|CHARM): d20/, 'no fabricated roll without a named stat');
});
