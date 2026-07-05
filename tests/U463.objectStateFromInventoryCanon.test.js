// U463 — ANS-2 (case 4): an object-STATE question ("Wait, where did the letter
// go? I was just holding it.") answers from INVENTORY canon — if the item is
// carried, say so; if the player never had it (the confused newbie invented it),
// an honest grounded correction — NEVER a deflection to unrelated NPC presence.
// Two components: isQuestionShaped() broadens to catch a leading interjection +
// comma before the interrogative; and object-location questions resolve from the
// sheet. The broadening must NOT over-trigger: "Wait, I pick it up" still ACTS.
//
// Opus gate 2026-07-04-3, Confused newbie: "Wait, where did the letter go? I was
// just holding it." → "Still here — Elske Nightherd and Dalla haven't gone
// anywhere." (the letter question ignored, deflected to NPC presence). The letter
// exists NOWHERE in canon for this seed — the newbie invented it. (INT-4-HELD's
// U459-05 flagged this as a separate seam; this is its resolution.)
//
// Deterministic, LLM-off: ×2 identical boots resolve identically.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { isQuestionShaped } from '../engine/grace/gracefulAdjudication.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const run = (text) => playerMove(boot(), PACKS, text).output;

// A deflection = the answer talks about who's present instead of the object.
const NPC_PRESENCE_DEFLECT_RE = /haven't gone anywhere|still here.*(?:elske|dalla)|if you want to speak/i;

test('U463: precondition — no "letter" exists anywhere in canon for this seed (the newbie invented it)', () => {
  const w = boot();
  assert.doesNotMatch(JSON.stringify(w), /letter/i, 'canon holds no letter (inventory, room, furniture)');
});

test('U463-01: the gate line "Wait, where did the letter go? I was just holding it." gives an honest grounded correction — no NPC deflection', () => {
  const out = run('Wait, where did the letter go? I was just holding it.');
  const narr = String(out.narration);
  assert.doesNotMatch(narr, NPC_PRESENCE_DEFLECT_RE, 'never deflects to who is present');
  assert.match(narr, /not carrying any letter|no letter|nothing like that/i, 'honestly corrects — you never had a letter');
});

test('U463-02: isQuestionShaped broadens to catch a leading interjection + comma before an interrogative', () => {
  assert.equal(isQuestionShaped('Wait, where did the letter go? I was just holding it.'), true, 'leading "Wait," + WH is question-shaped');
  assert.equal(isQuestionShaped('Hold on, who is that?'), true);
  assert.equal(isQuestionShaped('Oh, what is this place?'), true);
});

test('U463-03: OVER-TRIGGER guard — "Wait, I pick it up" is NOT question-shaped (a statement still ACTS)', () => {
  assert.equal(isQuestionShaped('Wait, I pick it up'), false, 'an interjection + a bare action clause is not a question');
  assert.equal(isQuestionShaped('Wait, I pick up the letter.'), false);
  // End-to-end: the statement resolves as an action (a take), not an object-state Q&A.
  const out = run('Wait, I pick up the worn blade.');
  assert.doesNotMatch(String(out.narration), /not carrying any/i, 'a declared action is not answered as an object-state question');
});

test('U463-04: an object-location question for a REALLY-carried item reports it is on you (from canon)', () => {
  const out = run('where did my worn blade go?');
  assert.match(String(out.narration), /worn blade/i, 'names the item');
  assert.match(String(out.narration), /on you|in your pack|where it's always been|nothing.*missing/i, 'reports it is still carried');
  assert.doesNotMatch(String(out.narration), NPC_PRESENCE_DEFLECT_RE, 'never an NPC deflection');
});

test('U463-05: a PERSON "where did the guard go?" still routes to NPC presence, not inventory', () => {
  const out = run('where did the guard go?');
  // The person-referent guard keeps this on the presence path (an object-state
  // answer would be wrong here).
  assert.doesNotMatch(String(out.narration), /not carrying any guard/i, 'a person is not looked up in inventory');
});

test('U463-06: deterministic ×2 — the object-state correction is byte-identical on repeat boots (LLM-off)', () => {
  const a = run('Wait, where did the letter go? I was just holding it.');
  const b = run('Wait, where did the letter go? I was just holding it.');
  assert.equal(String(a.narration), String(b.narration), 'identical narration on replay');
});
