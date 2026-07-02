// U315 — NBIO-1: a present NPC answers "were you born here?" from its own
// tenure (originTick), not the place-blurb and not a decline.
//
// Failure mode (FAILURE_META_DIAGNOSIS.md §4 / REF-003): after AG-1/DLG-1, a
// second-person self-tenure question ("have you been here long?", "did you grow
// up in this village?") no longer rolled and no longer silently waited — but it
// landed on the generic settlement blurb ("This is Pilgrim's Rest Test Village.
// Small, but it holds.") instead of the NPC's own founding-vs-later-arrival
// answer. The fact already existed (npc.originTick, via personQuery's
// describeTenure for third person); NBIO-1 extends it to the second-person
// self-addressed form via commonKnowledgeAnswer's new `origin` mode.

import test from 'node:test';
import assert from 'node:assert/strict';
import { playerMove } from '../engine/playloop.js';
import { FIXTURES, PACKS } from '../scripts/convergence/fixtures.mjs';

function surface(result) {
  return `${result.output?.narration || ''} ${result.output?.mechanics || ''}`.trim();
}

function makeWorld() {
  return FIXTURES.village_baker();
}

function withOriginTick(world, tick) {
  const nodes = world.map.nodes.map(n => {
    if (n.id !== world.map.currentNodeId) return n;
    return {
      ...n,
      settlement: {
        ...n.settlement,
        npcs: n.settlement.npcs.map(npc => ({ ...npc, originTick: tick }))
      }
    };
  });
  return { ...world, map: { ...world.map, nodes } };
}

// ── Founding resident (originTick 0) ──────────────────────────────────────────

test('U315-A1: "were you born here?" to a founding NPC names their founding tenure', () => {
  const w = withOriginTick(makeWorld(), 0);
  const s = surface(playerMove(w, PACKS, 'were you born here?'));
  assert.match(s, /born/i, '"were you born here?" to a founder must answer with born-here language');
  assert.doesNotMatch(s, /small, but it holds/i, 'must not recite the place blurb');
  assert.doesNotMatch(s, /stops and turns.*waiting/i, 'must not silent-wait');
  assert.doesNotMatch(s, /\[roll:/i, 'must not roll a d20');
});

test('U315-A2: "have you been here long?" to a founding NPC answers from their own tenure', () => {
  const w = withOriginTick(makeWorld(), 0);
  const s = surface(playerMove(w, PACKS, 'have you been here long?'));
  assert.match(s, /born|founding/i, '"have you been here long?" to a founder must speak to founding tenure');
  assert.doesNotMatch(s, /small, but it holds/i, 'must not recite the place blurb');
});

// ── Later arrival (originTick > 0) ────────────────────────────────────────────

test('U315-B1: "were you born here?" to a later-arrival NPC answers "came later", not born-here', () => {
  const w = withOriginTick(makeWorld(), 4);
  const s = surface(playerMove(w, PACKS, 'were you born here?'));
  assert.match(s, /came later|settled|not a native/i,
    '"were you born here?" to a later arrival must answer with a came-later/settled line');
  assert.doesNotMatch(s, /born here/i, 'must not claim they were born here');
  assert.doesNotMatch(s, /small, but it holds/i, 'must not recite the place blurb');
});

// ── Diverge: over-match discipline ────────────────────────────────────────────

test('U315-D1: "what is this village?" still recites the place blurb', () => {
  const w = withOriginTick(makeWorld(), 0);
  const s = surface(playerMove(w, PACKS, 'what is this village?'));
  assert.match(s, /This is Pilgrim's Rest Test Village/i, '"what is this village?" must still be a place question');
});

test('U315-D2: "who are you?" still answers identity, not origin', () => {
  const w = withOriginTick(makeWorld(), 0);
  const s = surface(playerMove(w, PACKS, 'who are you?'));
  assert.match(s, /Mira(?:\s+Hearth)?/i, '"who are you?" must still answer with the NPC\'s name');
});

// ── Determinism ────────────────────────────────────────────────────────────────

test('U315-DET1: the origin answer is deterministic under replay', () => {
  const w1 = withOriginTick(makeWorld(), 0);
  const w2 = withOriginTick(makeWorld(), 0);
  const s1 = surface(playerMove(w1, PACKS, 'were you born here?'));
  const s2 = surface(playerMove(w2, PACKS, 'were you born here?'));
  assert.equal(s1, s2, 'the same question against the same world must produce the same narration');
});
