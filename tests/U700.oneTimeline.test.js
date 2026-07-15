// U700 — DENIED-list law 21 (docs/IMMORTAL_INVARIANTS.md): one timeline per world.
//
// Saves suspend and resume; there is never a second copy of a world. The Export/Import
// JSON buttons in v1's dev panel were the last player-reachable path to banking a world
// and reloading it after consequences landed — which voids the entire consequence stack
// (moral physics, reputation, permadeath, rumor collapse). They are removed for good.
//
// exportWorld/importWorld remain in engine/save.js as TEST/HARNESS serialization
// utilities (U30/U41/U57/U61/U127/UX5 use them for round-trip determinism checks).
// This test is the tripwire that keeps them out of the player surface: a source scan
// of public/v1.js, the same class of guard as U384's Node-isms scan.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const v1Src = fs.readFileSync(path.join(__dirname, '..', 'public', 'v1.js'), 'utf8');

test('U700: the player surface has no world export/import (no second-copy path)', () => {
  assert.doesNotMatch(v1Src, /exportWorld/, 'v1.js must not reference exportWorld');
  assert.doesNotMatch(v1Src, /importWorld/, 'v1.js must not reference importWorld');
});

test('U700: the surface persists only through the rolling slot', () => {
  assert.match(v1Src, /saveSlot\(localStorage/, 'the rolling slot save is still wired');
  assert.match(v1Src, /loadSlot\(localStorage/, 'the rolling slot load is still wired');
});
