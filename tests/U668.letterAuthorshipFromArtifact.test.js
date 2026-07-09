// U668 — DM-GATE-1d B4: "who wrote this?" about a held/read letter answers from
// the LETTER ARTIFACT — including the honest "unsigned" — never a database-miss
// voiced through a person (Opus gate 2026-07-07, newbie t7 "The room is quiet";
// on b144 the softened miss voices an NPC shrug: "No record I've ever seen").
//
// Canon: the wake-letter bodies (generateFurniture containerItemText pool) are
// deliberately unsigned fragments — so "unsigned" IS the grounded answer, read
// off the thing in the player's hands, in fiction. An NPC shrugging about
// "records" answers a different question nobody asked.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

function bootWithReadLetter() {
  let w = beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  w = playerMove(w, PACKS, 'I open the iron-bound chest.').world;
  w = playerMove(w, PACKS, 'I read the letter.').world;
  return w;
}

const MISS_SHAPES = /no record i'?ve ever seen|the room is quiet|can'?t say\b/i;

test('U668: the authorship question answers from the letter — unsigned is the canon truth', () => {
  const w = bootWithReadLetter();
  const r = playerMove(w, PACKS, "Okay, so it's back — but there's still no name on it? Who wrote this to me?");
  const narr = String(r.output?.narration || '');

  assert.doesNotMatch(narr, MISS_SHAPES, 'no database-miss, no NPC shrug');
  assert.doesNotMatch(narr, /Elske/i, 'the answer comes from the letter, not a bystander');
  assert.match(narr, /unsigned|no name|no signature|never signed/i,
    `the honest artifact answer (got: ${narr.slice(0, 140)})`);
  assert.match(narr, /letter|hand|page|ink|writ/i, 'the answer is ABOUT the letter as a thing');
});

test('U668: the plainer phrasing lands the same', () => {
  const w = bootWithReadLetter();
  const r = playerMove(w, PACKS, 'Who wrote this letter?');
  const narr = String(r.output?.narration || '');

  assert.doesNotMatch(narr, MISS_SHAPES);
  assert.match(narr, /unsigned|no name|no signature/i);
});

test('U668: an authorship question with NO letter in play still declines gracefully (no invention)', () => {
  const w = beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  const r = playerMove(w, PACKS, 'Who wrote the letter?');
  const narr = String(r.output?.narration || '');
  // Nothing has been found or read: any honest response is fine EXCEPT inventing
  // an author or claiming a letter the scene doesn't ground.
  assert.doesNotMatch(narr, /unsigned/i, 'no letter → no letter-reading answer');
});
