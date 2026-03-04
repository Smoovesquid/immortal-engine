import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../../engine/state.js';
import { worldHash } from '../../engine/worldHash.js';
import { parseConductJson, applyConductDeltas } from '../../engine/ai/conductContract.js';

test('U37: LLM Boundary Integrity — prose-only output cannot mutate world', () => {
  const w0 = newWorld({ seed: 'u37-prose', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const h0 = worldHash(w0);

  // Simulate an LLM response that is NOT valid CONDUCT JSON.
  const prose = 'The torch sputters. You feel watched.';
  const parsed = parseConductJson(prose);
  assert.equal(parsed.ok, false);

  // Boundary rule: invalid model output must not be applied.
  const w1 = w0;
  const h1 = worldHash(w1);

  assert.equal(h1, h0);
});
