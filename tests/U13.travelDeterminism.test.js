import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { ensureMap } from '../engine/map/mapState.js';
import { moveToNode, pickTravelDestination } from '../engine/map/mapState.js';
import { generateInitialMap } from '../engine/map/generateMap.js';

test('U13: moveToNode only allows adjacent travel and updates discovered[0]', () => {
  const seed = 'u13-seed';
  const base = newWorld({ seed, fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const map = generateInitialMap({ seed });
  const w0 = { ...base, map: ensureMap(map) };

  const here = w0.map.currentNodeId;
  const nbs = w0.map.edges
    .filter(e => e.a === here || e.b === here)
    .map(e => (e.a === here ? e.b : e.a));

  assert.ok(nbs.length > 0, 'must have at least one neighbor');

  const target = nbs[0];
  const w1 = moveToNode(w0, target);

  assert.equal(w1.map.currentNodeId, target);
  assert.equal(w1.map.discovered[0], target);
});

test('U13: pickTravelDestination deterministic for same world + input', () => {
  const seed = 'u13-seed-2';
  const base = newWorld({ seed, fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const map = generateInitialMap({ seed });
  const w0 = { ...base, map: ensureMap(map) };

  const input = 'we travel onward';

  const a = pickTravelDestination(w0, input);
  const b = pickTravelDestination(w0, input);

  assert.equal(a, b);
});
