import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
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

test('U15: player action emits canonical resolution event with stable shape', () => {
  const seed = 'u15-seed';
  let w0 = newWorld({
    seed,
    fate: 0.3,
    campaignId: 'c',
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  const started = beginAdventure(w0, packsById).world;

  const input = 'I force the door open';
  const after = playerMove(started, packsById, input).world;

  const resolutionEvents = after.timeline.filter(e => e?.kind === 'resolution');

  assert.ok(resolutionEvents.length > 0, 'expected at least one resolution event');

  const evt = resolutionEvents[resolutionEvents.length - 1];

  assert.ok(typeof evt.t === 'number');
  assert.equal(typeof evt.kind, 'string');
  assert.equal(evt.kind, 'resolution');

  assert.ok(evt.data && typeof evt.data === 'object');
  assert.equal(typeof evt.data.intent, 'string');
  assert.equal(typeof evt.data.outcome, 'string');

  // outcome must be one of a stable, finite vocabulary
  assert.ok(
    ['success', 'mixed', 'failure'].includes(evt.data.outcome),
    'unexpected outcome vocabulary'
  );
});

test('U15: canonical resolution event survives export/import roundtrip', () => {
  const seed = 'u15-seed-2';
  let w0 = newWorld({
    seed,
    fate: 0.5,
    campaignId: 'c',
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  const started = beginAdventure(w0, packsById).world;
  const after = playerMove(started, packsById, 'I strike first').world;

  const text = exportWorld(after);
  const reloaded = importWorld(text);

  const r0 = after.timeline.filter(e => e?.kind === 'resolution');
  const r1 = reloaded.timeline.filter(e => e?.kind === 'resolution');

  assert.deepEqual(r1, r0);
});
