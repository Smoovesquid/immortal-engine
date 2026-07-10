// U679 — OBJ-PRESENCE-1: "Where's the barrel?" answers from ROOM-OBJECT
// state when the noun names furniture — never "you're not carrying any
// barrel" (Tim's scope correction, 2026-07-10: leaving this phrasing as a
// documented known-failure is the same player-trust loop as the NPC-miss).
//
// Root: answerObjectLocation (gracefulAdjudication.js, reached via the
// META_OBJECT_LOCATION guard) checks ONLY carried items (gatherCarriedItems)
// and — on a miss — unconditionally assumes the player invented the item.
// It never consults objectsHere at all. All three live states covered:
// intact / wrecked / never-carried-and-not-in-the-room.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));
const INVENTED_MISS_RE = /you'?re not carrying any/i;

function bootAuthored() {
  return beginAdventure(newWorld({ seed: 'loaderDemo', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

test('U679: "where\'s the barrel?" on an INTACT placed barrel answers from the room, not "not carrying"', () => {
  const w = bootAuthored();
  const r = playerMove(w, PACKS, "Where's the barrel?");
  const narr = String(r.output?.narration || '');
  assert.doesNotMatch(narr, INVENTED_MISS_RE, `must not treat a real room object as invented — got: ${narr}`);
  assert.match(narr, /barrel/i, 'names the barrel');
  assert.match(narr, /room|here|coopered oak/i, 'places it in the room, grounded in its real notes');
});

test('U679: "where\'s the barrel?" after full salvage-removal gives an honest absence, not the NPC or the invented-item line', () => {
  let w = bootAuthored();
  w = playerMove(w, PACKS, 'I smash the barrel.').world; // salvage lane: fully removed from node.furniture
  const r = playerMove(w, PACKS, "Where's the barrel?");
  const narr = String(r.output?.narration || '');
  assert.doesNotMatch(narr, INVENTED_MISS_RE, 'a barrel that plausibly existed is not the same as an invented one');
  assert.doesNotMatch(narr, /haven'?t gone anywhere/i, 'not the NPC-presence miss either');
});

test('U679: control — "where\'s Elske?" (a real NPC-shaped where-question) is completely untouched', () => {
  let w = bootAuthored();
  w = playerMove(w, PACKS, 'I go outside.').world;
  const r = playerMove(w, PACKS, "Where's Elske Nightherd?");
  // Whatever this resolves to, it must NOT be the room-furniture branch's
  // vocabulary ("wreckage", "coopered oak") — the gate must reject non-FURN nouns.
  assert.doesNotMatch(String(r.output?.narration || ''), /wreckage|coopered oak|iron-hooped/i);
});

test('U679: control — a genuinely invented item still gets the honest "not carrying" decline', () => {
  const w = bootAuthored();
  const r = playerMove(w, PACKS, "Where's my grappling hook?");
  assert.match(String(r.output?.narration || ''), INVENTED_MISS_RE,
    'a noun matching NO furniture vocabulary and NO carried item stays an honest invented-item decline');
});
