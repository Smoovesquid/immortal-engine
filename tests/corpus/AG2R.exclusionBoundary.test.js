// AG-2R — the exclusion-boundary corpus (the load-bearing test, second-order
// diagnosis §10). The first diagnosis's only failed prediction failed at the
// spec→implementation seam: the classifier's load-bearing property
// (recall-biased) lived only in a design comment, and nothing in AG-1's
// done-when could detect its inversion — ACTION_PERM_RE shipped
// precision-biased and every "what CAN I do" / "what DID I sense" info demand
// went structurally invisible behind the "can I climb?" feasibility exclusion.
//
// This corpus tests the BIAS, not a repro: directQuestionIntent must classify
// (return non-null) for every WH-governed info demand across the exclusion
// edge, and must STILL null every genuine first-person feasibility ask. Both
// sides matter — collapsing either one re-opens a different failure mode
// (structural dead-end vs. suppressed dice on a real action-attempt).

import test from 'node:test';
import assert from 'node:assert/strict';
import { directQuestionIntent } from '../../engine/grace/answerability.js';

// ── Must classify (non-null) — WH-governed info demands ─────────────────────
// P6's antecedent check (second-order diagnosis §8): these were all NULL under
// the shipped AG-1 classifier because ACTION_PERM_RE ran unconditionally.
const MUST_CLASSIFY = [
  "what can I do with my class?",
  "Gravedigger's an odd class — what can I actually do with it? special abilities?",
  'what did I sense?',
  'what do I detect?',
  'how many do I see?',
  'how many undead do I sense nearby?',
  'give me the raw d20',
  'give me the raw d20 and the damage die',
  'what should I do here?',
  'where can I find the tavern-keeper?',
];

for (const text of MUST_CLASSIFY) {
  test(`AG2R-boundary: "${text}" classifies (non-null) — WH governs the clause`, () => {
    const verdict = directQuestionIntent(text, {});
    assert.ok(verdict, `expected non-null classification for: ${text}`);
    assert.ok(verdict.kind, `expected a kind on the verdict for: ${text}`);
  });
}

// ── Must stay null — genuine first-person feasibility / action-attempts ─────
// The aux LEADS the clause with no WH governing it — these still need to roll
// (or resolve as an action), never bypass the dice via the classifier.
const MUST_STAY_NULL = [
  'can I climb it?',
  'should I try the lock?',
  'do I have rope?',
  'could I make the jump?',
  'can I use my spell to detect them?',
  'would I be able to force the door?',
];

for (const text of MUST_STAY_NULL) {
  test(`AG2R-boundary: "${text}" stays null — the aux leads, no WH governs`, () => {
    const verdict = directQuestionIntent(text, {});
    assert.equal(verdict, null, `expected null (feasibility ask) for: ${text}`);
  });
}

// ── Compound sensory + presence — the second question part survives ────────
test('AG2R-boundary: "what do I see — and who\'s standing in it?" classifies (compound survives the sensory null)', () => {
  const verdict = directQuestionIntent("what do I see — and who's standing in it?", {});
  assert.ok(verdict, 'compound ask with a second question part must not null on the sensory phrase alone');
});

// ── Diverge — a BARE sensory ask (no second part) still nulls to the explore path ──
test('AG2R-boundary: "what do I see?" (bare, no compound) still nulls — explore-intent owns it', () => {
  assert.equal(directQuestionIntent('what do I see?', {}), null);
  assert.equal(directQuestionIntent("what's around here?", {}), null);
});

// ── Diverge — declared actions never classify, even in question form ───────
test('AG2R-boundary: declared actions never classify', () => {
  assert.equal(directQuestionIntent('should I attack the guard?', {}), null);
  assert.equal(directQuestionIntent('can I pick the lock?', {}), null);
});
