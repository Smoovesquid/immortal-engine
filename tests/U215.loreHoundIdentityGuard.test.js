// U215 — H-52 lore-hound elder identity/tenure guard.
//
// Two CANON_HALLUCINATION shapes from the same glass-harbor node:
//   (a) invented tenure expressed in decades ("well over two decades").
//   (b) a grounded NPC name pinned to the wrong settlement role ("Corwin" as
//       the elder when canon says Kael is elder).

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findInventedFactClaim,
  findMisattributedRoleClaim,
  validateNarrationCandidate
} from '../engine/llmAdapter.js';

function makeWorld() {
  return {
    meta: { fate: 0.5 },
    map: {
      currentNodeId: 'glass-harbor',
      nodes: [{ id: 'glass-harbor', name: 'Glass Harbor', nodeType: 'settlement' }],
      edges: []
    },
    scene: { objective: '', interior: null, location: 'Glass Harbor' },
    combat: null,
    party: [{ id: 'pc1' }],
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
    placeName: 'Glass Harbor',
    nodeType: 'settlement',
    location: 'Glass Harbor',
    rollOutcome: 'success',
    infoSeeking: false,
    dialogueTurn: null,
    combat: null,
    settlement: {
      npcs: [
        { name: 'Kael', role: 'elder' },
        { name: 'Corwin Boneknit', role: 'representative' },
        { name: 'Mira Saltglass', role: 'healer' }
      ]
    },
    ...overrides
  };
}

function run(candidate, {
  base = 'At Glass Harbor, Kael is the elder, Corwin Boneknit is a representative, and Mira Saltglass tends wounds.',
  ctx = makeCtx()
} = {}) {
  return validateNarrationCandidate(makeWorld(), candidate, {
    baseNarration: base,
    ctx
  });
}

test('U215-01: REJECT — invented tenure claim using decades not present in grounded base', () => {
  const base = 'At Glass Harbor, Kael is the elder; no one gives a number for his tenure.';
  const cand = 'At Glass Harbor, an elder has guided the settlement for well over two decades.';
  assert.equal(findInventedFactClaim(cand, base), 'two decades');
});

test('U215-02: PASS — decades tenure present in grounded base is allowed', () => {
  const base = 'At Glass Harbor, Kael has guided the settlement for two decades.';
  const cand = 'At Glass Harbor, Kael has guided the settlement for two decades.';
  assert.equal(findInventedFactClaim(cand, base), null);
});

test('U215-03: PASS — negated decades framing is not a confident tenure claim', () => {
  const base = 'At Glass Harbor, Kael is the elder; no tenure figure is on record.';
  const cand = 'At Glass Harbor, there is no record spanning two decades for Kael.';
  assert.equal(findInventedFactClaim(cand, base), null);
});

test('U215-10: REJECT — grounded name pinned to wrong elder role', () => {
  const ctx = makeCtx();
  const cand = 'At Glass Harbor, Corwin Boneknit is the elder here, a representative voice in the harbor.';
  assert.ok(findMisattributedRoleClaim(cand, ctx), 'wrong-name elder assertion must be flagged directly');
  assert.equal(run(cand, { ctx }), false, 'validateNarrationCandidate must reject the wrong-role claim');
});

test('U215-11: REJECT — "the elder, Corwin Boneknit" wrong-role apposition', () => {
  const ctx = makeCtx();
  const cand = 'At Glass Harbor, the elder, Corwin Boneknit, watches the tide with a measured eye.';
  assert.ok(findMisattributedRoleClaim(cand, ctx), 'role-first wrong-name apposition must be flagged');
  assert.equal(run(cand, { ctx }), false);
});

test('U215-12: PASS — actual elder named as elder is allowed', () => {
  const ctx = makeCtx();
  const cand = 'At Glass Harbor, Kael is the elder here, and Corwin Boneknit keeps to representative matters.';
  assert.equal(findMisattributedRoleClaim(cand, ctx), null);
  assert.equal(run(cand, { ctx }), true);
});

test('U215-13: PASS — generic flavor with names and roles but no identity assertion is allowed', () => {
  const ctx = makeCtx();
  const cand = 'At Glass Harbor, Corwin Boneknit glances toward the elder house while Kael listens nearby.';
  assert.equal(findMisattributedRoleClaim(cand, ctx), null);
  assert.equal(run(cand, { ctx }), true);
});

test('U215-14: PASS — role with no holder in ctx is out of scope for this guard', () => {
  const ctx = makeCtx({
    settlement: { npcs: [{ name: 'Corwin Boneknit', role: 'representative' }] }
  });
  const cand = 'At Glass Harbor, Corwin Boneknit is the elder here.';
  assert.equal(findMisattributedRoleClaim(cand, ctx), null);
});

test('U215-15: findMisattributedRoleClaim never throws on bad input', () => {
  assert.doesNotThrow(() => findMisattributedRoleClaim(null, null));
  assert.equal(findMisattributedRoleClaim(null, null), null);
});
