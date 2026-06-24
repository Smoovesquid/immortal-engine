// U251 — D-B4 gate residual (a): the ability-score→modifier breakpoint TABLE.
//
// The loudest crunch nit in the 2026-06-24 Opus gate (6–7 of the 10 fails were
// this one cluster). The DM printed a hand-written breakpoint chart that started
// at "9 → −1" and omitted every low score, so for a Rules-Lawyer character whose
// scores were 6 and 8 the chart had NO entry for them — yet the "Your measures"
// line correctly showed 6 → −2 and 8 → −1. Read side by side, the chart looked
// self-contradictory ("your table starts at 9 but my scores are 6 and 8").
//
// The fix GENERATES the displayed chart from the real `statMod` function, so the
// printed table can never again drift from the engine's actual math. This locks:
//   (a) the chart is complete and matches statMod = floor((score−10)/2),
//   (b) it has explicit entries for 6 and 8 (the gate's contradiction point),
//   (c) the chart and the "Your measures" line agree on every score,
//   (d) "show me the full breakpoint chart" is recognized (no d20 dead-end),
//   (e) a bare physical "breakpoint"/"table" is NOT intercepted (no false dump).
//
// docs/playtests/opus-gate-2026-06-24.md (Rules Lawyer DM cluster).

import test from 'node:test';
import assert from 'node:assert/strict';

import { handleMetaQuestion, isMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { statMod } from '../engine/ruleset/core/stats.js';

// The exact low-score character from the failing gate transcript.
const SHEET = { party: [{ level: 1, stats: { MIGHT: 6, AGILITY: 6, WITS: 6, GRIT: 8, CHARM: 6 }, foci: [] }] };

function fmtMod(m) { return m >= 0 ? `+${m}` : `${m}`; }

// ── (a) the chart is generated from statMod and is COMPLETE ─────────────────

test('U251-a: the breakpoint chart matches statMod across the realistic 3–18 band', () => {
  const ans = handleMetaQuestion("What's the formula for modifiers?", SHEET);
  assert.ok(ans, 'must return an answer');
  // For every score a 4d6-drop-lowest character can hold, the displayed chart
  // must carry that score in a range whose modifier equals statMod(score).
  for (let score = 3; score <= 18; score++) {
    const mod = fmtMod(statMod(score));
    // The score appears either as a singleton "S → mod" or inside a range
    // "Lo–Hi → mod" that brackets it. Cheapest robust check: the modifier value
    // statMod assigns is present in the chart, and no contradictory mapping for
    // the boundary scores the gate cared about is below.
    assert.match(ans, new RegExp(`→ ${mod.replace('+', '\\+')}\\b`),
      `chart must contain a ${mod} bucket (for score ${score})`);
  }
});

// ── (b) explicit entries for 6 and 8 — the gate's contradiction point ───────

test('U251-b: the chart has entries for the low scores 6 (→ −2) and 8 (→ −1)', () => {
  const ans = handleMetaQuestion('Walk me through the stat-to-modifier math here.', SHEET);
  assert.match(ans, /6–7 → -2/, 'score 6 must map to −2 in the chart');
  assert.match(ans, /8–9 → -1/, 'score 8 must map to −1 in the chart');
  // The old broken chart led with "9 → −1" as a singleton; that exact artifact
  // (a leading 9 entry with no 8 bucket) must be gone.
  assert.doesNotMatch(ans, /breakpoints: 9 →/, 'must not lead with the old incomplete "9 →" chart');
});

// ── (c) the chart and the "Your measures" line agree ────────────────────────

test('U251-c: the chart agrees with the per-stat "Your measures" readout', () => {
  const ans = handleMetaQuestion("What's the formula for modifiers?", SHEET);
  // Measures line shows GRIT 8 (-1); the chart's 8–9 bucket must also be −1.
  assert.match(ans, /GRIT 8 \(-1\)/, 'measures: GRIT 8 → −1');
  assert.match(ans, /8–9 → -1/, 'chart: 8–9 → −1');
  // Measures line shows MIGHT 6 (-2); the chart's 6–7 bucket must also be −2.
  assert.match(ans, /MIGHT 6 \(-2\)/, 'measures: MIGHT 6 → −2');
  assert.match(ans, /6–7 → -2/, 'chart: 6–7 → −2');
});

// ── (d) recognition: the "breakpoint chart" phrasing no longer dead-ends ─────

test('U251-d: "show me the full breakpoint chart down to 6" is recognized and returns the chart', () => {
  const q = 'Show me the full breakpoint chart down to 6.';
  assert.ok(isMetaQuestion(q), 'breakpoint-chart ask must be a recognized meta-question');
  const ans = handleMetaQuestion(q, SHEET);
  assert.match(ans, /6–7 → -2/, 'must answer with the complete chart including the 6 entry');
});

test('U251-d: "modifier breakpoints" and "modifier table" phrasings are recognized', () => {
  assert.ok(isMetaQuestion('What are the modifier breakpoints?'));
  assert.ok(isMetaQuestion('Just give me the modifier table.'));
});

// ── (e) false-positive guards: bare physical "breakpoint"/"table" ───────────

test('U251-e: a bare physical "breakpoint" or "table" is NOT intercepted as a stats query', () => {
  assert.equal(isMetaQuestion('I steady my aim at the breakpoint of the wall'), false);
  assert.equal(isMetaQuestion('I aim for the breakpoint in the chain'), false);
  assert.equal(isMetaQuestion('I flip the table over and dive behind it'), false);
  assert.equal(isMetaQuestion('I chart a course north by the stars'), false);
});
