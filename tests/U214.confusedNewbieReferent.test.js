// U214 — H-51: two confused-newbie content-resolution bugs (post-H-47/H-48/H-49
// gate, docs/playtests/opus-gate-2026-06-20.md).
//
// (a) META_NPC_OBSERVER self-answered as the ADDRESSEE instead of the third
//     party being asked about. "Corwin, you keep going quiet on me — who is
//     this person you don't want to name?" is a question addressed TO Corwin,
//     asking about a DIFFERENT, deliberately-unnamed party — DM answered with
//     "Corwin Boneknit, a representative — one of the folk here, watching from
//     nearby.", describing Corwin himself. Root cause: the handler picks
//     sociable[0] whenever NPC_OBSERVER_LURK_RE doesn't match, and Corwin (the
//     addressee) was sociable[0]. Fixed by widening NPC_OBSERVER_LURK_RE to
//     catch "won't name"/"don't want to name"/"keep going quiet" evasion
//     framing (same semantic shape as "lurking"/"edges"), and by excluding the
//     explicitly-addressed NPC from the sociable candidate pool when that
//     framing is present.
//
// (b) An out-of-character fourth-wall callout about response repetition
//     ("You're just repeating yourself now, are you okay?") got resolved as a
//     real action — a roll fired (`[roll:13 vs DC:12 -> mixed | ...]`). Fixed
//     with a new META_SYSTEM_CHECKIN detector wired into isMetaQuestion, with
//     a non-rolling in-voice acknowledgment — careful not to catch a genuine
//     in-fiction "are you okay?" to an NPC.

import test from 'node:test';
import assert from 'node:assert/strict';

import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';

function rosterWorld(npcs) {
  return {
    map: { currentNodeId: 'n1', nodes: [{ id: 'n1', settlement: { npcs } }] },
    party: [{ stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 } }]
  };
}

const CORWIN_NPC = { id: 'corwin', name: 'Corwin', role: 'representative', hostile: false };
const LURKER_NPC = { id: 'lingerer', name: 'the Lingerer', role: 'stranger', hostile: true };

// ── (a) MUST-MATCH — the verbatim gate phrasing ─────────────────────────────

test('U214-01: MUST-MATCH — "Corwin, who is this person you don\'t want to name?" never self-answers as Corwin', () => {
  const world = rosterWorld([CORWIN_NPC, LURKER_NPC]);
  const text = "Corwin, you keep going quiet on me — who is this person you don't want to name?";
  assert.equal(isMetaQuestion(text), true, 'must be recognized as a meta-question');
  const ans = handleMetaQuestion(text, world);
  assert.doesNotMatch(ans, /^Corwin\b|\bCorwin Boneknit\b/i, `must not self-describe the addressee as the referent: ${ans}`);
});

test('U214-02: the lurker is named/described when a real one is present', () => {
  const world = rosterWorld([CORWIN_NPC, LURKER_NPC]);
  const text = "Corwin, you keep going quiet on me — who is this person you don't want to name?";
  const ans = handleMetaQuestion(text, world);
  assert.match(ans, /Lingerer/i, `with a real lurker present, must name them: ${ans}`);
});

test('U214-03: with NO real lurker present, falls back to an honest non-self-referencing line', () => {
  const world = rosterWorld([CORWIN_NPC]);
  const text = "Corwin, you keep going quiet on me — who is this person you don't want to name?";
  const ans = handleMetaQuestion(text, world);
  assert.doesNotMatch(ans, /^Corwin\b|\bCorwin Boneknit\b|one of the folk here, watching from nearby/i, `must not self-reference the addressee even with no real lurker: ${ans}`);
});

// ── (a) false-positive guard (c) — regression on the EXISTING simple case ──

test('U214-10: regression guard — "Who\'s that stranger watching me?" with only a lurker present resolves exactly as before', () => {
  const world = rosterWorld([LURKER_NPC]);
  const text = "Who's that stranger watching me?";
  const ans = handleMetaQuestion(text, world);
  assert.match(ans, /Lingerer/i, `unchanged behavior for the simple no-addressee case: ${ans}`);
});

test('U214-11: regression guard — generic lurk-framed ask with mixed roster still prefers the real lurker (U207-30 contract)', () => {
  const world = rosterWorld([CORWIN_NPC, LURKER_NPC]);
  const text = 'Who is the stranger lurking at the edges?';
  const ans = handleMetaQuestion(text, world);
  assert.match(ans, /Lingerer/i, `unchanged behavior: ${ans}`);
  assert.doesNotMatch(ans, /Corwin/i, `unchanged behavior: ${ans}`);
});

// ── (b) MUST-MATCH — repetition + check-in callout never rolls ─────────────

test('U214-20: MUST-MATCH — "You\'re just repeating yourself now, are you okay?" is recognized as meta (no roll)', () => {
  const text = "You're just repeating yourself now, are you okay?";
  assert.equal(isMetaQuestion(text), true, 'must be recognized as a meta-question so the action resolver never rolls it');
});

test('U214-21: the handler gives a brief in-voice acknowledgment, not a content-free hedge', () => {
  const world = rosterWorld([CORWIN_NPC]);
  const text = "You're just repeating yourself now, are you okay?";
  const ans = handleMetaQuestion(text, world);
  assert.ok(ans, 'must produce a non-null response');
  assert.doesNotMatch(ans, /it half-works|mixed|roll:/i, `must not be a content-free mixed-roll hedge: ${ans}`);
});

test('U214-22: MUST-MATCH — sibling phrasing "you keep saying the same thing, are you there?"', () => {
  assert.equal(isMetaQuestion('You keep saying the same thing, are you there?'), true);
});

test('U214-23: MUST-MATCH — "that\'s the same answer as before, are you stuck?"', () => {
  assert.equal(isMetaQuestion("That's the same answer as before, are you stuck?"), true);
});

// ── (b) false-positive guard (d) — genuine in-fiction "are you okay?" still resolves normally ──

test('U214-30: false-positive guard — a plain in-fiction "are you okay?" to an NPC (no repetition callout) is NOT caught as a system check-in', () => {
  assert.equal(isMetaQuestion('Are you okay?'), false, 'must not be treated as a fourth-wall system check');
});

test('U214-31: false-positive guard — "Hey, are you alright after that fall?" stays normal dialogue, not a non-rolling system check', () => {
  assert.equal(isMetaQuestion('Hey, are you alright after that fall?'), false);
});
