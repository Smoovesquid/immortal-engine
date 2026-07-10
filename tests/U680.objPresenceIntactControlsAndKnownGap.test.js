// U680 — OBJ-PRESENCE-1: intact-object controls (both authored + procgen,
// both fixed phrasings), plus the "is there still a barrel here?" gap this
// packet's OWN seam couldn't reach.
//
// UPDATE (OBJ-PRESENCE-1b, 2026-07-10): that gap is now CLOSED — Tim
// authorized a narrow, separate micro-packet touching ONLY
// engine/playloop.js's objectPresenceTarget regex (never gracefulAdjudication.js).
// The isMetaQuestion assertion below still documents WHY the fix had to live
// in a different file than the rest of OBJ-PRESENCE-1: the meta gate never
// even sees this phrasing, so no gracefulAdjudication.js-only change could
// have reached it. See tests/U683 for OBJ-PRESENCE-1b's own full coverage.

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

test('U680: "is there still a barrel here?" — unreachable from THIS file, but the gap itself is closed (by OBJ-PRESENCE-1b, playloop.js)', () => {
  assert.equal(isMetaQuestion('Is there still a barrel here?'), false,
    'the meta gate never sees this phrasing — confirms the fix correctly lives in playloop.js\'s objectPresenceTarget, not this file');
  const w = bootAuthored();
  const r = playerMove(w, PACKS, 'Is there still a barrel here?');
  // OBJ-PRESENCE-1b landed (playloop.js's objectPresenceTarget now tolerates
  // an inserted "still") — the intact barrel reads plainly present.
  assert.match(String(r.output?.narration || ''), /Yes\s*—\s*there'?s a barrel here/i,
    'fixed by OBJ-PRESENCE-1b — see tests/U683 for full coverage of this phrasing');
});
