import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { addFact } from '../engine/ledger.js';
import { guardPlayerText } from '../engine/guard.js';

test('guard blocks contradictions deterministically', () => {
  let w = newWorld({ seed: 's', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = addFact(w, 'not the king is dead', 'gm');

  const res = guardPlayerText(w, "The king is dead.");
  assert.equal(res.ok, false);
  assert.match(res.reason, /conflicts/i);
});
