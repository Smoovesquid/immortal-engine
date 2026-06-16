import test from 'node:test';
import assert from 'node:assert/strict';

import { validatePolish, looksGarbled } from '../engine/ai/polishValidation.js';
import { newWorld } from '../engine/state.js';

test('polish validation rejects forbidden tokens, brackets, and multi-sentence', () => {
  const w = newWorld({ seed: 's', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const base = 'A door creaks in the dark.';

  assert.equal(validatePolish({ world: w, composerLine: base, candidateText: 'Actually, it is fine.' }).ok, false);
  assert.equal(validatePolish({ world: w, composerLine: base, candidateText: 'A door creaks [roll:1].' }).ok, false);
  assert.equal(validatePolish({ world: w, composerLine: base, candidateText: 'A door creaks. Another line.' }).ok, false);
});

test('polish validation rejects garbled article+function-word echoes', () => {
  const w = newWorld({ seed: 's', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const base = 'A door creaks in the dark.';

  const r = validatePolish({ world: w, composerLine: base, candidateText: 'The it to bank is yours now, tucked away.' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'garbled');
});

test('looksGarbled passes grammatical prose', () => {
  assert.equal(looksGarbled('the inn door'), false);
  assert.equal(looksGarbled('the one path'), false);
  assert.equal(looksGarbled('You get a hand on their money, though carrying it off is more awkward than you had hoped.'), false);
  assert.equal(looksGarbled('The it to bank is yours now, tucked away.'), true);
});
