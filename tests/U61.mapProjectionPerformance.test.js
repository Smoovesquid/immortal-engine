import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { projectStructuresForMap } from '../engine/map/structureProjection.js';

function bigWorld(seed = 'u61') {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: 'u61', pack: { primaryId: 'fantasy', mixerId: null } });
  const nodes = [];
  const byId = {};
  for (let i = 0; i < 200; i++) {
    const id = `n${i}`;
    nodes.push({ id, name: `Node ${i}`, tags: i === 0 ? ['structure:demo'] : [] });
    byId[`st:${i}`] = { id: `st:${i}`, kind: i % 2 ? 'building' : 'road', nodeId: id, anchors: { nodeId: id }, topology: null, surfaces: {}, tags: [] };
  }
  return ensureWorld({
    ...w0,
    map: { nodes, edges: [], discovered: ['n0'], currentNodeId: 'n0', currentStructureId: '', currentRoomId: '' },
    structures: { byId, nextId: 1, interiorDiscovery: { byStructureId: {} } }
  });
}

test('U61: map projection for 200 nodes completes under 50ms', () => {
  const w = bigWorld();
  const t0 = process.hrtime.bigint();
  projectStructuresForMap(w);
  const dtMs = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(dtMs < 50, `projection too slow: ${dtMs.toFixed(3)}ms`);
});
