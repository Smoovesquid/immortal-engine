// U228 — THE_REF-3: empty-success sibling fixes (gate-13 THE_REF-1 rerun, turns 4 & 10).
//
// Two succeeded grace rolls returned the gen:s "You manage it, and the way ahead opens
// a little." filler instead of resolving the player's intent:
//   turn 4:  "Why does Kael have no surname when Brae gets Copperforge?"  (info-question)
//   turn 10: "Did Tove arrive on a road, or born here? One of them's wrong."  (contradiction)
//
// ROOT CAUSE (deterministic, both classifier misses):
//   (1) isInfoSeekingText didn't recognize the "why does X have no/a <name/attribute>"
//       absent-attribute REASON shape → it fell to a generic WITS roll → gen:s. Fix:
//       INFO_SEEKING_WHY_ABSENT_RE → the deliver-or-decline path (delivers if canon
//       holds the reason, honestly declines if not — never inventing a reason).
//   (2) isConfrontationChallenge didn't recognize "one of them's wrong" / "one of those
//       is wrong" / "that contradicts what X said" (THE_REF-1 only caught "lying"
//       shapes) → gen:s. Fix: CONFRONTATION_ONE_OF_WRONG_RE + CONFRONTATION_CONTRADICTS_WHO_RE
//       → the outcome-aware confrontationReaction (THE_REF-1). The contested FACT is
//       never invented (EK-1) — a landed contradiction resolves the social beat.
//
// Pure assertion on the exported genericGroundedOutcome + the two classifiers — no LLM,
// deterministic. Sibling to U226 (THE_REF-1 confrontation), U227 (H-96 referent), U202
// (deliver-or-decline). See docs/CAPABILITY_LEDGER.md THE_REF-3.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove, genericGroundedOutcome } from '../engine/playloop.js';
import { isInfoSeekingText, isConfrontationChallenge } from '../engine/grace/gracefulAdjudication.js';

const PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['village'], starterObjectives: ['survive'],
    skills: ['force'], locations: ['village'], objectives: ['survive'],
    complications: ['danger'], npcArchetypes: ['baker'], sensoryMotifs: ['flour']
  }
};

function councilWorld() {
  const base = beginAdventure(newWorld({
    seed: 'theref3', fate: 0.3, campaignId: 'theref3', mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), PACKS).world;
  const node = {
    id: 'tr3_settlement', name: "Pilgrim's Rest Test Village", nodeType: 'settlement', discovered: true,
    settlement: {
      npcs: [
        { id: 'npc_kael', name: 'Kael', role: 'elder', hostile: false },
        { id: 'npc_corwin', name: 'Corwin Boneknit', role: 'representative', hostile: false },
        { id: 'npc_tove', name: 'Tove', role: 'settler', hostile: false }
      ].map(n => ({ conversationState: { trustLevel: 4 }, ...n }))
    }
  };
  return ensureWorld({
    ...base,
    map: { ...base.map, currentNodeId: node.id, nodes: [...(base.map?.nodes || []), node] },
    scene: { ...(base.scene || {}), interior: null, dialogue: null }
  });
}

const GEN_S_RE = /goes your way|comes off cleanly|way ahead opens a little/i;
const ggoSuccess = (text) => genericGroundedOutcome(councilWorld(), text, 'success');

// ── Sibling 1 — "why does X have no/a <attribute>" → honest decline, not gen:s ──

test('U228-01: "Why does Kael have no surname…" is recognized as info-seeking', () => {
  assert.equal(isInfoSeekingText('Why does Kael have no surname when Brae gets Copperforge?'), true);
  assert.equal(isInfoSeekingText("Why doesn't Kael have a last name?"), true);
});

test('U228-02: the why-no-surname success is NOT the gen:s empty-success filler', () => {
  const out = ggoSuccess('Why does Kael have no surname when Brae gets Copperforge?');
  assert.doesNotMatch(out, GEN_S_RE, `succeeded info-question must not be "it goes your way": ${out}`);
});

test('U228-03: an ungrounded reason honestly declines (does not fabricate a surname/reason)', () => {
  const out = ggoSuccess("Why doesn't Kael have a last name?");
  assert.doesNotMatch(out, GEN_S_RE);
  // No fabricated surname or invented reason — an honest "wouldn't know / no record".
  assert.match(out, /wouldn'?t know|nobody'?s ever told|no record|can'?t say|can'?t rightly say|lost to me|not (?:written|recorded)|don'?t have it/i,
    `must honestly decline the ungrounded reason: ${out}`);
});

// ── Sibling 2 — contradiction → confrontation reaction, not gen:s ────────────

test('U228-04: contradiction shapes are recognized as confrontations', () => {
  assert.equal(isConfrontationChallenge("Did Tove arrive on a road, or born here? One of them's wrong."), true);
  assert.equal(isConfrontationChallenge('One of those is wrong.'), true);
  assert.equal(isConfrontationChallenge('That contradicts what Corwin said.'), true);
});

test('U228-05: a contradiction success yields a reaction, not the gen:s filler', () => {
  const out = ggoSuccess("Did Tove arrive on a road, or born here? One of them's wrong.");
  assert.doesNotMatch(out, GEN_S_RE, `contradiction must not be empty-success: ${out}`);
  assert.match(out, /"/, 'a confrontation reaction includes the NPC speaking');
});

test('U228-06: "that contradicts what Corwin said" routes to confrontation, not gen:s', () => {
  assert.doesNotMatch(ggoSuccess('That contradicts what Corwin said.'), GEN_S_RE);
});

test('U228-07: a landed contradiction does NOT invent which fact is wrong (EK-1)', () => {
  for (const t of ['One of those is wrong.', "Did Tove arrive on a road, or born here? One of them's wrong."]) {
    const out = ggoSuccess(t);
    assert.doesNotMatch(out, /\b(?:Tove (?:was|lied|arrived)|on a road is|born here is|the road (?:one|claim)|she lied|was born here|came by road)\b/i,
      `must not resolve which contested claim is wrong: ${out}`);
  }
});

// ── Diverge negatives — benign "wrong" / ordinary "why" must NOT over-fire ───

test('U228-10: "what is wrong here?" is NOT a confrontation', () => {
  assert.equal(isConfrontationChallenge('What is wrong here?'), false);
});

test('U228-11: benign "wrong turn" / "wrong road" are NOT accusations', () => {
  assert.equal(isConfrontationChallenge('I took a wrong turn back there.'), false);
  assert.equal(isConfrontationChallenge('Is this the wrong road to the harbor?'), false);
});

test('U228-12: an ordinary non-attribute "why" is NOT swept into info-seeking', () => {
  assert.equal(isInfoSeekingText('Why is the gate closed?'), false);
});

// ── Regression — H-96 and THE_REF-1 remain intact ───────────────────────────

test('U228-13: H-96 — sentence-initial "That\'s…" still does not bounce [clarify:referent]', () => {
  const mech = String(playerMove(councilWorld(), PACKS, "That's no answer, Corwin. Why does Kael have no surname?").output?.mechanics || '');
  assert.doesNotMatch(mech, /\[clarify:referent\]/);
});

test('U228-14: THE_REF-1 — "are you telling me he lied?" is still a confrontation', () => {
  assert.equal(isConfrontationChallenge('Corwin, are you telling me he lied about that?'), true);
});
