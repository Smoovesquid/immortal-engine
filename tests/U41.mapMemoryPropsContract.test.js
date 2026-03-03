import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { exportWorld, importWorld } from '../engine/save.js';

test('U41: Map Memory Props Contract — props exist, discovered mirrors seen, stable across export/import', () => {
  const seed = 'u41_map_memory_seed';

  const w0 = newWorld({
    seed,
    fate: 0.2,
    campaignId: 'c1',
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  assert.ok(w0.map && typeof w0.map === 'object', 'world.map missing');
  assert.ok(Array.isArray(w0.map.discovered), 'world.map.discovered missing');
  assert.ok(w0.map.memory && typeof w0.map.memory === 'object', 'world.map.memory missing');

  const mem = w0.map.memory;

  assert.ok(Array.isArray(mem.seenNodeIds), 'memory.seenNodeIds missing');
  assert.ok(mem.visitedTurnByNodeId && typeof mem.visitedTurnByNodeId === 'object', 'memory.visitedTurnByNodeId missing');
  assert.ok(mem.seenTurnByNodeId && typeof mem.seenTurnByNodeId === 'object', 'memory.seenTurnByNodeId missing');
  assert.ok(mem.knowledgeByNodeId && typeof mem.knowledgeByNodeId === 'object', 'memory.knowledgeByNodeId missing');
  assert.ok(mem.snapshotByNodeId && typeof mem.snapshotByNodeId === 'object', 'memory.snapshotByNodeId missing');

  // Contract: discovered == seen (discovered means "known/seen", not necessarily visited)
  assert.deepEqual(mem.seenNodeIds, w0.map.discovered, 'memory.seenNodeIds must mirror map.discovered at boot');

  const rt = importWorld(exportWorld(w0));
  assert.deepEqual(rt.map.memory, w0.map.memory, 'map.memory changed across export/import roundtrip');
});
