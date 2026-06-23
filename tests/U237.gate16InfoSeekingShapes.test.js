// U237 — gate-16: two info-seeking detector gaps that floored a concrete ask to empty
// atmosphere / a meta-recap bounce.
//
// Gate-16 failures (both DM_TEST_DEADEND):
//   Lore-hound: "name one person in Pilgrim's Rest old enough to remember the Boneknits
//               before you, Corwin." → gen:s "You see it through, and it goes your way."
//   Newbie:     "You're definitely hiding something. What happened in the old days?"
//               → META_RECAP bounce "Nothing's happened yet. What do you want to do?"
//
// ROOT CAUSES (deterministic):
//   (1) isInfoSeekingText missed the IMPERATIVE name-request "name (one|a|the) <person/
//       family noun>" — no "me" (so not INFO_SEEKING_NAME_ME_RE) and no "?" (so not
//       isQuestionShaped). Fix: INFO_SEEKING_NAME_ONE_RE → deliver-or-decline.
//   (2) INFO_SEEKING_BACKSTORY_RE had no in-range time-ref for "the old days" → the ask
//       stayed a META_RECAP and bounced. Fix: add old days / back then / in the past / …
//   Plus: the name-request named "the Boneknits" (a family); isGroundedNpcRef didn't match
//       the plural to present "Corwin Boneknit", so the clarify-referent bounced with a
//       contradictory "no one by that name here". Fix: de-pluralize a family surname ref.
//
// All resolutions are GROUNDED deliver-or-decline — never fabricate a name/event (EK-1).
// Pure assertion on isInfoSeekingText + end-to-end playerMove — no LLM, deterministic.
// Sibling to U232 (name-me), U228 (empty-success), U235 (empty-result). See gate-16 ledger.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { isInfoSeekingText } from '../engine/grace/gracefulAdjudication.js';

const PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['village'], starterObjectives: ['survive'],
    skills: ['force'], locations: ['village'], objectives: ['survive'],
    complications: ['danger'], npcArchetypes: ['baker'], sensoryMotifs: ['flour']
  }
};

function world() {
  const base = beginAdventure(newWorld({
    seed: 'u237', fate: 0.3, campaignId: 'u237', mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), PACKS).world;
  const node = {
    id: 'u237_node', name: "Pilgrim's Rest Test Village", nodeType: 'settlement', discovered: true,
    settlement: {
      decompressed: true,
      npcs: [
        { id: 'npc_corwin', name: 'Corwin Boneknit', role: 'representative', hostile: false, conversationState: { trustLevel: 6, metPlayer: true } },
        { id: 'npc_kael', name: 'Kael', role: 'elder', hostile: false, conversationState: { trustLevel: 5, metPlayer: true } }
      ]
    }
  };
  return ensureWorld({
    ...base,
    map: { ...base.map, currentNodeId: node.id, nodes: [...(base.map?.nodes || []), node] },
    combat: { ...(base.combat || {}), active: false },
    scene: { ...(base.scene || {}), interior: null, dialogue: null }
  });
}

const e2e = (text) => String(playerMove(world(), PACKS, text).output?.narration || '');
const GEN_RE = /goes your way|comes off cleanly|way ahead opens a little|half-works|doesn'?t come off the way you meant|falls short here|pattern stays stubborn/i;
// declineInfoSeek across all escalation tiers (polite → curt → disengage).
const DECLINE_RE = /no record|can'?t (?:rightly )?say|wouldn'?t know|nobody'?s ever told|don'?t have it|don'?t know|same answer|I told you|won'?t change by asking|won'?t be drawn|lost to me|shakes their head|shrugs|spreads their hands|patience thins|sighs|done with that question|done talking about it|won'?t say another word|no one here would know/i;
const RECAP_BOUNCE_RE = /Nothing'?s happened yet/i;
const CLARIFY_CONTRADICTION_RE = /no one by that name/i;

// ── 1. Imperative name-request is info-seeking and declines (not gen, not clarify) ──

test('U237-01: "name one person old enough to remember the Boneknits" is info-seeking', () => {
  assert.equal(isInfoSeekingText('name one person in Pilgrim\'s Rest old enough to remember the Boneknits before you, Corwin'), true);
  assert.equal(isInfoSeekingText('name a witness'), true);
  assert.equal(isInfoSeekingText('name another old family besides the Boneknits'), true);
});

test('U237-02: the name-request honestly declines — no gen filler, no contradictory clarify', () => {
  const out = e2e('Fine — then name one person in Pilgrim\'s Rest old enough to remember the Boneknits before you, Corwin.');
  assert.doesNotMatch(out, GEN_RE, `must not be empty-success: ${out}`);
  assert.doesNotMatch(out, CLARIFY_CONTRADICTION_RE, `family surname must ground to present Corwin Boneknit: ${out}`);
  assert.match(out, DECLINE_RE, `ungrounded name-request → honest decline: ${out}`);
});

// ── 2. "what happened in the old days?" routes to backstory, not the recap bounce ──

test('U237-03: "what happened in the old days?" (and siblings) are info-seeking backstory', () => {
  assert.equal(isInfoSeekingText('What happened in the old days?'), true);
  assert.equal(isInfoSeekingText('what happened back then?'), true);
  assert.equal(isInfoSeekingText('what happened in the past here?'), true);
});

test('U237-04: the backstory ask does NOT bounce with "Nothing\'s happened yet"', () => {
  const out = e2e("You're definitely hiding something. What happened in the old days?");
  assert.doesNotMatch(out, RECAP_BOUNCE_RE, `must not be a meta-recap bounce: ${out}`);
  assert.doesNotMatch(out, GEN_RE, `must not be empty atmosphere: ${out}`);
});

// ── 3. Diverge negatives — naming ACTIONS and a real recap are NOT info-seeking ──

test('U237-10: naming ACTIONS are not info-seeking', () => {
  assert.equal(isInfoSeekingText('I name my sword Excalibur.'), false);
  assert.equal(isInfoSeekingText('Name your price, merchant.'), false);
  assert.equal(isInfoSeekingText('I want to name the village Haven.'), false);
  assert.equal(isInfoSeekingText('name the time and place'), false);
});

test('U237-11: a real player-recap is NOT swept into backstory info-seeking', () => {
  assert.equal(isInfoSeekingText('What happened? What did I just do?'), false);
});

test('U237-12: an ordinary action is unaffected end-to-end (no decline/clarify steal)', () => {
  const out = e2e('I shove the broken cart aside and step through.');
  assert.doesNotMatch(out, CLARIFY_CONTRADICTION_RE);
  assert.doesNotMatch(out, DECLINE_RE, `an action must not be answered with an info-decline: ${out}`);
});
