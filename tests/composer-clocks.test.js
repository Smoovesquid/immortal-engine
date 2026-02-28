import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { compose } from '../engine/composer.js';

const pack = {
  id: 'fantasy',
  toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
  sensoryMotifs: ['air tastes of dust']
};

test('composer clocks shift imagery darker as clocks rise', () => {
  const w0 = newWorld({ seed: 'seed', fate: 0.5, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w0.scene = { location: 'tower', objective: 'find the key', time: 'start', promptSeed: '123' };

  const low = { ...w0, clocks: { pressure: 1, dread: 0, revelation: 0 } };
  const high = { ...w0, clocks: { pressure: 6, dread: 4, revelation: 3 } };

  const resolution = { kind: 'turn', t: 2, roll: 2, dc: 12, success: false, updateKind: 'clock' };
  const a = compose(low, 'I move.', resolution, { pack }).narrationLine;
  const b = compose(high, 'I move.', resolution, { pack }).narrationLine;

  assert.notEqual(a, b);
  assert.ok(b.toLowerCase().includes('dark') || b.toLowerCase().includes('hostile') || b.toLowerCase().includes('weight'));
});
