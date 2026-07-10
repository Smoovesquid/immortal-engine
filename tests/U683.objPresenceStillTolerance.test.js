// U683 — OBJ-PRESENCE-1b: "Is there STILL a barrel here?" tolerates the
// inserted "still" the same way "Is there a barrel here?" already does.
//
// Root (confirmed empirically in OBJ-PRESENCE-1's own U680, 2026-07-10):
// isMetaQuestion('Is there still a barrel here?') === false — the meta gate
// never sees this phrasing, so gracefulAdjudication.js's fix cannot reach it.
// The miss lives entirely in playloop.js's objectPresenceTarget: its anchor
// `^(?:is|are)\s+there\s+(?:a|an|any|some)\s+NOUN` requires the article
// IMMEDIATELY after "there" — "still" breaks that adjacency, so the turn
// falls past the object-presence check to the generic room-survey floor.
// Same player-trust loop as the NPC-substitution bug OBJ-PRESENCE-1 fixed:
// a smashed/removed object must not read as if the question were never
// about an object at all.
//
// Narrowly scoped: only objectPresenceTarget's regex tolerance changes.
// gracefulAdjudication.js is untouched by this packet.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

function bootAuthored() {
  return beginAdventure(newWorld({ seed: 'loaderDemo', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}
function bootProcgen() {
  return beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

const SURVEY_FLOOR_RE = /stand still and read|ways lead off|no way out shows itself/i;
const NPC_MISS_RE = /haven'?t gone anywhere|hasn'?t gone anywhere/i;

test('U683: "is there still a barrel here?" on a SMASHED authored barrel answers honestly absent — not the survey floor, not NPCs', () => {
  let w = bootAuthored();
  w = playerMove(w, PACKS, 'I smash the barrel.').world;
  const r = playerMove(w, PACKS, 'Is there still a barrel here?');
  const narr = String(r.output?.narration || '');
  assert.doesNotMatch(narr, SURVEY_FLOOR_RE, `must not fall to the generic room-survey floor — got: ${narr}`);
  assert.doesNotMatch(narr, NPC_MISS_RE, 'must not answer with NPC presence');
  assert.match(narr, /no\s+barrel\s+here/i, `must give the honest object-absent answer — got: ${narr}`);
});

test('U683: same phrasing on a smashed PROCGEN chest — general, not authored-only', () => {
  let w = bootProcgen();
  w = playerMove(w, PACKS, 'I smash the iron-bound chest.').world;
  const r = playerMove(w, PACKS, 'Is there still a chest here?');
  const narr = String(r.output?.narration || '');
  assert.doesNotMatch(narr, SURVEY_FLOOR_RE);
  assert.doesNotMatch(narr, NPC_MISS_RE);
  assert.match(narr, /no\s+chest\s+here/i, `got: ${narr}`);
});

test('U683: "is there still a barrel here?" on an INTACT barrel answers plainly present', () => {
  const r = playerMove(bootAuthored(), PACKS, 'Is there still a barrel here?');
  const narr = String(r.output?.narration || '');
  assert.doesNotMatch(narr, SURVEY_FLOOR_RE);
  assert.match(narr, /Yes\s*—\s*there'?s a barrel here/i, `got: ${narr}`);
});

test('U683: control — the ORIGINAL working phrasing ("is there a barrel here?") is byte-behavior-preserved', () => {
  const r = playerMove(bootAuthored(), PACKS, 'Is there a barrel here?');
  assert.match(String(r.output?.narration || ''), /Yes\s*—\s*there'?s a barrel here: coopered oak, iron-hooped\./);
});

test('U683: control — NPC/person presence questions are untouched by this regex change', () => {
  let w = bootProcgen();
  w = playerMove(w, PACKS, 'I go outside.').world;
  const r = playerMove(w, PACKS, 'Is the stranger still here?');
  assert.match(String(r.output?.narration || ''), NPC_MISS_RE, 'a genuine person-presence ask still answers from the roster');
});

test('U683: control — a non-furniture noun ("ghost") behaves IDENTICALLY with or without "still" (parity, not a new gate)', () => {
  // objectPresenceTarget has never gated on a furniture-plausibility
  // vocabulary — ANY noun that survives the regex gets an honest presence
  // answer (its own header: "never invents an object canon doesn't hold").
  // "Is there a ghost here?" (no "still") already says "No — no ghost here"
  // today, pre-this-packet. The fix's job is PARITY: the "still" phrasing
  // must behave exactly the same, not gain a new rejection rule.
  const w = bootAuthored();
  const withStill = playerMove(w, PACKS, 'Is there still a ghost here?');
  const withoutStill = playerMove(w, PACKS, 'Is there a ghost here?');
  assert.equal(String(withStill.output?.narration || ''), String(withoutStill.output?.narration || ''));
  assert.match(String(withStill.output?.narration || ''), /no\s+ghost\s+here/i);
});
