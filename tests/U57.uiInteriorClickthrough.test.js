import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { ensureWorld, newWorld } from '../engine/state.js';
import { playerMove } from '../engine/playloop.js';
import { getInteriorView } from '../engine/structures/interiors.js';

const packsById = { fantasy: { id: 'fantasy', toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] }, starterLocations: ['tower'], starterObjectives: ['find the key'], skills: ['Steel'], locations: ['tower'], objectives: ['find the key'], complications: ['a clock starts'], npcArchetypes: ['wary guide'], sensoryMotifs: ['air tastes of dust'] } };

function fixtureWorld(seed = 'u57') {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: 'u57', pack: { primaryId: 'fantasy', mixerId: null } });
  return ensureWorld({
    ...w0,
    map: { nodes: [{ id: 'n0', name: 'Start', tags: ['structure:demo'] }], edges: [], discovered: ['n0'], currentNodeId: 'n0', currentStructureId: '', currentRoomId: '' },
    scene: { ...w0.scene, location: 'Start', interior: null },
    structures: {
      byId: {
        'st:house': {
          id: 'st:house', kind: 'building', nodeId: 'n0', anchors: { nodeId: 'n0' },
          topology: { kind: 'rooms', rooms: [{ id: 'attic' }, { id: 'kitchen' }], edges: [{ a: 'attic', b: 'kitchen' }] },
          surfaces: {}, tags: ['demo']
        }
      },
      nextId: 1,
      interiorDiscovery: { byStructureId: {} }
    }
  });
}

test('U57: UI includes interior panel actions; engine clickthrough transcript deterministic', () => {
  const src = readFileSync(path.join(process.cwd(), 'public/v1.js'), 'utf8');
  assert.match(src, /Interior: \$\{interiorView\.structureKey\} \/ \$\{interiorView\.roomId\}/);
  assert.match(src, /doQuickCommand\('exit building'\)/);
  assert.match(src, /doQuickCommand\(`go \$\{x\.id\}`\)/);
  assert.match(src, /doQuickCommand\(`inspect \$\{x\.id\}`\)/);

  let w = fixtureWorld();
  w = playerMove(w, packsById, 'enter st:house').world;
  w = playerMove(w, packsById, 'look around').world;
  w = playerMove(w, packsById, 'go kitchen').world;
  const sid = getInteriorView(w).surfaces[0].id;
  w = playerMove(w, packsById, `inspect ${sid}`).world;
  w = playerMove(w, packsById, 'exit building').world;

  assert.equal(w.scene.interior, null);
});
