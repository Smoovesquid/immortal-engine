import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { playerMove } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';
import { getInteriorView } from '../engine/structures/interiors.js';

const packsById = { fantasy: { id: 'fantasy', toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] }, starterLocations: ['tower'], starterObjectives: ['find the key'], skills: ['Steel'], locations: ['tower'], objectives: ['find the key'], complications: ['a clock starts'], npcArchetypes: ['wary guide'], sensoryMotifs: ['air tastes of dust'] } };

function fixtureWorld(seed = 'u56') {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: 'u56', pack: { primaryId: 'fantasy', mixerId: null } });
  return ensureWorld({
    ...w0,
    map: { nodes: [{ id: 'n0', name: 'Start', tags: ['structure:demo'] }], edges: [], discovered: ['n0'], currentNodeId: 'n0', currentStructureId: '', currentRoomId: '' },
    scene: { ...w0.scene, location: 'Start', interior: null },
    structures: {
      byId: {
        'st:house': {
          id: 'st:house', kind: 'building', nodeId: 'n0', anchors: { nodeId: 'n0' },
          topology: { kind: 'rooms', rooms: [{ id: 'foyer' }], edges: [] },
          surfaces: {}, tags: ['demo']
        }
      },
      nextId: 1,
      interiorDiscovery: { byStructureId: {} }
    }
  });
}

function replay(seed, lines) {
  let w = fixtureWorld(seed);
  for (const line of lines) w = playerMove(w, packsById, line).world;
  return w;
}

test('U56: inspect surface emits canonical event + changes worldHash; replay identical', () => {
  const w0 = playerMove(fixtureWorld(), packsById, 'enter st:house').world;
  const sid = getInteriorView(w0).surfaces[0].id;
  const h0 = worldHash(w0);
  const w1 = playerMove(w0, packsById, `inspect ${sid}`).world;

  assert.notEqual(worldHash(w1), h0);
  const last = w1.timeline[w1.timeline.length - 1];
  assert.equal(last.kind, 'interiorInspect');
  assert.equal(last.data.surfaceId, sid);

  const a = replay('u56r', ['enter st:house', `inspect ${sid}`]);
  const b = replay('u56r', ['enter st:house', `inspect ${sid}`]);
  assert.equal(worldHash(a), worldHash(b));
});
