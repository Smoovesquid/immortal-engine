import test from 'node:test';
import assert from 'node:assert/strict';

import { validateNarrationCandidate } from '../engine/llmAdapter.js';

// H-2/3/4/5/6 narration guard 2026-06-18 — hit-turn aware inversion guard.
// On a victory turn the prose must not describe the enemy still attacking.
// On a grapple-success turn the prose must not describe enemy escaping.
// Deterministic: synthetic candidate strings only — no API calls.

function ctx(result) {
  return {
    combat: {
      inCombat: true,
      round: 2,
      enemies: [{ name: 'Brokefang', hp: 0, maxHp: 8, defeated: true }],
      pcHp: 10,
      pcMaxHp: 14,
      lastBeat: { result, damage: 0 }
    },
    placeName: 'Irongate Cell'
  };
}

// ── Victory guard ────────────────────────────────────────────────────────────

test('U176-01: victory + enemy-strikes-you → reject (inversion)', () => {
  const cand = 'The Brokefang strikes you across the jaw in the Irongate Cell as you gasp.';
  assert.equal(validateNarrationCandidate(null, cand, { ctx: ctx('victory') }), false,
    'victory turn: enemy striking player must be rejected');
});

test('U176-02: victory + enemy-charges-you → reject', () => {
  const cand = 'Brokefang charges at you in the Irongate Cell, snarling with fury.';
  assert.equal(validateNarrationCandidate(null, cand, { ctx: ctx('victory') }), false);
});

test('U176-03: victory + player-wins narration → accept', () => {
  const cand = 'The Brokefang crumples to the floor of the Irongate Cell, the fight finally done.';
  assert.equal(validateNarrationCandidate(null, cand, { ctx: ctx('victory') }), true,
    'victory turn: player-wins narration must pass');
});

test('U176-04: victory + neutral aftermath narration → accept', () => {
  const cand = 'Silence falls over the Irongate Cell as the last threat goes still.';
  assert.equal(validateNarrationCandidate(null, cand, { ctx: ctx('victory') }), true);
});

// ── Grapple-success guard ────────────────────────────────────────────────────

test('U176-10: grapple-success + breaks-free → reject (inversion)', () => {
  const cand = 'Brokefang breaks free of your grip in the Irongate Cell and snarls.';
  assert.equal(validateNarrationCandidate(null, cand, { ctx: ctx('grapple-success') }), false,
    'grapple-success: enemy breaking free must be rejected');
});

test('U176-11: grapple-success + slips-free → reject', () => {
  const cand = 'The beast slips free and circles you in the Irongate Cell.';
  assert.equal(validateNarrationCandidate(null, cand, { ctx: ctx('grapple-success') }), false);
});

test('U176-12: grapple-success + clinch-held narration → accept', () => {
  const cand = 'You wrench Brokefang tight in the Irongate Cell, jaw clamped, going nowhere.';
  assert.equal(validateNarrationCandidate(null, cand, { ctx: ctx('grapple-success') }), true,
    'grapple-success: clinch-held narration must pass');
});

// ── Existing hit/miss guards must not regress ────────────────────────────────

test('U176-20: miss + "lands a blow" → reject (existing guard)', () => {
  const cand = 'Your blade lands a blow on the enemy in the Irongate Cell.';
  assert.equal(validateNarrationCandidate(null, cand, { ctx: ctx('miss') }), false);
});

test('U176-21: hit + "goes wide" → reject (existing guard)', () => {
  const cand = 'Your strike goes wide in the Irongate Cell.';
  assert.equal(validateNarrationCandidate(null, cand, { ctx: ctx('hit') }), false);
});

test('U176-22: hit + enemy-counterattacks prose → accept (NOT a false positive)', () => {
  // On a hit turn the enemy CAN legitimately counter — only miss-language is rejected.
  const cand = 'You land a solid blow on Brokefang in the Irongate Cell as it snaps back at you.';
  assert.equal(validateNarrationCandidate(null, cand, { ctx: ctx('hit') }), true,
    'hit turn: enemy snapping back is NOT an inversion — must not be rejected');
});

test('U176-23: no lastBeat → all phrases accepted (no guard fires without result)', () => {
  const ctxNoResult = {
    combat: { inCombat: true, round: 1, enemies: [], pcHp: 10, pcMaxHp: 14, lastBeat: null },
    placeName: 'Irongate Cell'
  };
  const cand = 'You eye the Irongate Cell warily as the fight unfolds.';
  assert.equal(validateNarrationCandidate(null, cand, { ctx: ctxNoResult }), true);
});
