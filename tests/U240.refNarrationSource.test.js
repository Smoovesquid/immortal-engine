// U240 — THE REF: narrationSource classification (the gate that makes Tier 2
// affordable). The Ref runs its judge ONLY on soft sources — the dialogue-ask
// modes whose RENDERING the gate keeps failing (deflected/place/shared/continuity).
// Hard sources (combat, grounded action resolves, meta answers, exits, the
// intentional epistemic modes lied/withheld/claim_recall) are skipped → no cost
// and the Ref never "corrects" a deliberate lie/withhold into the truth.
//
// Deterministic, LLM-off. See docs/THE_REF.md §"The Thesis".

import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyNarrationSource } from '../engine/ref/narrationSource.js';

test('U240: soft dialogue-ask modes are classified soft (the Ref reviews them)', () => {
  for (const mode of ['deflected', 'place', 'shared', 'continuity']) {
    const r = classifyNarrationSource({ mechanics: `[dialogue ask | ${mode} | trust:5]` });
    assert.equal(r.soft, true, `${mode} should be soft`);
    assert.equal(r.source, `dialogue:${mode}`);
  }
});

test('U240: a shared mode carrying a factId still classifies soft', () => {
  const r = classifyNarrationSource({ mechanics: '[dialogue ask | shared | founding_fact | trust:6]' });
  assert.equal(r.soft, true);
  assert.equal(r.source, 'dialogue:shared');
});

test('U240: intentional epistemic dialogue modes are HARD (Ref must not correct them)', () => {
  for (const mode of ['lied', 'withheld', 'claim_recall', 'self', 'recruited']) {
    const r = classifyNarrationSource({ mechanics: `[dialogue ask | ${mode} | trust:5]` });
    assert.equal(r.soft, false, `${mode} must be hard — the Ref must never overwrite a deliberate lie/withhold/recall`);
    assert.equal(r.source, `dialogue:${mode}`);
  }
});

test('U240: non-dialogue mechanics are HARD (skipped, no cost)', () => {
  const samples = [
    '[strike:Worn Blade | atk:21 vs AC:10 → hit | 6 dmg]',
    '[roll:14 vs DC:12 → success | margin:2 | approach:focus | stake:time | risk:0.47 | stat:WITS]',
    '[dialogue enter]',
    '[dialogue exit | trust:5]',
    'observe only — no roll, state unchanged',
    '',
  ];
  for (const mech of samples) {
    const r = classifyNarrationSource({ mechanics: mech });
    assert.equal(r.soft, false, `mechanics ${JSON.stringify(mech)} should be hard`);
  }
});

test('U240: an explicit narrationSource tag takes priority over mechanics', () => {
  // A future soft path can set outcome.narrationSource directly (e.g. the
  // generic-resolve atmosphere bank) without changing this classifier.
  assert.equal(classifyNarrationSource({ narrationSource: 'generic-resolve' }).soft, true);
  assert.equal(classifyNarrationSource({ narrationSource: 'observe-fallback' }).soft, true);
  // An unknown explicit tag is hard (conservative).
  assert.equal(classifyNarrationSource({ narrationSource: 'whatever-else' }).soft, false);
  // Explicit wins even when mechanics would say otherwise.
  const r = classifyNarrationSource({ narrationSource: 'generic-resolve', mechanics: '[strike:x]' });
  assert.equal(r.soft, true);
  assert.equal(r.source, 'generic-resolve');
});

test('U240: missing/empty outcome is hard (never throws)', () => {
  assert.equal(classifyNarrationSource().soft, false);
  assert.equal(classifyNarrationSource({}).soft, false);
  assert.equal(classifyNarrationSource(null).soft, false);
});
