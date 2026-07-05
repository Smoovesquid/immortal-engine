import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Combat-not-started gap (2026-06-17 Opus gate): declared attacks on a present
// NPC via throw/hurl + pronoun ("at his face") and grab-by-throat must start
// combat, not fall through to table-talk or a generic skill roll.
//
// Axes covered:
//   1. "throw X at his face" — pronoun+bodypart ref resolved via GENERIC_WORD fix
//   2. "throw X at <name>" — already worked; guard against regression
//   3. "grab <name> by the throat" — detectPhysicalAssault pattern A2
//   4. Negatives: talking / denial phrases must NOT start combat

function world(seed = 'stonewatch-hollow') {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const npc = (node?.settlement?.npcs || [])[0];
  const first = String(npc?.name || '').split(' ')[0];
  return { w, byId, npc, first };
}

const startsC = (seed, text) => {
  const { w, byId } = world(seed);
  return playerMove(w, byId, text).world.combat?.active === true;
};

// OCC-STORY-1: a PRONOUN ref ("his face") resolves to a person in LINE OF SIGHT, and the sleeping
// player's wake cottage is now (correctly) empty of strangers — you can't throw a dagger "at his
// face" in an empty bedroom. So the pronoun-ref cases step the player OUTSIDE first, where the
// townsfolk actually are, giving "his/her" a referent. (Named-target and grab-by-name cases below
// auto-seek the NPC and need no co-location — they still pass unchanged.)
const startsCOutside = (seed, text) => {
  const { w, byId } = world(seed);
  const outside = playerMove(w, byId, 'I step outside').world;
  return playerMove(outside, byId, text).world.combat?.active === true;
};

// ── Throw + pronoun ref ("at his face") ──────────────────────────────────────

test('U171-01: "I throw my dagger at his face" starts combat (pronoun+bodypart ref)', () => {
  // Baseline: before the GENERIC_WORD fix this returned false; after it resolves
  // "his face" to the first present NPC via the generic-person word "his".
  assert.equal(startsCOutside('stonewatch-hollow', 'I throw my dagger at his face'), true,
    '"throw at his face" should start combat');
});

test('U171-02: "I throw my dagger at her head" starts combat (her pronoun)', () => {
  assert.equal(startsCOutside('stonewatch-hollow', 'I throw my dagger at her head'), true,
    '"throw at her head" should start combat');
});

test('U171-03: "I hurl a rock at him" starts combat (bare pronoun)', () => {
  assert.equal(startsCOutside('stonewatch-hollow', 'I hurl a rock at him'), true,
    '"hurl at him" should start combat');
});

// ── Throw + NPC name (regression guard) ──────────────────────────────────────

test('U171-04: "I throw my dagger at <NPC>" starts combat (named target)', () => {
  const { first } = world();
  assert.equal(startsC('stonewatch-hollow', `I throw my dagger at ${first}`), true,
    'throw at named NPC should start combat');
});

// ── Grab by the throat (detectPhysicalAssault pattern A2) ────────────────────

test('U171-05: "I grab <NPC> by the throat" starts combat', () => {
  const { first } = world();
  assert.equal(startsC('stonewatch-hollow', `I grab ${first} by the throat`), true,
    '"grab by the throat" should start combat');
});

test('U171-06: "I grab <NPC> by the collar" starts combat', () => {
  const { first } = world();
  assert.equal(startsC('stonewatch-hollow', `I grab ${first} by the collar`), true,
    '"grab by the collar" should start combat');
});

test('U171-07: "I seize <NPC> by the neck" starts combat', () => {
  const { first } = world();
  assert.equal(startsC('stonewatch-hollow', `I seize ${first} by the neck`), true,
    '"seize by the neck" should start combat');
});

// ── Negatives — must NOT start combat ────────────────────────────────────────

test('U171-10: "talk to <NPC>" does NOT start combat', () => {
  const { first } = world();
  assert.equal(startsC('stonewatch-hollow', `talk to ${first}`), false,
    '"talk to NPC" must not start combat');
});

test("U171-11: \"I don't want to fight\" does NOT start combat", () => {
  assert.equal(startsC('stonewatch-hollow', "I don't want to fight"), false,
    'denial phrase must not start combat');
});

test('U171-12: "I throw a coin to <NPC>" does NOT start combat (friendly throw)', () => {
  const { first } = world();
  assert.equal(startsC('stonewatch-hollow', `I throw a coin to ${first}`), false,
    '"throw a coin to NPC" must not start combat');
});

test('U171-13: "I grab a cup" does NOT start combat (benign grab)', () => {
  assert.equal(startsC('stonewatch-hollow', 'I grab a cup from the shelf'), false,
    '"grab a cup" must not start combat');
});
