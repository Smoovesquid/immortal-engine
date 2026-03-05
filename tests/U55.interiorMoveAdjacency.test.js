import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { playerMove } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';

const packsById = { fantasy: { id: 'fantasy', toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] }, starterLocations: ['tower'], starterObjectives: ['find the key'], skills: ['Steel'], locations: ['tower'], objectives: ['find the key'], complications: ['a clock starts'], npcArchetypes: ['wary guide'], sensoryMotifs: ['air tastes of dust'] } };

function fixtureWorld(seed = 'u55') {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: 'u55', pack: { primaryId: 'fantasy', mixerId: null } });
  return ensureWorld({
    ...w0,
    map: { nodes: [{ id: 'n0', name: 'Start', tags: ['structure:demo'] }], edges: [], discovered: ['n0'], currentNodeId: 'n0', currentStructureId: '', currentRoomId: '' },
    scene: { ...w0.scene, location: 'Start', interior: null },
    structures: {
      byId: {
        'st:house': {
          id: 'st:house', kind: 'building', nodeId: 'n0', anchors: { nodeId: 'n0' },
          topology: { kind: 'rooms', rooms: [{ id: 'attic' }, { id: 'kitchen' }, { id: 'foyer' }], edges: [{ a: 'attic', b: 'kitchen' }, { a: 'kitchen', b: 'foyer' }] },
          surfaces: {}, tags: ['demo']
        }
      },
      nextId: 1,
      interiorDiscovery: { byStructureId: {} }
    }
  });
}

test('U55: go-to-adjacent-room works; illegal room rejected without changing world', () => {
  const w0 = playerMove(fixtureWorld(), packsById, 'enter st:house').world;
  const w1 = playerMove(w0, packsById, 'go kitchen').world;
  assert.equal(w1.scene.interior.roomId, 'kitchen');

  const h1 = worldHash(w1);
  const w2 = playerMove(w1, packsById, 'go nowhere').world;
  assert.equal(w2.scene.interior.roomId, 'kitchen');
  assert.equal(worldHash(w2), h1);
});
