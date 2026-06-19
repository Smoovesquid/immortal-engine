// U205 — H-42 react-under-pressure (grace lane).
//
// Opus gate, Lore-hound t12, HIGH-severity DM_TEST_DEADEND: the player confronts a
// present NPC with a contradiction — "You said Kael was here before any of you. He
// says he came later. One of you is lying about your own village's founding. Which
// one?" — the insight roll FAILS, and the DM emitted the generic place-filler
// "Whatever you meant to do, Pilgrim's Rest Village doesn't give it to you." A real
// DM, even when the player's READ fails, still gives the confronted NPC a REACTION —
// they deflect, bristle, hold firm — never narration-voice filler about the village
// (IDEA_GARDEN IG-11, "react under pressure" social physics).
//
// Two changes, both deterministic:
//   (i)  gracefulAdjudication.js: a new exported isConfrontationChallenge(text) —
//        recall-biased net of accusation/contradiction markers ("you said... but",
//        "one/which of you is lying", "you're lying", "stop lying", "admit it", "you
//        claimed", "contradicts what you said", "you swore... but"), guarded against
//        the "lying" = reclining false reading and against plain info-asks (which stay
//        isInfoSeekingText's job).
//   (ii) playloop.js: genericGroundedOutcome gets a SIBLING branch to the existing
//        H-39 isInfoSeekingText decline, at the top of the function — on a FAILURE
//        outcome, a confrontation aimed at a present NPC returns a deterministic
//        in-character reaction (confrontationReaction, two tiers off the NPC's real
//        `hostile` flag) instead of falling to the gen:s/gen:m/gen:f atmosphere pool.
//        The reaction never concedes or reveals the contested fact — the roll failed,
//        so the player doesn't earn the read. Success/mixed outcomes are untouched
//        (that's the deliver path / H-12-13 roll-recall contradiction handling's job).

import test from 'node:test';
import assert from 'node:assert/strict';

import { genericGroundedOutcome } from '../engine/playloop.js';
import { isConfrontationChallenge, isInfoSeekingText } from '../engine/grace/gracefulAdjudication.js';

const GEN_F_FILLER_RE = /doesn't come off the way you meant|falls short here|doesn't give it to you/i;
const DECLINE_RE = /no record|can't say|can't rightly say|wouldn't know|couldn't tell you|lost to me|nobody's ever told|no answer|won't be drawn|done with that question|done talking about it|won't say another word|subject is closed|no one here would know|not written anywhere|matter stays unsettled|question's closed|matter's done|same answer|i don't have it|i told you/i;
const REACTION_RE = /jaw tightens|holds your gaze|doesn't blink|folds their arms|bristles|hand drifts toward|meets your eyes, steady/i;
const ATMOSPHERE_BANK_RE = /it goes your way|it comes off cleanly|way ahead opens a little|it half-works|though not what you hoped|after a fashion/i;

const LORE_HOUND_T12 = "You said Kael was here before any of you. He says he came later. One of you is lying about your own village's founding. Which one?";

function confrontWorld({ npcs = [], seed = 'u205' } = {}) {
  return {
    map: {
      currentNodeId: 'n1',
      nodes: [{
        id: 'n1', name: "Pilgrim's Rest Village", nodeType: 'settlement',
        settlement: { npcs }
      }]
    },
    party: [{ stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 } }],
    meta: { seed },
    timeline: []
  };
}

const civilNpc = { id: 'npc_mira', name: 'Mira', role: 'elder', hostile: false };
const hostileNpc = { id: 'npc_grask', name: 'Grask', role: 'guard', hostile: true };

// ── isConfrontationChallenge — MUST-MATCH ────────────────────────────────────

test('U205-01: MUST-MATCH — "one of you is lying"', () => {
  assert.equal(isConfrontationChallenge(LORE_HOUND_T12), true);
});

test('U205-02: MUST-MATCH — "which of you is lying"', () => {
  assert.equal(isConfrontationChallenge('Which of you is lying about the founding?'), true);
});

test('U205-03: MUST-MATCH — "you\'re lying"', () => {
  assert.equal(isConfrontationChallenge("You're lying to me right now."), true);
});

test('U205-04: MUST-MATCH — "stop lying"', () => {
  assert.equal(isConfrontationChallenge('Stop lying and tell me the truth.'), true);
});

test('U205-05: MUST-MATCH — "admit it"', () => {
  assert.equal(isConfrontationChallenge('Just admit it already.'), true);
});

test('U205-06: MUST-MATCH — "you claimed"', () => {
  assert.equal(isConfrontationChallenge('You claimed the well was always here.'), true);
});

test('U205-07: MUST-MATCH — "contradicts what you said"', () => {
  assert.equal(isConfrontationChallenge('That contradicts what you said yesterday.'), true);
});

test('U205-08: MUST-MATCH — "you swore ... but"', () => {
  assert.equal(isConfrontationChallenge("You swore you'd never seen him before, but here he is."), true);
});

test('U205-09: MUST-MATCH — "you said X but Y"', () => {
  assert.equal(isConfrontationChallenge('You said the well was poisoned, but now you say it wasn\'t.'), true);
});

// ── isConfrontationChallenge — false-positive guards ─────────────────────────

test('U205-10: false-positive guard — a neutral statement is not a confrontation', () => {
  assert.equal(isConfrontationChallenge('Kael told me he was born here.'), false);
});

test('U205-11: false-positive guard — a plain info-ask is not a confrontation (isInfoSeekingText\'s job)', () => {
  assert.equal(isConfrontationChallenge('Tell me about the war.'), false);
  assert.equal(isInfoSeekingText('Tell me about the war.'), true);
});

test('U205-12: false-positive guard — "lying" as reclining (not accusing) does not trip the detector', () => {
  assert.equal(isConfrontationChallenge('She\'s lying in the grass, hurt badly.'), false);
  assert.equal(isConfrontationChallenge('He\'s lying down to rest.'), false);
});

test('U205-13: false-positive guard — an empty/whitespace string is not a confrontation', () => {
  assert.equal(isConfrontationChallenge(''), false);
  assert.equal(isConfrontationChallenge('   '), false);
});

// ── genericGroundedOutcome — the Lore-hound t12 bug, fixed ───────────────────

test('U205-20: Lore-hound t12 — a failed confrontation of a present NPC yields an NPC reaction, never the gen:f filler', () => {
  const w = confrontWorld({ npcs: [civilNpc] });
  const narr = genericGroundedOutcome(w, LORE_HOUND_T12, 'failure');
  assert.match(narr, REACTION_RE, `must give an in-character NPC reaction: ${narr}`);
  assert.doesNotMatch(narr, GEN_F_FILLER_RE, `must never fall to the gen:f atmosphere filler: ${narr}`);
});

test('U205-21: the reaction does not concede or reveal the contested fact', () => {
  const w = confrontWorld({ npcs: [civilNpc] });
  const narr = genericGroundedOutcome(w, LORE_HOUND_T12, 'failure');
  // The roll failed — the player has not earned the read. The reaction must not
  // name the contested third party or assert who is telling the truth.
  assert.doesNotMatch(narr, /kael/i, `must not resolve the contested fact about Kael: ${narr}`);
  assert.doesNotMatch(narr, /\byou'?re right\b|\bhe'?s right\b|\bshe'?s right\b|founded the village/i,
    `must not concede the contradiction: ${narr}`);
});

test('U205-22: civil (non-hostile) NPC gets a defensive-but-civil reaction', () => {
  const w = confrontWorld({ npcs: [civilNpc] });
  const narr = genericGroundedOutcome(w, LORE_HOUND_T12, 'failure');
  assert.match(narr, /Mira/, `must name the real present NPC: ${narr}`);
  assert.doesNotMatch(narr, /hand drifts toward|bristles/i, `a non-hostile NPC should not get the bristle-tier lines: ${narr}`);
});

test('U205-23: hostile NPC gets the sharper bristle-tier reaction', () => {
  const w = confrontWorld({ npcs: [hostileNpc] });
  const narr = genericGroundedOutcome(w, LORE_HOUND_T12, 'failure');
  assert.match(narr, /Grask/, `must name the real present NPC: ${narr}`);
  assert.match(narr, /holds your gaze|hand drifts toward|bristles/i, `a hostile NPC should get the bristle-tier line: ${narr}`);
});

// ── False-positive guards on the genericGroundedOutcome branch ───────────────

test('U205-24: false-positive guard — confrontation with NO NPC present routes normally (no reaction, falls to real atmosphere)', () => {
  const w = confrontWorld({ npcs: [] });
  const narr = genericGroundedOutcome(w, LORE_HOUND_T12, 'failure');
  assert.doesNotMatch(narr, REACTION_RE, `with no one present there is no one to react: ${narr}`);
  assert.match(narr, GEN_F_FILLER_RE, `must fall through to the real gen:f atmosphere: ${narr}`);
});

test('U205-25: false-positive guard — a plain info-ask still routes to the H-39 decline path, not the new branch', () => {
  const w = confrontWorld({ npcs: [civilNpc] });
  const narr = genericGroundedOutcome(w, 'Tell me about the war.', 'failure');
  assert.doesNotMatch(narr, REACTION_RE, `a plain info-ask must not be read as a confrontation: ${narr}`);
  assert.match(narr, DECLINE_RE, `must still decline via the H-39 path: ${narr}`);
});

test('U205-26: false-positive guard — a neutral action with an NPC present is unaffected (still real gen:s atmosphere)', () => {
  const w = confrontWorld({ npcs: [civilNpc] });
  const narr = genericGroundedOutcome(w, 'I steady my breathing.', 'success');
  assert.doesNotMatch(narr, REACTION_RE, `a neutral action must not trigger a confrontation reaction: ${narr}`);
});

// ── Scoped to FAILURE only — success/mixed are untouched ─────────────────────

test('U205-27: a SUCCESSFUL confrontation read does not use the new reaction branch (deliver path\'s job)', () => {
  const w = confrontWorld({ npcs: [civilNpc] });
  const narr = genericGroundedOutcome(w, LORE_HOUND_T12, 'success');
  assert.doesNotMatch(narr, REACTION_RE, `success must not be intercepted by the failure-only reaction branch: ${narr}`);
});

test('U205-28: a MIXED confrontation read does not use the new reaction branch (failure-only scope)', () => {
  const w = confrontWorld({ npcs: [civilNpc] });
  const narr = genericGroundedOutcome(w, LORE_HOUND_T12, 'mixed');
  assert.doesNotMatch(narr, REACTION_RE, `mixed must not be intercepted by the failure-only reaction branch: ${narr}`);
});

// ── Determinism ───────────────────────────────────────────────────────────────

test('U205-29: determinism — identical world/text/outcome yields an identical reaction on replay', () => {
  const w1 = confrontWorld({ npcs: [civilNpc] });
  const w2 = confrontWorld({ npcs: [civilNpc] });
  const a = genericGroundedOutcome(w1, LORE_HOUND_T12, 'failure');
  const b = genericGroundedOutcome(w2, LORE_HOUND_T12, 'failure');
  assert.equal(a, b, 'same seed/state/key must produce the same pick');
});
