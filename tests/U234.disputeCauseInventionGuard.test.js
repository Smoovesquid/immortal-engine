// U234 — EK-2: dispute/event CAUSE invention guard, extending llmAdapter.js's
// findInventedFactClaim (the EK-1 / H-29 Rule 5b post-LLM validator).
//
// gate-14 full panel, Lore-hound t12 (CANON_HALLUCINATION): under contradiction
// pressure ("you swore there were three grandmothers — what did the third one quarrel
// over?") the DM fabricated a concrete backstory — "the third grandmother's quarrel was
// over the deed to the building" — with no support in canon (recentCanon empty). This is
// the EK-1 *live residual* the ledger flagged: a lowercase, numberless fact-claim that
// slips findInventedProperNoun (U142, names/places) and the prior findInventedFactClaim
// shapes (U212: years/winters, ages, lineage, two-party relationships).
//
// The H-49 relationship guard (U212-05) needs TWO named parties ("Tove and the elder
// feuded over …"). This catches the ONE-party "<dispute> … over/about <specific>" shape:
// quarrel/dispute/feud/argument/falling-out/grudge/disagreement/squabble/strife/spat/rift
// + over|about|because of|due to + a specific. Same restraint as every guard in
// findInventedFactClaim: only rejects when the matched fragment is ABSENT from the base
// narration, and a denial/hypothetical lead-in is exempt. Dispute nouns only, so a
// neutral "talk/question about X" never trips it.
//
// SCOPE NOTE: this closes the gate-14 t12 *class* deterministically at the post-LLM
// validator. It does NOT close the general lowercase-fabrication problem — that is the
// THE_REF second-model output-validator frontier. See docs/CAPABILITY_LEDGER.md EK-2.
//
// Pure unit assertion on the exported findInventedFactClaim — no LLM, deterministic.
// Sibling to U142 (proper-noun guard) and U212 (tenure/lineage/relationship guard).

import test from 'node:test';
import assert from 'node:assert/strict';

import { findInventedFactClaim } from '../engine/llmAdapter.js';

const BASE = 'Kael considers your question about the founding families, his face unreadable.';

// ── REJECT — an invented one-party dispute/event cause absent from the base ──

test('U234-01: REJECT — the gate-t12 "the quarrel was over the deed" fabrication', () => {
  const cand = "Kael speaks plainly: the third grandmother's quarrel was over the deed to the building — who truly owned it.";
  assert.ok(findInventedFactClaim(cand, BASE), 'an invented dispute-cause with no canon backing must be flagged');
});

test('U234-02: REJECT — "the dispute was about the old well"', () => {
  const cand = 'The dispute between the two households was about the old well, and it festered for a generation.';
  assert.ok(findInventedFactClaim(cand, BASE), 'an invented dispute-subject must be flagged');
});

test('U234-03: REJECT — "feud over <land>" and "grudge because of <X>"', () => {
  assert.ok(findInventedFactClaim('Their feud was over the grazing land east of the mill.', BASE),
    'an invented feud-cause must be flagged');
  assert.ok(findInventedFactClaim('Her grudge against him started because of a stolen recipe.', BASE),
    'an invented grudge-cause must be flagged');
});

// ── PASS — false-positive guards (grounded / negated / hypothetical / neutral) ──

test('U234-04: PASS — a dispute-cause that IS present in the grounded base', () => {
  const base = 'the quarrel was over the deed to the building, everyone agrees.';
  const cand = 'The quarrel was over the deed, Kael says.';
  assert.equal(findInventedFactClaim(cand, base), null, 'a grounded dispute-cause that matches the base must pass');
});

test('U234-05: PASS — a denial is not a confident claim', () => {
  assert.equal(findInventedFactClaim('There is no record of what the quarrel was over.', BASE), null,
    'a "no record of what …" denial must not be flagged');
});

test('U234-06: PASS — a hypothetical "if …" framing is not a confident claim', () => {
  assert.equal(findInventedFactClaim('If the quarrel was over the deed, no one here will say so.', BASE), null,
    'an "if …" dispute framing must not be flagged');
});

test('U234-07: PASS — a NEUTRAL "talk/question about X" (no dispute noun) never trips it', () => {
  assert.equal(findInventedFactClaim('We should talk about the old well sometime.', BASE), null,
    'a neutral "talk about X" must not be flagged');
  assert.equal(findInventedFactClaim('Her question was about the founding families.', BASE), null,
    'a neutral "question about X" must not be flagged');
});

test('U234-08: PASS — plain narration with no dispute claim at all', () => {
  const line = 'Corwin counts coins at his stall, eyes flicking toward the elder\'s house.';
  assert.equal(findInventedFactClaim(line, line), null, 'plain narration must pass');
});

test('U234-09: never throws on bad input', () => {
  assert.doesNotThrow(() => findInventedFactClaim(null, undefined));
  assert.equal(findInventedFactClaim(null, undefined), null);
});
