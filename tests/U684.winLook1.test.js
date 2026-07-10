// U684 — WIN-LOOK-1: "look through/out the window" reaches the real window
// handler, never a room survey.
//
// Root A: windowVerbKind's shutter-open/close verb+object patterns now tolerate
// a narrow engine-vocabulary adjective between the article and the noun ("open
// THE SHUTTERED window") — the exact-adjacency regex used to fall an explicitly
// declared open action past the window handler to the generic trivial-action
// floor (confirmed empirically: direct playerMove() on the verbatim gate text
// returned "You do so without difficulty." pre-fix).
//
// Root B: a declared OPEN bundled with a look/see-outside cue in the same
// breath ("open the window to look outside — what do I see?") is now ONE
// compound action — open (if needed), then answer the view — never just the
// open half and never a "shutters are closed" decline for a window the player
// is opening in the same utterance.
//
// Outer-gate guard: detectWindowActionIntent (engine/playloop.js) mirrors
// DM-GATE-1a's detectObjectAttackIntent — guards public/v1.js and
// scripts/dm-playtest.mjs's pre-playerMove meta gate so a declared window
// action is never answered as a room survey by isMetaQuestion's unanchored
// META_LOCATION match before playerMove ever runs. Reproduced against the
// EXACT failing gate turn: docs/playtests/gate-runs/gate-2026-07-10T14-53-34-501Z-v1.jsonl,
// persona rules-lawyer, seed tallow, t3.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove, carriesInteriorMovementIntent, detectObjectAttackIntent, detectWindowActionIntent } from '../engine/playloop.js';
import { isMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest } from '../engine/rulesets.js';
import { roomWindows } from '../engine/structures/roomWindows.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

// Same seed/mode/interior as the actual gate transcript: tallow, escape mode,
// fantasy pack — the Bedchamber this seed derives has 2 windows, shuttered by
// default (matches the gate's "two shuttered windows" room description).
function bootTallowBedchamber() {
  return beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

// Mirrors the outer meta-gate check in public/v1.js:745 / scripts/dm-playtest.mjs:235
// exactly, so a red/green result here is proof about the LIVE/HARNESS path, not
// just playloop.js's own internals.
function outerGateSwallows(world, text) {
  return isMetaQuestion(text) && !carriesInteriorMovementIntent(world, text) && !detectObjectAttackIntent(world, text) && !detectWindowActionIntent(world, text);
}

const SURVEY_FLOOR_RE = /Here:.*Doorways lead|stand still and read|ways lead off/i;

test('U684 Root A: "I open the shuttered window." reaches the real shutter-open lane (adjective tolerance)', () => {
  const w = bootTallowBedchamber();
  assert.equal(roomWindows(w, w.scene.interior).shuttered, true, 'fixture sanity: starts shuttered');
  const r = playerMove(w, PACKS, 'I open the shuttered window.');
  assert.equal(r.output?.mechanics, '[window:shutter-open]');
  assert.match(String(r.output?.narration || ''), /throw the shutters open/i);
  assert.equal(roomWindows(r.world, r.world.scene.interior).shuttered, false, 'canon shutter state actually flips');
});

test('U684 Root A: "I close the barred shutters." reaches the real shutter-close lane (symmetric adjective tolerance)', () => {
  let w = bootTallowBedchamber();
  w = playerMove(w, PACKS, 'I open the window.').world; // start open so close is meaningful
  const r = playerMove(w, PACKS, 'I close the barred shutters.');
  assert.equal(r.output?.mechanics, '[window:shutter-close]');
  assert.equal(roomWindows(r.world, r.world.scene.interior).shuttered, true);
});

test('U684 Root B: "I open the window to look outside — what do I see?" opens AND answers the view in one turn', () => {
  const w = bootTallowBedchamber();
  const r = playerMove(w, PACKS, 'I open the window to look outside — what do I see?');
  assert.match(String(r.output?.narration || ''), /throw the shutters open/i, 'the open half must actually happen');
  assert.match(String(r.output?.narration || ''), /Through the window:/i, 'the view half must actually answer');
  assert.doesNotMatch(String(r.output?.narration || ''), /shutters are closed/i, 'must never decline a window the player just opened');
  assert.equal(roomWindows(r.world, r.world.scene.interior).shuttered, false);
});

test('U684 verbatim gate turn: "I pocket the cord and open the shuttered window to look outside — what do I see?" (Root A + Root B combined)', () => {
  const w = bootTallowBedchamber();
  const text = 'I pocket the cord and open the shuttered window to look outside — what do I see?';
  const r = playerMove(w, PACKS, text);
  const narr = String(r.output?.narration || '');
  assert.doesNotMatch(narr, SURVEY_FLOOR_RE, `must not fall to the generic room-survey floor — got: ${narr}`);
  assert.match(narr, /throw the shutters open/i, `must actually open — got: ${narr}`);
  assert.match(narr, /Through the window:/i, `must actually answer the view — got: ${narr}`);
});

test('U684 outer-gate/harness guard: the verbatim gate turn no longer routes to meta (mirrors public/v1.js + scripts/dm-playtest.mjs)', () => {
  const w = bootTallowBedchamber();
  const text = 'I pocket the cord and open the shuttered window to look outside — what do I see?';
  assert.equal(isMetaQuestion(text), true, 'isMetaQuestion itself is UNTOUCHED — still matches "what do I see"');
  assert.equal(detectWindowActionIntent(w, text), true, 'the new detector recognizes the declared window action');
  assert.equal(outerGateSwallows(w, text), false, 'the combined outer-gate condition must now be false — the turn reaches playerMove');
});

test('U684 control: a bare room look-around with NO window mention is untouched — still a real survey', () => {
  const w = bootTallowBedchamber();
  const text = 'What do I see?';
  assert.equal(detectWindowActionIntent(w, text), false, 'no window/shutters word present — never a window action');
  assert.equal(outerGateSwallows(w, text), true, 'a bare look-around still routes to the meta survey, unchanged');
});

test('U684 control: "I open the window." alone (no look cue) still gives the plain shutter-open narration, not the compound', () => {
  const w = bootTallowBedchamber();
  const r = playerMove(w, PACKS, 'I open the window.');
  assert.equal(r.output?.mechanics, '[window:shutter-open]');
  assert.doesNotMatch(String(r.output?.narration || ''), /Through the window:/i, 'a plain open must not also narrate the view');
});

test('U684 control: looking through an ALREADY-OPEN window still gives the plain look narration', () => {
  let w = bootTallowBedchamber();
  w = playerMove(w, PACKS, 'I open the window.').world;
  const r = playerMove(w, PACKS, 'I look out the window.');
  assert.equal(r.output?.mechanics, '');
  assert.match(String(r.output?.narration || ''), /Through the window:/i);
  assert.doesNotMatch(String(r.output?.narration || ''), /throw the shutters open/i, 'a plain look on an already-open window must not re-open it');
});

test('U684 control: "Wait, you didn\'t answer — what do I see outside through it?" is explicitly OUT of scope (Tim: queue separately, do not fix here)', () => {
  const w = bootTallowBedchamber();
  const text = "Wait, you didn't answer — I opened the window. What do I see outside through it?";
  // Documents CURRENT (unfixed) behavior on purpose — this phrasing has no
  // adjacent open-cue+window match, so detectWindowActionIntent stays false
  // and the outer gate still swallows it. If this assertion ever flips because
  // someone fixes it elsewhere, that's good news — update the test.
  assert.equal(detectWindowActionIntent(w, text), false, 'not fixed here — separate finding per Tim\'s scope call');
});
