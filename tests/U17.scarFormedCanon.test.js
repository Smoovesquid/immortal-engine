import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { worldTick } from '../engine/worldTick.js';
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

test('U17: irreversible thresholds emit canonical scarFormed event with stable shape', () => {
  const seed = 'u17-seed';
  let w0 = newWorld({
    seed,
    fate: 0.8,
    campaignId: 'c',
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  let w = beginAdventure(w0, packsById).world;

  // Force an irreversible threshold deterministically (scarcity>75 => famine_arc)
  w = { ...w, ecology: { ...(w.ecology || {}), scarcity: 80, corruption: (w.ecology?.corruption ?? 0), instability: (w.ecology?.instability ?? 0) } };

  w = worldTick(w, `${seed}|tick|u17`);

  const events = w.timeline.filter(e => e?.kind === 'scarFormed');
  assert.ok(events.length > 0, 'expected at least one scarFormed event');

  const evt = events[events.length - 1];

  assert.ok(typeof evt.t === 'number');
  assert.equal(evt.kind, 'scarFormed');
  assert.ok(evt.data && typeof evt.data === 'object');

  assert.equal(typeof evt.data.scarId, 'string');
  assert.equal(typeof evt.data.description, 'string');
  assert.equal(typeof evt.data.trigger, 'string');

  assert.ok(evt.data.scarId.length > 0);
});

test('U17: scarFormed survives export/import roundtrip', () => {
  const seed = 'u17-seed-2';
  let w0 = newWorld({
    seed,
    fate: 0.9,
    campaignId: 'c',
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  let w = beginAdventure(w0, packsById).world;

  // Force an irreversible threshold deterministically (corruption>70 => corruption_shift)
  w = { ...w, ecology: { ...(w.ecology || {}), corruption: 80, scarcity: (w.ecology?.scarcity ?? 0), instability: (w.ecology?.instability ?? 0) } };

  w = worldTick(w, `${seed}|tick|u17b`);

  const text = exportWorld(w);
  const reloaded = importWorld(text);

  const a = w.timeline.filter(e => e?.kind === 'scarFormed');
  const b = reloaded.timeline.filter(e => e?.kind === 'scarFormed');

  assert.deepEqual(b, a);
});
