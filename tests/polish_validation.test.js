import test from 'node:test';
import assert from 'node:assert/strict';

import { validatePolish } from '../engine/ai/polishValidation.js';
import { newWorld } from '../engine/state.js';

test('polish validation rejects forbidden tokens, brackets, and multi-sentence', () => {
  const w = newWorld({ seed: 's', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const base = 'A door creaks in the dark.';

  assert.equal(validatePolish({ world: w, composerLine: base, candidateText: 'Actually, it is fine.' }).ok, false);
  assert.equal(validatePolish({ world: w, composerLine: base, candidateText: 'A door creaks [roll:1].' }).ok, false);
  assert.equal(validatePolish({ world: w, composerLine: base, candidateText: 'A door creaks. Another line.' }).ok, false);
});
