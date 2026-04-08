// Rulesets tests — fateBand thresholds, normalizePack, toneWordsFor
import test from 'node:test';
import assert from 'node:assert/strict';

import { fateBand, normalizePack, toneWordsFor } from '../engine/rulesets.js';

// ── fateBand threshold tests ──────────────────────────────────────────

test('fateBand: cooperative below 0.34', () => {
  assert.equal(fateBand(0), 'cooperative');
  assert.equal(fateBand(0.1), 'cooperative');
  assert.equal(fateBand(0.33), 'cooperative');
});

test('fateBand: grim at 0.34 boundary', () => {
  assert.equal(fateBand(0.34), 'grim');
  assert.equal(fateBand(0.5), 'grim');
  assert.equal(fateBand(0.66), 'grim');
});

test('fateBand: blood at 0.67 boundary', () => {
  assert.equal(fateBand(0.67), 'blood');
  assert.equal(fateBand(0.8), 'blood');
  assert.equal(fateBand(1.0), 'blood');
});

test('fateBand: clamps out-of-range values', () => {
  assert.equal(fateBand(-1), 'cooperative');
  assert.equal(fateBand(2), 'blood');
});

test('fateBand: handles non-finite input', () => {
  assert.equal(fateBand(NaN), 'cooperative');
  assert.equal(fateBand(undefined), 'cooperative');
  assert.equal(fateBand(null), 'cooperative');
});

// ── normalizePack tests ───────────────────────────────────────────────

test('normalizePack: returns valid pack from raw input', () => {
  const raw = {
    id: 'test-pack',
    toneWords: {
      cooperative: ['calm', 'warm'],
      grim: ['tense'],
      blood: ['violent']
    },
    starterLocations: ['village'],
    starterObjectives: ['survive'],
    skills: ['persuade']
  };
  const pack = normalizePack(raw);
  assert.equal(pack.id, 'test-pack');
  assert.deepEqual(pack.toneWords.cooperative, ['calm', 'warm']);
  assert.deepEqual(pack.toneWords.grim, ['tense']);
  assert.deepEqual(pack.toneWords.blood, ['violent']);
});

test('normalizePack: handles missing fields gracefully', () => {
  const pack = normalizePack({});
  assert.ok(pack);
  assert.ok(Array.isArray(pack.toneWords?.cooperative));
  assert.ok(Array.isArray(pack.toneWords?.grim));
  assert.ok(Array.isArray(pack.toneWords?.blood));
});

test('normalizePack: handles null input', () => {
  const pack = normalizePack(null);
  assert.ok(pack);
});

// ── toneWordsFor tests ────────────────────────────────────────────────

test('toneWordsFor: returns correct words for cooperative band', () => {
  const pack = normalizePack({
    toneWords: { cooperative: ['calm'], grim: ['tense'], blood: ['violent'] }
  });
  const words = toneWordsFor(pack, 0.1);
  assert.deepEqual(words, ['calm']);
});

test('toneWordsFor: returns correct words for blood band', () => {
  const pack = normalizePack({
    toneWords: { cooperative: ['calm'], grim: ['tense'], blood: ['violent'] }
  });
  const words = toneWordsFor(pack, 0.9);
  assert.deepEqual(words, ['violent']);
});

test('toneWordsFor: returns empty array for missing pack', () => {
  const words = toneWordsFor(null, 0.5);
  assert.deepEqual(words, []);
});
