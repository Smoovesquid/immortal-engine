import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { worldHash } from '../engine/worldHash.js';
import { projectStructuresForMap } from '../engine/map/structureProjection.js';

function fixtureWorld(seed = 'u58') {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: 'u58', pack: { primaryId: 'fantasy', mixerId: null } });
  return ensureWorld({
    ...w0,
    map: {
      nodes: [{ id: 'n0', name: 'Start', tags: ['structure:demo'] }, { id: 'n1', name: 'North', tags: [] }],
      edges: [{ a: 'n0', b: 'n1', kind: 'path' }],
      discovered: ['n0'],
      currentNodeId: 'n0',
      currentStructureId: '',
      currentRoomId: ''
    },
    structures: {
      byId: {
        'st:b': { id: 'st:b', kind: 'building', nodeId: 'n0', anchors: { nodeId: 'n0' }, topology: null, surfaces: {}, tags: ['kind:building'] },
        'st:a': { id: 'st:a', kind: 'tower', nodeId: 'n0', anchors: { edge: { a: 'n0', b: 'n1' } }, topology: null, surfaces: {}, tags: ['tower'] }
      },
      nextId: 1,
      interiorDiscovery: { byStructureId: {} }
    }
  });
}

test('U58/S1: projection does not change worldHash', () => {
  const w = fixtureWorld();
  const h0 = worldHash(w);
  projectStructuresForMap(w);
  assert.equal(worldHash(w), h0);
});

test('U58/S2: same world => identical projection', () => {
  const w = fixtureWorld();
  assert.deepEqual(projectStructuresForMap(w), projectStructuresForMap(w));
});

test('U58/S3: structure ordering deterministic', () => {
  const p = projectStructuresForMap(fixtureWorld()).structures;
  const ids = p.map(x => x.id);
  assert.deepEqual(ids, [...ids].sort((a, b) => {
    const ka = p.find(x => x.id === a);
    const kb = p.find(x => x.id === b);
    return `${ka.kind}|${ka.anchorType}|${ka.anchorRef}|${ka.id}`.localeCompare(`${kb.kind}|${kb.anchorType}|${kb.anchorRef}|${kb.id}`);
  }));
});
