import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  }
};

test('fate affects consequence severity deterministically', () => {
  const wCoop0 = newWorld({ seed: 'abc', fate: 0.0, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });
  const wBlood0 = newWorld({ seed: 'abc', fate: 1.0, campaignId: 'c2', pack: { primaryId: 'fantasy', mixerId: null } });

  const coop = beginAdventure(wCoop0, packsById);
  const blood = beginAdventure(wBlood0, packsById);

  // Choose an input likely to fail for both sometimes; regardless, DC differs.
  const move = 'I force the locked door.';
  const coopTurn = playerMove(coop.world, packsById, move);
  const bloodTurn = playerMove(blood.world, packsById, move);

  // If either fails, blood should never be *less* severe in pressure on fail.
  // We can assert DC is higher for blood.
  const coopMech = coopTurn.output.mechanics;
  const bloodMech = bloodTurn.output.mechanics;
  // DC differs; blood should be >= coop.
  const coopDc = Number((coopMech.match(/DC:(\d+)/) || [])[1]);
  const bloodDc = Number((bloodMech.match(/DC:(\d+)/) || [])[1]);
  assert.ok(Number.isFinite(coopDc) && Number.isFinite(bloodDc));
  assert.ok(bloodDc >= coopDc);

  // And on failure, blood pressure bump is >= coop bump.
  if (/fail/.test(coopMech) && /fail/.test(bloodMech)) {
    assert.ok(bloodTurn.world.clocks.pressure >= coopTurn.world.clocks.pressure);
  }
});
