// U680 — OBJ-PRESENCE-1: intact-object controls (both authored + procgen,
// both fixed phrasings) plus an HONEST documentation of the one phrasing
// this packet's seam cannot reach.
//
// "Is there still a barrel here?" is EMPIRICALLY unreachable from
// gracefulAdjudication.js: isMetaQuestion() returns false for it (confirmed
// below), so the outer meta gate never fires and playloop.js's own
// objectPresenceTarget (whose anchored regex doesn't tolerate the inserted
// "still") owns the miss. Per Tim's hard instruction not to touch
// playloop.js without proving the seam wrong and coming back first — this
// test PROVES it, on the record, rather than silently dropping the phrasing.
// Brought back to Tim as its own finding; not fixed in this packet.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { isMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest } from '../engine/rulesets.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

function bootAuthored() {
  return beginAdventure(newWorld({ seed: 'loaderDemo', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}
function bootProcgen() {
  return beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

test('U680: intact AUTHORED barrel — "is the barrel still here?" reads plainly present', () => {
  const r = playerMove(bootAuthored(), PACKS, 'Is the barrel still here?');
  assert.match(String(r.output?.narration || ''), /still here|coopered oak|iron-hooped/i);
  assert.doesNotMatch(String(r.output?.narration || ''), /haven'?t gone anywhere/i, 'never the NPC voice for a real object');
});

test('U680: intact PROCGEN chest — "is the chest still here?" reads plainly present', () => {
  const r = playerMove(bootProcgen(), PACKS, 'Is the chest still here?');
  assert.match(String(r.output?.narration || ''), /still here|banded with rusted iron/i);
  assert.doesNotMatch(String(r.output?.narration || ''), /haven'?t gone anywhere/i);
});

test('U680: control — "is there a barrel around here?" (the already-working phrasing) stays green', () => {
  const r = playerMove(bootAuthored(), PACKS, 'Is there a barrel around here?');
  assert.match(String(r.output?.narration || ''), /Yes\s*—\s*there'?s a barrel here/i);
});

test('U680: KNOWN GAP (documented, not fixed here) — "is there still a barrel here?" is unreachable from gracefulAdjudication.js', () => {
  assert.equal(isMetaQuestion('Is there still a barrel here?'), false,
    'the meta gate never sees this phrasing — confirms the root sits in playloop.js\'s objectPresenceTarget regex, out of this packet\'s owned files');
  const w = bootAuthored();
  const r = playerMove(w, PACKS, 'Is there still a barrel here?');
  // Documents CURRENT (unfixed) behavior — a generic room-survey floor, not
  // an NPC answer and not a correct object answer either. If this assertion
  // ever fails because someone fixed it elsewhere, that's good news — update
  // the test, don't be alarmed.
  assert.doesNotMatch(String(r.output?.narration || ''), /Yes\s*—\s*there'?s a barrel here/i,
    'still unresolved as of this packet — tracked as a separate finding for Tim');
});
