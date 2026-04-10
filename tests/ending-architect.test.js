import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { seedMotifs, introduceThread, escalateThread } from '../engine/instrument.js';
import { shouldTriggerEnding, generateEnding } from '../engine/endingArchitect.js';

const pack = { sensoryMotifs: ['m1', 'm2', 'm3'] };

test('deterministic ending generation', () => {
  let w = newWorld({ seed: 'seed', fate: 1.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene = { location: 'tower', objective: 'find', time: 'start', promptSeed: '123', tags: [], thread: '' };
  w = seedMotifs(w, pack);
  w = introduceThread(w, 'the rift wants a price');
  const tid = w.instrument.threads[0].id;
  w = escalateThread(w, tid);
  w.instrument.inevitability = 10;
  // Ending now requires BOTH resolved thread AND inevitability threshold, plus 15+ turns
  w = { ...w, time: { ...w.time, turn: 20 } };
  w.instrument = { ...w.instrument, threads: w.instrument.threads.map(t => t.id === tid ? { ...t, status: 'resolved' } : t) };

  assert.equal(shouldTriggerEnding(w), true);
  const a = generateEnding(w);
  const b = generateEnding(w);
  assert.deepEqual(a, b);
});

test('different fate produces different weighting (often different endingType)', () => {
  let coop = newWorld({ seed: 'seed', fate: 0.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  let blood = newWorld({ seed: 'seed', fate: 1.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  coop.scene = { location: 'tower', objective: 'find', time: 'start', promptSeed: '123', tags: [], thread: '' };
  blood.scene = { location: 'tower', objective: 'find', time: 'start', promptSeed: '123', tags: [], thread: '' };
  coop = seedMotifs(coop, pack);
  blood = seedMotifs(blood, pack);
  coop = introduceThread(coop, 'the rift wants a price');
  blood = introduceThread(blood, 'the rift wants a price');
  coop.instrument.inevitability = 10;
  blood.instrument.inevitability = 10;

  const a = generateEnding(coop).endingType;
  const b = generateEnding(blood).endingType;
  assert.ok(a && b);
});

test('ending always references motif + thread + consequence', () => {
  let w = newWorld({ seed: 'seed', fate: 0.5, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene = { location: 'tower', objective: 'find', time: 'start', promptSeed: '123', tags: [], thread: '' };
  w = seedMotifs(w, pack);
  w = introduceThread(w, 'the rift wants a price');
  w.instrument.inevitability = 10;

  const e = generateEnding(w);
  assert.ok(e.summaryLine.includes('motif:'));
  assert.ok(e.summaryLine.includes('thread:'));
  assert.ok(e.summaryLine.includes('consequence:'));
});
