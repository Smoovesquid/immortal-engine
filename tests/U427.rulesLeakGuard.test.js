// U427 — RL-1: the narration-validator leak guard for rules/mechanics dumps.
// docs/briefs/RL-1-confirm-shape-never-table.md, seam 2.
//
// The deterministic rules-answer floor (U426, gracefulAdjudication.js
// handleMetaQuestion) intercepts the four gate utterances before they ever
// reach LLM polish. This is the SAFETY NET one layer downstream: a
// rules/mechanics question that doesn't match that classifier — a phrasing
// it misses, or one asked mid-combat/mid-dialogue where the meta-intercept
// is deliberately skipped (playloop.js: `!w.combat?.active && !w.scene?.dialogue`)
// — still flows through playerMove → augmentNarration, where Sonnet polish
// could invent or echo a raw table. validateNarrationCandidate (ML-1's
// precedent) now rejects any candidate carrying a breakpoint sequence, a
// numeric DC/TN, a percentage-odds claim, or a multi-stat stat-block run —
// falling back to the always-grounded base narration, exactly like every
// other rule in this function.
//
// Deterministic, LLM-off — validateNarrationCandidate is a pure function.

import test from 'node:test';
import assert from 'node:assert/strict';

import { validateNarrationCandidate } from '../engine/llmAdapter.js';

const BASE = 'You step back outside, the morning quiet over Wayfarers\' Outpost.';
const v = (cand, base = BASE) => validateNarrationCandidate(null, cand, { baseNarration: base });

test('U427-a: a raw modifier-breakpoint dump is REJECTED', () => {
  assert.equal(
    v('Modifier breakpoints: 3 → -4, 4–5 → -3, 6–7 → -2, 8–9 → -1, 10–11 → +0. Wayfarers\' Outpost stirs.'),
    false
  );
  assert.equal(
    v('Breakpoints run 6-7 → -2 and 8-9 → -1 here in Wayfarers\' Outpost.'),
    false
  );
});

test('U427-b: a multi-stat stat-block run is REJECTED', () => {
  assert.equal(
    v('Your measures: MIGHT 6 (-2), AGILITY 6 (-2), WITS 6 (-2), GRIT 8 (-1), CHARM 6 (-2), all here in Wayfarers\' Outpost.'),
    false
  );
});

test('U427-c: a numeric DC or TN leak is REJECTED', () => {
  assert.equal(v('Your blade needs DC 15 to land here in Wayfarers\' Outpost.'), false);
  assert.equal(v('The TN 12 stands between you and the door of Wayfarers\' Outpost.'), false);
});

test('U427-d: a percentage-odds claim is REJECTED', () => {
  assert.equal(v('You reckon your odds at 60% to land the blow, here in Wayfarers\' Outpost.'), false);
  assert.equal(v('There\'s maybe a 15 percent chance, standing in Wayfarers\' Outpost.'), false);
});

test('U427-e: clean in-fiction shape-confirmation prose PASSES untouched', () => {
  assert.equal(
    v('Yes — a d20, your might behind it, against the foe\'s guard, here in Wayfarers\' Outpost.'),
    true
  );
  assert.equal(
    v('A common bandit\'s guard sits about level with your own, here in Wayfarers\' Outpost.'),
    true
  );
});

test('U427-f: a single named stat + modifier is NOT falsely rejected (legitimate self-answer)', () => {
  assert.equal(v('Your MIGHT is 6, a -2 modifier, steady as ever in Wayfarers\' Outpost.'), true);
});

test('U427-g: ordinary combat/atmosphere prose with no leak signature still passes', () => {
  assert.equal(
    v('The bandit staggers back into Wayfarers\' Outpost\'s narrow street, blade raised.'),
    true
  );
});

test('U427-h: the bare word "percent" with no adjoining number is NOT falsely rejected', () => {
  assert.equal(v('A percentage will not tell this story, in Wayfarers\' Outpost.'), true);
  assert.equal(v('Percent chance is not how this table talks, in Wayfarers\' Outpost.'), true);
});
