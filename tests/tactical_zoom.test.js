import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { generateInitialMap } from '../engine/map/generateMap.js';
import { resolveMove } from '../engine/resolve.js';

test('tactical zoom: engaged force is slightly easier when tactical active', () => {
  let w = newWorld({ seed: 'seed', fate: 0.5, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene.promptSeed = 'p';
  w.map = generateInitialMap({ seed: w.meta.seed, packId: 'fantasy', pack: { locations: ['A','B','C'] } });

  w.party = [{
    id: 'p1',
    name: 'P1',
    stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 },
    stress: 0,
    wounds: 0,
    position: { zone: 'engaged' },
    inventory: { weapons: [], armor: [], tools: [], clothes: [], spells: [], tech: [], oddities: [], consumables: [], junk: [] }
  }];

  const move = { actorId: 'p1', intentText: 'Smash through', approachTag: 'force', stakeTag: 'time', risk: 0.5 };

  const dcOff = resolveMove({ ...w, map: { ...w.map, tactical: { active: false, zoneLayout: null } } }, move).result.dc;
  const dcOn = resolveMove({ ...w, map: { ...w.map, tactical: { active: true, zoneLayout: { lanes: ['l'], coverTags: ['cover'] } } } }, move).result.dc;

  assert.ok(dcOn <= dcOff);
});
