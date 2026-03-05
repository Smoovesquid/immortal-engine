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

function fixtureWorld(seed = 'u53-seed') {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: 'u53', pack: { primaryId: 'fantasy', mixerId: null } });
  return ensureWorld({
    ...w0,
    map: {
      nodes: [
        { id: 'n0', name: 'Start', tags: ['structure:demo'] },
        { id: 'n1', name: 'North', tags: [] }
      ],
      edges: [{ a: 'n0', b: 'n1', kind: 'path' }],
      discovered: ['n0'],
      currentNodeId: 'n0',
      currentStructureId: '',
      currentRoomId: ''
    },
    scene: { ...w0.scene, location: 'Start', interior: null },
    structures: {
      byId: {
        'st:alpha': {
          id: 'st:alpha',
          kind: 'building',
          nodeId: 'n0',
          anchors: { nodeId: 'n0' },
          topology: { kind: 'rooms', rooms: [{ id: 'a1' }], edges: [] },
          surfaces: {},
          tags: ['demo']
        },
        'st:bravo': {
          id: 'st:bravo',
          kind: 'building',
          nodeId: 'n0',
          anchors: { nodeId: 'n0' },
          topology: { kind: 'rooms', rooms: [{ id: 'b1' }], edges: [] },
          surfaces: {},
          tags: ['demo']
        },
        'st:charlie': {
          id: 'st:charlie',
          kind: 'building',
          nodeId: 'n0',
          anchors: { nodeId: 'n0' },
          topology: { kind: 'rooms', rooms: [{ id: 'c1' }], edges: [] },
          surfaces: {},
          tags: ['demo']
        }
      },
      nextId: 1,
      interiorDiscovery: { byStructureId: {} }
    }
  });
}

function applyTranscript(seed, transcript) {
  let w = fixtureWorld(seed);
  for (const line of transcript) w = playerMove(w, packsById, line).world;
  return w;
}

test('U53/S1: exit + re-enter same selector returns same structure/room deterministically', () => {
  const w0 = fixtureWorld('u53-s1');
  const w1 = playerMove(w0, packsById, 'enter 2').world;
  assert.deepEqual(w1.scene.interior, { structureKey: 'st:bravo', roomId: 'b1' });

  const w2 = playerMove(w1, packsById, 'exit building').world;
  assert.equal(w2.scene.interior, null);

  const w3 = playerMove(w2, packsById, 'enter 2').world;
  assert.deepEqual(w3.scene.interior, { structureKey: 'st:bravo', roomId: 'b1' });
});

test('U53/S2: look around outside is projection-only (no worldHash change)', () => {
  const w0 = fixtureWorld('u53-s2');
  const h0 = worldHash(w0);
  const t = playerMove(w0, packsById, 'look around');
  assert.equal(worldHash(t.world), h0);
  assert.equal(t.world.scene.interior, null);
});

test('U53/S3: selection stable across transcript replay => same worldHash', () => {
  const transcript = ['look around', 'enter 3', 'look around', 'exit building', 'enter 3', 'look around'];
  const a = applyTranscript('u53-s3', transcript);
  const b = applyTranscript('u53-s3', transcript);
  assert.equal(worldHash(a), worldHash(b));
});
