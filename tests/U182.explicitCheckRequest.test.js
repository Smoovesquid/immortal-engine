import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// H-19 (Rung-1 gate 2026-06-18) — explicit skill-check requests must route to a
// roll prompt, not a soft refusal or observe-only path.
//
// Root cause: "let me make a WITS check" contained "read" which triggered the
// INSPECT_VERB / observe-only path.  Fix: META_EXPLICIT_CHECK_A/B patterns in
// isMetaQuestion + handler in handleMetaQuestion intercept before tryExamineTarget.

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

function world(seed = 'glass-harbor') {
  return beginAdventure(
    newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }),
    packs()
  ).world;
}

// ── (a) Detection ────────────────────────────────────────────────────────────

test('U182-01: "let me make a WITS check" is detected as a meta-question', () => {
  assert.ok(
    isMetaQuestion('I want to read him properly — let me make a WITS check to see through that calm. What do I roll, and what\'s the DC?'),
    'explicit check request must be a meta-question'
  );
});

test('U182-02: "I want to roll MIGHT against him" is detected', () => {
  assert.ok(
    isMetaQuestion('I want to roll MIGHT against him'),
    '"I want to roll MIGHT" must be detected as a meta-question'
  );
});

test('U182-03: "let me make a check" without stat name is detected', () => {
  assert.ok(isMetaQuestion('Let me make a check on him.'), 'bare check request without stat must be detected');
});

test('U182-04: "can I attempt a GRIT save" is detected', () => {
  assert.ok(isMetaQuestion('Can I attempt a GRIT save?'), '"attempt a GRIT save" must be detected');
});

// ── (b) Handler returns a roll prompt, not a soft refusal ────────────────────

test('U182-10: handler returns DC', () => {
  const w = world();
  const ans = handleMetaQuestion(
    'I want to read him properly — let me make a WITS check to see through that calm. What do I roll, and what\'s the DC?',
    w
  );
  assert.ok(ans, 'handler must return non-null');
  assert.match(ans, /dc\s*\d+/i, 'answer must include a DC number');
});

test('U182-11: handler names the stat', () => {
  const w = world();
  const ans = handleMetaQuestion('Let me make a WITS check', w);
  assert.ok(ans, 'handler must return non-null');
  assert.match(ans, /WITS/i, 'answer must name the WITS stat');
});

test('U182-12: handler mentions rolling (not "no roll needed")', () => {
  const w = world();
  const ans = handleMetaQuestion('Let me make a WITS check to see through his calm', w);
  assert.ok(ans, 'handler must return non-null');
  assert.match(ans, /roll|d20/i, 'answer must prompt a roll');
  assert.doesNotMatch(ans, /no roll(?:\s+is)?\s+needed|just your.*patience/i, 'must not soft-refuse the roll');
});

test('U182-13: playerMove with explicit WITS check request does not return observe-only mechanics', () => {
  const w = world();
  const { output } = playerMove(
    w, packs(),
    'I want to read him properly — let me make a WITS check to see through that calm. What do I roll, and what\'s the DC?'
  );
  assert.doesNotMatch(
    output.mechanics || '',
    /observe only/i,
    'explicit check request must not route to observe-only path'
  );
});

test('U182-14: "I want to roll MIGHT against him" handler names MIGHT and a DC', () => {
  const w = world();
  const ans = handleMetaQuestion('I want to roll MIGHT against him', w);
  assert.ok(ans, 'handler must return non-null');
  assert.match(ans, /MIGHT/i, 'answer must name MIGHT');
  assert.match(ans, /dc\s*\d+/i, 'answer must include a DC');
});

// ── (c) Control — implicit social actions are not forced into roll-prompt path ─

test('U182-20: "I persuade him" is NOT detected as an explicit check request', () => {
  // Plain social intent must flow to social adjudication, not to the roll-prompt gate.
  // It may or may not be a meta-question (it shouldn't be), but if isMetaQuestion
  // returns true via another gate, handleMetaQuestion must return null for it.
  const text = 'I persuade him to step aside';
  // If it's picked up by isMetaQuestion at all, the handler must not produce a roll prompt
  if (isMetaQuestion(text)) {
    const w = world();
    const ans = handleMetaQuestion(text, w);
    // If we get an answer back, it must NOT look like an explicit-check roll prompt
    if (ans) {
      assert.doesNotMatch(ans, /d20.*dc\s*\d+|roll.*dc\s*\d+/i, '"I persuade him" must not force a roll-prompt response');
    }
  }
  // Either way: playerMove must produce a roll (social adjudication), not a blank mechanics line
  const w = world();
  const { output } = playerMove(w, packs(), 'I persuade him to step aside');
  // Social adjudication OR generic resolve — both produce a roll. A blank mechanics line
  // would mean the explicit-check gate erroneously swallowed the action.
  // (social: returns roll:N vs DC:M; meta gate returns '' mechanics.)
  // We just verify it doesn't end up as the explicit-check response.
  assert.doesNotMatch(output.narration, /d20.*dc\s*\d+.*tell me/i, '"I persuade him" must not return a roll-prompt narration');
});

test('U182-21: "I try to convince her" is NOT caught by explicit-check gate', () => {
  // "try" alone without a check/roll/test/save target should not fire.
  assert.ok(!isMetaQuestion('I try to convince her') ||
    !handleMetaQuestion('I try to convince her', world()),
    '"I try to convince her" must not produce explicit-check roll prompt');
});
