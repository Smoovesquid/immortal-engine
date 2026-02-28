import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { compose } from '../engine/composer.js';

const pack = {
  id: 'fantasy',
  toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
  sensoryMotifs: ['air tastes of dust']
};

test('composer fate shifts wording pools (coop vs blood)', () => {
  const base = { campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } };
  const wCoop = newWorld({ seed: 'seed', fate: 0.0, ...base });
  const wBlood = newWorld({ seed: 'seed', fate: 1.0, ...base });
  wCoop.scene = { location: 'tower', objective: 'find the key', time: 'start', promptSeed: '123' };
  wBlood.scene = { location: 'tower', objective: 'find the key', time: 'start', promptSeed: '123' };

  const resolution = { kind: 'scene', t: 1, location: 'tower', objective: 'find the key', refKind: 'promise', tags: [], thread: '' };
  const a = compose(wCoop, '', resolution, { pack }).narrationLine;
  const b = compose(wBlood, '', resolution, { pack }).narrationLine;

  // Expect different tone words; blood should contain harsher pool word.
  assert.notEqual(a, b);
  assert.match(b.toLowerCase(), /(pitiless|brutal|merciless|raw|black)/);
});
