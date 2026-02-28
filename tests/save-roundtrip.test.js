import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { exportWorld, importWorld } from '../engine/save.js';

test('save export/import roundtrip preserves world', () => {
  const w0 = newWorld({ seed: 'seed', fate: 0.7, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: 'modern' } });
  w0.instrument = {
    theme: 'curiosity vs survival',
    motif: 'dripping wax',
    taboo: 'no easy rescues',
    promise: 'a revelation will demand sacrifice',
    cost: 'time, blood, trust',
    omen: 'Omen: the wax drips.',
    question: 'What will you pay?'
  };
  const text = exportWorld(w0);
  const w1 = importWorld(text);
  assert.equal(w1.meta.seed, w0.meta.seed);
  assert.equal(w1.meta.fate, w0.meta.fate);
  assert.deepEqual(w1.pack, w0.pack);
  // Instrument is extended via ensureWorld defaults; verify legacy fields preserved.
  for (const k of ['theme','motif','taboo','promise','cost','omen','question']) {
    assert.equal(w1.instrument[k], w0.instrument[k]);
  }
});
