// U213 — H-50 purse/coin transaction-claim guard.
//
// LLM polish may restyle grounded narration, but it must not invent a fresh
// NPC/player payment that never fired a purse delta. Existing balance reports,
// denial/hypothetical framings, and future real transaction bases must pass.

import test from 'node:test';
import assert from 'node:assert/strict';

import { validateNarrationCandidate } from '../engine/llmAdapter.js';

function makeWorld() {
  return {
    meta: { fate: 0.5 },
    map: {
      currentNodeId: 'n1',
      nodes: [{ id: 'n1', name: "Pilgrim's Rest Village", nodeType: 'settlement' }],
      edges: []
    },
    scene: { objective: '', interior: null, location: "Pilgrim's Rest Village" },
    combat: null,
    party: [{ id: 'pc1', purse: { cp: 0 } }],
    ledger: { facts: [], threats: [], questions: [] },
    structures: { byId: {} },
    factions: [],
    instrument: { threads: [], motifs: [] },
    time: { turn: 1 },
    pack: { primaryId: 'fantasy' }
  };
}

function makeCtx(overrides = {}) {
  return {
    placeName: "Pilgrim's Rest Village",
    nodeType: 'settlement',
    location: "Pilgrim's Rest Village",
    rollOutcome: 'success',
    infoSeeking: false,
    dialogueTurn: null,
    combat: null,
    ...overrides
  };
}

function run(candidate, {
  base = "At Pilgrim's Rest Village, Corwin waits by the stall, watching you.",
  ctx = makeCtx()
} = {}) {
  return validateNarrationCandidate(makeWorld(), candidate, {
    baseNarration: base,
    ctx
  });
}

test('U213-01: REJECT — unbacked NPC hands player specific currency', () => {
  const cand = "At Pilgrim's Rest Village, Corwin hands you three silver crowns upfront.";
  assert.equal(run(cand), false, 'a fresh currency receipt absent from base narration must be rejected');
});

test('U213-02: REJECT — unbacked NPC pays player specific currency', () => {
  const cand = "At Pilgrim's Rest Village, he pays you ten gold upfront.";
  assert.equal(run(cand), false, 'a fresh payment absent from base narration must be rejected');
});

test('U213-03: PASS — existing purse balance statement is not a receipt claim', () => {
  const cand = "At Pilgrim's Rest Village, your purse holds three silver crowns.";
  assert.equal(run(cand, { base: cand }), true, 'stating the current purse balance must not be rejected');
});

test('U213-04: PASS — negated payment framing is not a confident receipt claim', () => {
  const cand = "At Pilgrim's Rest Village, no, Corwin never handed over any crowns.";
  assert.equal(run(cand), true, 'a denial that payment happened must not be rejected');
});

test('U213-05: PASS — hypothetical payment framing is not a confident receipt claim', () => {
  const cand = "At Pilgrim's Rest Village, if he'd paid you in gold, you would know.";
  assert.equal(run(cand), true, 'a hypothetical payment framing must not be rejected');
});

test('U213-06: PASS — a receipt claim grounded in base narration is allowed', () => {
  const base = "At Pilgrim's Rest Village, Corwin hands you three silver crowns upfront.";
  const cand = "At Pilgrim's Rest Village, Corwin hands you three silver crowns upfront.";
  assert.equal(run(cand, { base }), true, 'a future real transaction path present in base narration must pass');
});
