import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { ensureInstrumentLayer, introduceThread, escalateThread, resolveThread, tickThreads } from '../engine/instrument.js';
import { shouldTriggerEnding } from '../engine/endingArchitect.js';
import { resolveMove } from '../engine/resolve.js';
import { applyDeltas } from '../engine/effectsCore.js';

const makeWorld = (fate = 0.5) => {
  let w = newWorld({ seed: 'deathspiral', fate, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = { ...w, scene: { location: 'test', objective: 'survive', time: 'start', promptSeed: 'ds1', tags: [], thread: '' } };
  w = { ...w, party: [{ id: 'party', name: 'Hero', stats: { MIGHT: 14, AGILITY: 12, WITS: 10, GRIT: 10, CHARM: 10 }, wounds: 0, stress: 0, inventory: { weapons: [], armor: [], tools: [], clothes: [], spells: [], tech: [], oddities: [], consumables: [], junk: [] }, traits: {}, background: {}, signature: {}, position: { zone: 'far' } }] };
  return w;
};

test('inevitability is capped at 10, not 12', () => {
  let w = makeWorld(1.0); // blood fate
  w = introduceThread(w, 'thread1');
  w = introduceThread(w, 'thread2');
  w = introduceThread(w, 'thread3');
  // Escalate all threads to max tension
  for (const t of w.instrument.threads) {
    w = escalateThread(w, t.id);
    w = escalateThread(w, t.id);
    w = escalateThread(w, t.id);
    w = escalateThread(w, t.id);
  }
  assert.ok(w.instrument.inevitability <= 10, `inevitability ${w.instrument.inevitability} should be <= 10`);
});

test('successful roll reduces thread tension via relief valve', () => {
  let w = makeWorld(0.0); // cooperative — easier to succeed
  w = introduceThread(w, 'rising darkness');
  const tid = w.instrument.threads[0].id;
  // Escalate to build tension
  w = escalateThread(w, tid);
  w = escalateThread(w, tid);
  const tensionBefore = w.instrument.threads[0].tension;

  // Resolve a move — on success, it should emit threadRelief delta
  const { world2, result } = resolveMove(w, {
    actorId: 'party',
    intentText: 'smash the obstacle',
    approachTag: 'force',
    risk: 0.3,
    stakeTag: 'time'
  });

  if (result.outcome === 'success') {
    // Apply the deltas including threadRelief
    const w2 = applyDeltas(world2, result.deltas);
    const inst = ensureInstrumentLayer(w2.instrument);
    const thread = inst.threads.find(t => t.id === tid);
    assert.ok(thread.tension <= tensionBefore, `tension ${thread.tension} should be <= ${tensionBefore} after success relief`);
    // Verify the delta was emitted
    const hasRelief = result.deltas.some(d => d.op === 'threadRelief');
    assert.ok(hasRelief, 'success result should include threadRelief delta');
  }
});

test('threadRelief delta reduces most tense thread', () => {
  let w = makeWorld();
  w = introduceThread(w, 'alpha');
  w = introduceThread(w, 'beta');
  // Escalate alpha more than beta
  const alphaId = w.instrument.threads.find(t => t.label === 'alpha').id;
  const betaId = w.instrument.threads.find(t => t.label === 'beta').id;
  w = escalateThread(w, alphaId);
  w = escalateThread(w, alphaId);
  w = escalateThread(w, betaId);

  const alphaBefore = w.instrument.threads.find(t => t.id === alphaId).tension;
  const betaBefore = w.instrument.threads.find(t => t.id === betaId).tension;

  w = applyDeltas(w, [{ op: 'threadRelief', by: -1 }]);

  const alphaAfter = w.instrument.threads.find(t => t.id === alphaId).tension;
  const betaAfter = w.instrument.threads.find(t => t.id === betaId).tension;

  assert.equal(alphaAfter, alphaBefore - 1, 'most tense thread (alpha) should lose 1 tension');
  assert.equal(betaAfter, betaBefore, 'less tense thread (beta) should be unchanged');
});

test('ending requires BOTH resolved thread AND inevitability threshold', () => {
  let w = makeWorld(1.0); // blood: threshold = 8
  w = { ...w, time: { ...w.time, turn: 20 } }; // past minimum turns
  w = introduceThread(w, 'the doom');
  const tid = w.instrument.threads[0].id;

  // High inevitability but no resolved threads
  w = { ...w, instrument: { ...w.instrument, inevitability: 10 } };
  assert.equal(shouldTriggerEnding(w), false, 'should not trigger with only high inevitability');

  // Resolved thread but low inevitability
  w = { ...w, instrument: { ...w.instrument, inevitability: 2, threads: w.instrument.threads.map(t => ({ ...t, status: 'resolved' })) } };
  assert.equal(shouldTriggerEnding(w), false, 'should not trigger with only resolved thread');

  // Both conditions met
  w = { ...w, instrument: { ...w.instrument, inevitability: 10 } };
  assert.equal(shouldTriggerEnding(w), true, 'should trigger with both resolved thread AND high inevitability');
});

test('ending cannot trigger before turn 15', () => {
  let w = makeWorld(1.0);
  w = introduceThread(w, 'the doom');
  w = { ...w, instrument: { ...w.instrument, inevitability: 10, threads: w.instrument.threads.map(t => ({ ...t, status: 'resolved' })) } };

  // At turn 10 — too early
  w = { ...w, time: { ...w.time, turn: 10 } };
  assert.equal(shouldTriggerEnding(w), false, 'should not trigger before turn 15');

  // At turn 15 — now eligible
  w = { ...w, time: { ...w.time, turn: 15 } };
  assert.equal(shouldTriggerEnding(w), true, 'should trigger at turn 15+');
});

test('ending can also trigger via maxed clocks + resolved thread (after turn 15)', () => {
  let w = makeWorld(0.0);
  w = { ...w, time: { ...w.time, turn: 20 } };
  w = introduceThread(w, 'the crisis');
  w = { ...w, instrument: { ...w.instrument, inevitability: 3, threads: w.instrument.threads.map(t => ({ ...t, status: 'resolved' })) } };
  w = { ...w, clocks: { ...w.clocks, pressure: 12 } };

  assert.equal(shouldTriggerEnding(w), true, 'maxed clocks + resolved thread should trigger ending');
});
