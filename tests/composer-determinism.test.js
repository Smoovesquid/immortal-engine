import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { compose } from '../engine/composer.js';

const pack = {
  id: 'fantasy',
  toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
  sensoryMotifs: ['air tastes of dust', 'a distant drip keeps perfect time']
};

test('composer deterministic: same world + same inputs => same lines', () => {
  const w = newWorld({ seed: 'seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene = { location: 'tower', objective: 'find the key', time: 'start', promptSeed: '123', tags: [], thread: '' };

  const resolution = { kind: 'turn', t: 5, roll: 12, dc: 10, success: true, updateKind: 'fact' };
  const a = compose(w, 'I search.', resolution, { pack });
  const b = compose(w, 'I search.', resolution, { pack });
  assert.deepEqual(a.narrationLine, b.narrationLine);
  assert.deepEqual(a.mechanicsLine, b.mechanicsLine);
});
