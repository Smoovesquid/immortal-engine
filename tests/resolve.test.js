import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { resolveMove } from '../engine/resolve.js';
import { applyDeltas } from '../engine/effectsCore.js';

const baseMove = {
  actorId: 'party',
  intentText: 'I force the door.',
  approachTag: 'force',
  risk: 0.6,
  stakeTag: 'harm'
};

test('resolve determinism under fixed seed', () => {
  const w = newWorld({ seed: 'seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene = { location: 'tower', objective: 'find the key', time: 'start', promptSeed: '123', tags: [], thread: '' };

  const a = resolveMove(w, baseMove);
  const b = resolveMove(w, baseMove);
  assert.deepEqual(a.result, b.result);
});

test('outcome distribution changes with fate deterministically (coop vs blood)', () => {
  const wCoop = newWorld({ seed: 'seed', fate: 0.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const wBlood = newWorld({ seed: 'seed', fate: 1.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  wCoop.scene = { location: 'tower', objective: 'find the key', time: 'start', promptSeed: '123', tags: [], thread: '' };
  wBlood.scene = { location: 'tower', objective: 'find the key', time: 'start', promptSeed: '123', tags: [], thread: '' };

  const a = resolveMove(wCoop, baseMove);
  const b = resolveMove(wBlood, baseMove);
  assert.notEqual(a.result.dc, b.result.dc);
});

test('mixed outcome exists and produces both gain + cost', () => {
  const w = newWorld({ seed: 'mix-seed', fate: 0.5, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene = { location: 'tower', objective: 'find the key', time: 'start', promptSeed: '123', tags: [], thread: '' };

  // Search deterministically for a mixed result by varying intentText.
  let mixed = null;
  for (let i = 0; i < 40; i++) {
    const res = resolveMove(w, { ...baseMove, intentText: `I test the lock (${i}).` });
    if (res.result.outcome === 'mixed') { mixed = res; break; }
  }
  assert.ok(mixed, 'expected to find a mixed outcome');
  assert.ok(mixed.result.gains.length > 0);
  assert.ok(mixed.result.costs.length > 0);
});

test('deltas apply safely + clamp clocks/resources/position', () => {
  let w = newWorld({ seed: 'seed', fate: 1.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene = { location: 'tower', objective: 'find the key', time: 'start', promptSeed: '123', tags: [], thread: '' };
  w.party = [{ id: 'party', name: 'Party', vibe: 'x', archetype: 'x', wounds: 0, stress: 0, resources: { Supply: 5 } }];

  const res = resolveMove(w, baseMove);
  const w2 = applyDeltas(w, [
    ...res.result.deltas,
    { op: 'clock', key: 'pressure', by: 999 },
    { op: 'resource', entityId: 'party', key: 'HP', by: -999 },
    { op: 'position', entityId: 'party', set: { zone: 'invalid-zone' } }
  ]);

  assert.equal(w2.clocks.pressure, 12);
  const hp = w2.party[0].resources?.HP ?? 0;
  assert.equal(hp, 0);
  assert.equal(['far','near','engaged'].includes(w2.party[0].position.zone), true);
});
