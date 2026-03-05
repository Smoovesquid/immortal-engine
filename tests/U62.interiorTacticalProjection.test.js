import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { playerMove } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';
import { projectInteriorTactical } from '../engine/structures/interiorTacticalProjection.js';

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

function fixtureWorld(seed = 'u62') {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: 'u62', pack: { primaryId: 'fantasy', mixerId: null } });
  return ensureWorld({
    ...w0,
    map: { nodes: [{ id: 'n0', name: 'Start', tags: ['structure:demo'] }], edges: [], discovered: ['n0'], currentNodeId: 'n0', currentStructureId: '', currentRoomId: '' },
    scene: { ...w0.scene, location: 'Start', interior: null },
    structures: {
      byId: {
        'st:house': {
          id: 'st:house', kind: 'building', nodeId: 'n0', anchors: { nodeId: 'n0' },
          topology: {
            kind: 'rooms',
            rooms: [{ id: 'foyer', tags: ['entry'] }, { id: 'kitchen' }, { id: 'attic' }],
            edges: [{ a: 'foyer', b: 'kitchen' }, { a: 'kitchen', b: 'attic' }]
          },
          surfaces: {},
          tags: ['demo']
        }
      },
      nextId: 1,
      interiorDiscovery: { byStructureId: {} }
    }
  });
}

test('U62/B1: interior tactical projection is deterministic and projection-only', () => {
  const w0 = playerMove(fixtureWorld(), packsById, 'enter st:house').world;

  const h0 = worldHash(w0);
  const p1 = projectInteriorTactical(w0);
  const h1 = worldHash(w0);
  assert.equal(h1, h0);

  const p2 = projectInteriorTactical(w0);
  assert.deepEqual(p2, p1);

  assert.equal(p1.ok, true);
  assert.equal(p1.structureKey, 'st:house');
  assert.ok(p1.grid.w >= 11 && p1.grid.w <= 16);
  assert.ok(p1.grid.h >= 11 && p1.grid.h <= 16);

  // doors are derived from adjacency: foyer has exit kitchen
  assert.ok(Array.isArray(p1.pois.doors));
});

test('U62/B1: projection completes under 25ms for a typical interior', () => {
  const w0 = playerMove(fixtureWorld('u62-perf'), packsById, 'enter st:house').world;
  const t0 = process.hrtime.bigint();
  projectInteriorTactical(w0);
  const dtMs = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(dtMs < 25, `interior tactical projection too slow: ${dtMs.toFixed(3)}ms`);
});
