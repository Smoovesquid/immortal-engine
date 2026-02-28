import test from 'node:test';
import assert from 'node:assert/strict';

import { parseConductJson, applyConductDeltas } from '../engine/ai/conductContract.js';
import { newWorld } from '../engine/state.js';

test('conduct JSON parses and applies deltas safely (logs timeline)', () => {
  const w = newWorld({ seed: 's', fate: 0.8, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });

  const txt = JSON.stringify({
    narration: 'The air tastes metallic and wrong.',
    deltas: {
      addFact: 'A warning sign is nailed to the archway.',
      addThreat: 'Something listens behind the walls.',
      addQuestion: 'Who put the sign here?',
      clock: { dread: 1, pressure: 0, revelation: 0 },
      forceNextBeat: true
    }
  });

  const parsed = parseConductJson(txt);
  assert.equal(parsed.ok, true);

  const w2 = applyConductDeltas(w, parsed.value);
  assert.ok(w2.ledger.facts.length >= w.ledger.facts.length);
  assert.ok(w2.timeline.length === w.timeline.length + 1);
});
