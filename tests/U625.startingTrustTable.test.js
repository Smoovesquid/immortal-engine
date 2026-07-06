// U625 — SP-3 starting-trust table (the pure magnitude source).
//
// Social Physics Contract §2 law 1 (Biblioteca Vol 11 §7.3): the NUMBER a fresh NPC
// opens at comes from a constant table in a pure module, never the LLM. This locks the
// arithmetic and the clamps of engine/social/startingTrust.js against the F1 calibration
// anchors (npcBrain wary −25 / hostile −50 / warm +50). Pure = no rng, no world, no I/O:
// same input → same trust, forever.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startingTrust,
  startingTrustForFaction,
  startingTrustForNotoriety,
  NEUTRAL_TRUST, MIN_TRUST, MAX_TRUST, REP_PER_TRUST_STEP,
} from '../engine/social/startingTrust.js';

test('U625-01: faction path — the done-when anchors (−60→3, +50→7, 0→5)', () => {
  // The contract's SP-3 done-when, verbatim: a −60 town mints trust 3, a +50 town mints 7,
  // and a neutral (0) standing mints exactly the pre-SP-3 value (5).
  assert.equal(startingTrustForFaction(-60), 3, 'a −60 civic town mints the floor');
  assert.equal(startingTrustForFaction(50), 7, 'a +50 hero-town mints the ceiling');
  assert.equal(startingTrustForFaction(0), NEUTRAL_TRUST, 'neutral standing is unchanged (5)');
});

test('U625-02: faction path — one step per 25 points, clamped 3..7', () => {
  // 5 + floor(rep/25), clamped. Table-exact across the band.
  const cases = [
    [-100, 3], [-75, 3], [-60, 3], [-50, 3], // floor holds at/below −50
    [-49, 3], [-26, 3],                       // −26..−49 → floor(−2) → trust 3
    [-25, 4], [-1, 4],                        // −1..−25 → floor(−1) → trust 4 (any negative bites)
    [0, 5],
    [1, 5], [24, 5],                          // positive needs a full +25 to bump (asymmetry)
    [25, 6], [49, 6],
    [50, 7], [75, 7], [100, 7],               // ceiling holds at/above +50
  ];
  for (const [rep, want] of cases) {
    assert.equal(startingTrustForFaction(rep), want, `rep ${rep} → trust ${want}`);
  }
});

test('U625-03: faction path — deliberate loss/earn asymmetry (floor toward −∞)', () => {
  // "Standing is easier to lose than to earn" (contract §2.1). The faintest ill-will
  // (−1) already drops the opening a step; the same-size goodwill (+1) does not yet lift it.
  assert.equal(startingTrustForFaction(-1), 4, 'a −1 standing opens guarded');
  assert.equal(startingTrustForFaction(1), 5, 'a +1 standing still opens neutral');
  // Confirm the step constant is the F1 wary spacing.
  assert.equal(REP_PER_TRUST_STEP, 25, 'one trust step per 25 rep (F1 wary threshold spacing)');
});

test('U625-04: notoriety path — negative-valence only, symmetric floor with faction', () => {
  // notorietyReaching(...).score is 0..1 (loudness of the player's traveled CRIMES).
  // It can only LOWER trust; the worst-heard stranger bottoms at MIN_TRUST (3), the same
  // floor as the faction path. A clean/unheard player stays neutral (5) — never above.
  const cases = [
    [0, 5], [0.2, 5], [0.33, 5],  // barely/not heard → neutral
    [0.34, 4], [0.5, 4], [0.66, 4], // heard secondhand → one step down
    [0.67, 3], [0.9, 3], [1, 3],   // widely/closely heard → floor
  ];
  for (const [score, want] of cases) {
    assert.equal(startingTrustForNotoriety(score), want, `score ${score} → trust ${want}`);
  }
});

test('U625-05: clamps hold at the extremes; garbage → neutral', () => {
  assert.equal(startingTrustForFaction(9999), MAX_TRUST, 'over-max rep clamps to 7');
  assert.equal(startingTrustForFaction(-9999), MIN_TRUST, 'under-min rep clamps to 3');
  assert.equal(startingTrustForNotoriety(5), MIN_TRUST, 'over-range score clamps to floor');
  // Non-finite / absent inputs fall back to neutral — never NaN, never out of band.
  assert.equal(startingTrustForFaction(NaN), NEUTRAL_TRUST, 'NaN rep → neutral');
  assert.equal(startingTrustForFaction(undefined), NEUTRAL_TRUST, 'undefined rep → neutral');
  assert.equal(startingTrustForNotoriety(NaN), NEUTRAL_TRUST, 'NaN score → neutral');
});

test('U625-06: startingTrust() router — affiliated reads rep, unaffiliated reads notoriety', () => {
  // Affiliated → faction rep path.
  assert.equal(startingTrust({ factionId: 'civic', factionRep: -60 }), 3, 'civic −60 → 3');
  assert.equal(startingTrust({ factionId: 'civic', factionRep: 50 }), 7, 'civic +50 → 7');
  // Unaffiliated (null / blank factionId) → notoriety path; rep is ignored.
  assert.equal(startingTrust({ factionId: null, notorietyScore: 1 }), 3, 'unaffiliated, widely heard → 3');
  assert.equal(startingTrust({ factionId: '  ', notorietyScore: 0, factionRep: -100 }), 5,
    'blank factionId ignores factionRep, reads notoriety (clean → 5)');
  // No standing at all → neutral (invisible until the player has a reputation).
  assert.equal(startingTrust(), NEUTRAL_TRUST, 'no-arg → neutral 5');
  assert.equal(startingTrust({ factionId: 'civic' }), NEUTRAL_TRUST, 'affiliated, no rep supplied → 5');
});

test('U625-07: pure — identical inputs give identical outputs (no hidden state)', () => {
  for (const rep of [-60, 0, 50]) {
    assert.equal(startingTrustForFaction(rep), startingTrustForFaction(rep), `rep ${rep} is stable`);
  }
  for (const sc of [0, 0.5, 1]) {
    assert.equal(startingTrustForNotoriety(sc), startingTrustForNotoriety(sc), `score ${sc} is stable`);
  }
});
