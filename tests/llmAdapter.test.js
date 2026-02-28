import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { augmentNarration } from '../engine/llmAdapter.js';
import { addFact } from '../engine/ledger.js';

test('LLM adapter: invalid contradiction triggers fallback to deterministic narration', async () => {
  let w = newWorld({ seed: 'seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene = { location: 'tower', objective: 'find the key', time: 'start', promptSeed: '123' };
  w = addFact(w, 'not the king is dead', 'gm');

  const base = 'Wizard: In hopeful silence at the tower, you keep moving; what do you do?';

  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: 'Wizard: In the tower, the king is dead.' } }]
    })
  });

  const out = await augmentNarration({
    world: w,
    outcome: { kind: 'turn', t: 1 },
    baseNarration: base,
    enabled: true,
    apiKey: 'fake',
    facts: w.ledger.facts.map(f => f.text).slice(0, 10),
    styleProfile: { fate: w.meta.fate, clocks: w.clocks, pack: 'fantasy' },
    fetchImpl
  });

  assert.equal(out, base);
});
