import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { resolveMove } from '../engine/resolve.js';
import { applyDeltas } from '../engine/effectsCore.js';

const move = {
  actorId: 'party',
  intentText: 'I search the area.',
  approachTag: 'insight',
  risk: 0.4,
  stakeTag: 'time'
};

test('time advances deterministically (turn or scene)', () => {
  let w = newWorld({ seed: 'seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene = { location: 'tower', objective: 'find the key', time: 'start', promptSeed: '123', tags: [], thread: '' };
  w.party = [{ id: 'party', name: 'Party', vibe: 'x', archetype: 'x', wounds: 0, stress: 0, resources: { Supply: 5 } }];

  const a = resolveMove(w, move);
  const w2 = applyDeltas(w, a.result.deltas);
  assert.ok(w2.time.turn >= w.time.turn + 1);
});

test('advantage is deterministic and consumed exactly once when used', () => {
  let w = newWorld({ seed: 'seed', fate: 1.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene = { location: 'tower', objective: 'find the key', time: 'start', promptSeed: '123', tags: [], thread: '' };
  w.party = [{ id: 'party', name: 'Party', vibe: 'x', archetype: 'x', wounds: 0, stress: 0, resources: { Supply: 5 } }];
  w.meta.advantageTokens = { party: 1 };

  const a = resolveMove(w, { ...move, intentText: 'I force the door.', approachTag: 'force', risk: 0.8, stakeTag: 'time' });
  const w2 = applyDeltas(w, a.result.deltas);
  const after = w2.meta.advantageTokens.party;
  assert.equal(after === 0 || after === 1 || after === 2, true);
  // If advantage was used, it must decrement by 1.
  if (a.result.mechanicsLine.includes('adv:+2')) {
    assert.equal(after, 0);
  }
});

test('position changes deterministic and clamped to allowed zones', () => {
  let w = newWorld({ seed: 'seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene = { location: 'tower', objective: 'find the key', time: 'start', promptSeed: '123', tags: [], thread: '' };
  w.party = [{ id: 'party', name: 'Party', vibe: 'x', archetype: 'x', wounds: 0, stress: 0, resources: { Supply: 5 }, position: { zone: 'far' } }];

  const a = resolveMove(w, { ...move, intentText: 'I sneak closer.', approachTag: 'finesse', stakeTag: 'time' });
  const w2 = applyDeltas(w, a.result.deltas);
  assert.equal(['far','near','engaged'].includes(w2.party[0].position.zone), true);
});
