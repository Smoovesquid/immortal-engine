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

test('U16: thread escalation emits canonical threadShift event with stable shape', () => {
  const seed = 'u16-seed';
  let w0 = newWorld({
    seed,
    fate: 0.8,
    campaignId: 'c',
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  const started = beginAdventure(w0, packsById).world;

  // Push several aggressive moves to force escalation deterministically
  let w = started;
  for (let i = 0; i < 6; i++) {
    w = playerMove(w, packsById, 'I attack relentlessly').world;
  }

  const events = w.timeline.filter(e => e?.kind === 'threadShift');
  assert.ok(events.length > 0, 'expected at least one threadShift event');

  const evt = events[events.length - 1];

  assert.ok(typeof evt.t === 'number');
  assert.equal(evt.kind, 'threadShift');
  assert.ok(evt.data && typeof evt.data === 'object');

  assert.equal(typeof evt.data.threadId, 'string');
  assert.equal(typeof evt.data.from, 'number');
  assert.equal(typeof evt.data.to, 'number');
  assert.equal(typeof evt.data.reason, 'string');

  assert.ok(evt.data.to >= evt.data.from);
});

test('U16: threadShift survives export/import roundtrip', () => {
  const seed = 'u16-seed-2';
  let w0 = newWorld({
    seed,
    fate: 0.9,
    campaignId: 'c',
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  const started = beginAdventure(w0, packsById).world;

  let w = started;
  for (let i = 0; i < 6; i++) {
    w = playerMove(w, packsById, 'I press the assault').world;
  }

  const text = exportWorld(w);
  const reloaded = importWorld(text);

  const a = w.timeline.filter(e => e?.kind === 'threadShift');
  const b = reloaded.timeline.filter(e => e?.kind === 'threadShift');

  assert.deepEqual(b, a);
});
