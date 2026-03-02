import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { simulateTurns } from '../engine/simulate.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld, importWorld } from '../engine/save.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel'],
    locations: ['tower'],
    objectives: ['find the key'],
    complications: ['a clock starts'],
    npcArchetypes: ['wary guide'],
    sensoryMotifs: ['air tastes of dust']
  }
};

test('U27: Gate VII WorldHash Surface Contract — identical canonical surface => identical worldHash', () => {
  const seed = 'u27-seed-0';

  const w0 = newWorld({
    seed,
    fate: 0.4,
    campaignId: 'u27',
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  const { world: a } = simulateTurns(w0, packsById, 120);

  const exported = exportWorld(a);
  const b = importWorld(exported);

  assert.equal(worldHash(a), worldHash(b), 'worldHash changed across export/import roundtrip');
});
