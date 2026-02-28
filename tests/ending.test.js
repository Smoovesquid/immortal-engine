import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { triggerEnding, exportChronicle } from '../engine/ending.js';
import { addThreat } from '../engine/ledger.js';

test('ending triggers deterministically under seeded world (dread >= 8)', () => {
  let w = newWorld({ seed: 'end-seed', fate: 0.9, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = { ...w, instrument: { promise: 'a revelation will demand sacrifice', taboo: 'no easy rescues' } };
  w = { ...w, clocks: { ...w.clocks, dread: 8 } };

  const w2 = triggerEnding(w);
  const w3 = triggerEnding(w);

  assert.equal(w2.ending.triggered, true);
  assert.equal(w2.ending.locked, true);
  assert.equal(w2.ending.type, w3.ending.type);
  assert.equal(w2.ending.epilogueLine, w3.ending.epilogueLine);

  // Must reference promise OR taboo.
  assert.ok(/Promise:|Taboo:/i.test(w2.ending.epilogueLine));
});

test('ending trigger: fate high + 3+ threats', () => {
  let w = newWorld({ seed: 'end-seed2', fate: 1.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = { ...w, instrument: { promise: 'a revelation will demand sacrifice', taboo: 'no easy rescues' } };
  w = addThreat(w, 't1', 1);
  w = addThreat(w, 't2', 1);
  w = addThreat(w, 't3', 1);

  const w2 = triggerEnding(w);
  assert.equal(w2.ending.triggered, true);
});

test('chronicle export is stable ordering', () => {
  let w = newWorld({ seed: 'end-seed3', fate: 0.9, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = { ...w, instrument: { promise: 'a revelation will demand sacrifice', taboo: 'no easy rescues' } };
  w = { ...w, clocks: { ...w.clocks, pressure: 10 } };
  w = triggerEnding(w);

  const a = exportChronicle(w);
  const b = exportChronicle(w);
  assert.equal(a.json, b.json);
  assert.equal(a.text, b.text);
});
