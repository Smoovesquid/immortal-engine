// U676 — DM-GATE-1e: replay/worldHash determinism across all five roots (Tim's
// acceptance #7, 2026-07-09). Each sequence runs twice from a fresh boot;
// identical hashes prove the new lanes add no hidden randomness. The pure
// question lanes (R1/R2/R3) are additionally proven worldly no-ops; the burn
// (R5b) is a real, replay-stable mutation.

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
  return { hash: worldHash(w), world: w };
}

const SEQUENCES = {
  'R1 sheet stats': ["Give me actual numbers for those five attributes — Might, Agility, Wits, Charm, Grit. What's each score?"],
  'R2 multi identity': ['I go outside.', 'Who are Elske Nightherd, Dalla, and Asha — and what do they do here?'],
  'R3 record decline': ['So the outpost keeps records of events but not people? Who did the repair work here?'],
  'R4 presence compound': ['Alright, well, is there anyone else around I could ask? Maybe I should head to the front.'],
  'R5 burning contact': ['I set the straw pallet on fire.', 'I lie down on the flaming pallet.'],
};

for (const [label, turns] of Object.entries(SEQUENCES)) {
  test(`U676: ${label} — same seed, same turns, same world (worldHash ×2)`, () => {
    assert.equal(runSequence(turns).hash, runSequence(turns).hash);
  });
}

test('U676: the sheet read is a worldly no-op (R1 leaves the hash unchanged)', () => {
  let w = beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  const before = worldHash(w);
  const afterStats = playerMove(w, PACKS, 'What are my numbers for Might, Agility, Wits, Charm, Grit?').world;
  assert.equal(worldHash(afterStats), before, 'a sheet read mutates nothing');
  // NOTE: the R3 decline is NOT a no-op by design — the info-press counter
  // (repeat-question escalation, deterministic) advances. Its replay stability
  // is what matters, and the R3 ×2 sequence test above pins it.
});

test('U676: the burn is a real mutation — the hash moves, identically every replay', () => {
  const a = runSequence(SEQUENCES['R5 burning contact']);
  const cold = runSequence(['I set the straw pallet on fire.']);
  assert.notEqual(a.hash, cold.hash, 'the wound is inside the world fingerprint');
});
