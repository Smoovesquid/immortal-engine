import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { generateInitialMap } from '../engine/map/generateMap.js';
import { scarifyNode } from '../engine/map/mapState.js';
import { planNextScene } from '../engine/sceneDirector.js';

test('sceneDirector surfaces current-node place scars as tags', () => {
  let w = newWorld({ seed: 'seed', fate: 0.5, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene.promptSeed = 'p';
  w.map = generateInitialMap({ seed: w.meta.seed, packId: 'fantasy', pack: { locations: ['A','B','C'] } });

  const here = w.map.currentNodeId;
  w = scarifyNode(w, here, 'faction:shadow:strike');

  const pack = { locations: ['X'], objectives: ['Y'], complications: ['Z'], npcArchetypes: ['N'], sensoryMotifs: ['m'] };
  const plan = planNextScene(w, pack, { allowSameLocation: true });

  assert.ok(Array.isArray(plan.tags));
  assert.ok(plan.tags.some(t => String(t).startsWith('place-scar:')));
});
