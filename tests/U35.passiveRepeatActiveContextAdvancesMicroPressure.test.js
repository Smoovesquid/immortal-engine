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

test('U35: repeated passive intent in active context advances micro pressure (not macro)', () => {
  const w0 = newWorld({ seed: 'u35', fate: 0.2, campaignId: 'c1', pack: { primaryId: 'fantasy', mixerId: null } });

  const a0 = beginAdventure(w0, packsById);

  const baseEvent = { t: 0, kind: 'resolution', data: { intent: 'I wait and do nothing.', outcome: 'failure' } };

  const stable = {
    ...a0.world,
    timeline: [...(a0.world.timeline || []), baseEvent],
    scene: { ...a0.world.scene, tags: [] }
  };

  const active = {
    ...a0.world,
    timeline: [...(a0.world.timeline || []), baseEvent],
    scene: { ...a0.world.scene, tags: ['confrontation'] }
  };

  const s1 = playerMove(stable, packsById, 'I wait and do nothing.');
  const a1 = playerMove(active, packsById, 'I wait and do nothing.');

  const sMicro = Number(s1.world?.meta?.microClocks?.pressure ?? 0);
  const aMicro = Number(a1.world?.meta?.microClocks?.pressure ?? 0);

  const sMacro = Number(s1.world?.clocks?.pressure ?? 0);
  const aMacro = Number(a1.world?.clocks?.pressure ?? 0);

  assert.equal(sMicro, 0);
  assert.equal(aMicro, 1);
  assert.equal(sMacro, 0);
  assert.equal(aMacro, 0);
});
