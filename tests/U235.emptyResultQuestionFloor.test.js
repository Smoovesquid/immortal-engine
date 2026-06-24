// U235 — gate-15: a concrete INFORMATION/PRESENCE question must never resolve to the
// empty gen:s/m/f atmosphere bank (the "empty-result" class).
//
// Gate-15 failures (all one class — a present-roster question that reached the last-
// resort resolver without a specific handler, so it floored to gen:s/m/f):
//   Lore  t11: "…Is there a healer in this village…?"        → success → gen:s
//   Chaos t11: "…all gone too? Where's Corwin?"               → mixed   → gen:m
//   RL    t5 : "…who do I see?"                               → failure → gen:f
//
// ROOT CAUSE (deterministic): these are who's-here / where-is-present / is-there-here
// PRESENCE questions that escaped every detector (isInfoSeekingText / isMetaQuestion /
// confrontation / NPC-observer), so they fell through to genericGroundedOutcome's gen
// bank — which answered a concrete question with content-free atmosphere.
//
// FIX: answerOrDeclineQuestion — wired both into the `grounded` chain (so it fires
// regardless of whether the composer floored) AND into genericGroundedOutcome's floor.
// A presence question is answered from the LIVE roster (buildLocationSurvey — the present
// people are canon); a grounded fact is delivered; anything else honestly declines.
// Action / permission questions ("can I climb?") and action statements with a trailing
// "?" ("I attack — what happens?") are NOT info queries — they keep the action floor.
//
// Pure assertion on exported genericGroundedOutcome + end-to-end playerMove — no LLM,
// deterministic. Sibling to U228 (empty-success siblings), U226/U227 (grace). See
// docs/CAPABILITY_LEDGER.md gate-15.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove, genericGroundedOutcome } from '../engine/playloop.js';

const PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['village'], starterObjectives: ['survive'],
    skills: ['force'], locations: ['village'], objectives: ['survive'],
    complications: ['danger'], npcArchetypes: ['baker'], sensoryMotifs: ['flour']
  }
};

// Mira (baker) + Corwin Boneknit (representative) present; no combat, no dialogue.
function crowdWorld() {
  const base = beginAdventure(newWorld({
    seed: 'u235', fate: 0.3, campaignId: 'u235', mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), PACKS).world;
  const node = {
    id: 'u235_settlement', name: "Pilgrim's Rest Test Village", nodeType: 'settlement', discovered: true,
    settlement: {
      decompressed: true,
      npcs: [
        { id: 'npc_baker', name: 'Mira Hearth', role: 'baker', hostile: false },
        { id: 'npc_corwin', name: 'Corwin Boneknit', role: 'representative', hostile: false }
      ].map(n => ({ conversationState: { trustLevel: 5 }, ...n }))
    }
  };
  return ensureWorld({
    ...base,
    map: { ...base.map, currentNodeId: node.id, nodes: [...(base.map?.nodes || []), node] },
    combat: { ...(base.combat || {}), active: false },
    scene: { ...(base.scene || {}), interior: null, dialogue: null }
  });
}

// gen:s / gen:m / gen:f atmosphere bank (all variants) — the thing a question must NEVER be.
const GEN_RE = /goes your way|comes off cleanly|way ahead opens a little|half-works|get part of what you were after|get something out of it|lands, after a fashion|doesn'?t come off the way you meant|falls short here|slips past you in|doesn'?t give it to you/i;
// The present-roster deliver (buildLocationSurvey) — its phrasing, NOT bare NPC names
// (a decline can be VOICED by a present NPC, so "Mira shrugs…" must not read as a survey).
const ROSTER_RE = /in and around the place|are about|right here|You see\b|You're (?:in|inside)\b/i;
// An honest in-fiction decline (declineInfoSeek).
const DECLINE_RE = /wouldn'?t know|nobody'?s ever told|no record|can'?t (?:rightly )?say|lost to me|not (?:written|recorded)|don'?t have it|shakes their head|spreads their hands|shrugs|no one here would know/i;

const ggo = (text, outcome) => genericGroundedOutcome(crowdWorld(), text, outcome);
const e2e = (text) => String(playerMove(crowdWorld(), PACKS, text).output?.narration || '');

// ── 1. The exact gate-15 inputs deliver the roster, NOT gen filler (end-to-end) ──

test('U235-01: Lore t11 "is there a healer here?" delivers the roster, not gen:s', () => {
  const out = e2e("Kael, Boneknit is a bonesetter's name — a healer. Is there a healer in this village, and is that what Corwin did here?");
  assert.doesNotMatch(out, GEN_RE, `empty-success leaked: ${out}`);
  assert.match(out, ROSTER_RE, `must answer from the present roster: ${out}`);
});

test('U235-02: Chaos t11 "…where\'s Corwin?" names Corwin, not gen / "no record"', () => {
  const out = e2e("So the body, the blood, the dead man I just stabbed — all gone too? Where's Corwin?");
  assert.doesNotMatch(out, GEN_RE, `empty-mixed leaked: ${out}`);
  assert.match(out, /Corwin/, `Corwin is present — must not be "lost": ${out}`);
});

test('U235-03: RL t5 "…who do I see?" delivers the roster, not gen:f', () => {
  const out = e2e("Broke and amnesiac — great start. I head outside to find whoever's baking that bread; who do I see?");
  assert.doesNotMatch(out, GEN_RE, `empty-failure leaked: ${out}`);
  assert.match(out, ROSTER_RE, `must name who's present: ${out}`);
});

// ── 2. The floor itself (genericGroundedOutcome) — presence is outcome-independent ──

test('U235-04: a presence question never floors to gen on ANY outcome (s/m/f)', () => {
  for (const oc of ['success', 'mixed', 'failure']) {
    for (const q of ['who do I see?', 'who is around here?', 'is there a healer here?', 'is there anyone else about?']) {
      const out = ggo(q, oc);
      assert.doesNotMatch(out, GEN_RE, `[${oc}] "${q}" floored to gen: ${out}`);
      assert.match(out, ROSTER_RE, `[${oc}] "${q}" must deliver the roster: ${out}`);
    }
  }
});

test('U235-05: "where\'s Corwin?" (present) delivers the roster; "where\'s Brae?" (absent) honestly declines', () => {
  const present = ggo("where's Corwin?", 'mixed');
  assert.doesNotMatch(present, GEN_RE);
  assert.match(present, /Corwin/, `present person must be confirmed here: ${present}`);

  const absent = ggo("where's Brae?", 'mixed'); // Brae is NOT at this node
  assert.doesNotMatch(absent, GEN_RE, `absent-person where must not be gen filler: ${absent}`);
  assert.doesNotMatch(absent, ROSTER_RE, `absent person must not trigger a roster deliver: ${absent}`);
  assert.match(absent, DECLINE_RE, `absent person → honest decline: ${absent}`);
});

// ── 3. Diverge negatives — actions and action/permission questions keep the floor ──

test('U235-10: a plain (non-question) action still uses the gen/normal floor, not the roster', () => {
  const out = ggo('I shove the broken cart aside and step through', 'success');
  // The action floor may now NAME the object it acted on (IT-5: gen:s:<obj>) — still a
  // grounded action outcome, just more specific. The gate-15 point is: NOT the roster.
  assert.doesNotMatch(out, ROSTER_RE, `non-question action must not survey: ${out}`);
  assert.ok(GEN_RE.test(out) || /\bcart\b/i.test(out), `must be a grounded action floor (generic or object-named): ${out}`);
});

test('U235-11: a permission/feasibility question ("can I climb?") is an action, not an info query', () => {
  const out = ggo('Can I climb the wall over there?', 'success');
  assert.doesNotMatch(out, ROSTER_RE, `feasibility question must not survey: ${out}`);
  assert.doesNotMatch(out, DECLINE_RE, `feasibility question must not honest-decline: ${out}`);
  assert.match(out, GEN_RE, `feasibility question keeps the action floor: ${out}`);
});

test('U235-12: an action statement with a trailing "?" ("I attack — what happens?") keeps the action floor', () => {
  const out = ggo('I attack the bandit hard — what happens?', 'success');
  assert.doesNotMatch(out, ROSTER_RE, `action-with-? must not survey: ${out}`);
  assert.doesNotMatch(out, DECLINE_RE, `action-with-? must not decline: ${out}`);
});

test('U235-13: end-to-end, a plain action is unaffected by the question floor', () => {
  const out = e2e('I shove the broken cart aside and step through');
  assert.doesNotMatch(out, ROSTER_RE, `action must not be answered with a roster: ${out}`);
});
