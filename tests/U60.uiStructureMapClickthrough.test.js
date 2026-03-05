import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { ensureWorld, newWorld } from '../engine/state.js';
import { worldHash } from '../engine/worldHash.js';
import { projectStructuresForMap } from '../engine/map/structureProjection.js';

function fixtureWorld(seed = 'u60') {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: 'u60', pack: { primaryId: 'fantasy', mixerId: null } });
  return ensureWorld({
    ...w0,
    map: { nodes: [{ id: 'n0', name: 'Start', tags: ['structure:demo'] }], edges: [], discovered: ['n0'], currentNodeId: 'n0', currentStructureId: '', currentRoomId: '' },
    structures: { byId: { 'st:1': { id: 'st:1', kind: 'building', nodeId: 'n0', anchors: { nodeId: 'n0' }, topology: null, surfaces: {}, tags: [] } }, nextId: 1, interiorDiscovery: { byStructureId: {} } }
  });
}

test('U60/S1: local map is visual-only (no clickthrough command wiring)', () => {
  const src = readFileSync(path.join(process.cwd(), 'public/map/LocalMap.js'), 'utf8');
  assert.doesNotMatch(src, /addEventListener\('click'/);
  assert.doesNotMatch(src, /onCommand\(c\.command\)/);
  assert.doesNotMatch(src, /clickable\.push/);
  assert.doesNotMatch(src, /`enter \$\{label\.split$begin:math:text$\' \'$end:math:text$$begin:math:display$0$end:math:display$\}`/);
});

test('U60/S2: map projection does not mutate world', () => {
  const w = fixtureWorld();
  const h0 = worldHash(w);
  projectStructuresForMap(w);
  assert.equal(worldHash(w), h0);
});

test('U60/S3: replay deterministic', () => {
  const a = projectStructuresForMap(fixtureWorld('u60r'));
  const b = projectStructuresForMap(fixtureWorld('u60r'));
  assert.deepEqual(a, b);
});
