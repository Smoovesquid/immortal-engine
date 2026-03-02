import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { generateInitialMap } from '../engine/map/generateMap.js';
import { ensureMap } from '../engine/map/mapState.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    starterLocations: ['Port of Ash'],
    starterObjectives: ['Find shelter'],
    skills: [],
    toneWords: { cooperative: [], grim: [], blood: [] },
    locations: ['Port of Ash'],
    objectives: ['Find shelter']
  }
};

test('U14: playerMove travel intent updates map + emits travel timeline event deterministically', () => {
  const seed = 'u14-seed';
  let w0 = newWorld({ seed, fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });

  // Ensure map exists and is deterministic.
  w0 = { ...w0, map: ensureMap(generateInitialMap({ seed })) };

  // Begin to set scene.promptSeed deterministically.
  const a0 = beginAdventure(w0, packsById).world;

  // Execute the exact same travel-intent move twice from the same pre-move world snapshot.
  const text = 'we travel onward';
  const r1 = playerMove(a0, packsById, text).world;
  const r2 = playerMove(a0, packsById, text).world;

  assert.equal(r1.map.currentNodeId, r2.map.currentNodeId);
  assert.deepEqual(r1.map.discovered, r2.map.discovered);
  assert.deepEqual(r1.timeline, r2.timeline);

  const travelEvents = r1.timeline.filter(e => e?.kind === 'travel');
  assert.ok(travelEvents.length > 0, 'expected at least one travel event');
  const travel = travelEvents[travelEvents.length - 1];
  assert.ok(travel.data && typeof travel.data === 'object');
  assert.ok(typeof travel.data.from === 'string');
  assert.ok(typeof travel.data.to === 'string');
  assert.equal(travel.data.to, r1.map.currentNodeId);
});
