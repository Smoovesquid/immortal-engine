// U682 — OBJ-PRESENCE-1: replay/worldHash determinism (Tim's acceptance #8).
// Every new branch is a pure read over existing stored state (node.furniture)
// — no mutation, no rng, no new field. Same seed + same turns → same hash,
// twice; the presence/location questions themselves are worldly no-ops.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

function runSequence(turns) {
  let w = beginAdventure(newWorld({ seed: 'loaderDemo', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  for (const t of turns) w = playerMove(w, PACKS, t).world;
  return worldHash(w);
}

const SEQUENCES = {
  'smashed + still-here': ['I smash the barrel.', 'Is the barrel still here?'],
  'smashed + wheres': ['I smash the barrel.', "Where's the barrel?"],
  'intact + still-here': ['Is the barrel still here?'],
  'intact + wheres': ["Where's the barrel?"],
};

for (const [label, turns] of Object.entries(SEQUENCES)) {
  test(`U682: ${label} — same seed, same turns, same world (worldHash ×2)`, () => {
    assert.equal(runSequence(turns), runSequence(turns));
  });
}

test('U682: the presence/location QUESTIONS themselves are worldly no-ops', () => {
  let w = beginAdventure(newWorld({ seed: 'loaderDemo', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  w = playerMove(w, PACKS, 'I smash the barrel.').world; // the one real mutation
  const before = worldHash(w);
  const afterStillHere = playerMove(w, PACKS, 'Is the barrel still here?').world;
  assert.equal(worldHash(afterStillHere), before, 'asking "still here?" mutates nothing');
  const afterWheres = playerMove(w, PACKS, "Where's the barrel?").world;
  assert.equal(worldHash(afterWheres), before, 'asking "where\'s?" mutates nothing');
});
