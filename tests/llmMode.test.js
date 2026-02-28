import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { augmentNarration } from '../engine/llmAdapter.js';

// These tests stay offline: fetch is mocked.

test('LLM disabled -> output equals composer/base line', async () => {
  const w = newWorld({ seed: 's', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene = { location: 'tower', objective: 'find the key', time: 'start', promptSeed: '123', tags: [], thread: '' };

  const base = 'Wizard: In the tower, you keep to the objective; what do you do?';
  const out = await augmentNarration({ world: w, baseNarration: base, enabled: false, apiKey: 'fake', fetchImpl: async () => { throw new Error('should not call'); } });
  assert.equal(out, base);
});

test('LLM enabled but adapter fails -> fallback works; canon world unchanged', async () => {
  const w0 = newWorld({ seed: 's', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w0.scene = { location: 'tower', objective: 'find the key', time: 'start', promptSeed: '123', tags: [], thread: '' };
  const before = JSON.stringify(w0);

  const base = 'Wizard: In the tower, you keep to the objective; what do you do?';
  const out = await augmentNarration({
    world: w0,
    baseNarration: base,
    enabled: true,
    apiKey: 'fake',
    fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) })
  });

  assert.equal(out, base);
  assert.equal(JSON.stringify(w0), before);
});
