// U380 — INT-2R: the provider ORDER for the server-side LLM-intent proposal.
//
// Tim's rulings 2026-07-03 (the evening Haiku-primary ruling superseded the
// morning's Ollama-primary): Anthropic's fast tier (INTENT_LLM_MODEL, default
// claude-haiku-4-5) is PRIMARY; local Ollama is the free/offline fallback.
// engine/intent/llmIntent.js's `INTENT_LLM` env flag selects the order:
//   'off'       — no provider consulted at all (covered by U377's zero-
//                 outbound-calls gate; not re-tested here).
//   'auto' (default/unset) — Anthropic first, Ollama only on an Anthropic miss.
//   'ollama'    — Ollama only, no Anthropic fallback even on a miss.
//   'anthropic' — Anthropic only, no Ollama attempted at all.
//
// All network is a MOCKED fetchImpl routed by URL — zero real network calls.

import test from 'node:test';
import assert from 'node:assert/strict';

import { proposeIntentViaLlm } from '../engine/intent/llmIntent.js';
import { _resetForTest as resetOllamaAvailability } from '../server/localLlmProvider.js';

const BUNDLE = {
  entities: [{ id: 'goblin_1', name: 'goblin', ref: null }],
  abilities: ['Worn Blade'],
  spells: [],
  items: ['torch']
};

// A fetchImpl that records which provider endpoint was hit, in order, and
// returns a valid packet-shaped JSON reply for whichever provider is asked.
function makeRecordingFetch({ ollamaOk = true, anthropicOk = true } = {}) {
  const calls = [];
  const anthropicModels = []; // the `model` field each Anthropic request carried
  const fetchImpl = async (url, opts) => {
    const u = String(url);
    if (u.includes(':11434')) {
      calls.push('ollama');
      if (!ollamaOk) return { ok: false, status: 500, text: async () => 'ollama down' };
      return {
        ok: true,
        json: async () => ({ response: JSON.stringify({ verb: 'attack', target: 'goblin' }) })
      };
    }
    if (u.includes('api.anthropic.com')) {
      calls.push('anthropic');
      try { anthropicModels.push(JSON.parse(String(opts?.body || '{}')).model || null); } catch { anthropicModels.push(null); }
      if (!anthropicOk) return { ok: false, status: 500, text: async () => 'anthropic down' };
      return {
        ok: true,
        json: async () => ({ content: [{ text: JSON.stringify({ verb: 'attack', target: 'goblin' }) }] })
      };
    }
    calls.push(`unknown:${u}`);
    return { ok: false, status: 404, text: async () => 'not found' };
  };
  return { fetchImpl, calls, anthropicModels };
}

function withEnv(vars, fn) {
  const prev = {};
  for (const k of Object.keys(vars)) prev[k] = process.env[k];
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return Promise.resolve(fn()).finally(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

test('U380: default (INTENT_LLM unset/auto) — Anthropic is consulted BEFORE Ollama', async () => {
  resetOllamaAvailability();
  await withEnv({ INTENT_LLM: undefined, INTENT_LLM_MODEL: undefined, ANTHROPIC_API_KEY: 'test-key-not-real' }, async () => {
    const { fetchImpl, calls } = makeRecordingFetch();
    const result = await proposeIntentViaLlm(null, 'I stab the goblin', BUNDLE, { fetchImpl });
    assert.deepEqual(calls, ['anthropic'], 'a healthy Anthropic response must short-circuit before Ollama is ever touched (Haiku-primary ruling)');
    assert.equal(result.verb, 'attack');
  });
});

test('U380: default (auto) — Ollama is consulted only AFTER an Anthropic miss', async () => {
  resetOllamaAvailability();
  await withEnv({ INTENT_LLM: undefined, INTENT_LLM_MODEL: undefined, ANTHROPIC_API_KEY: 'test-key-not-real' }, async () => {
    const { fetchImpl, calls } = makeRecordingFetch({ anthropicOk: false });
    const result = await proposeIntentViaLlm(null, 'I stab the goblin', BUNDLE, { fetchImpl });
    assert.deepEqual(calls, ['anthropic', 'ollama'], 'Anthropic must be attempted first even when it will miss, THEN Ollama as the offline fallback');
    assert.equal(result.verb, 'attack');
  });
});

test('U380: the ears request the intent model — claude-haiku-4-5 by default, INTENT_LLM_MODEL override respected', async () => {
  resetOllamaAvailability();
  await withEnv({ INTENT_LLM: 'anthropic', INTENT_LLM_MODEL: undefined, ANTHROPIC_API_KEY: 'test-key-not-real' }, async () => {
    const { fetchImpl, anthropicModels } = makeRecordingFetch();
    await proposeIntentViaLlm(null, 'I stab the goblin', BUNDLE, { fetchImpl });
    assert.deepEqual(anthropicModels, ['claude-haiku-4-5'], 'the intent translator must ask for the fast tier by default, independent of LLM_MODEL');
  });
  await withEnv({ INTENT_LLM: 'anthropic', INTENT_LLM_MODEL: 'claude-sonnet-4-6', ANTHROPIC_API_KEY: 'test-key-not-real' }, async () => {
    const { fetchImpl, anthropicModels } = makeRecordingFetch();
    await proposeIntentViaLlm(null, 'I stab the goblin', BUNDLE, { fetchImpl });
    assert.deepEqual(anthropicModels, ['claude-sonnet-4-6'], 'INTENT_LLM_MODEL must override the ears model per-env');
  });
});

test('U380: INTENT_LLM=ollama — Ollama only, no Anthropic fallback on a miss', async () => {
  resetOllamaAvailability();
  await withEnv({ INTENT_LLM: 'ollama', ANTHROPIC_API_KEY: 'test-key-not-real' }, async () => {
    const { fetchImpl, calls } = makeRecordingFetch({ ollamaOk: false });
    const result = await proposeIntentViaLlm(null, 'I stab the goblin', BUNDLE, { fetchImpl });
    assert.deepEqual(calls, ['ollama'], 'INTENT_LLM=ollama must never fall through to Anthropic');
    assert.equal(result, null);
  });
});

test('U380: INTENT_LLM=anthropic — Anthropic only, Ollama never attempted', async () => {
  resetOllamaAvailability();
  await withEnv({ INTENT_LLM: 'anthropic', ANTHROPIC_API_KEY: 'test-key-not-real' }, async () => {
    const { fetchImpl, calls } = makeRecordingFetch();
    const result = await proposeIntentViaLlm(null, 'I stab the goblin', BUNDLE, { fetchImpl });
    assert.deepEqual(calls, ['anthropic'], 'INTENT_LLM=anthropic must never touch the Ollama endpoint');
    assert.equal(result.verb, 'attack');
  });
});

test('U380: INTENT_LLM=off — no provider is consulted at all (covers the same guarantee as U377, at the function level)', async () => {
  resetOllamaAvailability();
  await withEnv({ INTENT_LLM: 'off', ANTHROPIC_API_KEY: 'test-key-not-real' }, async () => {
    const { fetchImpl, calls } = makeRecordingFetch();
    const result = await proposeIntentViaLlm(null, 'I stab the goblin', BUNDLE, { fetchImpl });
    assert.deepEqual(calls, []);
    assert.equal(result, null);
  });
});

test('U380: both providers miss (auto) — returns null, never throws', async () => {
  resetOllamaAvailability();
  await withEnv({ INTENT_LLM: undefined, INTENT_LLM_MODEL: undefined, ANTHROPIC_API_KEY: 'test-key-not-real' }, async () => {
    const { fetchImpl, calls } = makeRecordingFetch({ ollamaOk: false, anthropicOk: false });
    const result = await proposeIntentViaLlm(null, 'I stab the goblin', BUNDLE, { fetchImpl });
    assert.deepEqual(calls, ['anthropic', 'ollama']);
    assert.equal(result, null);
  });
});
