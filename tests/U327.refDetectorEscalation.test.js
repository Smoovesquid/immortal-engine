// U327 — THE REF detector-escalation orchestration (reviewNarration + Family B).
// The union policy: a plain-HARD turn whose candidate carries a machine artifact
// escalates to the judge; intentional epistemic dialogue modes NEVER escalate
// (social physics); the never-throw + fallback chain holds on the escalated path
// exactly as on the soft path. Deterministic, LLM-off (stub judge/regen).
// See docs/briefs/THE_REF_CONTRACT.md §4.2.

import test from 'node:test';
import assert from 'node:assert/strict';

import { reviewNarration } from '../engine/ref/index.js';
import { createRefBudget } from '../engine/ref/budget.js';
import { REF_VERDICTS } from '../engine/ref/rubric.js';

function tinyWorld() {
  return {
    map: { currentNodeId: 'n1', nodes: [{ id: 'n1', name: 'Test', kind: 'settlement', settlement: { npcs: [{ name: 'Mira', role: 'baker' }] } }] },
    party: [{ level: 1, wounds: 0, maxWounds: 3 }],
    ledger: { facts: [] },
    meta: {},
  };
}

// A HARD-source outcome (meta answer, mechanics none) whose candidate is a sheet dump.
const HARD_META = { input: 'what am I carrying and what are my stats?', mechanics: '' };
const DUMP_CAND = "You're Sera — MIGHT 6 (-2), AGILITY 6 (-2), WITS 6 (+0), and a Worn Blade.";
const CLEAN_CAND = 'You carry the Worn Blade and the last of the road bread.';
const BASE = 'Your pack holds the Worn Blade and a heel of road bread.';

const fresh = () => createRefBudget({ maxJudgePerSession: Infinity });

test('U327: a hard turn with a detector hit escalates — judge sees the detector source', async () => {
  const seen = [];
  const out = await reviewNarration({
    world: tinyWorld(), outcome: HARD_META, candidate: DUMP_CAND, baseNarration: BASE,
    judge: async (args) => { seen.push(args); return { verdict: REF_VERDICTS.PASS }; },
    enabled: true, budget: fresh(),
  });
  assert.equal(out, DUMP_CAND, 'PASS ships the candidate');
  assert.equal(seen.length, 1, 'judge called exactly once');
  assert.equal(seen[0].source, 'detector:stat-block');
  assert.equal(seen[0].candidate, DUMP_CAND);
});

test('U327: escalated REGENERATE runs the regen and ships its line', async () => {
  const out = await reviewNarration({
    world: tinyWorld(), outcome: HARD_META, candidate: DUMP_CAND, baseNarration: BASE,
    judge: async () => ({ verdict: REF_VERDICTS.REGENERATE, failure_class: 'MACHINE_DUMP' }),
    regenerate: async ({ failureClass, source }) => {
      assert.equal(failureClass, 'MACHINE_DUMP');
      assert.equal(source, 'detector:stat-block');
      return 'Blade at your hip, bread in the pack — and strength enough to swing the one and finish the other.';
    },
    enabled: true, budget: fresh(),
  });
  assert.match(out, /Blade at your hip/);
});

test('U327: escalated REGENERATE with no regen falls back to the grounded BASE, not the dump', async () => {
  const out = await reviewNarration({
    world: tinyWorld(), outcome: HARD_META, candidate: DUMP_CAND, baseNarration: BASE,
    judge: async () => ({ verdict: REF_VERDICTS.REGENERATE, failure_class: 'MACHINE_DUMP' }),
    enabled: true, budget: fresh(),
  });
  assert.equal(out, BASE);
});

test('U327: an INTENTIONAL dialogue mode never escalates, even with an artifact-shaped line', async () => {
  let judged = false;
  const out = await reviewNarration({
    world: tinyWorld(),
    outcome: { input: 'how long have you been here?', mechanics: '[dialogue ask | lied | trust:2]' },
    candidate: DUMP_CAND, baseNarration: BASE,
    judge: async () => { judged = true; return { verdict: REF_VERDICTS.REGENERATE }; },
    enabled: true, budget: fresh(),
  });
  assert.equal(judged, false, 'lied/withheld/claim_recall are untouchable (social physics)');
  assert.equal(out, DUMP_CAND);
});

test('U327: never throws on the escalated path — judge throw ships the candidate, regen throw ships the base', async () => {
  const afterJudgeThrow = await reviewNarration({
    world: tinyWorld(), outcome: HARD_META, candidate: DUMP_CAND, baseNarration: BASE,
    judge: async () => { throw new Error('judge down'); },
    enabled: true, budget: fresh(),
  });
  assert.equal(afterJudgeThrow, DUMP_CAND);

  const afterRegenThrow = await reviewNarration({
    world: tinyWorld(), outcome: HARD_META, candidate: DUMP_CAND, baseNarration: BASE,
    judge: async () => ({ verdict: REF_VERDICTS.REGENERATE, failure_class: 'MACHINE_DUMP' }),
    regenerate: async () => { throw new Error('regen down'); },
    enabled: true, budget: fresh(),
  });
  assert.equal(afterRegenThrow, BASE);
});

test('U327: the soft path still works with the union in place (dialogue deflected → judge runs)', async () => {
  let src = null;
  const out = await reviewNarration({
    world: tinyWorld(),
    outcome: { input: 'how long have you been here?', mechanics: '[dialogue ask | deflected | trust:5]' },
    candidate: CLEAN_CAND, baseNarration: BASE,
    judge: async ({ source }) => { src = source; return { verdict: REF_VERDICTS.PASS }; },
    enabled: true, budget: fresh(),
  });
  assert.equal(out, CLEAN_CAND);
  assert.equal(src, 'dialogue:deflected');
});

test('U327: the new Family-A tags escalate through the soft path (no detector needed)', async () => {
  let src = null;
  await reviewNarration({
    world: tinyWorld(),
    outcome: { input: 'where does the road lead?', mechanics: '[egress:repair]' },
    candidate: CLEAN_CAND, baseNarration: BASE,
    judge: async ({ source }) => { src = source; return { verdict: REF_VERDICTS.PASS }; },
    enabled: true, budget: fresh(),
  });
  assert.equal(src, 'egress:repair');
});
