// U569 — CONSEQ-1: determinism + old-save safety for the now-live thread
// aging clock. Two invariants from the packet's own "invariants" section
// (docs/PACKETS.md CONSEQ-1 row): (1) an aged thread must replay identically
// under the same seed + tick sequence (the determinism tripwire class:
// U19/U21/U22/U27/U30 assert this pattern elsewhere); (2) a thread loaded
// from an OLD SAVE that never had age/objective/trajectory fields at all
// (i.e. persisted before this fix existed) must default cleanly via
// normalizeThread's `?? 0` / `?? ''` / `?? 'static'` guards, not throw or
// produce NaN/undefined.
//
// No WORLD_VERSION bump was needed for this fix (per the packet's forbidden
// list) — the fields were already being WRITTEN by tickLivingThreads, just
// not preserved by normalizeThread. This file proves that stance: a thread
// object that predates the fix (literally missing the three keys) survives
// ensureInstrumentLayer() and comes out fully normalized.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { introduceThread, ensureInstrumentLayer } from '../engine/instrument.js';
import { worldTick } from '../engine/worldTick.js';
import { worldHash } from '../engine/worldHash.js';

const makeWorld = (seed) => {
  let w = newWorld({ seed, fate: 0.4, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = { ...w, scene: { location: 'test', objective: 'survive', time: 'start', promptSeed: 'u569', tags: [], thread: '' } };
  w = { ...w, party: [{ id: 'party', name: 'Hero', stats: { MIGHT: 14, AGILITY: 12, WITS: 10, GRIT: 10, CHARM: 10 }, wounds: 0, stress: 0, inventory: { weapons: [], armor: [], tools: [], clothes: [], spells: [], tech: [], oddities: [], consumables: [], junk: [] }, traits: {}, background: {}, signature: {}, position: { zone: 'far' } }] };
  return w;
};

test('U569: identical seed + identical tick sequence → identical worldHash, even after age mutates the objective', () => {
  const build = () => {
    let w = makeWorld('u569-determinism');
    w = introduceThread(w, 'a deterministically-aging thread');
    for (let i = 0; i < 8; i++) w = worldTick(w, `u569-det-${i}`);
    return w;
  };
  const w1 = build();
  const w2 = build();

  const t1 = w1.instrument.threads[0];
  const t2 = w2.instrument.threads[0];
  assert.ok(t1.age >= 6, 'sanity: the thread actually aged into the mutation zone');
  assert.equal(t1.age, t2.age, 'age must be identical across two independent builds of the same seed+ticks');
  assert.equal(t1.objective, t2.objective, 'the mutated objective must be identical (deterministic RNG pick)');
  assert.equal(t1.trajectory, t2.trajectory, 'trajectory must be identical');
  assert.equal(worldHash(w1), worldHash(w2), 'full worldHash must be byte-identical — an aged thread replays deterministically');
});

test('U569: two different seeds age at the same rate but can diverge on the mutated objective text (RNG is seed-scoped, not global)', () => {
  const build = (seed) => {
    let w = makeWorld(seed);
    w = introduceThread(w, 'a seed-scoped thread');
    for (let i = 0; i < 6; i++) w = worldTick(w, `u569-seedscope-${i}`);
    return w.instrument.threads[0];
  };
  const a = build('u569-seed-a');
  const b = build('u569-seed-b');
  assert.equal(a.age, 6, 'seed A ages normally');
  assert.equal(b.age, 6, 'seed B ages normally — the aging RATE is not seed-dependent');
  assert.equal(a.trajectory, 'mutating');
  assert.equal(b.trajectory, 'mutating');
  // Not asserting the objectives differ (mutateObjective's twist pool is small
  // enough that two seeds could legitimately land on the same twist) — only
  // that each is independently well-formed.
  assert.ok(a.objective.length > 0 && b.objective.length > 0, 'both seeds produce a real mutated objective');
});

test('U569: OLD SAVE SAFETY — a thread object missing age/objective/trajectory entirely (pre-fix shape) normalizes cleanly, no throw', () => {
  // Simulates a save persisted before this fix existed: normalizeThread must
  // have been the ONLY place these fields were ever assembled for storage, so
  // an old save's thread literally has no age/objective/trajectory keys.
  const preFixThread = { id: 'th-oldsave', label: 'a save from before CONSEQ-1', introducedAt: 3, tension: 2, status: 'open' };
  assert.ok(!('age' in preFixThread), 'fixture check: this object has no age key at all, matching a genuine pre-fix save');

  let inst;
  assert.doesNotThrow(() => {
    inst = ensureInstrumentLayer({ threads: [preFixThread] });
  }, 'loading a thread with no age/objective/trajectory keys must not throw');

  const t = inst.threads.find(x => x.id === 'th-oldsave');
  assert.ok(t, 'the old-save thread survives normalization');
  assert.equal(t.age, 0, 'missing age defaults to 0 via the ?? guard');
  assert.equal(t.objective, '', 'missing objective defaults to empty string via the ?? guard');
  assert.equal(t.trajectory, 'static', 'missing trajectory defaults to static via the ?? guard');
  // Fields that already survived before this fix must be untouched.
  assert.equal(t.tension, 2, 'pre-existing tension is preserved, unaffected by this fix');
  assert.equal(t.status, 'open', 'pre-existing status is preserved, unaffected by this fix');
});

test('U569: OLD SAVE SAFETY — a thread with garbage/negative age values clamps into range rather than throwing', () => {
  const garbage = { id: 'th-garbage', label: 'corrupt field test', age: -50, objective: 12345, trajectory: null };
  let inst;
  assert.doesNotThrow(() => {
    inst = ensureInstrumentLayer({ threads: [garbage] });
  }, 'malformed age/objective/trajectory values must not throw');
  const t = inst.threads.find(x => x.id === 'th-garbage');
  assert.equal(t.age, 0, 'negative age clamps to the floor (0), matching clampInt(n, 0, 999)');
  assert.equal(t.objective, '12345', 'a non-string objective coerces via String(), matching the ?? guard pattern');
  assert.equal(t.trajectory, 'static', 'a null trajectory falls back to the static default');
});
