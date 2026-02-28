import test from 'node:test';
import assert from 'node:assert/strict';

import { createCharacter } from '../engine/chargen/genesis.js';
import { rollDetailOptions } from '../engine/chargen/details.js';
import { makeRng, seedFromString } from '../engine/rng.js';

test('ritual choices: same seed + same picks => identical character', () => {
  const seed = 'seed';
  const packId = 'fantasy';
  const baseSeed = `${seed}|chargen|${packId}|f20|m:2d6+2`;
  const opts = rollDetailOptions(packId, baseSeed, makeRng(seedFromString(`${baseSeed}|ritual`)));

  const picks = {
    detail: opts.detail[1] || opts.detail[0],
    keepsake: opts.keepsake[2] || opts.keepsake[0],
    lineYouWontCross: opts.lineYouWontCross[0],
    rumor: opts.rumor[1] || opts.rumor[0]
  };

  const a = createCharacter({ seed, packId, fate: 0.2, ritualPicks: picks });
  const b = createCharacter({ seed, packId, fate: 0.2, ritualPicks: picks });
  assert.deepEqual(a, b);
});

test('ritual choices: different picks (same seed) changes traits deterministically', () => {
  const seed = 'seed';
  const packId = 'fantasy';
  const baseSeed = `${seed}|chargen|${packId}|f20|m:2d6+2`;
  const opts = rollDetailOptions(packId, baseSeed, makeRng(seedFromString(`${baseSeed}|ritual`)));

  const p1 = { detail: opts.detail[0], keepsake: opts.keepsake[0], lineYouWontCross: opts.lineYouWontCross[0], rumor: opts.rumor[0] };
  const p2 = { detail: opts.detail[2] || opts.detail[0], keepsake: opts.keepsake[1] || opts.keepsake[0], lineYouWontCross: opts.lineYouWontCross[1] || opts.lineYouWontCross[0], rumor: opts.rumor[2] || opts.rumor[0] };

  const a = createCharacter({ seed, packId, fate: 0.2, ritualPicks: p1 });
  const b = createCharacter({ seed, packId, fate: 0.2, ritualPicks: p2 });

  assert.notEqual(a.traits.detail, b.traits.detail);
});
