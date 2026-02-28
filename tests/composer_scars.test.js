import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { computeWorldBias, tonePool } from '../engine/composer.js';

test('composer bias: scars + war posture bias tone pool deterministically', () => {
  let w = newWorld({ seed: 'seed', fate: 1.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scars = [{ id: 'war_state', description: 'war', permanent: true }];
  w.ecology = { corruption: 80, scarcity: 80, instability: 10 };
  w.factions = [{ id: 'shadow', goal: 'Exploit', pressure: 90, assets: [], hostility: 95, lastMove: 'strike' }];
  const bias = computeWorldBias(w);

  assert.ok(bias.scarWeight >= 1);
  assert.equal(bias.war, true);
  assert.ok(bias.ecoSeverity >= 1);

  const pool = tonePool('blood', { pressure: 0, dread: 0, revelation: 0 }, { toneWords: { blood: [] } }, bias);
  assert.ok(pool.includes('besieged') || pool.includes('martial'));
  assert.ok(pool.includes('soured') || pool.includes('withered') || pool.includes('ashen') || pool.includes('blighted'));
});
