// U223 — EK-1: the Law of Earned Knowledge, enforced at the DM system prompt.
//
// The narrator must never be LICENSED to fabricate a specific on a successful
// knowledge roll. Before EK-1, llmAdapter.js:151 told the model, on a "→ success"
// proper-noun ask, to "state a concrete, specific answer ... invent a plausible
// one." That clause was both:
//   (a) self-contradicting — the standing rule two lines above forbids naming any
//       person/place/thing "unless that exact name is already listed in the facts
//       above"; and
//   (b) self-defeating — the post-LLM validator (validateNarrationCandidate /
//       findInventedProperNoun [U142], findInventedFactClaim [U212]) rejects exactly
//       such invented names/dates and augmentNarration falls back to base narration,
//       i.e. the very "atmospheric deflection" the clause meant to prevent.
//
// EK-1 harmonizes the prompt with that validator and with the Law of Earned
// Knowledge: deliver a grounded specific plainly (no deflection), and on an
// ungrounded success do NOT invent — narrate what the success yields from grounded
// material, coining nothing that was not given.
//
// See docs/LAW_OF_EARNED_KNOWLEDGE.md (Tier 1 deliver-from-canon, Tier 2 honest-
// decline) and docs/PACKETS.md EK-1. Pure unit assertion on the prompt string — no
// LLM, deterministic.

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSystemPrompt } from '../engine/llmAdapter.js';

function ctx(opts = {}) {
  return {
    placeName:      opts.placeName ?? 'Test Place',
    nodeType:       opts.nodeType ?? 'settlement',
    location:       opts.placeName ?? 'Test Place',
    objective:      '',
    structuresHere: [],
    interior:       null,
    tone:           'grim',
    actionText:     'tell me the name',
    mechanicsText:  '',
    fate:           0.5
  };
}

test('U223-01: the fabrication license is gone ("invent a plausible one" never reappears)', () => {
  const prompt = buildSystemPrompt(ctx());
  assert.ok(!/invent a plausible/i.test(prompt),
    'the removed fabrication license "invent a plausible one" must not be in the DM prompt');
});

test('U223-02: the success clause explicitly forbids coining an ungrounded specific', () => {
  const prompt = buildSystemPrompt(ctx());
  assert.ok(/do NOT invent one/i.test(prompt),
    'prompt must tell the narrator not to invent a specific on an ungrounded success');
  assert.ok(/coining no name, title, date, or fact that was not given/i.test(prompt),
    'prompt must bar coining any name/title/date/fact that was not given');
});

test('U223-03: the anti-deflection win is preserved for GROUNDED specifics', () => {
  const prompt = buildSystemPrompt(ctx());
  // EK-1 must NOT regress to vague deflection when a grounded answer DOES exist:
  // the prompt still names "atmospheric deflection" / "a name forms in your mind"
  // as the thing to avoid when a grounded specific is available.
  assert.ok(/atmospheric deflection/i.test(prompt),
    'grounded-delivery anti-deflection rule must remain');
  assert.ok(/a name forms in your mind/i.test(prompt),
    'the deflection negative-example must remain');
});

test('U223-04: the successful-knowledge-roll contract is intact (only fabrication removed)', () => {
  const prompt = buildSystemPrompt(ctx());
  assert.ok(/SUCCESSFUL knowledge roll/i.test(prompt), 'the success clause must still exist');
  assert.ok(/→ success/.test(prompt), 'the clause must still key on a "→ success" mechanic');
});

test('U223-05: the success clause now AGREES with the grounded-only naming rule (no contradiction)', () => {
  const prompt = buildSystemPrompt(ctx());
  assert.ok(/already listed in the facts above/i.test(prompt),
    'the standing "no proper name unless already in the facts" rule must remain — the success clause now agrees with it rather than contradicting it');
});
