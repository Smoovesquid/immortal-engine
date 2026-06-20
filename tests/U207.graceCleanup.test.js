// U207 — H-44 grace-lane cleanup (post-H-42 baseline gate residuals).
//
// (i)  isInfoSeekingText (gracefulAdjudication.js ~L369) missed noun-less
//      suspicion/info questions that seek CONCEALED information from a person —
//      "is something going on you're not telling me?", "what aren't you telling
//      me?", "are you hiding something?" — because they have no who/what+noun
//      anchor (INFO_SEEKING_RE) and no knowledge-verb topic phrase
//      (INFO_SEEKING_TOPIC_RE). Confused-newbie t8 (post-H-42 baseline gate):
//      "That sideways glance — is something going on you're not telling me?"
//      rolled a SUCCESS but narrated content-free atmosphere filler instead of
//      routing to the deliver-or-decline contract. Same detector-recall family
//      as H-39/U202 — recall-biased net anchored on an explicit concealment/
//      withholding marker, guarded so a neutral statement or a plain action
//      never trips it.
//
// (ii) handleMetaQuestion's META_NPC_OBSERVER branch always answered with
//      `sociable[0]` — the first non-hostile NPC in the roster — even when the
//      player explicitly asked about the LURKING (hostile) stranger. Opus gate
//      transcript (docs/playtests/opus-gate-2026-06-19-postH42-baseline.md,
//      CANON_HALLUCINATION, Rules Lawyer DM):
//        player: "That's not what I asked. I asked Brae the guard who the
//                 stranger lurking at the edges is — not about Corwin. Does
//                 Brae have an answer?"
//        DM:     "Corwin Boneknit, a representative — one of the folk here,
//                 watching from nearby."
//      That DM line is META_NPC_OBSERVER's exact no-description fallback
//      template — confirms the bug lives here, not upstream in playloop
//      routing. Fix: a "lurking"/"edges"/"shadows" framing in the question
//      names the present HOSTILE npc (the real lurker, e.g. canon's "the
//      Lingerer") instead of defaulting to whichever sociable NPC is first.

import test from 'node:test';
import assert from 'node:assert/strict';

import { isInfoSeekingText, isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { infoExtractionOutcome } from '../engine/playloop.js';

// ── (i) isInfoSeekingText — noun-less concealment/suspicion MUST-MATCH ──────

test('U207-01: MUST-MATCH — "is something going on you\'re not telling me?" (the H-44 confused-newbie t8 phrasing)', () => {
  assert.equal(isInfoSeekingText("That sideways glance — is something going on you're not telling me?"), true);
});

test('U207-02: MUST-MATCH — "what aren\'t you telling me?"', () => {
  assert.equal(isInfoSeekingText("What aren't you telling me?"), true);
});

test('U207-03: MUST-MATCH — "are you hiding something?"', () => {
  assert.equal(isInfoSeekingText('Are you hiding something?'), true);
});

test('U207-04: MUST-MATCH — "is there something you\'re not saying?"', () => {
  assert.equal(isInfoSeekingText("Is there something you're not saying?"), true);
});

test('U207-05: MUST-MATCH — "what are you not telling me?"', () => {
  assert.equal(isInfoSeekingText('What are you not telling me?'), true);
});

// ── (i) false-positive guards — never trip on a statement or a plain action ─

test('U207-10: MUST-NOT-MATCH — a plain statement (declarative word order, no question) stays actionable', () => {
  assert.equal(isInfoSeekingText('Something is going on here.'), false);
});

test('U207-11: MUST-NOT-MATCH — a plain first-person action is never read as a fact-demand', () => {
  assert.equal(isInfoSeekingText('I hide behind the crate.'), false);
});

test('U207-12: MUST-NOT-MATCH — a third-person observation about someone else is not the player demanding disclosure', () => {
  assert.equal(isInfoSeekingText('He is hiding something behind his back.'), false);
});

// ── (i) integration — deliver-or-decline, never the content-free atmosphere ─

const ATMOSPHERE_BANK_RE = /it goes your way|it comes off cleanly|way ahead opens a little|it half-works|though not what you hoped|after a fashion|doesn't come off the way you meant|falls short here in|doesn't give it to you|put the question to those nearby|something real to go on|\bask around\b|low hum threads/i;
const DECLINE_RE = /no record|can't say|can't rightly say|wouldn't know|couldn't tell you|lost to me|nobody's ever told|no answer|won't be drawn|done with that question|done talking about it|won't say another word|subject is closed|no one here would know|not written anywhere|matter stays unsettled|question's closed|matter's done|same answer|i don't have it|i told you/i;

test('U207-20: integration — a SUCCESSFUL noun-less suspicion question never yields content-free atmosphere (must decline honestly instead)', () => {
  // Bare minimal world (no map/settlement/ledger) — mirrors U202-31's discipline:
  // this case is about the no-grounding-at-all branch, so it must guarantee
  // there's nothing to find, isolating the detector fix from grounding luck.
  const w = { party: [{ stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 } }], meta: {} };
  const narr = infoExtractionOutcome(w, "That sideways glance — is something going on you're not telling me?", 'success');
  assert.ok(narr, 'must produce non-null narration once detected as info-seeking (pre-fix: isInfoSeekingText missed it and this returned null)');
  assert.doesNotMatch(narr, ATMOSPHERE_BANK_RE, `must never read as the content-free atmosphere bank: ${narr}`);
  assert.match(narr, DECLINE_RE, `with nothing grounded to deliver, must give an explicit in-fiction decline: ${narr}`);
});

// ── (ii) NPC-observer query — names the canon-correct present lurker ───────

function rosterWorld(npcs) {
  return {
    map: { currentNodeId: 'n1', nodes: [{ id: 'n1', settlement: { npcs } }] },
    party: [{ stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 } }]
  };
}

// Mirrors U195.npcRosterGrounding.test.js's exact fixture — "the Lingerer" is
// this repo's established stand-in for a real, named, present hostile lurker.
const SOCIABLE_NPCS = [{ id: 'corwin', name: 'Corwin', role: 'representative', hostile: false }];
const LURKER_NPCS = [{ id: 'lingerer', name: 'the Lingerer', role: 'stranger', hostile: true }];
const MIXED_NPCS = [...SOCIABLE_NPCS, ...LURKER_NPCS];

test('U207-30: catch — "lurking at the edges" framing names the real lurker, not the sociable NPC', () => {
  const world = rosterWorld(MIXED_NPCS);
  const text = 'Who is the stranger lurking at the edges?';
  assert.equal(isMetaQuestion(text), true, 'must be recognized as a meta-question');
  const ans = handleMetaQuestion(text, world);
  assert.match(ans, /Lingerer/i, `must name the real present lurker: ${ans}`);
  assert.doesNotMatch(ans, /Corwin/i, `must not re-serve the sociable NPC for a lurker-specific ask: ${ans}`);
});

test('U207-31: catch — the exact Rules Lawyer t5 transcript phrasing resolves to the lurker, not Corwin', () => {
  const world = rosterWorld(MIXED_NPCS);
  const text = "That's not what I asked. I asked Brae the guard who the stranger lurking at the edges is — not about Corwin. Does Brae have an answer?";
  assert.equal(isMetaQuestion(text), true, 'must be recognized as a meta-question');
  const ans = handleMetaQuestion(text, world);
  assert.match(ans, /Lingerer/i, `must name the canon-correct lurker: ${ans}`);
  assert.doesNotMatch(ans, /Corwin/i, `must not re-serve Corwin after an explicit correction: ${ans}`);
});

test('U207-32: false-positive / regression guard — a generic "who\'s that stranger" with NO lurk framing still names the sociable NPC (unchanged contract)', () => {
  const world = rosterWorld(MIXED_NPCS);
  const text = "Who's that stranger watching me?";
  const ans = handleMetaQuestion(text, world);
  assert.match(ans, /Corwin/i, `non-lurk-framed identity asks must keep their existing behavior: ${ans}`);
});

test('U207-33: fallback guard — "lurking at the edges" framing with no hostile NPC present falls back to the sociable NPC instead of denying everyone', () => {
  const world = rosterWorld(SOCIABLE_NPCS);
  const text = 'Who is the stranger lurking at the edges?';
  const ans = handleMetaQuestion(text, world);
  assert.match(ans, /Corwin/i, `with no real lurker, must fall back honestly to who is actually present: ${ans}`);
});

test('U207-34: false-positive guard — an unnamed lurker (role only, no canon name) is still described honestly, never as the wrong sociable NPC', () => {
  const world = rosterWorld([...SOCIABLE_NPCS, { id: 'shade', role: 'stranger', hostile: true }]);
  const text = 'Who is the figure lurking in the shadows?';
  const ans = handleMetaQuestion(text, world);
  assert.doesNotMatch(ans, /Corwin/i, `must not misattribute the lurker's identity to the sociable NPC: ${ans}`);
  assert.match(ans, /stranger/i, `with no name on record, must still honestly describe the lurker: ${ans}`);
});
