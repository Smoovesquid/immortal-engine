// U184 — H-28 bundled narration-validation pass.
//
// Four new rejection rules in engine/llmAdapter.js's validateNarrationCandidate,
// all the same failure shape: LLM polish drifting from or contradicting
// deterministic ground truth. Each test proves the bad case is REJECTED and that
// legitimate narration mentioning the same place/combat/roll/NPC is NOT — the
// false-positive guards matter as much as the catches (same discipline as
// U170's combat-state guard and H-9/H-10/H-11's regression guards).
//
//   Rule 1 (H-11 2nd half) — wrong-scene location assertion
//   Rule 2 (H-26a)         — fresh attack/defeat vs. a reconciled (defeated) enemy
//   Rule 3 (H-26d)         — mixed roll smoothed into a clean success
//   Rule 4a (H-27)         — invented biographical / historical claim
//   Rule 4b (H-27)         — a defeated NPC narrated as alive / active / present

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNarrationCandidate, collectDefeatedNames } from '../engine/llmAdapter.js';

const PLACE = "Wayfarers' Outpost";

function makeWorld(overrides = {}) {
  return {
    meta: { fate: 0.5, escapeHp: 12, escapeMaxHp: 15 },
    map: {
      currentNodeId: 'n1',
      nodes: [
        { id: 'n1', name: PLACE, nodeType: 'settlement' },
        { id: 'n2', name: 'Stonebridge', nodeType: 'settlement' }
      ],
      edges: []
    },
    scene: { objective: '', interior: null, location: PLACE },
    combat: null,
    party: [],
    ledger: { facts: [], threats: [], questions: [] },
    structures: { byId: {} },
    factions: [],
    instrument: { threads: [], motifs: [] },
    time: { turn: 1 },
    pack: { primaryId: 'fantasy' },
    ...overrides
  };
}

function makeCtx(overrides = {}) {
  return {
    placeName: PLACE,
    nodeType: 'settlement',
    location: PLACE,
    dialogueTurn: null,
    combat: null,
    ...overrides
  };
}

function run(world, cand, opts = {}) {
  return validateNarrationCandidate(world, cand, {
    baseNarration: opts.base ?? cand,
    ctx: opts.ctx ?? makeCtx(),
    ...opts.extra
  });
}

// ── Rule 1 — wrong-scene location assertion ────────────────────────────────

test('U184-10: REJECT — polish plants the player inside a different real node', () => {
  const world = makeWorld();
  const cand = `The gate-talk done, you find yourself standing inside Stonebridge's sole structure as the lanterns of ${PLACE} gutter low.`;
  assert.equal(run(world, cand), false, 'must reject a location assertion at a non-current node');
});

test('U184-11: REJECT — "you are within Stonebridge" while elsewhere', () => {
  const world = makeWorld();
  const cand = `You are within Stonebridge now, though the watchfires of ${PLACE} still smell of pitch.`;
  assert.equal(run(world, cand), false, 'must reject "you are within <other node>"');
});

test('U184-12: PASS — merely mentioning another node (no location assertion)', () => {
  const world = makeWorld();
  const cand = `From the rampart at ${PLACE}, the road to Stonebridge runs north into the dark.`;
  assert.equal(run(world, cand), true, 'mentioning a node as a destination must not trip Rule 1');
});

test('U184-13: PASS — being at the CURRENT place is fine', () => {
  const world = makeWorld();
  const cand = `You are standing in ${PLACE}, the morning crowd thinning around the well.`;
  assert.equal(run(world, cand), true, 'asserting the current place must pass');
});

// ── Rule 2 — fresh attack/defeat against a reconciled (defeated) enemy ──────

function defeatedCombatWorld() {
  return makeWorld({
    combat: { active: false, round: 3, enemies: [
      { id: 'e1', name: 'Greyhand', hp: 0, maxHp: 8, defeated: true }
    ] },
    // Ground the enemy name so the proper-noun backstop doesn't pre-empt Rule 2.
    ledger: { facts: [{ text: 'you bested Greyhand in the lane' }], threats: [], questions: [] }
  });
}

test('U184-20: REJECT — player narrated as freshly defeated after combat ended', () => {
  const world = defeatedCombatWorld();
  const cand = `Though the duel ended moments ago, the next blow lands and you fall, defeated, onto the boards of ${PLACE}.`;
  assert.equal(run(world, cand), false, 'no fresh player-defeat once combat is reconciled');
});

test('U184-21: REJECT — the reconciled-dead enemy launches a fresh attack', () => {
  const world = defeatedCombatWorld();
  const cand = `The duel long settled, Greyhand lunges at you again across the floor of ${PLACE}.`;
  assert.equal(run(world, cand), false, 'a defeated enemy cannot attack');
});

test('U184-22: PASS — the defeated enemy lies still (legitimate recap)', () => {
  const world = defeatedCombatWorld();
  const cand = `Greyhand lies still where you left him, and the lane is quiet again at ${PLACE}.`;
  assert.equal(run(world, cand), true, 'mere mention of the fallen foe must pass');
});

test('U184-23: PASS — calm post-combat narration with no contradiction', () => {
  const world = defeatedCombatWorld();
  const cand = `With the bandit beaten and the dust settling, you catch your breath at ${PLACE}.`;
  assert.equal(run(world, cand), true, 'ordinary post-combat narration must pass');
});

// ── Rule 3 — mixed roll smoothed into a clean success ──────────────────────

test('U184-30: REJECT — mixed roll narrated as an effortless clean win', () => {
  const world = makeWorld();
  const ctx = makeCtx({ rollOutcome: 'mixed' });
  const cand = `You scale the rampart effortlessly and stand atop the wall at ${PLACE}.`;
  assert.equal(run(world, cand, { ctx }), false, 'a mixed outcome may not read as a clean win');
});

test('U184-31: PASS — mixed roll that keeps its cost/complication', () => {
  const world = makeWorld();
  const ctx = makeCtx({ rollOutcome: 'mixed' });
  const cand = `You scale the rampart, though the climb leaves your palms raw, and reach the top at ${PLACE}.`;
  assert.equal(run(world, cand, { ctx }), true, 'friction language must satisfy Rule 3');
});

test('U184-32: PASS — a genuine clean win on a SUCCESS roll', () => {
  const world = makeWorld();
  const ctx = makeCtx({ rollOutcome: 'success' });
  const cand = `You scale the rampart effortlessly and crest the wall at ${PLACE}.`;
  assert.equal(run(world, cand, { ctx }), true, 'Rule 3 fires only on a mixed outcome');
});

// ── Rule 4a — invented biographical / historical claim ─────────────────────

test('U184-40: REJECT — polish injects an ungrounded grandfather backstory', () => {
  const world = makeWorld();
  const base = `You steady your grip at ${PLACE}.`;
  const cand = `You steady your grip, and somewhere in the gesture your grandfather's old training surfaces at ${PLACE}.`;
  assert.equal(run(world, cand, { base }), false, 'invented ancestry not in the base must be rejected');
});

test('U184-41: REJECT — confident attribution with no canon support', () => {
  const world = makeWorld();
  const base = `The old beam sags above the gate at ${PLACE}.`;
  const cand = `The old beam sags above the gate, and it was Stonebridge who raised it, locals say, here at ${PLACE}.`;
  // "it was Stonebridge who" — a confident deed-attribution absent from the base.
  assert.equal(run(world, cand, { base }), false, 'unsupported "it was X who" attribution must be rejected');
});

test('U184-42: PASS — a kinship claim that IS in the grounded base', () => {
  const world = makeWorld();
  const cand = `Your father taught you this grip, and you steady your hand here at ${PLACE}.`;
  assert.equal(run(world, cand, { base: cand }), true, 'a grounded kinship reference must pass');
});

test('U184-43: PASS — "it was you who" (pronoun attribution, not a fabricated person)', () => {
  const world = makeWorld();
  const cand = `In the end it was you who opened the gate at ${PLACE}.`;
  assert.equal(run(world, cand, { base: `You opened the gate at ${PLACE}.` }), true, 'pronoun attributions are not hallucinations');
});

// ── Rule 4b — a defeated NPC narrated as alive / active / present ───────────

function killedNpcWorld() {
  return makeWorld({
    ledger: { facts: [{ text: 'you killed Renna in the square' }], threats: [], questions: [] }
  });
}

test('U184-50: REJECT — a killed NPC greets the player as if alive', () => {
  const world = killedNpcWorld();
  const cand = `Crossing the square at ${PLACE}, Renna nods to you as though the morning held no grievance.`;
  assert.equal(run(world, cand), false, 'a dead NPC may not act alive');
});

test('U184-51: REJECT — a killed NPC described as very much alive', () => {
  const world = killedNpcWorld();
  const cand = `At ${PLACE}, Renna is very much alive and leaning on the well as you pass.`;
  assert.equal(run(world, cand), false, 'a dead NPC may not be stated alive');
});

test('U184-52: PASS — the dead NPC is referenced as gone (legitimate)', () => {
  const world = killedNpcWorld();
  const cand = `The square at ${PLACE} is quieter now that Renna is gone.`;
  assert.equal(run(world, cand), true, 'mentioning the dead NPC as gone must pass');
});

test('U184-53: PASS — a LIVING NPC greets the player (no death on record)', () => {
  const world = makeWorld({
    ledger: { facts: [{ text: 'Renna keeps the gate at the outpost' }], threats: [], questions: [] }
  });
  const cand = `At ${PLACE}, Renna nods to you from the gate as the morning crowd thins.`;
  assert.equal(run(world, cand), true, 'a living NPC acting alive must pass');
});

// ── collectDefeatedNames helper ────────────────────────────────────────────

test('U184-60: collectDefeatedNames gathers combat + ledger deaths', () => {
  const world = makeWorld({
    combat: { active: false, enemies: [{ id: 'e1', name: 'Greyhand', hp: 0, maxHp: 8, defeated: true }] },
    ledger: { facts: [{ text: 'you killed Renna in the square' }], threats: [], questions: [] }
  });
  const names = collectDefeatedNames(world, makeCtx());
  assert.ok(names.has('Greyhand'), 'defeated combat enemy is collected');
  assert.ok(names.has('Renna'), 'ledger death fact is collected');
});

test('U184-61: collectDefeatedNames ignores living enemies and never throws', () => {
  const names = collectDefeatedNames({ combat: { enemies: [{ id: 'e1', name: 'Brennan', hp: 5, defeated: false }] } }, null);
  assert.equal(names.has('Brennan'), false, 'a living enemy is not collected');
  assert.doesNotThrow(() => collectDefeatedNames(null, null));
});
