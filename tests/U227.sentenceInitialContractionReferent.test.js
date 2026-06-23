// U227 — THE_REF-2 / H-96: clarify-referent false-NER on sentence-initial contractions.
//
// gate-13 THE_REF-1 rerun, turns 5 & 11 (DM_TEST_DEADEND / menu-bounce):
//   "That's no answer, Corwin. Why does Kael have no surname?"   → [clarify:referent] "no one named That"
//   "That's a dice roll, not Brae's voice. I asked Brae…"        → [clarify:referent] "no one named That"
// The DM bounced a clarify menu asking who "That" is, even though the player named
// real present NPCs (Corwin / Brae) later in the sentence.
//
// ROOT CAUSE (deterministic): hasPersonReferentSignal's possessive arm
// (\b<name>'s\b) FALSELY matched the copula contraction "That's" (= "that is") as a
// possessive person-signal. The clarify gate (playloop.js:1006) already required a
// positive person-signal — but the signal itself was lying, so "That" won the
// referent over the real (unsignalled) NPCs and, being ungrounded, bounced a menu.
//
// FIX (positive-signal honesty, NOT a name denylist): the "'s" arm no longer fires
// for closed-class function words (that/there/here/what/where/who/this/it/he/she/…)
// — those are never possessive person-references. A REAL possessive ("Brae's voice",
// "Garrett's brother") still signals; the his/her/their arm is unchanged.
//
// Sibling to U219 (H-56/H-90/H-91 ungrounded referent). Pure end-to-end assertion on
// playerMove mechanics (the helpers aren't exported) — deterministic, no LLM. See
// docs/CAPABILITY_LEDGER.md THE_REF-2/H-96.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';

const PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['village'], starterObjectives: ['survive'],
    skills: ['force'], locations: ['village'], objectives: ['survive'],
    complications: ['danger'], npcArchetypes: ['baker'], sensoryMotifs: ['flour']
  }
};

function worldWith(npcs = []) {
  const base = beginAdventure(newWorld({
    seed: 'h96', fate: 0.3, campaignId: 'h96', mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), PACKS).world;
  const node = {
    id: 'h96_settlement', name: "Pilgrim's Rest Test Village", nodeType: 'settlement', discovered: true,
    settlement: { npcs: npcs.map(n => ({ conversationState: { trustLevel: 5 }, ...n })) }
  };
  return ensureWorld({
    ...base,
    map: { ...base.map, currentNodeId: node.id, nodes: [...(base.map?.nodes || []), node] },
    scene: { ...(base.scene || {}), interior: null, dialogue: null }
  });
}

// A council of present, named NPCs (mirrors the glass-harbor gate scene).
function councilWorld() {
  return worldWith([
    { id: 'npc_baker', name: 'Mira Hearth', role: 'baker', hostile: false },
    { id: 'npc_corwin', name: 'Corwin Boneknit', role: 'representative', hostile: false },
    { id: 'npc_kael', name: 'Kael', role: 'elder', hostile: false },
    { id: 'npc_brae', name: 'Brae Copperforge', role: 'smith', hostile: false }
  ]);
}

const mechOf = (text) => String(playerMove(councilWorld(), PACKS, text).output?.mechanics || '');
const bounces = (text) => /\[clarify:referent\]/.test(mechOf(text));

// ── Positives — sentence-initial contractions must NOT bounce a clarify menu ──

test('U227-01: gate turn-5 — "That\'s no answer, Corwin…" does not bounce [clarify:referent]', () => {
  assert.equal(bounces("That's no answer, Corwin. Why does Kael have no surname?"), false);
});

test('U227-02: gate turn-11 — "That\'s a dice roll, not Brae\'s voice. I asked Brae…" does not bounce', () => {
  assert.equal(bounces("That's a dice roll, not Brae's voice. I asked Brae — what does Brae Copperforge actually say?"), false);
});

test('U227-03: "That\'s not what I asked, Kael." does not bounce (tie-break case)', () => {
  assert.equal(bounces("That's not what I asked, Kael."), false);
});

test('U227-04: "That\'s evasive, Corwin." does not bounce', () => {
  assert.equal(bounces("That's evasive, Corwin."), false);
});

test('U227-05: "That\'s not an answer." (no other name) does not bounce', () => {
  assert.equal(bounces("That's not an answer."), false);
});

test('U227-06: "There\'s no name you\'ll give me, Corwin." does not bounce', () => {
  assert.equal(bounces("There's no name you'll give me, Corwin."), false);
});

test('U227-07: "What\'s going on here, Kael?" does not bounce', () => {
  assert.equal(bounces("What's going on here, Kael?"), false);
});

// ── Negatives — genuine person-referents to ABSENT names must STILL clarify ───

test('U227-10: "I ask Thad about the founding" (Thad absent) still clarifies (address-verb signal)', () => {
  assert.equal(bounces('I ask Thad about the founding.'), true);
});

test('U227-11: a REAL possessive of an absent name still clarifies ("Garrett\'s brother sent me")', () => {
  // Proves the "\'s" arm was narrowed to copula function words only — a real
  // possessive of a plausible person name still produces the signal.
  assert.equal(bounces("Garrett's brother sent me to find him."), true);
});

// ── Regression — a present named NPC routes normally, never a clarify menu ────

test('U227-12: "I ask Kael about the founding" (Kael present) does not bounce', () => {
  assert.equal(bounces('I ask Kael about the founding.'), false);
});

test('U227-13: "Tell Brae that Corwin is lying" keeps both present NPCs (no bounce)', () => {
  assert.equal(bounces('Tell Brae that Corwin is lying.'), false);
});
