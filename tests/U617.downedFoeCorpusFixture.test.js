// U617 — CORPUS-KILL-1: the downed_foe corpus fixture stays valid. DEATH-3
// (U602) flagged that the convergence corpus drives ONE playerMove per scenario,
// but a kill needs TWO beats (down the foe, then finish) — CORPUS-KILL-1 promoted
// the inline downedWorld() helper U600/U602/U604 each hand-rolled into a SHARED
// fixture (scripts/convergence/fixtures.mjs → downedFoeWorld, FIXTURES.downed_foe)
// so tests/corpus/death/DEATH.corpus.mjs can lock the scripted verb kills (mercy /
// worse / abandon) through npm run convergence.
//
// npm run convergence does not run under `node --test` (corpus files are loaded by
// scripts/convergence/runCorpus.mjs, not node's built-in *.test.* glob) — so this
// guard is the ONLY node-test-suite tripwire on the fixture's shape. It does not
// re-assert the prose (that's DEATH.corpus.mjs + U600/U602/U604's job) — just that
// the fixture still hands classifyDownedVerb a live DOWNED, begging communicator,
// and that all four verb dispositions still dispatch from it.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { downedFoeWorld, PACKS } from '../scripts/convergence/fixtures.mjs';
import { playerMove } from '../engine/playloop.js';
import { classifyDownedVerb } from '../engine/combat/downedResolve.js';

test('U617-01: downed_foe boots a communicator foe already DOWNED, dying, begging — not yet defeated or spared', () => {
  const w = downedFoeWorld();
  const foe = w.combat?.enemies?.[0];
  assert.ok(foe, 'the fixture seeds a foe');
  assert.equal(foe.downed, true, 'the foe is cornered to DOWNED (dying clock ticking)');
  assert.equal(foe.defeated, false, 'not finished yet — the verb has not landed');
  assert.equal(foe.spared, false, 'not yet spared either — the choice is still open');
  assert.ok(foe.begged, 'a communicator foe begs once cornered (DEATH_CONTRACT §3 — the beg)');
  assert.equal(w.meta.mode, 'escape', 'the fixture stays in escape mode (the downed-verb gate only fires there)');
  assert.equal(w.combat.active, false, 'combat has ended for this turn — the gate reads OUTSIDE active combat');
});

test('U617-02: classifyDownedVerb still dispatches all four player dispositions from fresh fixture text', () => {
  const cases = [
    ['I give him a clean, merciful death', 'mercy'],
    ['I finish him off', 'mercy'],
    ['I make an example of him — slow and cruel', 'worse'],
    ['I bind his wounds and let him live', 'spare'],
    ['I turn my back on him and walk away', 'walk'],
  ];
  for (const [text, expected] of cases) {
    assert.equal(classifyDownedVerb(text), expected, `"${text}" still classifies to ${expected}`);
  }
});

test('U617-03: the fixture is boot-cheap and byte-stable across two fresh instances (the determinism floor)', () => {
  const a = playerMove(downedFoeWorld(), PACKS, 'I make an example of him — slow and cruel');
  const b = playerMove(downedFoeWorld(), PACKS, 'I make an example of him — slow and cruel');
  assert.equal(a.output.narration, b.output.narration, 'same seed + same verb ⇒ byte-identical narration');
  assert.equal(a.output.mechanics, b.output.mechanics, 'same seed + same verb ⇒ byte-identical mechanics tag');
});

test('U617-04: a fresh downed_foe instance never carries over another call\'s resolution (no cross-test leakage)', () => {
  const w1 = downedFoeWorld();
  playerMove(w1, PACKS, 'I give him a clean, merciful death'); // resolve one instance's foe
  const w2 = downedFoeWorld(); // a second, independent instance
  const foe2 = w2.combat?.enemies?.[0];
  assert.equal(foe2.downed, true, 'a fresh fixture call still returns a foe awaiting the verb, unaffected by a prior call');
  assert.equal(foe2.defeated, false, 'the fresh instance was not silently killed by the earlier resolution');
});
