// U197 — H-36a deliver-or-decline generalization (post-H-35 Opus gate,
// docs/playtests/opus-gate-2026-06-19-postH35.md, clusters 1/2/4).
//
// R1 (gracefulAdjudication.js + playloop.js isExploreIntent) — a resolved
//    info-seeking turn (a roll success, OR a bare observe with no roll)
//    fell to generic atmosphere instead of a grounded fact or an explicit
//    in-fiction decline, for two phrasings the old isInfoSeekingText missed:
//    observe-object-detail ("what's stamped on the coin") and
//    quantity/genealogy ("how many generations", "who founded"). The
//    no-roll case ALSO required excluding info-seeking text from
//    isExploreIntent in playloop.js — the broad "what/how/where/who" survey
//    branch was intercepting these questions before the deliver-or-decline
//    contract (infoExtractionOutcome/isUngroundedInfoCheck) ever ran, for
//    EVERY interrogative-led info-seeking phrasing, not just the two new
//    ones. Confined to isExploreIntent itself — infoExtractionOutcome,
//    isUngroundedInfoCheck, lookupGroundedFact, genericGroundedOutcome
//    untouched.
// R2 (gracefulAdjudication.js) — a single ask naming multiple character-
//    sheet slots (HP + name + class + gear) answered the first matched
//    slot and dropped the rest, same fold shape as H-35's gear+coin.
// R3 (llmAdapter.js findInventedFactClaim) — a confident multi-generational
//    lineage/tenure claim ("roots deep", "for generations", "founding
//    family") asserted with no canon backing, extending the H-31 R4
//    age-phrase guard family.
//
// Each rule's catch case is paired with a false-positive guard (mirrors
// U192/U194/U195/U196's discipline).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove, infoExtractionOutcome } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { handleMetaQuestion, isInfoSeekingText } from '../engine/grace/gracefulAdjudication.js';
import { findInventedFactClaim } from '../engine/llmAdapter.js';

function loadPacks() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}
const packs = loadPacks();

function freshWorld(seed) {
  return beginAdventure(newWorld({
    seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null }
  }), packs).world;
}

const DECLINE_RE = /no record|can't say|can't rightly say|wouldn't know|couldn't tell you|lost to me|nobody's ever told|no answer|won't be drawn|done with that question|done talking about it|won't say another word|subject is closed|no one here would know|not written anywhere|matter stays unsettled|question's closed|matter's done|same answer|i don't have it|i told you/i;
const ATMOSPHERE_RE = /ask around|something real to go on|it goes your way|your call|low hum threads/i;

function baseWorld() {
  return {
    party: [{
      name: 'Nyx',
      archetype: 'Scrapper',
      stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 },
      purse: { copper: 3, silver: 0, gold: 0, platinum: 0 },
      inventory: { weapons: [{ name: 'Worn Blade', damage: '1d6' }], armor: [{ name: 'Padded coat' }] },
      signature: { itemName: 'Worn Blade' },
      wounds: 0, stress: 0
    }],
    meta: {}
  };
}

// ── R1 — observe-object-detail + genealogy must route through deliver-or-decline ──

test('U197-01: R1 catch — observe-object-detail ("what is printed on the coin") is recognized as info-seeking', () => {
  assert.equal(isInfoSeekingText("I scoop up exactly one coin, hold it up, and ask you what's printed on its face."), true);
  assert.equal(isInfoSeekingText("No, look at the coin in my hand and tell me what's stamped on it."), true);
});

test('U197-02: R1 catch — quantity/genealogy phrasing is recognized as info-seeking', () => {
  assert.equal(isInfoSeekingText("Corwin Boneknit — how many generations exactly has your family run Pilgrim's Rest, and who founded it?"), true);
  assert.equal(isInfoSeekingText('how many generations, and the name of the founder'), true);
});

test('U197-03: R1 false-positive guard — a bare observe with no question, and a normal "found" past-tense, are unaffected', () => {
  assert.equal(isInfoSeekingText('I look at the coin in my hand.'), false, 'no question asked — not info-seeking');
  assert.equal(isInfoSeekingText('I found a sword in the chest.'), false, '"found" as past tense of find must not match "founded"');
  assert.equal(isInfoSeekingText('What did I find in the chest?'), false, '"find" must not match the genealogy/founding cluster');
  assert.equal(isInfoSeekingText('I attack the goblin with my sword.'), false, 'combat verb exclusion still wins');
});

test('U197-04: R1 catch — an ungrounded observe-object-detail ask resolved via playerMove gets an explicit decline, never the generic ask:s floor', () => {
  const w = freshWorld('u197-04');
  const out = playerMove(w, packs, "What's printed on the coin in my hand?");
  assert.match(out.output.mechanics, /info-check/, `must route through the deliver-or-decline pre-roll gate: ${out.output.mechanics}`);
  const narr = out.output.narration.replace(/^Wizard:\s*/, '');
  assert.match(narr, DECLINE_RE, `must give an explicit in-fiction decline: ${narr}`);
  assert.doesNotMatch(narr, ATMOSPHERE_RE, `must not fall to generic atmosphere: ${narr}`);
});

test('U197-05: R1 catch — an ungrounded genealogy ask resolved via playerMove gets an explicit decline, never the generic ask:s floor', () => {
  const w = freshWorld('u197-05');
  const out = playerMove(w, packs, 'How many generations has my family run this inn?');
  assert.match(out.output.mechanics, /info-check/, `must route through the deliver-or-decline pre-roll gate: ${out.output.mechanics}`);
  const narr = out.output.narration.replace(/^Wizard:\s*/, '');
  assert.match(narr, DECLINE_RE, `must give an explicit in-fiction decline: ${narr}`);
  assert.doesNotMatch(narr, ATMOSPHERE_RE, `must not fall to generic atmosphere: ${narr}`);
});

test('U197-06: R1 false-positive guard — a genuine room survey still gets the location-survey answer, not a decline', () => {
  const w = freshWorld('u197-06');
  const out = playerMove(w, packs, 'What do I see around me?');
  assert.equal(out.output.mechanics, 'observe only — no roll, state unchanged', `a real survey must not be swept into the info-seeking decline path: ${out.output.mechanics}`);
  assert.doesNotMatch(out.output.narration, DECLINE_RE);
});

test('U197-07: R1 unit — infoExtractionOutcome never throws and returns null for non-info-seeking text', () => {
  const w = baseWorld();
  assert.equal(infoExtractionOutcome(w, 'I swing my blade at the door.', 'success'), null);
});

// ── R2 — compound state-query slot-completeness (HP + name + class + gear) ──

test('U197-10: R2 catch — a gear ask + HP ask in one breath answers both, not just gear', () => {
  const world = baseWorld();
  const ans = handleMetaQuestion("I sit up and check my gear — what's my character carrying, and what are my current hit points?", world);
  assert.match(ans, /Worn Blade/i, `gear half must answer: ${ans}`);
  assert.match(ans, /perfect health|wound|stress/i, `HP half must not be dropped: ${ans}`);
});

test('U197-11: R2 catch — an HP ask + name ask + class ask in one breath answers all three', () => {
  const world = baseWorld();
  const ans = handleMetaQuestion("What are my current hit points, and what's my character's name and class?", world);
  assert.match(ans, /Nyx/, `name half must answer: ${ans}`);
  assert.match(ans, /scrapper/i, `class half must not be dropped: ${ans}`);
  assert.match(ans, /perfect health|wound|stress/i, `HP half must not be dropped: ${ans}`);
});

test('U197-12: R2 false-positive guard — a single-slot name ask is unaffected (no stray class/HP text appended)', () => {
  const world = baseWorld();
  const ans = handleMetaQuestion("What's my name?", world);
  assert.match(ans, /Nyx/);
  assert.doesNotMatch(ans, /scrapper|perfect health|wound|stress/i, `no extra slots must be appended when none were asked: ${ans}`);
});

test('U197-13: R2 false-positive guard — a single-slot gear ask is unaffected (no stray HP text appended)', () => {
  const world = baseWorld();
  const ans = handleMetaQuestion("What's my gear?", world);
  assert.match(ans, /Worn Blade/i);
  assert.doesNotMatch(ans, /perfect health|wound|stress/i, `no HP text must appear when none was asked: ${ans}`);
});

// ── R3 — lineage/tenure anti-hallucination guard ────────────────────────────

test('U197-20: R3 catch — a confident "roots deep" / "generations rather than years" lineage claim absent from base is flagged', () => {
  const base = 'Corwin Boneknit, a civic representative, looks up from his ledger.';
  const cand = "Corwin Boneknit, a civic representative whose family name has roots deep in Pilgrim's Rest, settled authority that suggests generations rather than years.";
  const claim = findInventedFactClaim(cand, base);
  assert.ok(claim, 'must flag the invented lineage claim');
  assert.match(claim, /roots deep|generations rather than years/i);
});

test('U197-21: R3 catch — "founding family" / "since the founding" asserted with no canon backing is flagged', () => {
  const base = 'Corwin Boneknit nods at you.';
  assert.ok(findInventedFactClaim('You can tell — this is a founding family.', base));
  assert.ok(findInventedFactClaim('They have run it since the founding.', base));
});

test('U197-22: R3 false-positive guard — a lineage phrase that IS in the grounded base survives unflagged', () => {
  const base = 'Corwin says his family has roots deep in this village, for generations.';
  const cand = 'Corwin Boneknit says his family has roots deep in this village, for generations.';
  assert.equal(findInventedFactClaim(cand, base), null);
});

test('U197-23: R3 false-positive guard — a denial/hypothetical framing is not a confident claim', () => {
  const base = 'Corwin Boneknit, a civic representative, looks up.';
  const cand = 'There is no founding family here, no roots deep in this soil — just him, alone.';
  assert.equal(findInventedFactClaim(cand, base), null);
});

test('U197-24: R3 unit — findInventedFactClaim never throws on bad input', () => {
  assert.doesNotThrow(() => findInventedFactClaim(null, undefined));
  assert.equal(findInventedFactClaim(null, undefined), null);
});
