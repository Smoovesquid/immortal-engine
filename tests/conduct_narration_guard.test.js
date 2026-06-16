import test from 'node:test';
import assert from 'node:assert/strict';

import { handleAiRequest } from '../server/ai.js';

// Mock OpenAI-style client whose responses.create returns a fixed output_text.
function mockClient(outputText) {
  return {
    responses: {
      create: async () => ({ output_text: outputText, system_fingerprint: 'fp_test' })
    }
  };
}

const COMPOSER_LINE = 'You tuck the coin away for safekeeping.';

function conductBody() {
  return {
    mode: 'CONDUCT',
    seed: 1,
    composerLine: COMPOSER_LINE,
    worldSnapshot: { nouns: [], tags: [], motifs: [] },
    styleProfile: { voice: 'plain', verbosity: 0, fate: 0.2 }
  };
}

test('CONDUCT garbled narration falls back to composerLine', async () => {
  const payload = JSON.stringify({
    narration: 'The it to bank is yours now, tucked away.',
    deltas: { addFact: null, addThreat: null, addQuestion: null, clock: null, forceNextBeat: null }
  });
  const res = await handleAiRequest({ client: mockClient(payload), body: conductBody() });
  assert.equal(res.ok, true);
  assert.equal(res.json.narration, COMPOSER_LINE);
});

test('CONDUCT clean narration passes through unchanged', async () => {
  const clean = 'You tuck the coin into your pocket and move on.';
  const payload = JSON.stringify({
    narration: clean,
    deltas: { addFact: null, addThreat: null, addQuestion: null, clock: null, forceNextBeat: null }
  });
  const res = await handleAiRequest({ client: mockClient(payload), body: conductBody() });
  assert.equal(res.ok, true);
  assert.equal(res.json.narration, clean);
});
