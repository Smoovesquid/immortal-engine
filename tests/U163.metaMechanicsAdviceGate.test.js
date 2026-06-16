import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Opus gate (2026-06-16, Rules Lawyer DM / Confused newbie): two meta-question
// classes got rolled or deadended instead of answered:
//   1. "How do you resolve a sword swing — pure narration, or a dice mechanic?"
//      got `[roll:17 vs DC:13 ...]` — a roll generated for a question about HOW
//      the game works, not an in-fiction action.
//   2. "Should I go talk to them, or is that a bad idea?" got "That way is
//      blocked from here" — a navigation deadend for an advice question.
// Root cause for both: the meta-question gate only ran inside active escape
// combat (playloop.js ~line 1706); everywhere else (including mid-dialogue)
// had no meta-question check at all, so these fell into the generic roll/move
// resolver. Fixed by adding META_MECHANICS / META_ADVICE patterns plus an
// out-of-combat meta-question gate near the top of playerMoveCore.

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

function world(seed = 'stonewatch-hollow') {
  return beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), packs()).world;
}

test('U163: "how do you resolve a sword swing" is a mechanics question, not a roll', () => {
  const text = 'So the game has no stats at all? Then how do you resolve a sword swing — pure narration, or is there a dice mechanic I should know?';
  assert.ok(isMetaQuestion(text));
  const ans = handleMetaQuestion(text, world());
  assert.match(ans, /d20/);
});

test('U163: a compound mechanics+stat question answers both halves', () => {
  const w = world();
  w.party[0].stats = { MIGHT: 9, AGILITY: 14, WITS: 8, GRIT: 12, CHARM: 10 };
  const text = 'One die — is that a d20? And what exactly is my Might modifier number right now?';
  assert.ok(isMetaQuestion(text));
  const ans = handleMetaQuestion(text, w);
  assert.match(ans, /d20/);
  assert.match(ans, /MIGHT is 9, a -1 modifier/);
});

test('U163: "should I talk to them" is advice, never a navigation deadend', () => {
  const text = 'Should I go talk to them, or is that a bad idea?';
  assert.ok(isMetaQuestion(text));
  const ans = handleMetaQuestion(text, world());
  assert.ok(ans && ans.length > 0);
  assert.doesNotMatch(ans, /blocked/i);
});

test('U163: playerMove answers a mechanics question out of combat with no roll mechanics', () => {
  const w = world();
  const { output } = playerMove(w, packs(), 'Is there a dice mechanic I should know about?');
  assert.doesNotMatch(output.mechanics || '', /roll:/);
  assert.match(output.narration, /d20/);
});

test('U163: "give me the number, what is my Might modifier" answers from canon, never lets the narrator invent it', () => {
  // Opus gate: the DM said "minus three" while mechanics showed stat:WITS-1 —
  // an LLM-invented number, because this fell into a generic roll instead of
  // the grace layer. Same root cause/fix as the mechanics/advice cases above.
  const w = world();
  w.party[0].stats = { MIGHT: 5, AGILITY: 14, WITS: 8, GRIT: 12, CHARM: 10 };
  const { output } = playerMove(w, packs(), 'Senna just told me Might is at a penalty — so give me the number. What is my Might modifier, plus or minus?');
  assert.match(output.narration, /MIGHT is 5, a -3 modifier/);
  assert.doesNotMatch(output.mechanics || '', /roll:/);
});

test('U163: mid-dialogue, the same phrase is left to askNpc (G10 lore questions are not meta)', () => {
  // The gate is scoped to OUT of dialogue on purpose: "what happened with X"
  // is exactly the shape of a real in-fiction question for an NPC (G10), so
  // dialogue must keep routing through askNpc rather than the meta layer.
  let w = world();
  const node = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId);
  const npc = node?.settlement?.npcs?.[0];
  assert.ok(npc, 'fixture needs an NPC at the current node');
  w = { ...w, scene: { ...w.scene, dialogue: { npcId: npc.id, turnsInDialogue: 1, topicsCount: 0 } } };
  const { output } = playerMove(w, packs(), 'What happened here?');
  assert.doesNotMatch(output.mechanics || '', /roll:/);
});
