import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { generateInitialMap } from '../engine/map/generateMap.js';
import { planNextScene } from '../engine/sceneDirector.js';

const pack = {
  locations: ['L1','L2','L3'],
  objectives: ['O1','O2'],
  sensoryMotifs: ['m1','m2']
};

test('sceneDirector uses map current node name as location', () => {
  let w = newWorld({ seed: 'seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = { ...w, map: generateInitialMap({ seed: w.meta.seed, packId: 'fantasy', pack }) };
  const here = w.map.nodes.find(n => n.id === w.map.currentNodeId);

  const plan = planNextScene(w, pack, { lastResolutionKind: 'scene' });
  assert.equal(plan.location, here.name);
});
