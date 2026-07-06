// U580 — OCC-STORY-2 hot-thread bias. The world's live PLOTS place its people: a thread in
// world.instrument.threads (READ-ONLY) that has grown HOT — aged past a named floor AND at high
// tension — biases the anchors of the NPCs whose story ties them to its LOCUS. The Lingerer haunts
// the chapel path because the chapel thread is hot; the priest is drawn to the chapel; a bandit is
// drawn to rob a hot, valuable place (the burglary). A COLD thread (age 0 — the boot state) fires
// NOTHING: the placement is byte-identical to the OCC-STORY-1 baseline. Deterministic per world state
// ×2. Hermetic — no network, no API key, no worldTick (threads scripted directly to isolate the bias).
//
// Relation to OCC-STORY-1: this EXTENDS storyAnchors.placementFor — the same seed-stable
// role/epithet/faction machinery, plus a thread-locus layer that only engages when a thread is hot.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  placementFor, hottestLocusThread, threadIsHot, threadLocus, relatesToThread,
  HOT_AGE, HOT_TENSION,
} from '../engine/structures/storyAnchors.js';

// A settlement world with a chosen building set and a single scripted thread. No wakeKey (nothing is
// the player's home here), daytime (hours 8), so the ordinary OCC-STORY-1 path would keep folk at
// their anchors — any move toward the locus is the bias, not the day-phase roll.
function threadWorld(buildings, thread, seed = 'aldermere') {
  return {
    meta: { seed },
    time: { hours: 8 },
    map: { currentNodeId: 'town', nodes: [{ id: 'town', settlement: { buildings, npcs: [] } }] },
    structures: { byId: {} },
    instrument: { threads: thread ? [thread] : [] },
  };
}
const hotChapel = (over = {}) => ({ id: 'th-chapel', label: 'the chapel bell', objective: '', tension: 5, age: 5, status: 'open', ...over });
const NO_CHAPEL = [{ name: 'smithy', state: 'intact' }, { name: 'well', state: 'intact' }, { name: 'storehouse', state: 'intact' }];
const WITH_CHAPEL = [...NO_CHAPEL, { name: 'chapel', state: 'intact' }];

const lingerer = { id: 'npc_lingerer', name: 'the Lingerer', role: 'a wanderer who has stayed too long, asking questions no one wants to answer' };
const priest = { id: 'priest0', name: 'Father Aldous', role: 'priest' };
const smith = { id: 'smith0', name: 'Bruna', role: 'smith' };

test('U580: the hot-thread thresholds sit strictly above the boot state (age-0 / tension-1 never hot)', () => {
  assert.ok(HOT_AGE >= 1 && HOT_TENSION >= 2, 'floors must exclude a fresh (age-0, tension-1) thread');
  assert.equal(threadIsHot({ age: 0, tension: 1, status: 'open' }), false, 'a boot thread is cold');
  assert.equal(threadIsHot({ age: HOT_AGE - 1, tension: 5, status: 'open' }), false, 'too young is cold');
  assert.equal(threadIsHot({ age: 99, tension: HOT_TENSION - 1, status: 'open' }), false, 'too calm is cold');
  assert.equal(threadIsHot({ age: HOT_AGE, tension: HOT_TENSION, status: 'open' }), true, 'at both floors it is hot');
  assert.equal(threadIsHot({ age: 99, tension: 5, status: 'resolved' }), false, 'a resolved thread never biases');
});

test('U580: a hot chapel thread draws the Lingerer to watch the chapel path (no chapel drawn here)', () => {
  const w = threadWorld(NO_CHAPEL, hotChapel());
  assert.deepEqual(threadLocus(w.instrument.threads[0]), { kind: 'chapel', phrase: 'the chapel path' });
  assert.ok(hottestLocusThread(w), 'the chapel thread is the hottest spatial plot');
  const p = placementFor(w, lingerer);
  assert.equal(p.where, 'outdoors', 'no chapel is drawn here → she watches from the open');
  assert.equal(p.reasonKind, 'watching the locus');
  assert.match(p.reason, /chapel path/, 'her reason names the locus');
});

test('U580: with a chapel drawn here, the priest is drawn INTO it (role→kind relation)', () => {
  const w = threadWorld(WITH_CHAPEL, hotChapel());
  const p = placementFor(w, priest);
  assert.equal(p.where, 'building', 'the chapel is here → the priest anchors into it');
  assert.equal(p.reasonKind, 'drawn to the thread');
  assert.match(String(p.key), /chapel/, `the anchor key is the chapel: ${p.key}`);
});

test('U580: an UNRELATED NPC keeps living the ordinary day (the smith is not pulled by the chapel plot)', () => {
  const hot = threadWorld(NO_CHAPEL, hotChapel());
  const cold = threadWorld(NO_CHAPEL, hotChapel({ age: 0, tension: 1 }));
  const pHot = placementFor(hot, smith);
  const pCold = placementFor(cold, smith);
  // The smith has no kind/faction/watcher tie to the chapel, so hot vs cold must be identical for her.
  assert.deepEqual(
    { where: pHot.where, key: pHot.key, reason: pHot.reason },
    { where: pCold.where, key: pCold.key, reason: pCold.reason },
    'an unrelated NPC is untouched by the hot thread',
  );
});

test('U580: a hostile is drawn to a hot valuable locus as a BURGLARY — inside when the target is here', () => {
  // Sweep hostile ids to find one the seeded target-roll selects (≈half), then assert the break-in.
  const thread = { id: 'th-estate', label: 'The Divided Estate', objective: '', tension: 5, age: 6, status: 'open' };
  const locus = threadLocus(thread);
  assert.equal(locus.kind, 'market', 'an estate/market plot resolves to the market locus');
  let drawn = null;
  for (let i = 0; i < 40 && !drawn; i++) {
    const b = { id: `hostile_${i}`, name: 'Ashblade', role: 'bandit', hostile: true };
    if (relatesToThread('aldermere', b, thread, locus)) drawn = b;
  }
  assert.ok(drawn, 'at least one hostile in a sweep is drawn to the target (seeded ≈50%)');

  const inside = placementFor(threadWorld([{ name: 'storehouse', state: 'intact' }, { name: 'well', state: 'intact' }], thread), drawn);
  assert.equal(inside.where, 'building', 'the target building is here → he is inside, breaking in');
  assert.equal(inside.reasonKind, 'burglary in progress');
  assert.match(inside.reason, /burglary/, 'his reason names the crime');

  const casing = placementFor(threadWorld([{ name: 'well', state: 'intact' }], thread), drawn);
  assert.equal(casing.where, 'outdoors', 'no target here → he cases it from the open');
  assert.equal(casing.reasonKind, 'burglary in progress');
});

test('U580: a COLD thread is byte-identical to the OCC-STORY-1 baseline (no bias, no field drift)', () => {
  // With an age-0/tension-1 thread the world is "cold": hottestLocusThread is null and every placement
  // is the pure OCC-STORY-1 result. We compare against a NO-THREAD world (the pre-OCC-STORY-2 shape)
  // for the same NPCs — they must match string-for-string.
  const withCold = threadWorld(WITH_CHAPEL, hotChapel({ age: 0, tension: 1 }));
  const noThread = threadWorld(WITH_CHAPEL, null);
  assert.equal(hottestLocusThread(withCold), null, 'a cold thread is not hot');
  for (const npc of [lingerer, priest, smith]) {
    const a = placementFor(withCold, npc);
    const b = placementFor(noThread, npc);
    assert.deepEqual(
      { where: a.where, key: a.key, reason: a.reason },
      { where: b.where, key: b.key, reason: b.reason },
      `cold-thread placement matches the no-thread baseline for ${npc.name}`,
    );
  }
});

test('U580: hot-thread placement is deterministic ×2 (same world state → same placement)', () => {
  const mk = () => threadWorld(WITH_CHAPEL, hotChapel());
  for (const npc of [lingerer, priest, smith]) {
    const p1 = placementFor(mk(), npc);
    const p2 = placementFor(mk(), npc);
    assert.deepEqual(p1, p2, `deterministic placement for ${npc.name}`);
  }
});
