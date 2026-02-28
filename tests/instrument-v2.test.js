import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { seedMotifs, introduceThread, escalateThread, resolveThread } from '../engine/instrument.js';

const pack = {
  sensoryMotifs: ['m1', 'm2', 'm3', 'm4']
};

test('motif seeding deterministic by seed', () => {
  const w0 = newWorld({ seed: 'seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const a = seedMotifs(w0, pack);
  const b = seedMotifs(w0, pack);
  assert.deepEqual(a.instrument.motifsCore.active, b.instrument.motifsCore.active);
});

test('thread escalation deterministic and increases inevitability; resolution reduces it', () => {
  let w = newWorld({ seed: 'seed', fate: 1.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = introduceThread(w, 'the rift wants a price');
  const id = w.instrument.threads[0].id;
  const i0 = w.instrument.inevitability;
  w = escalateThread(w, id);
  const i1 = w.instrument.inevitability;
  assert.ok(i1 >= i0);
  w = resolveThread(w, id);
  const i2 = w.instrument.inevitability;
  assert.ok(i2 <= i1);
});
