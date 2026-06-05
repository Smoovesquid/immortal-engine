import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { generateInitialMap } from '../engine/map/generateMap.js';
import { buildAsciiMap, renderAsciiMapBlock } from '../engine/ai/asciiMap.js';
import { buildDMContext } from '../engine/ai/narratorContext.js';

const pack = { locations: ['L1', 'L2', 'L3'], objectives: ['O1', 'O2'], sensoryMotifs: ['m1', 'm2'] };

function overworldWorld() {
  let w = newWorld({ seed: 'ascii_overworld', fate: 0.3, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = { ...w, map: generateInitialMap({ seed: w.meta.seed, packId: 'fantasy', pack }) };
  return w;
}

function interiorWorld() {
  let w = newWorld({ seed: 'ascii_interior', fate: 0.3, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const structure = {
    id: 'keep1', kind: 'building', nodeId: String(w.map?.currentNodeId || 'n'),
    anchors: { nodeId: String(w.map?.currentNodeId || 'n') },
    topology: {
      kind: 'rooms',
      rooms: [
        { id: 'entry', tags: ['entry'] },
        { id: 'hall' },
        { id: 'kitchen' },
        { id: 'vault' }
      ],
      edges: [
        { a: 'entry', b: 'hall' },
        { a: 'entry', b: 'kitchen' },
        { a: 'hall', b: 'vault' }
      ]
    }
  };
  w = {
    ...w,
    structures: { ...(w.structures || {}), byId: { ...(w.structures?.byId || {}), keep1: structure } },
    scene: { ...(w.scene || {}), interior: { structureKey: 'keep1', roomId: 'entry' } }
  };
  return w;
}

test('U90: overworld ascii map — scale, @ marker, structured exits', () => {
  const w = overworldWorld();
  const m = buildAsciiMap(w);
  assert.ok(m, 'expected an ascii map');
  assert.equal(m.scale, 'overworld');
  assert.ok(m.text.includes('@'), 'overworld text should mark the player with @');
  const here = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  assert.equal(m.here, String(here.name || here.id), 'here should be current node name');
  assert.ok(Array.isArray(m.exits), 'exits should be an array');
  for (const e of m.exits) {
    assert.ok(['north', 'east', 'south', 'west'].includes(e.dir), `exit dir cardinal: ${e.dir}`);
    assert.equal(typeof e.to, 'string');
  }
});

test('U90: interior ascii map — grid, legend marks (you), door exits', () => {
  const w = interiorWorld();
  const m = buildAsciiMap(w);
  assert.ok(m, 'expected an ascii map');
  assert.equal(m.scale, 'interior');
  assert.ok(m.text.includes('@'), 'interior grid should mark current room with @');
  assert.ok(Array.isArray(m.legend) && m.legend.length >= 4, 'legend should list all rooms');
  assert.ok(m.legend.some(l => l.includes('(you)')), 'legend should mark the current room (you)');
  assert.ok(Array.isArray(m.exits), 'exits should be an array');
  // entry connects to hall + kitchen => at least 2 door exits from the entry room
  assert.ok(m.exits.length >= 2, `entry should have >=2 door exits, got ${m.exits.length}`);
});

test('U90: ascii map is deterministic (pure, same world => identical)', () => {
  const w1 = overworldWorld();
  assert.deepEqual(buildAsciiMap(w1), buildAsciiMap(w1));
  const w2 = interiorWorld();
  assert.deepEqual(buildAsciiMap(w2), buildAsciiMap(w2));
});

test('U90: buildDMContext carries asciiMap; renderAsciiMapBlock emits a LOCAL MAP block', () => {
  const w = interiorWorld();
  const ctx = buildDMContext(w, {}, {});
  assert.ok(ctx.asciiMap, 'DM context should include asciiMap');
  assert.equal(ctx.asciiMap.scale, 'interior');

  const block = renderAsciiMapBlock(ctx.asciiMap);
  assert.ok(block.startsWith('LOCAL MAP'), 'block should be headed LOCAL MAP');
  assert.ok(block.includes('@'), 'block should contain the player marker');

  // null-safe
  assert.equal(renderAsciiMapBlock(null), '');
});
