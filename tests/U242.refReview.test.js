// U242 — THE REF orchestration (reviewNarration). The selective second-opinion's
// verdict→action flow, proven deterministically with a STUB judge (the live model
// is injected separately, behind the flag). Covers the four hard invariants:
//   1. NARRATION ≠ CANON — the Ref returns a string and mutates neither world nor
//      outcome (snapshot deep-equality before/after).
//   3. NEVER THROWS — judge/regenerate errors, missing fns, over budget, flag off,
//      bad output all fall back to the engine's candidate.
//   + the verdict space: PASS ships, REGENERATE redoes, kick-backs only when the
//      judge supplies a DM-voiced line (else default to answering — guardrail 1).
//
// Deterministic, LLM-off. See docs/THE_REF.md.

import test from 'node:test';
import assert from 'node:assert/strict';

import { reviewNarration } from '../engine/ref/index.js';
import { createRefBudget } from '../engine/ref/budget.js';
import { REF_VERDICTS } from '../engine/ref/rubric.js';

// A minimal world buildCanonGroundTruth can read (all optional-chained).
function tinyWorld() {
  return {
    map: { currentNodeId: 'n1', nodes: [{ id: 'n1', name: 'Test', kind: 'settlement', settlement: { npcs: [{ name: 'Mira', role: 'baker' }] } }] },
    party: [{ level: 1, wounds: 0, maxWounds: 3 }],
    ledger: { facts: [] },
    meta: {},
  };
}
const SOFT = { input: 'how long have you been here?', mechanics: '[dialogue ask | deflected | trust:5]' };
const HARD = { input: 'I attack Mira', mechanics: '[strike:Worn Blade | atk:21 vs AC:10 → hit | 6 dmg]' };
const CAND = 'Mira keeps her own tally of years, and shares none of it.';
const BASE = '"Couldn\'t say. Try someone who minds other folks\' business."';

const passJudge = async () => ({ verdict: REF_VERDICTS.PASS });
const regenJudge = async () => ({ verdict: REF_VERDICTS.REGENERATE, failure_class: 'ATMOSPHERE_DODGE' });
const fresh = () => createRefBudget({ maxJudgePerSession: Infinity });

test('U242: flag OFF returns the candidate unchanged (zero behavior change)', async () => {
  let judged = false;
  const out = await reviewNarration({
    world: tinyWorld(), outcome: SOFT, candidate: CAND, baseNarration: BASE,
    judge: async () => { judged = true; return regenJudge(); }, enabled: false, budget: fresh(),
  });
  assert.equal(out, CAND);
  assert.equal(judged, false, 'judge must not be called when the flag is off');
});

test('U242: a HARD source skips the judge (no cost)', async () => {
  let judged = false;
  const out = await reviewNarration({
    world: tinyWorld(), outcome: HARD, candidate: CAND, baseNarration: BASE,
    judge: async () => { judged = true; return regenJudge(); }, enabled: true, budget: fresh(),
  });
  assert.equal(out, CAND);
  assert.equal(judged, false, 'hard sources are not judged');
});

test('U242: soft + PASS ships the candidate (judge called once with the right args)', async () => {
  const seen = [];
  const out = await reviewNarration({
    world: tinyWorld(), outcome: SOFT, candidate: CAND, baseNarration: BASE,
    judge: async (a) => { seen.push(a); return { verdict: 'PASS' }; }, enabled: true, budget: fresh(),
  });
  assert.equal(out, CAND);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].input, SOFT.input);
  assert.equal(seen[0].mechanics, SOFT.mechanics);
  assert.equal(seen[0].candidate, CAND);
  assert.equal(seen[0].source, 'dialogue:deflected');
  assert.ok(seen[0].canon && seen[0].canon.npcsPresent, 'judge gets the canon ground-truth bundle');
});

test('U242: soft + REGENERATE returns the regenerated words; regen gets the facts', async () => {
  let regenArgs = null;
  const REDO = 'Mira shrugs. "Couldn\'t tell you how long — ask someone older than me."';
  const out = await reviewNarration({
    world: tinyWorld(), outcome: SOFT, candidate: CAND, baseNarration: BASE,
    judge: regenJudge,
    regenerate: async (a) => { regenArgs = a; return REDO; },
    enabled: true, budget: fresh(),
  });
  assert.equal(out, REDO);
  assert.equal(regenArgs.failureClass, 'ATMOSPHERE_DODGE');
  assert.equal(regenArgs.base, BASE);
  assert.equal(regenArgs.input, SOFT.input);
  assert.ok(regenArgs.canon, 'regen gets canon truth to deliver the exact content');
});

test('U242: REGENERATE with no regenerate fn → falls back to candidate', async () => {
  const out = await reviewNarration({
    world: tinyWorld(), outcome: SOFT, candidate: CAND, baseNarration: BASE,
    judge: regenJudge, enabled: true, budget: fresh(),
  });
  assert.equal(out, CAND);
});

test('U242: REGENERATE but regen budget exhausted → falls back to candidate', async () => {
  const budget = createRefBudget({ maxRegenPerTurn: 0 });
  const out = await reviewNarration({
    world: tinyWorld(), outcome: SOFT, candidate: CAND, baseNarration: BASE,
    judge: regenJudge, regenerate: async () => 'SHOULD NOT BE USED', enabled: true, budget,
  });
  assert.equal(out, CAND);
});

test('U242: judge throwing → silent fallback to candidate (Invariant 3)', async () => {
  const out = await reviewNarration({
    world: tinyWorld(), outcome: SOFT, candidate: CAND, baseNarration: BASE,
    judge: async () => { throw new Error('judge api down'); }, enabled: true, budget: fresh(),
  });
  assert.equal(out, CAND);
});

test('U242: regenerate throwing → silent fallback to candidate', async () => {
  const out = await reviewNarration({
    world: tinyWorld(), outcome: SOFT, candidate: CAND, baseNarration: BASE,
    judge: regenJudge, regenerate: async () => { throw new Error('regen down'); }, enabled: true, budget: fresh(),
  });
  assert.equal(out, CAND);
});

test('U242: empty regen output → keeps the candidate', async () => {
  const out = await reviewNarration({
    world: tinyWorld(), outcome: SOFT, candidate: CAND, baseNarration: BASE,
    judge: regenJudge, regenerate: async () => '   ', enabled: true, budget: fresh(),
  });
  assert.equal(out, CAND);
});

test('U242: REDIRECT_UNANSWERABLE honored ONLY with a DM-voiced line (else answer)', async () => {
  const withLine = await reviewNarration({
    world: tinyWorld(), outcome: SOFT, candidate: CAND, baseNarration: BASE,
    judge: async () => ({ verdict: 'REDIRECT_UNANSWERABLE', dm_line: 'No way for you to know that — ask the harbor-master.' }),
    enabled: true, budget: fresh(),
  });
  assert.match(withLine, /harbor-master/);

  const noLine = await reviewNarration({
    world: tinyWorld(), outcome: SOFT, candidate: CAND, baseNarration: BASE,
    judge: async () => ({ verdict: 'REDIRECT_UNANSWERABLE' }),
    enabled: true, budget: fresh(),
  });
  assert.equal(noLine, CAND, 'a kick-back with no DM line must NOT emit a system artifact — default to answering');
});

test('U242: an unknown/garbage verdict ships the candidate (bias toward answering)', async () => {
  for (const verdict of [null, {}, { verdict: 'WAT' }, 'nope', undefined]) {
    const out = await reviewNarration({
      world: tinyWorld(), outcome: SOFT, candidate: CAND, baseNarration: BASE,
      judge: async () => verdict, enabled: true, budget: fresh(),
    });
    assert.equal(out, CAND, `verdict ${JSON.stringify(verdict)} → candidate`);
  }
});

test('U242: NARRATION ≠ CANON — world and outcome are not mutated (Invariant 1)', async () => {
  const world = tinyWorld();
  const outcome = { ...SOFT };
  const worldSnap = structuredClone(world);
  const outcomeSnap = structuredClone(outcome);
  const out = await reviewNarration({
    world, outcome, candidate: CAND, baseNarration: BASE,
    judge: regenJudge,
    // a hostile regen that tries to mutate everything it's handed
    regenerate: async (a) => { try { a.canon.npcsPresent.push({ name: 'GHOST' }); } catch {} return 'clean words'; },
    enabled: true, budget: fresh(),
  });
  assert.equal(typeof out, 'string', 'the Ref returns a STRING only');
  assert.deepEqual(world, worldSnap, 'world must be untouched');
  assert.deepEqual(outcome, outcomeSnap, 'outcome must be untouched');
});

test('U242: empty candidate falls back to base as the safe value', async () => {
  const out = await reviewNarration({
    world: tinyWorld(), outcome: SOFT, candidate: '', baseNarration: BASE,
    judge: passJudge, enabled: true, budget: fresh(),
  });
  assert.equal(out, BASE);
});

test('U242: session budget cap stops judging on later turns → candidate', async () => {
  const budget = createRefBudget({ maxJudgePerSession: 1 });
  const a = await reviewNarration({ world: tinyWorld(), outcome: SOFT, candidate: CAND, baseNarration: BASE, judge: passJudge, enabled: true, budget });
  // second soft turn: over the session cap → no judge, candidate returned
  let judged = false;
  const b = await reviewNarration({
    world: tinyWorld(), outcome: SOFT, candidate: CAND, baseNarration: BASE,
    judge: async () => { judged = true; return regenJudge(); }, regenerate: async () => 'REDO', enabled: true, budget,
  });
  assert.equal(a, CAND);
  assert.equal(b, CAND);
  assert.equal(judged, false, 'session cap reached → judge not called on the second turn');
});
