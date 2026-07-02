// U329 — THE REF is WORDS-ONLY (narration ≠ canon), asserted mechanically.
// A write-recording proxy wraps the world and outcome through a FULL escalated
// judge→regenerate cycle: zero set/delete/defineProperty anywhere in the graph,
// worldHash byte-identical before/after, and the return type is a string. This
// is Invariant 1/2 of engine/ref/index.js — if this test goes red, the Ref
// leaked into state and the determinism moat is breached.

import test from 'node:test';
import assert from 'node:assert/strict';

import { reviewNarration } from '../engine/ref/index.js';
import { createRefBudget } from '../engine/ref/budget.js';
import { REF_VERDICTS } from '../engine/ref/rubric.js';
import { worldHash } from '../engine/worldHash.js';

// Recursive write-recorder: reads pass through (wrapped), writes are RECORDED and
// applied (so a buggy mutation isn't masked by a frozen-object throw inside the
// Ref's never-throw shell — we detect the ATTEMPT, not just the effect).
function recordingProxy(root, writes) {
  const wrap = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    return new Proxy(obj, {
      get(t, p, r) { return wrap(Reflect.get(t, p, r)); },
      set(t, p, v, r) { writes.push(`set:${String(p)}`); return Reflect.set(t, p, v, r); },
      deleteProperty(t, p) { writes.push(`delete:${String(p)}`); return Reflect.deleteProperty(t, p); },
      defineProperty(t, p, d) { writes.push(`define:${String(p)}`); return Reflect.defineProperty(t, p, d); },
    });
  };
  return wrap(root);
}

function tinyWorld() {
  return {
    map: {
      currentNodeId: 'n1',
      nodes: [{ id: 'n1', name: 'Test Hollow', kind: 'settlement', settlement: { npcs: [{ name: 'Mira', role: 'baker' }] } }],
      edges: [{ a: 'n1', b: 'n2' }],
    },
    party: [{ level: 1, wounds: 0, maxWounds: 3, conditions: [], inventory: { consumables: [] } }],
    ledger: { facts: [{ text: 'the well ran dry last winter' }] },
    canonLog: { events: [{ kind: 'arrive', id: 'e1', data: {} }] },
    timeline: [{ kind: 'arrive', t: 1 }],
    conversation: { lastRoll: { roll: 14, dc: 12, outcome: 'success' } },
    combat: { active: false, enemies: [] },
    meta: {},
  };
}

test('U329: a full escalated judge→regen cycle mutates NOTHING and returns a string', async () => {
  const world = tinyWorld();
  const outcome = { input: 'what are my stats?', mechanics: '' };
  const before = worldHash(world);
  const beforeJson = JSON.stringify({ world, outcome });

  const writes = [];
  const out = await reviewNarration({
    world: recordingProxy(world, writes),
    outcome: recordingProxy(outcome, writes),
    candidate: 'MIGHT 6 (-2), AGILITY 6 (-2) — so reads the ledger of you.',
    baseNarration: 'You are strong enough for the work, and no more.',
    judge: async () => ({ verdict: REF_VERDICTS.REGENERATE, failure_class: 'MACHINE_DUMP' }),
    regenerate: async () => 'Strong arms, slow wits — you know your own measure well enough.',
    enabled: true, budget: createRefBudget({ maxJudgePerSession: Infinity }),
  });

  assert.equal(typeof out, 'string', 'the Ref returns WORDS — a string, nothing else');
  assert.match(out, /your own measure/);
  assert.deepEqual(writes, [], 'zero write attempts anywhere in world/outcome');
  assert.equal(JSON.stringify({ world, outcome }), beforeJson, 'inputs byte-identical');
  assert.equal(worldHash(world), before, 'worldHash unchanged — determinism moat holds');
});

test('U329: the soft dialogue path is equally read-only', async () => {
  const world = tinyWorld();
  const outcome = { input: 'how long have you been here?', mechanics: '[dialogue ask | deflected | trust:5]' };
  const before = worldHash(world);
  const writes = [];

  const out = await reviewNarration({
    world: recordingProxy(world, writes),
    outcome: recordingProxy(outcome, writes),
    candidate: 'Mira keeps her own tally of years, and shares none of it.',
    baseNarration: "Couldn't say — ask someone older.",
    judge: async () => ({ verdict: REF_VERDICTS.PASS }),
    enabled: true, budget: createRefBudget({ maxJudgePerSession: Infinity }),
  });

  assert.equal(typeof out, 'string');
  assert.deepEqual(writes, []);
  assert.equal(worldHash(world), before);
});
