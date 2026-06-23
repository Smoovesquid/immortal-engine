// U239 — gate-18 (Rules-Lawyer): the proficiency bonus / final to-hit are MODELED
// (levelTable.profBonus; +2 at L1; meleeProfile.atkBonus) but had no META pattern, so
// "what's my proficiency bonus?" fell to a gen roll / observe / decline ("the answer lives
// outside the walls", a WITS recall that failed) — a DM_TEST_DEADEND on the most basic
// sheet number a Rules Lawyer is owed.
//
// FIX: META_PROFICIENCY answers the proficiency bonus straight from the sheet (never
// rolled) and resolves the equipped-weapon to-hit (meleeProfile folds ability mod +
// proficiency), so a compound "proficiency bonus … to-hit number" is fully answered.
// META_ATTACK_MOD's determiner widened to accept "give me THE to-hit number" (was "my").
//
// Pure assertion on end-to-end playerMove — no LLM, deterministic. Sibling to the other
// META crunch-transparency handlers (H-25/H-40/H-61). See docs/CAPABILITY_LEDGER.md gate-18.

import test from 'node:test';
import assert from 'node:assert/strict';

import { playerMove } from '../engine/playloop.js';
import { isMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { PACKS, villageBakerWorld } from '../scripts/convergence/fixtures.mjs';

const e2e = (text) => String(playerMove(villageBakerWorld(), PACKS, text).output?.narration || '');
const PROF_RE = /proficiency bonus is \+2|proficiency bonus.*\+2|\+2 \(level 1\)/i;
const DEADEND_RE = /outside the walls|stays just out of grasp|out of grasp|it doesn'?t land|eyes move slow|ways lead off|\[roll:/i;

// ── 1. Proficiency bonus is answered from the sheet, never rolled/declined ────

test('U239-01: "proficiency bonus" queries are recognized as meta', () => {
  assert.equal(isMetaQuestion('Give me my proficiency bonus as a flat number.'), true);
  assert.equal(isMetaQuestion("What's my proficiency bonus?"), true);
  assert.equal(isMetaQuestion('proficiency bonus?'), true);
});

test('U239-02: "give me my proficiency bonus as a flat number" → +2, not a roll/decline', () => {
  const out = e2e('Give me my proficiency bonus as a flat number.');
  assert.match(out, PROF_RE, `must state the +2 proficiency bonus: ${out}`);
  assert.doesNotMatch(out, DEADEND_RE, `must not roll/decline a sheet number: ${out}`);
});

test('U239-03: the compound "proficiency bonus … to-hit number" is fully answered', () => {
  const out = e2e("What's my proficiency bonus, and is the Worn Blade a weapon I'm trained with? Give me the to-hit number.");
  assert.match(out, PROF_RE, `must answer proficiency: ${out}`);
  assert.match(out, /to-hit|to hit|attack bonus|\+\d/i, `must address the to-hit: ${out}`);
  assert.doesNotMatch(out, /outside the walls|eyes move slow/i, `must not dodge: ${out}`);
});

test('U239-04: "Proficiency bonus is +2. Pick one." gets the flat value, not a non-answer', () => {
  const out = e2e('That\'s a system failure. Proficiency bonus is the same kind of number. Pick one: +2.');
  assert.match(out, PROF_RE, `must confirm the proficiency value: ${out}`);
});

test('U239-05: "give me the to-hit number" (the "the" determiner) is now answered', () => {
  const out = e2e('give me the to-hit number');
  assert.match(out, /to-hit|to hit|attack bonus|MIGHT|AGILITY|\+\d/i, `must answer the to-hit: ${out}`);
  assert.doesNotMatch(out, /it doesn'?t land|eyes move slow|ways lead off/i);
});

// ── 2. Diverge negatives — unrelated asks/actions are unaffected ──────────────

test('U239-10: a declared attack is not read as a proficiency query', () => {
  assert.equal(isMetaQuestion('I attack the bandit'), false);
});

test('U239-11: other sheet queries still answer their own thing', () => {
  assert.match(e2e('what is my MIGHT modifier?'), /MIGHT is 13|MIGHT.*\+1/i);
  assert.match(e2e('what do I have on me?'), /pack|Hatchet|Worn Blade/i);
});
