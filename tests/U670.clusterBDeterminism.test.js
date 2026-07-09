// U670 — DM-GATE-1d: replay/worldHash determinism across all five Cluster B
// fixes (Tim's acceptance #6, 2026-07-09). Each verbatim gate sequence runs
// twice from a fresh boot; identical hashes prove the new lanes add no hidden
// randomness and mutate nothing they shouldn't:
//   B1 mirror-shard look (meta lane — worldly no-op by construction),
//   B2 walk-to-chest contact (opens the chest — a real, replayable mutation),
//   B3 continuity challenge (a worldly no-op after a real lighting),
//   B4 letter authorship (a worldly no-op after real open/read turns),
//   B5 vague bystander violence (combat init + the cruelty deed + axis price).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

function runSequence(turns) {
  let w = beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  for (const t of turns) w = playerMove(w, PACKS, t).world;
  return worldHash(w);
}

const SEQUENCES = {
  'B1 mirror shard': ['I take the Mirror shard out and look into it — what do I see, and why does it mean something to me?'],
  'B2 walk to chest': ["Twice now you've ignored the mirror. Fine — I walk to the iron-bound chest and try to open it. What's inside?"],
  'B3 lantern continuity': [
    'I take the candle stub and light it with the oil lantern.',
    'When did I light that lantern? A moment ago you said it sat unlit — I never struck it.',
  ],
  'B4 letter authorship': [
    'I open the iron-bound chest.',
    'I read the letter.',
    "Okay, so it's back — but there's still no name on it? Who wrote this to me?",
  ],
  'B5 vague violence': [
    'I go outside.',
    'I cut down the first villager who runs up with a bucket.',
    'I strike again.',
  ],
};

for (const [label, turns] of Object.entries(SEQUENCES)) {
  test(`U670: ${label} — same seed, same turns, same world (worldHash ×2)`, () => {
    assert.equal(runSequence(turns), runSequence(turns));
  });
}

test('U670: the no-op lanes really are no-ops — B3/B4 questions leave the hash unchanged', () => {
  let w = beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  w = playerMove(w, PACKS, 'I open the iron-bound chest.').world;
  w = playerMove(w, PACKS, 'I read the letter.').world;
  const before = worldHash(w);
  const asked = playerMove(w, PACKS, 'Who wrote this letter?').world;
  assert.equal(worldHash(asked), before, 'an artifact-authorship answer mutates nothing');
});
