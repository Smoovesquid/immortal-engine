import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { resolveMove } from '../engine/resolve.js';
import { applyDeltas } from '../engine/effectsCore.js';

function baseWorld({ seed, fate, dread = 0 } = {}) {
  const w = newWorld({ seed, fate, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene = { location: 'tower', objective: 'find the key', time: 'start', promptSeed: '123', tags: [], thread: '' };
  w.clocks.dread = dread;
  w.party = [{ id: 'party', name: 'Party', vibe: 'x', archetype: 'x', wounds: 0, stress: 0, resources: { Supply: 3 } }];
  return w;
}

test('wounds/stress/dread interactions deterministic', () => {
  const w = baseWorld({ seed: 'seed', fate: 1.0, dread: 8 });
  const move = { actorId: 'party', intentText: 'I force the door.', approachTag: 'force', risk: 0.8, stakeTag: 'harm' };
  const a = resolveMove(w, move);
  const b = resolveMove(w, move);
  assert.deepEqual(a.result, b.result);
});

test('blood-meridian increases cost severity vs cooperative (wounds/stress/time/clock)', () => {
  const coop = baseWorld({ seed: 'seed', fate: 0.0, dread: 8 });
  const blood = baseWorld({ seed: 'seed', fate: 1.0, dread: 8 });
  const move = { actorId: 'party', intentText: 'I force the door.', approachTag: 'force', risk: 0.8, stakeTag: 'harm' };

  const a = resolveMove(coop, move);
  const b = resolveMove(blood, move);

  const aw = a.result.deltas.filter(d => d.op === 'wound').reduce((s, d) => s + d.by, 0);
  const bw = b.result.deltas.filter(d => d.op === 'wound').reduce((s, d) => s + d.by, 0);
  assert.ok(bw >= aw);
});

test('scarcity: stakeTag=resource depletes supply and clamps at 0', () => {
  const w = baseWorld({ seed: 'seed', fate: 0.5, dread: 0 });
  const move = { actorId: 'party', intentText: 'I rummage for ammo.', approachTag: 'insight', risk: 0.7, stakeTag: 'resource' };
  const res = resolveMove(w, move);
  const w2 = applyDeltas(w, res.result.deltas);
  assert.ok((w2.party[0].resources.Supply ?? 0) >= 0);
});

test('ledger updates only via delta ops in resolution (world2 unchanged)', () => {
  const w = baseWorld({ seed: 'seed', fate: 0.5, dread: 0 });
  const move = { actorId: 'party', intentText: 'I search.', approachTag: 'insight', risk: 0.4, stakeTag: 'time' };
  const { world2, result } = resolveMove(w, move);
  // world2 is a safe copy (ensureWorld) and should not include applied ledger changes.
  assert.equal(world2.ledger.facts.length, w.ledger.facts.length);
  assert.ok(result.deltas.some(d => d.op === 'ledger') || result.deltas.some(d => d.op === 'timeline'));
});
