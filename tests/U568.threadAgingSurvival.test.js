// U568 — CONSEQ-1: normalizeThread() preserves age/objective/trajectory
// engine-wide (not slice-specific). This is the minimal, direct reproduction:
// a bare `introduceThread` on a plain world, driven through worldTick() —
// the exact method used to verify the pre-existing bug (stash-reverting all
// SL-5 code and reproducing on a plain thread with zero slice code present,
// per docs/PACKETS.md's CONSEQ-1 row and tests/U490's former KNOWN GAP note).
//
// Root cause recap: engine/instrument.js's normalizeThread() is invoked by
// ensureInstrumentLayer(), which runs on EVERY ensureWorld() call — including
// worldTick's own opening ensureWorld(world). Before this fix, normalizeThread
// returned only {id, label, introducedAt, tension, status}, silently dropping
// age/objective/trajectory. worldTick.js's tickLivingThreads() sets those
// three fields correctly WITHIN one worldTick() call, but the very next
// worldTick()/ensureWorld() anywhere stripped them back out — so age could
// never climb past 1, and mutateObjective's `age>4 && age%3===0` branch could
// never fire in the real multi-turn loop. This affected EVERY thread engine-
// wide (introduceThread, escalateThread, resolveThread, tickThreads all route
// through the same normalizeThread), not just the SL-5 slice-region threads
// that U490 covers.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { introduceThread } from '../engine/instrument.js';
import { worldTick } from '../engine/worldTick.js';

const makeWorld = (fate = 0.5, seed = 'u568-conseq1') => {
  let w = newWorld({ seed, fate, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = { ...w, scene: { location: 'test', objective: 'survive', time: 'start', promptSeed: 'u568', tags: [], thread: '' } };
  w = { ...w, party: [{ id: 'party', name: 'Hero', stats: { MIGHT: 14, AGILITY: 12, WITS: 10, GRIT: 10, CHARM: 10 }, wounds: 0, stress: 0, inventory: { weapons: [], armor: [], tools: [], clothes: [], spells: [], tech: [], oddities: [], consumables: [], junk: [] }, traits: {}, background: {}, signature: {}, position: { zone: 'far' } }] };
  return w;
};

test('U568: a bare introduceThread (no slice/pack code), once normalized, starts at age 0, empty objective, static trajectory', () => {
  // introduceThread() itself returns the raw thread literal un-normalized
  // (it does not re-run ensureWorld on its own return) — normalization
  // happens the next time ensureWorld()/ensureInstrumentLayer() runs, which
  // is exactly the seam this packet fixes. Route through ensureWorld() here
  // to read the normalized shape, matching what every real caller sees by
  // the next turn (worldTick's own opening ensureWorld call, if nothing else).
  let w = makeWorld();
  w = introduceThread(w, 'a plain engine-wide thread');
  w = ensureWorld(w);
  const t = w.instrument.threads[0];
  assert.equal(t.age, 0, 'a freshly introduced thread starts at age 0');
  assert.equal(t.objective, '', 'a freshly introduced thread starts with an empty objective');
  assert.equal(t.trajectory, 'static', 'a freshly introduced thread starts static');
});

test('U568: age climbs by exactly 1 per worldTick call and is NOT capped at 1 (the bug this packet fixes)', () => {
  let w = makeWorld();
  w = introduceThread(w, 'a plain engine-wide thread');
  const id = w.instrument.threads[0].id;

  for (let i = 1; i <= 5; i++) {
    w = worldTick(w, `u568-tick-${i}`);
    const t = w.instrument.threads.find(x => x.id === id);
    assert.equal(t.age, i, `after ${i} worldTick call(s), age must equal ${i} — not stuck at <=1`);
  }
});

test('U568: the objective mutates and trajectory flips to "mutating" once age crosses age>4 && age%3===0', () => {
  let w = makeWorld();
  w = introduceThread(w, 'a plain engine-wide thread');
  const id = w.instrument.threads[0].id;

  for (let i = 0; i < 5; i++) w = worldTick(w, `u568-mut-${i}`);
  let t = w.instrument.threads.find(x => x.id === id);
  assert.equal(t.age, 5, 'sanity: age is 5 before the 6th tick');
  assert.equal(t.trajectory, 'static', 'age 5 does not satisfy age%3===0 — still static');
  assert.equal(t.objective, '', 'age 5 has not mutated yet');

  w = worldTick(w, 'u568-mut-5');
  t = w.instrument.threads.find(x => x.id === id);
  assert.equal(t.age, 6, 'age is 6 on the 6th tick');
  assert.equal(t.trajectory, 'mutating', 'age 6 satisfies age>4 && age%3===0 — trajectory must flip to mutating');
  assert.ok(t.objective.length > 0, 'objective must be non-empty once mutated');
});

test('U568: engine-wide — this is not slice-specific; a second, independently-labeled thread ages identically', () => {
  let w = makeWorld();
  w = introduceThread(w, 'thread one');
  w = introduceThread(w, 'thread two');
  for (let i = 0; i < 6; i++) w = worldTick(w, `u568-multi-${i}`);
  for (const t of w.instrument.threads) {
    assert.equal(t.age, 6, `every thread ages independently of label/slice — "${t.label}" must reach age 6`);
  }
});
