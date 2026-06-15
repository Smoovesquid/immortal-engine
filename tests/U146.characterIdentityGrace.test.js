import test from 'node:test';
import assert from 'node:assert/strict';

import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';

// Opus gate (2026-06-15, 2-seed run): the rules-lawyer's "what's my class / level /
// character?" identity queries were dodged with empty in-fiction flavor or a
// fabricated roll (the dominant DM_TEST_DEADEND cluster). Learning your own
// character is an information request — answered in-voice from canon, no roll.

const world = {
  party: [{
    name: 'Lark', archetype: 'Sellsword', level: 1,
    background: { hook: "You've been paid to win and paid to lose." },
    traits: { ideal: 'mercy', flaw: 'too proud' },
    stats: { MIGHT: 9, AGILITY: 10, WITS: 11, GRIT: 9, CHARM: 11 },
    inventory: { weapons: [], armor: [] },
  }],
};

test('U146: identity queries are meta-questions', () => {
  for (const q of ['who am I?', 'what is my class and level?', "what's my character?",
    'what are my stats?', 'tell me my abilities']) {
    assert.ok(isMetaQuestion(q), `should be meta: ${q}`);
  }
});

test('U146: identity answer names class/level from canon, no dice', () => {
  const ans = handleMetaQuestion('what is my class and level?', world);
  assert.match(ans, /Lark/);
  assert.match(ans, /sellsword/i);
  assert.match(ans, /level 1/);
  assert.doesNotMatch(ans, /vs DC|roll:/);
});

test('U146: an explicit stats request returns the real scores', () => {
  const ans = handleMetaQuestion('what are my stats?', world);
  assert.match(ans, /MIGHT 9/);
  assert.match(ans, /CHARM 11/);
});

test('U146: identity does NOT shadow equipment, objective, or actions', () => {
  // "what am I wielding" is equipment, "what am I supposed to do" is objective.
  const wield = handleMetaQuestion('what am I wielding?', world);
  assert.doesNotMatch(wield, /level 1/);            // routed to equipment, not identity
  assert.equal(isMetaQuestion('I attack the guard'), false);
  assert.equal(isMetaQuestion('what am I looking at'), false); // a look action, not identity
});
