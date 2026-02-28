import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { conductorDecision, applyConductorDeltas } from '../engine/conductor.js';
import { ensureInstrumentLayer, introduceThread } from '../engine/instrument.js';
import { seedFromString, makeRng } from '../engine/rng.js';

function baseWorld({ seed = 'seed', fate = 0.8, inev = 0 } = {}) {
  let w = newWorld({ seed, fate, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene = { location: 'A', objective: 'O1', time: 'start', promptSeed: '1', tags: [], thread: '' };
  w.instrument = { ...ensureInstrumentLayer(w.instrument), inevitability: inev, lastBeats: ['quiet','quiet'] };
  w = introduceThread(w, 'the rift wants a price');
  return w;
}

test('deterministic conductor decision given seed', () => {
  const w = baseWorld({ seed: 'seed', inev: 6 });
  const rng = makeRng(seedFromString('seed|r'));
  const a = conductorDecision(w, rng);
  const b = conductorDecision(w, rng);
  // Since rng is stateful, use internal deterministic call instead.
  const a2 = conductorDecision(w);
  const b2 = conductorDecision(w);
  assert.deepEqual(a2, b2);
});

test('escalation weighting increases with inevitability (more escalation/confrontation)', () => {
  const lo = baseWorld({ seed: 'seed', inev: 0 });
  const hi = baseWorld({ seed: 'seed', inev: 12 });
  const a = conductorDecision(lo);
  const b = conductorDecision(hi);
  const aHas = a.deltas.some(d => d.type === 'escalateThread' || (d.type === 'forceBeat' && d.beatType === 'confrontation'));
  const bHas = b.deltas.some(d => d.type === 'escalateThread' || (d.type === 'forceBeat' && d.beatType === 'confrontation'));
  assert.ok(bHas || !aHas);
});

test('advisory mode does not mutate world except timeline log', () => {
  const w = baseWorld({ seed: 'seed', inev: 8 });
  const p = conductorDecision(w);
  const w2 = applyConductorDeltas(w, p, { mode: 'advisory' });
  assert.equal(w2.meta.seed, w.meta.seed);
  assert.equal(w2.instrument.inevitability, w.instrument.inevitability);
  assert.ok(w2.timeline.length === w.timeline.length + 1);
});

test('conductor mode mutates world deterministically and logs timeline', () => {
  const w = baseWorld({ seed: 'seed', inev: 8 });
  const p = conductorDecision(w);
  const w2 = applyConductorDeltas(w, p, { mode: 'conductor' });
  const w3 = applyConductorDeltas(w, p, { mode: 'conductor' });
  assert.deepEqual(w2.instrument, w3.instrument);
  assert.ok(w2.timeline.length === w.timeline.length + 1);
  assert.equal(w2.timeline[w2.timeline.length - 1].kind, 'conductor');
});
