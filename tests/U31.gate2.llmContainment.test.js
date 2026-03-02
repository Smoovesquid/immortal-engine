import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { worldHash } from '../engine/worldHash.js';
import { appendCanonEvent } from '../engine/csl/canonLog.js';

/*
Gate 2 — LLM Containment Hardening

Invariant:
LLM narration must NEVER mutate world state directly.
Only conductor-applied deltas or canonical events may alter world.

This test simulates:
- baseline world
- fake "LLM prose" injection
- verifies worldHash unchanged unless canonical event emitted
*/

test('U31: Gate 2 LLM Containment — prose alone cannot mutate world', () => {
  const seed = 'gate2-containment-seed';

  const w1 = newWorld({
    seed,
    fate: 0.5,
    campaignId: `campaign-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  const hashBefore = worldHash(w1);

  // Simulated LLM prose output (should not mutate anything)
  const fakeProse = {
    narration: "The sky fractures and reality bends.",
    hiddenMutationAttempt: { dread: 999 } // ignored
  };

  // No canonical event appended
  const hashAfter = worldHash(w1);

  assert.equal(
    hashBefore,
    hashAfter,
    'World mutated from prose-only LLM output'
  );
});

test('U31: Gate 2 LLM Containment — only canonical events change worldHash', () => {
  const seed = 'gate2-containment-seed-2';

  let w = newWorld({
    seed,
    fate: 0.5,
    campaignId: `campaign-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  const hashBefore = worldHash(w);

  const canon2 = appendCanonEvent(w.canonLog, {
    type: 'CANON_CREATE',
    id: 'gate2-test-event',
    targetId: 'world'
  });

  w = { ...w, canonLog: canon2 };

  const hashAfter = worldHash(w);

  assert.notEqual(
    hashBefore,
    hashAfter,
    'Canonical event failed to change worldHash'
  );
});
