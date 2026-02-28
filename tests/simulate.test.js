import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { simulateTurns, reportSummaryString } from '../engine/simulate.js';

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

test('simulate: same seed => same run report summary', () => {
  const w0 = newWorld({ seed: 'sim-seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const a = simulateTurns(w0, packsById, 10);
  const b = simulateTurns(w0, packsById, 10);
  assert.equal(reportSummaryString(a.report), reportSummaryString(b.report));
});
