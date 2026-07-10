// U677 — OBJ-PRESENCE-1: "is the barrel still here?" after smashing does NOT
// answer with NPCs (live b144 receipt, FUNC-MINIS-1 follow-up).
//
// Root: META_NPC_PRESENCE (gracefulAdjudication.js) matches "is (that|this|
// the) \w+ (gone|left|still here/around/there)" — blind to whether \w+ names
// a person or an object. "Is the barrel still here?" satisfies it exactly,
// so the outer meta gate answers "Still here — <NPCs> haven't gone anywhere"
// before playloop's action lane (where the CORRECT object-presence handler,
// objectPresenceTarget, lives) ever runs. Reproduced on BOTH authored
// (FUNC-MINIS-1 placed) and procgen furniture, so the fix must be general.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

const NPC_MISS_RE = /haven'?t gone anywhere|hasn'?t gone anywhere|moved on — the place is empty/i;

function bootAuthored() {
  return beginAdventure(newWorld({ seed: 'loaderDemo', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}
function bootProcgen() {
  return beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

test('U677: a smashed AUTHORED barrel — "is the barrel still here?" never names NPCs', () => {
  let w = bootAuthored();
  w = playerMove(w, PACKS, 'I smash the barrel.').world;
  const r = playerMove(w, PACKS, 'Is the barrel still here?');
  const narr = String(r.output?.narration || '');
  assert.doesNotMatch(narr, NPC_MISS_RE, `must not answer with NPC presence — got: ${narr}`);
  assert.doesNotMatch(narr, /Senna|Jorin|Elske|Dalla/i, 'no NPC name substituted for the object');
});

test('U677: a smashed PROCGEN chest — same phrasing, same law (general, not authored-only)', () => {
  let w = bootProcgen();
  w = playerMove(w, PACKS, 'I smash the iron-bound chest.').world;
  const r = playerMove(w, PACKS, 'Is the chest still here?');
  const narr = String(r.output?.narration || '');
  assert.doesNotMatch(narr, NPC_MISS_RE, `must not answer with NPC presence — got: ${narr}`);
  assert.doesNotMatch(narr, /Elske|Dalla|Ashblade/i, 'no NPC name substituted for the object');
});

test('U677: control — a REAL NPC-presence question is completely untouched', () => {
  let w = bootProcgen();
  w = playerMove(w, PACKS, 'I go outside.').world;
  const r = playerMove(w, PACKS, 'Is the stranger still here?');
  const narr = String(r.output?.narration || '');
  assert.match(narr, NPC_MISS_RE, `a genuine person-presence ask must still answer from the roster — got: ${narr}`);
});
