// U673 — DM-GATE-1e R3: a no-record answer is a GROUNDED DECLINE — it says what
// kind of record exists or doesn't, never a presence survey and never the
// validator's inert "The room is quiet." (Opus re-gate 2026-07-09, lore-hound:
// the record-keeping question died in the quiet room; the deterministic floor
// answered with a presence survey — both are the same root: the no-record path
// doesn't decline in fiction).
//
// Tim's wording rule (2026-07-09): plain and non-cute — state what record does
// or does not exist. Control: B4's artifact-grounded authorship is untouched.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

function boot() {
  return beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

const MISS_SHAPES = /the room is quiet|you'?re inside wayfarers|no one else is in the room|the way out leads/i;

test('U673: the record-keeping question gets a grounded decline that names the record-kind', () => {
  const w = boot();
  const r = playerMove(w, PACKS, 'So the outpost keeps records of events but not people? Who did the repair work here?');
  const narr = String(r.output?.narration || '');

  assert.doesNotMatch(narr, MISS_SHAPES, 'not a presence survey, not a quiet room');
  assert.match(narr, /record|written|writes|paper|ledger|kept|keeps/i,
    `the decline says what kind of record does or does not exist (got: ${narr.slice(0, 160)})`);
  assert.match(String(r.output?.mechanics || ''), /no roll|no-record|grounded/i,
    'an honest observe-only turn');
});

test('U673: a pressed who-did-it with no grounded fact still declines in fiction, never surveys', () => {
  let w = boot();
  w = playerMove(w, PACKS, 'Who did the repair work on this cottage?').world;
  const r = playerMove(w, PACKS, 'Someone repaired it — you conceded the work happened. So who did it?');
  const narr = String(r.output?.narration || '');
  assert.doesNotMatch(narr, MISS_SHAPES);
  assert.doesNotMatch(narr, /doorways lead|shuttered window/i, 'no room re-description as an answer');
});

test('U673: control — the artifact-grounded authorship answer (B4) is untouched', () => {
  let w = boot();
  w = playerMove(w, PACKS, 'I open the iron-bound chest.').world;
  w = playerMove(w, PACKS, 'I read the letter.').world;
  const r = playerMove(w, PACKS, 'Who wrote this letter?');
  assert.match(String(r.output?.narration || ''), /unsigned|no name|never signed/i);
});
