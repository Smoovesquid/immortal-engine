// U317 — CT-1: the roll-report half of a compound demand answers.
//
// RL-5 (Fable second-order diagnosis, docs/briefs/SECOND_ORDER_DIAGNOSIS.md
// §3): "give me the raw d20 and the damage die" answered the damage-die half
// and dropped the roll-report half — META_ROLL_QUERY never folded into the
// weapon-damage answer. This was never a hide-the-math law conflict (the
// engine already reports sheet/ledger numbers on demand); it was a
// compound-drop. Fix folds the last roll (number + DC + outcome) into the
// weapon-damage branch, mirroring the existing stats/purse folds.
//
// Tier-3 (predictive numbers — odds/hit-chance/enemy HP) is NOT touched:
// "what's my chance to hit?" must still be the read, never a number.

import test from 'node:test';
import assert from 'node:assert/strict';

import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';

function world({ combatActive = false } = {}) {
  return {
    meta: { seed: 'tallow' },
    timeline: { length: 3 },
    scene: { promptSeed: 'p1' },
    party: [{
      level: 1,
      stats: { MIGHT: 12, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 },
      foci: [],
      inventory: { weapons: [{ name: 'Hatchet', damage: '1d6' }] },
    }],
    map: { nodes: [], currentNodeId: null },
    conversation: { lastRoll: { roll: 14, dc: 12, outcome: 'success' } },
    combat: combatActive ? { active: true } : { active: false },
  };
}

test('U317: "give me the raw d20 and the damage die" answers BOTH halves', () => {
  const text = 'Give me the raw d20 and the damage die on the Hatchet.';
  assert.ok(isMetaQuestion(text));
  const ans = handleMetaQuestion(text, world());
  assert.match(ans, /14/, 'must report the stored roll digits');
  assert.match(ans, /12/, 'must report the stored DC');
  assert.match(ans, /success/i, 'must report the stored outcome');
  assert.match(ans, /1d6/, 'must report the weapon damage die');
});

test('U317: the compound answer is reachable with combat.active', () => {
  const text = 'Give me the raw d20 and the damage die on the Hatchet.';
  const ans = handleMetaQuestion(text, world({ combatActive: true }));
  assert.match(ans, /14/);
  assert.match(ans, /1d6/);
});

test('U317: a standalone "what did I roll?" still answers as before', () => {
  const text = 'What did I roll?';
  assert.ok(isMetaQuestion(text));
  const ans = handleMetaQuestion(text, world());
  assert.match(ans, /14/);
  assert.match(ans, /12/);
  assert.match(ans, /success/i);
});

test('U317: widened META_ROLL_QUERY phrasings ("the raw d20", "the d20 result") are recognized', () => {
  for (const text of ['What was the raw d20?', 'Tell me the d20 result.', 'What was the actual d20?']) {
    assert.ok(isMetaQuestion(text), `must be a meta-question: ${text}`);
    const ans = handleMetaQuestion(text, world());
    assert.match(ans, /14/, `must report the roll for: ${text}`);
  }
});

test('U317 diverge: "what\'s my chance to hit?" stays the read, never a number (tier-3 guard)', () => {
  const text = "What's my chance to hit?";
  const ans = handleMetaQuestion(text, world());
  if (ans) {
    assert.doesNotMatch(ans, /\d+%/, 'must not invent an odds percentage');
    assert.doesNotMatch(ans, /\b14\b/, 'must not leak the stored roll as a hit-chance answer');
  }
});
