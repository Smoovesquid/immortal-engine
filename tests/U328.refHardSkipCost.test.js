// U328 — THE REF cost guard under the union policy. The common case (a clean
// hard turn) must stay ZERO-cost — no judge call — and the escalated path must
// consume the SAME budget as the soft path (per-turn 1/1 caps + the session cap),
// so detector escalation can never turn into runaway spend.
// See docs/briefs/THE_REF_CONTRACT.md §4.2 + engine/ref/budget.js.

import test from 'node:test';
import assert from 'node:assert/strict';

import { reviewNarration } from '../engine/ref/index.js';
import { createRefBudget } from '../engine/ref/budget.js';
import { REF_VERDICTS } from '../engine/ref/rubric.js';

function tinyWorld() {
  return {
    map: { currentNodeId: 'n1', nodes: [{ id: 'n1', name: 'Test', kind: 'settlement', settlement: { npcs: [] } }] },
    party: [{ level: 1 }],
    ledger: { facts: [] },
    meta: {},
  };
}

const HARD_META = { input: 'what am I carrying?', mechanics: '' };
const DUMP_CAND = 'MIGHT 6 (-2), AGILITY 6 (-2) — the ledger of you.';
const CLEAN_CAND = 'You carry the Worn Blade and a heel of road bread.';
const BASE = 'Your pack holds the Worn Blade.';

test('U328: a clean hard turn costs nothing — detector silent, judge never called', async () => {
  let judged = 0;
  const out = await reviewNarration({
    world: tinyWorld(), outcome: HARD_META, candidate: CLEAN_CAND, baseNarration: BASE,
    judge: async () => { judged += 1; return { verdict: REF_VERDICTS.REGENERATE }; },
    enabled: true, budget: createRefBudget({ maxJudgePerSession: Infinity }),
  });
  assert.equal(out, CLEAN_CAND);
  assert.equal(judged, 0);
});

test('U328: the session cap bounds escalated turns exactly like soft turns', async () => {
  const budget = createRefBudget({ maxJudgePerSession: 1 });
  let judged = 0;
  const judge = async () => { judged += 1; return { verdict: REF_VERDICTS.PASS }; };

  await reviewNarration({ world: tinyWorld(), outcome: HARD_META, candidate: DUMP_CAND, baseNarration: BASE, judge, enabled: true, budget });
  const second = await reviewNarration({ world: tinyWorld(), outcome: HARD_META, candidate: DUMP_CAND, baseNarration: BASE, judge, enabled: true, budget });

  assert.equal(judged, 1, 'the second escalated turn is over the session cap');
  assert.equal(second, DUMP_CAND, 'over budget → silent fallback to the candidate');
});

test('U328: regen cap 0 on an escalated REGENERATE falls to base without calling regen', async () => {
  let regens = 0;
  const out = await reviewNarration({
    world: tinyWorld(), outcome: HARD_META, candidate: DUMP_CAND, baseNarration: BASE,
    judge: async () => ({ verdict: REF_VERDICTS.REGENERATE, failure_class: 'MACHINE_DUMP' }),
    regenerate: async () => { regens += 1; return 'never'; },
    enabled: true, budget: createRefBudget({ maxRegenPerTurn: 0, maxJudgePerSession: Infinity }),
  });
  assert.equal(regens, 0);
  assert.equal(out, BASE);
});

test('U328: flag OFF short-circuits before the detector (zero behavior change)', async () => {
  let judged = 0;
  const out = await reviewNarration({
    world: tinyWorld(), outcome: HARD_META, candidate: DUMP_CAND, baseNarration: BASE,
    judge: async () => { judged += 1; return { verdict: REF_VERDICTS.REGENERATE }; },
    enabled: false, budget: createRefBudget({ maxJudgePerSession: Infinity }),
  });
  assert.equal(judged, 0);
  assert.equal(out, DUMP_CAND);
});
