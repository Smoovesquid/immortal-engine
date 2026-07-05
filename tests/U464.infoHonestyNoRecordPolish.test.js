// U464 — INFO-HONESTY: a no-record info answer must never be POLISHED into a
// confident, LOCATED specific. The deterministic floor is already honest — the
// mechanics show `[info-check → no-record | nothing grounded to deliver, no roll]`
// (engine/playloop.js declineInfoSeek) — so this guards the LLM polish layer ONLY.
//
// Opus gate 2026-07-04-3 (CANON_HALLUCINATION): pressing after a prior no-record
// answer — "You just said no searching required, so point exactly — which building
// or spot is Elske standing in?" — the DM answered "Asha lifts her chin toward the
// single building visible from where you stand — that's the only structure here, and
// Elske is somewhere within or about it." Canon has NO record of Elske's location and
// interior:null; the located-specific ("the single building… she's within it") was
// invented at the POLISH layer on top of an honest no-record base.
//
// validateNarrationCandidate (engine/llmAdapter.js) is the sink. The new guard is the
// third of the "base carries the correct uncertain shape" family (fled-foe kill-claim
// U245; PERC-1 un-hedge U448/U449): when the base is a no-record decline, a candidate
// that RESOLVES the uncertainty into a located/counted assertion (asserts WHERE a
// person/thing IS, or COUNTS structures) is REJECTED — the honest base wins. A
// candidate that merely REWORDS the uncertainty is ACCEPTED. Deterministic, LLM-off:
// drives the validator directly (mirrors U245), no live API call.

import test from 'node:test';
import assert from 'node:assert/strict';

import { validateNarrationCandidate } from '../engine/llmAdapter.js';

// The real declineInfoSeek named-NPC no-record base. It carries the roster names
// (Asha, Elske) exactly as production does — so the proper-noun backstop treats them
// as grounded, isolating THIS guard's behavior (same reason U245's base names its foe).
const NO_RECORD_BASE = 'Wizard: Asha shrugs about Elske. "Can\'t say. No record I\'ve ever seen."';
const v = (cand, base = NO_RECORD_BASE) => validateNarrationCandidate(null, cand, { baseNarration: base });

// The exact fabricated line from the Opus gate.
const GATE_LINE = 'Wizard: Asha lifts her chin toward the single building visible from where you stand — that\'s the only structure here, and Elske is somewhere within or about it.';

test('U464-01: the gate-shaped fabricated located-specific is REJECTED (honest base wins)', () => {
  assert.equal(v(GATE_LINE), false);
});

test('U464-02: other located/counted resolutions on a no-record base are REJECTED', () => {
  // A bare WHERE assertion planting where the person IS.
  assert.equal(v('Wizard: Elske is inside the building.'), false);
  assert.equal(v('Wizard: She\'s within the house, last anyone saw.'), false);
  assert.equal(v('Wizard: You\'ll find her over at the inn.'), false);
  // A structure COUNT the base never carried.
  assert.equal(v('Wizard: That\'s the only structure here.'), false);
  assert.equal(v('Wizard: There\'s but a single building here, and she must be in it.'), false);
});

test('U464-03: a candidate that merely REWORDS the uncertainty is ACCEPTED', () => {
  // The brief's own accept example.
  assert.equal(v('Wizard: Asha shrugs — she couldn\'t say where Elske\'s got to.'), true);
  // Other faithful rewords — the doubt is kept, just restyled.
  assert.equal(v('Wizard: Asha spreads her hands; no one here knows where Elske is.'), true);
  // Keeps a located clause but under a hedge — the doubt is preserved, so it passes.
  assert.equal(v('Wizard: Asha only frowns; there\'s no telling whether Elske is within the house or off in the yard.'), true);
  assert.equal(v('Wizard: Asha can\'t say if Elske is inside or off somewhere else.'), true);
});

test('U464-04: atmosphere with NO located fact on a no-record base is ACCEPTED', () => {
  assert.equal(v('Wizard: Asha shrugs, and a cold wind picks up across the muddy yard.'), true);
  assert.equal(v('Wizard: Asha only shakes her head; the grey afternoon presses on.'), true);
});

test('U464-05: deterministic — same (base, candidate) verdict twice, both directions', () => {
  assert.equal(v(GATE_LINE), v(GATE_LINE));
  assert.equal(v(GATE_LINE), false);
  const reword = 'Wizard: Asha shrugs — she couldn\'t say where Elske\'s got to.';
  assert.equal(v(reword), v(reword));
  assert.equal(v(reword), true);
});

test('U464-06: the guard recognizes every real declineInfoSeek no-record template as a no-record base', () => {
  // If the base is a real decline template, the fabricated located-specific must be
  // rejected against it — proves the base-detector covers all named/unnamed tiers +
  // the object-read decline, not just the one gate string.
  const name = 'Asha';
  const BASES = [
    // named tier 0/1/2
    `Wizard: ${name} shrugs. "Can't say. No record I've ever seen."`,
    `Wizard: ${name} shakes their head. "Wouldn't know — nobody's ever told me."`,
    `Wizard: ${name} spreads their hands. "That's lost to me, truth be told."`,
    `Wizard: ${name} sighs. "I told you — I don't know. Won't change by asking twice."`,
    `Wizard: ${name}'s patience thins. "Same answer. I don't have it."`,
    `Wizard: ${name} won't be drawn twice on the same dead end.`,
    `Wizard: ${name} turns away. "Enough. I'm done with that question."`,
    `Wizard: ${name} is done talking about it — the subject is closed.`,
    `Wizard: ${name} won't say another word on it.`,
    // unnamed tier 0/1/2
    `Wizard: There's no record of that — not one anyone's ever shown you.`,
    `Wizard: Can't rightly say. That's lost, whatever it was.`,
    `Wizard: No one here would know. It's not written anywhere you can find.`,
    `Wizard: Same as before — no answer exists to give, however you ask it.`,
    `Wizard: Asking again won't conjure a record that isn't there.`,
    `Wizard: Still nothing. The matter stays unsettled.`,
    `Wizard: That question's closed. There's no answer coming, here or anywhere.`,
    `Wizard: Drop it — pressing further won't make a fact appear.`,
    `Wizard: The matter's done; no more comes of asking.`,
    // object-read decline
    `Wizard: You look for something to read, but there's nothing here that means anything to you.`,
    `Wizard: You turn it over and come up empty — there's nothing set down here you can read.`,
  ];
  // A located-specific fabrication that reuses a grounded name (Asha) so only the
  // INFO-HONESTY guard, not the proper-noun backstop, decides the verdict.
  const FABRICATION = 'Wizard: Asha points you to the only building here, where she is standing right now.';
  for (const base of BASES) {
    // Prepend the fabrication's name to the base's grounded-noun set by ensuring "Asha"
    // appears (named tiers already do; unnamed/object bases get it via the closing clause).
    const groundedBase = base.includes('Asha') ? base : base.replace(/\.$/, ' — Asha says no more.');
    assert.equal(
      validateNarrationCandidate(null, FABRICATION, { baseNarration: groundedBase }),
      false,
      `expected REJECT of a located-specific against no-record base: ${JSON.stringify(base)}`
    );
  }
});
