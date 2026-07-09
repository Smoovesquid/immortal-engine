// U665 — DM-GATE-1d B1: a look INTO a carried flavor item answers from the ITEM,
// never with a room survey (Opus gate 2026-07-07, rules-lawyer t2/t3; re-proven
// LLM-off on b144).
//
// "I take the Mirror shard out and look into it — what do I see?" hit META_LOCATION's
// unanchored "what do I see" and dumped the room. The shard is chargen gear with
// authored notes ("Shows you standing somewhere else." — fantasyGear.js) — canon HAS
// the answer. Tim's instruction: this is an OBJECT-REFERENT guard inside the answerer,
// not a loosening of isMetaQuestion — a bare "what do I see?" must still survey.
//
// Router mirrored from scripts/dm-playtest.mjs playTurn (the same outer gate v1 runs).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove, carriesInteriorMovementIntent, detectObjectAttackIntent } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest } from '../engine/rulesets.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

function boot() {
  return beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

function route(w, text) {
  const inCombat = !!w.combat?.active, inDialogue = !!w.scene?.dialogue;
  if (!inCombat && !inDialogue && isMetaQuestion(text) && !carriesInteriorMovementIntent(w, text) && !detectObjectAttackIntent(w, text)) {
    const a = handleMetaQuestion(text, w);
    return { lane: 'META', world: w, narration: String(a?.narration ?? a ?? '') };
  }
  const r = playerMove(w, PACKS, text);
  return { lane: 'ACTION', world: r.world, narration: String(r.output?.narration || '') };
}

const SURVEY_SHAPE = /take the measure|Here: a straw pallet/i;

test('U665: looking into the carried Mirror shard answers from the shard\'s authored notes, not a room dump', () => {
  const w = boot();
  const r = route(w, 'I take the Mirror shard out and look into it — what do I see, and why does it mean something to me?');

  assert.doesNotMatch(r.narration, SURVEY_SHAPE, 'the room survey must not swallow an object look');
  assert.match(r.narration, /shard|somewhere else/i,
    `the answer is about the SHARD (its authored notes ground it) — got: ${r.narration.slice(0, 120)}`);
});

test('U665: the pressed follow-up ("what do I see reflected in it?") also answers from the shard', () => {
  const w = boot();
  const r = route(w, "You dodged my question. I'm holding the Mirror shard up to my face — what do I see reflected in it?");

  assert.doesNotMatch(r.narration, SURVEY_SHAPE);
  assert.match(r.narration, /shard|somewhere else/i);
});

test('U665: no meta loosening — a bare survey still surveys, and isMetaQuestion is untouched', () => {
  const w = boot();
  assert.equal(isMetaQuestion('what do I see?'), true, 'bare look-around stays meta');
  assert.equal(isMetaQuestion('where am I?'), true);

  const r = route(w, 'I look around. What do I see?');
  assert.equal(r.lane, 'META');
  assert.match(r.narration, SURVEY_SHAPE, 'a genuine survey still gets the room');
});
