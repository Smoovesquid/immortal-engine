// U295 — ML-3: modelRejectsTemperature / anthropicSamplingFields — single source of truth
// for the "Opus 4.x rejects temperature (HTTP 400)" quirk. All four Anthropic call sites
// now consult anthropicSamplingFields; the bug was llmProvider.js passing temperature
// unconditionally even when the model is Opus 4.x. Zero behavior change for Sonnet/Haiku.

import test from 'node:test';
import assert from 'node:assert/strict';
import { modelRejectsTemperature, anthropicSamplingFields } from '../engine/llmModelRules.js';
import { chatCompletion } from '../server/llmProvider.js';

// ── predicate unit tests ──────────────────────────────────────────────────────

test('U295: modelRejectsTemperature — Opus 4.x family returns true', () => {
  assert.ok(modelRejectsTemperature('claude-opus-4-8'));
  assert.ok(modelRejectsTemperature('claude-opus-4-7'));
  assert.ok(modelRejectsTemperature('claude-opus-4-0'));
});

test('U295: modelRejectsTemperature — Sonnet and Haiku return false', () => {
  assert.ok(!modelRejectsTemperature('claude-sonnet-4-6'));
  assert.ok(!modelRejectsTemperature('claude-haiku-4-5-20251001'));
  assert.ok(!modelRejectsTemperature('claude-sonnet-4-5'));
});

test('U295: modelRejectsTemperature — empty / null returns false', () => {
  assert.ok(!modelRejectsTemperature(''));
  assert.ok(!modelRejectsTemperature(null));
  assert.ok(!modelRejectsTemperature(undefined));
});

test('U295: anthropicSamplingFields — Opus 4 omits temperature', () => {
  const fields = anthropicSamplingFields('claude-opus-4-8', 0.7);
  assert.ok(!Object.prototype.hasOwnProperty.call(fields, 'temperature'),
    'Opus 4 sampling fields must NOT include temperature');
});

test('U295: anthropicSamplingFields — Sonnet includes temperature', () => {
  const fields = anthropicSamplingFields('claude-sonnet-4-6', 0.7);
  assert.equal(fields.temperature, 0.7,
    'Sonnet sampling fields must include temperature');
});

test('U295: anthropicSamplingFields — temperature value is preserved for non-Opus', () => {
  assert.equal(anthropicSamplingFields('claude-haiku-4-5-20251001', 0.2).temperature, 0.2);
  assert.equal(anthropicSamplingFields('claude-sonnet-4-6', 0).temperature, 0);
});

// ── fetchImpl injection: verify callAnthropic request body ────────────────────

function makeCaptureFetch(reply = 'ok') {
  let captured;
  const fetchImpl = async (_url, opts) => {
    captured = JSON.parse(opts.body);
    return {
      ok: true,
      json: async () => ({ content: [{ text: reply }] })
    };
  };
  return { fetchImpl, getBody: () => captured };
}

test('U295: chatCompletion omits temperature in Anthropic body for Opus model', async () => {
  const origKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'test-key';
  const { fetchImpl, getBody } = makeCaptureFetch();
  try {
    await chatCompletion({
      messages: [{ role: 'user', content: 'hello' }],
      model: 'claude-opus-4-8',
      temperature: 0.5,
      max_tokens: 10,
      fetchImpl
    });
    assert.ok(!('temperature' in getBody()),
      'Anthropic request body must NOT include temperature for Opus 4');
  } finally {
    process.env.ANTHROPIC_API_KEY = origKey;
  }
});

test('U295: chatCompletion includes temperature in Anthropic body for Sonnet model', async () => {
  const origKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'test-key';
  const { fetchImpl, getBody } = makeCaptureFetch();
  try {
    await chatCompletion({
      messages: [{ role: 'user', content: 'hello' }],
      model: 'claude-sonnet-4-6',
      temperature: 0.5,
      max_tokens: 10,
      fetchImpl
    });
    assert.equal(getBody().temperature, 0.5,
      'Anthropic request body must include temperature for Sonnet');
  } finally {
    process.env.ANTHROPIC_API_KEY = origKey;
  }
});
