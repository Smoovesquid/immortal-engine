import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { playerMove } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';

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

function fixtureWorld(seed = 'u54-seed') {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: 'u54', pack: { primaryId: 'fantasy', mixerId: null } });
  return ensureWorld({
    ...w0,
    map: {
      nodes: [{ id: 'n0', name: 'Start', tags: ['structure:demo'] }],
      edges: [],
      discovered: ['n0'],
      currentNodeId: 'n0',
      currentStructureId: '',
      currentRoomId: ''
    },
    scene: { ...w0.scene, location: 'Start', interior: null },
    structures: {
      byId: {
        'st:house': {
          id: 'st:house', kind: 'building', nodeId: 'n0', anchors: { nodeId: 'n0' },
          topology: { kind: 'rooms', rooms: [{ id: 'foyer' }], edges: [] }, surfaces: {}, tags: ['demo']
        }
      },
      nextId: 1,
      interiorDiscovery: { byStructureId: {} }
    }
  });
}

test('U54: inside look-around is projection-only (worldHash unchanged)', () => {
  const w0 = playerMove(fixtureWorld('u54'), packsById, 'enter st:house').world;
  const h0 = worldHash(w0);
  const t = playerMove(w0, packsById, 'look around');
  assert.equal(worldHash(t.world), h0);
  assert.deepEqual(t.world.scene.interior, w0.scene.interior);
});
