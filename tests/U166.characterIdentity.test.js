import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { buildDMSystemPrompt } from '../engine/llmAdapter.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Opus gate follow-up (2026-06-16, Rules Lawyer DM): the DM called the player
// "Garrick" then "Thorn" and dodged when the discrepancy was called out twice.
// Two gaps: (1) "what's my name?" / "you called me X" had no meta-question
// answer, so the call-out fell to a dice roll / fiction dodge; (2) the DM
// system prompt did not pin the PC's canonical name, leaving the narrator free
// to invent one. Fix: META_NAME meta-answer from canon + a name-pin rule in
// buildDMSystemPrompt.

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

function world(seed = 'stonewatch-hollow') {
  return beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), packs()).world;
}

test('U166: "what is my name?" answers from canon', () => {
  const w = world();
  w.party[0].name = 'Thorn';
  assert.ok(isMetaQuestion('What is my name again?'));
  const ans = handleMetaQuestion('What is my name again?', w);
  assert.match(ans, /Thorn/);
});

test('U166: "you called me Garrick" is answered, not rolled', () => {
  const w = world();
  w.party[0].name = 'Thorn';
  const { output } = playerMove(w, packs(), 'Wait — you called me Garrick a moment ago. What is my name?');
  assert.doesNotMatch(output.mechanics || '', /roll:/);
  assert.match(output.narration, /Thorn/);
});

test('U166: the DM system prompt pins the PC name and forbids substitution', () => {
  const prompt = buildDMSystemPrompt({ player: { name: 'Thorn', stats: {}, weapons: [], armor: [] } });
  assert.match(prompt, /player character is named Thorn/);
  assert.match(prompt, /NEVER invent, swap, or use any other name/);
});
