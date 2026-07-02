// N11 — IOM-P3 (WB-Q9): the NPC-voice prompt is grounded in the room's real
// layout, so an NPC in a single-storey building stops offering "guest rooms
// upstairs." sceneFacts (engine's getRoomState, P2) is PUBLIC room context —
// prompt INPUT only — and must not weaken the withheld-mode secret-leak guard
// (llmAdapter.js validateNpcVoiceCandidate scans the OUTPUT for factPhrase).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildNpcVoicePrompt } from '../server/npcVoicePrompt.js';
import { validateNpcVoiceCandidate } from '../engine/llmAdapter.js';

const sceneFacts = {
  inside: true,
  buildingType: 'cottage',
  roomCount: 1,
  singleStorey: true,
  roomName: 'main room',
  doorways: ['front door'],
  objects: ['hearth', 'table', 'stool']
};

test('N11-01: buildNpcVoicePrompt renders the WHERE-YOU-ARE facts block', () => {
  const prompt = buildNpcVoicePrompt({
    npcName: 'Wren',
    role: 'tallow-maker',
    mood: 'even',
    manner: 'even',
    mode: 'shared',
    factPhrase: 'the well',
    playerLine: 'is there a room upstairs?',
    sceneFacts
  });

  assert.ok(prompt, 'prompt is generated');
  assert.match(prompt, /WHERE YOU ARE/, 'facts block header present');
  assert.match(prompt, /cottage/, 'building type in prompt');
  assert.match(prompt, /Rooms in this building: 1/, 'room count in prompt');
  assert.match(prompt, /SINGLE-STOREY/, 'single-storey called out');
  assert.match(prompt, /main room/, 'room name in prompt');
  assert.match(prompt, /front door/, 'doorway in prompt');
  assert.match(prompt, /hearth/, 'real object name in prompt');
  assert.match(prompt, /table/, 'second real object name in prompt');
  assert.match(prompt, /do not invent rooms, floors, or exits/, 'grounding rule present');
});

test('N11-02: outdoors (inside:false) or missing sceneFacts renders no facts block', () => {
  const outdoors = buildNpcVoicePrompt({
    npcName: 'Wren', role: 'tallow-maker', manner: 'even', mode: 'deflected',
    playerLine: 'any news?', sceneFacts: { inside: false }
  });
  assert.ok(outdoors, 'prompt still generated outdoors');
  assert.ok(!/WHERE YOU ARE/.test(outdoors), 'no facts block outdoors');

  const missing = buildNpcVoicePrompt({
    npcName: 'Wren', role: 'tallow-maker', manner: 'even', mode: 'deflected',
    playerLine: 'any news?'
  });
  assert.ok(missing, 'prompt still generated with no sceneFacts');
  assert.ok(!/WHERE YOU ARE/.test(missing), 'no facts block when sceneFacts absent');
});

test('N11-03: manner/decision wording is untouched by the facts block', () => {
  const prompt = buildNpcVoicePrompt({
    npcName: 'Wren', role: 'tallow-maker', mood: 'wary', manner: 'blunt',
    mode: 'withheld', playerLine: 'what are you hiding?', sceneFacts
  });
  assert.match(prompt, /WITHHOLD/, 'decision wording intact');
  assert.match(prompt, /BLUNT/, 'manner wording intact');
});

test('N11-04: withheld factPhrase is still caught by the secret-leak guard with sceneFacts present', () => {
  // The guard scans the VOICED OUTPUT for the factPhrase — sceneFacts (public
  // room context) must not be added to the ground set in a way that lets a
  // candidate line smuggle the secret through as a "grounded" term.
  const factPhrase = 'a hidden root cellar';
  const leaky = `Everyone knows about ${factPhrase}, why ask me?`;
  const ok = validateNpcVoiceCandidate(leaky, {
    npcName: 'Wren',
    role: 'tallow-maker',
    factPhrase,
    playerLine: 'what are you hiding?',
    mode: 'withheld'
  });
  assert.equal(ok, false, 'a line containing the withheld factPhrase is rejected');

  const clean = 'I have nothing to say about that.';
  const okClean = validateNpcVoiceCandidate(clean, {
    npcName: 'Wren',
    role: 'tallow-maker',
    factPhrase,
    playerLine: 'what are you hiding?',
    mode: 'withheld'
  });
  assert.equal(okClean, true, 'a clean refusal still passes the guard');
});
