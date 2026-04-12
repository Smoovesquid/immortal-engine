// R3: Rumor garbling — deterministic template + LLM fallback
import test from 'node:test';
import assert from 'node:assert/strict';

import { garbleRumor, garbleRumorWithLlm, extractKeyPhrase, buildGarblePrompt } from '../engine/rumor/garble.js';

const TRUTH = 'The blacksmith hid a cursed blade beneath the forge.';

// ── R3-01: tier 0 returns original body unchanged ─────────────────────────

test('R3-01: garbleRumor at tier 0 returns original body unchanged', () => {
  assert.equal(garbleRumor(TRUTH, 0, {}), TRUTH);
  assert.equal(garbleRumor(TRUTH, -1, {}), TRUTH);
});

// ── R3-02: tier 2+ returns body different from original ───────────────────

test('R3-02: garbleRumor at tier 2+ returns body different from original', () => {
  for (const tier of [2, 3, 4]) {
    const garbled = garbleRumor(TRUTH, tier, {});
    assert.notEqual(garbled, TRUTH, `tier ${tier} should differ from truth`);
    assert.ok(garbled.length > 0, `tier ${tier} should be non-empty`);
  }
});

// ── R3-03: deterministic fallback produces non-empty string for all tiers ─

test('R3-03: garbleRumor produces non-empty string for tiers 1-4', () => {
  for (let tier = 1; tier <= 4; tier++) {
    const result = garbleRumor(TRUTH, tier, { honesty: 0.5 });
    assert.ok(typeof result === 'string' && result.length > 0, `tier ${tier} must yield non-empty string`);
  }
});

// ── R3-04: garbleRumorWithLlm falls back when queryLocal returns {ok:false}

test('R3-04: garbleRumorWithLlm falls back to deterministic when queryLocal fails', async () => {
  const failingQuery = async () => ({ ok: false, reason: 'offline' });
  const result = await garbleRumorWithLlm(TRUTH, 3, {}, failingQuery);
  const deterministic = garbleRumor(TRUTH, 3, {});
  assert.equal(result, deterministic, 'should match deterministic fallback');
});

// ── R3-05: low-honesty carrier produces different text than default ───────

test('R3-05: garbleRumor with low-honesty carrier differs from default at tier 2', () => {
  const lowHonesty = garbleRumor(TRUTH, 2, { honesty: 0.1 });
  const defaultCarrier = garbleRumor(TRUTH, 2, { honesty: 0.5 });
  assert.notEqual(lowHonesty, defaultCarrier, 'low honesty should produce different tier-2 text');
});

// ── R3-06: extractKeyPhrase extracts meaningful words ─────────────────────

test('R3-06: extractKeyPhrase extracts meaningful words from body', () => {
  const phrase = extractKeyPhrase('The blacksmith hid a cursed blade beneath the forge.');
  assert.ok(phrase.length > 0, 'should extract something');
  assert.ok(!phrase.includes('The'), 'should lowercase');
  // Should contain multi-character words, up to 4
  const words = phrase.split(/\s+/);
  assert.ok(words.length >= 1 && words.length <= 4, `got ${words.length} words`);
});

// ── R3-07: garbleRumorWithLlm uses LLM result when valid ─────────────────

test('R3-07: garbleRumorWithLlm uses LLM body when valid', async () => {
  const mockQuery = async () => ({
    ok: true,
    result: { body: 'A strange rumor from the north.' }
  });
  const result = await garbleRumorWithLlm(TRUTH, 2, {}, mockQuery);
  assert.equal(result, 'A strange rumor from the north.');
});

// ── R3-08: garbleRumor returns empty string for empty input ───────────────

test('R3-08: garbleRumor returns empty string for empty input', () => {
  assert.equal(garbleRumor('', 3, {}), '');
  assert.equal(garbleRumor(null, 2, {}), '');
  assert.equal(garbleRumor(undefined, 1, {}), '');
});

// ── R3-09: buildGarblePrompt produces a string mentioning the tier ────────

test('R3-09: buildGarblePrompt includes tier and original text', () => {
  const prompt = buildGarblePrompt(TRUTH, 2, { honesty: 0.5 });
  assert.ok(prompt.includes('tier 2'), 'should mention tier');
  assert.ok(prompt.includes(TRUTH), 'should include original body');
  assert.ok(prompt.includes('JSON'), 'should request JSON output');
});
