// U701 — DENIED-list law 22 (docs/IMMORTAL_INVARIANTS.md): the effect vocabulary is
// sealed at runtime.
//
// Every structured world-change is one of applyDeltas' known ops. An op type the
// executor doesn't know must be INERT — no throw (the LLM layer proposes deltas and
// must never be able to crash the mutation path), and no mutation (an unknown op must
// never invent a mechanic by side effect). worldHash equality is the strongest
// no-mutation assertion the repo has (same instrument as the U19/U21/U22 replay gates).

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldHash } from '../engine/worldHash.js';

test('U701: unknown delta ops are inert — no throw, no mutation', async () => {
  const w = newWorld('u701-seal');
  const h0 = await worldHash(w);
  const w2 = applyDeltas(w, [
    { op: 'summonDragon', size: 'gargantuan' },
    { op: 'igniteEverything' },
    { op: 'mintNewEffectType', type: 'timeStop', duration: Infinity },
    { op: '__notARealOp__' },
  ]);
  const h1 = await worldHash(w2);
  assert.equal(h1, h0, 'world hash unchanged by unknown ops — the vocabulary is sealed');
});

test('U701: unknown ops mixed into a batch do not poison the known ones', async () => {
  const w = newWorld('u701-mixed');
  const h0 = await worldHash(w);
  const withUnknown = applyDeltas(w, [
    { op: 'summonDragon' },
    { op: 'clock', key: 'pressure', by: 1 },
  ]);
  const cleanOnly = applyDeltas(w, [
    { op: 'clock', key: 'pressure', by: 1 },
  ]);
  const [hA, hB] = await Promise.all([worldHash(withUnknown), worldHash(cleanOnly)]);
  assert.notEqual(hB, h0, 'precondition: the known op really mutates (non-vacuous)');
  assert.equal(hA, hB, 'batch result identical with and without the unknown op');
});
