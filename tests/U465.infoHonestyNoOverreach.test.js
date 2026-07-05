// U465 — INFO-HONESTY, no overreach. The new no-record polish guard (U464) must
// fire ONLY when the base is an honest no-record decline. It must not touch:
//   1. a GROUNDED base (a real canon location known) polished into vivid specifics —
//      a located answer is CORRECT there, and polish is allowed to enrich it;
//   2. the two sibling guards it stands beside — the U245 fled-foe kill-claim guard
//      and the PERC-1 un-hedge guard must still fire (regression);
//   3. a no-record base whose candidate adds only ATMOSPHERE (no located fact/count) —
//      that already passes (also covered in U464-04; re-asserted here as the "no
//      overreach" contract).
//
// Deterministic, LLM-off — drives validateNarrationCandidate directly (mirrors U245).

import test from 'node:test';
import assert from 'node:assert/strict';

import { validateNarrationCandidate } from '../engine/llmAdapter.js';

const v = (cand, base) => validateNarrationCandidate(null, cand, { baseNarration: base });

test('U465-01: a GROUNDED location base polished into vivid specifics still PASSES', () => {
  // The base already delivers the real answer (a known location). Polish enriches it;
  // the located clause is grounded, not invented — the guard must not fire.
  const GROUNDED = 'Wizard: Elske is down at the mill by the river, mending nets.';
  assert.equal(
    v('Wizard: Elske is down at the mill by the river, her hands busy mending nets in the failing light.', GROUNDED),
    true
  );
  // A grounded "she's inside the barn" answer, restyled — still passes.
  const GROUNDED2 = 'Wizard: Elske is inside the barn, forking hay.';
  assert.equal(
    v('Wizard: Elske is inside the barn, pitching forkfuls of hay into the loft.', GROUNDED2),
    true
  );
});

test('U465-02: REGRESSION — the U245 fled-foe kill-claim guard still fires', () => {
  const FLED_BASE = 'The Lingerer has had enough — it breaks and runs. Last you saw, it ducked into the open country.';
  // A kill-claim over a flee base is still REJECTED.
  assert.equal(v('You cut the Lingerer down, dead at your feet.', FLED_BASE), false);
  // A faithful flee narration still PASSES.
  assert.equal(v('The Lingerer breaks off and bolts into the open, clutching its side.', FLED_BASE), true);
});

test('U465-03: REGRESSION — the PERC-1 un-hedge guard still fires', () => {
  // hedgedPerceptionRead's failure floor (the exact base phrasing the guard keys on).
  const HEDGE_BASE = 'Wizard: You look up, but honestly can\'t tell — the smoke and dark leave it uncertain.';
  // A confident invented all-clear over the hedge is still REJECTED.
  assert.equal(v('Wizard: You look up: plain wattle, no trace of flame — the ceiling is fine.', HEDGE_BASE), false);
  // A reworded hedge still PASSES.
  assert.equal(v('Wizard: You squint upward and still can\'t make it out through the haze.', HEDGE_BASE), true);
});

test('U465-04: a no-record base + ATMOSPHERE-only candidate PASSES (no located fact planted)', () => {
  const NO_RECORD = 'Wizard: There\'s no record of that — not one anyone\'s ever shown you.';
  assert.equal(v('Wizard: The wind moves through the empty lane; no one steps forward to answer.', NO_RECORD), true);
  assert.equal(v('Wizard: A hush settles over the yard, and the grey light thickens toward dusk.', NO_RECORD), true);
});

test('U465-05: the guard does NOT fire on an ordinary non-info base (scoped, not a blanket net)', () => {
  // A plain scene-description base with a located clause in the candidate — the base is
  // not a no-record decline, so INFO-HONESTY must stay silent (other rules may still
  // apply, but this specific guard must not be the reason to reject).
  const SCENE = 'Wizard: The market square is busy this morning, stalls crowding the muddy lane.';
  assert.equal(v('Wizard: The market square is busy this morning; a baker calls his wares from the only stall still with bread.', SCENE), true);
});
