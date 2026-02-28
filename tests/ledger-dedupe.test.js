import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { addFact, addThreat, addQuestion } from '../engine/ledger.js';

test('ledger dedupe + caps at 8', () => {
  let w = newWorld({ seed: 's', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });

  w = addFact(w, 'x');
  w = addFact(w, 'x');
  assert.equal(w.ledger.facts.length, 1);

  w = addThreat(w, 't');
  w = addThreat(w, 't');
  assert.equal(w.ledger.threats.length, 1);

  w = addQuestion(w, 'What stands between you and the signal?');
  w = addQuestion(w, 'What stands between you and the signal?');
  assert.ok(w.ledger.questions.length >= 1);
  assert.ok(w.ledger.questions.length <= 2);
  // evolved phrasing present or original only
  assert.ok(w.ledger.questions.some(q => /truly/i.test(q.text)) || w.ledger.questions.some(q => /What stands between/i.test(q.text)));

  // cap behavior
  for (let i = 0; i < 20; i++) w = addFact(w, `f${i}`);
  assert.equal(w.ledger.facts.length, 8);
});
