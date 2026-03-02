import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove, newScene } from '../engine/playloop.js';
import { exportWorld, importWorld } from '../engine/save.js';

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

test('U18: endingTriggered emits canonical event with stable shape (exactly once)', () => {
  const seed = 'u18-seed';
  let w0 = newWorld({
    seed,
    fate: 0.9,
    campaignId: 'c',
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  let w = beginAdventure(w0, packsById).world;

  w = { ...w, clocks: { ...w.clocks, dread: 8 } };

  w = playerMove(w, packsById, 'I press on.').world;

  w = newScene(w, packsById).world;

  const evts = w.timeline.filter(e => e?.kind === 'endingTriggered');
  assert.ok(evts.length === 1, 'expected exactly one endingTriggered event');

  const evt = evts[0];
  assert.ok(typeof evt.t === 'number');
  assert.equal(evt.kind, 'endingTriggered');
  assert.ok(evt.data && typeof evt.data === 'object');

  assert.equal(typeof evt.data.endingType, 'string');
  assert.equal(typeof evt.data.epilogueLine, 'string');
  assert.ok(evt.data.endingType.length > 0);
  assert.ok(evt.data.epilogueLine.length > 0);
});

test('U18: endingTriggered survives export/import roundtrip', () => {
  const seed = 'u18-seed-2';
  let w0 = newWorld({
    seed,
    fate: 0.9,
    campaignId: 'c',
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  let w = beginAdventure(w0, packsById).world;
  w = { ...w, clocks: { ...w.clocks, dread: 8 } };
  w = playerMove(w, packsById, 'I press the assault.').world;

  const text = exportWorld(w);
  const reloaded = importWorld(text);

  const a = w.timeline.filter(e => e?.kind === 'endingTriggered');
  const b = reloaded.timeline.filter(e => e?.kind === 'endingTriggered');

  assert.deepEqual(b, a);
});
