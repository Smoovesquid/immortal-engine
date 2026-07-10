// U681 — OBJ-PRESENCE-1: regression guards. The new room-object defer must
// not perturb the carried-item H-65 precedent, real NPC-presence answers, or
// invented-item declines. Acceptance bar #6/#7.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

function bootAuthored() {
  return beginAdventure(newWorld({ seed: 'loaderDemo', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}
function bootProcgen() {
  return beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

test('U681: carried-item H-65 phrasing ("is X gone or still there") stays untouched — answers from inventory', () => {
  const r = playerMove(bootProcgen(), PACKS, 'Is the Holy water gone or still there?');
  assert.match(String(r.output?.narration || ''), /is in your pack/i);
});

test('U681: "do I still have my lockpicks?" (carried-item presence idiom) stays untouched', () => {
  const w = bootProcgen();
  const r = playerMove(w, PACKS, 'Do I still have my lockpicks?');
  // Whatever lane this resolves through (a search/recall check, per the
  // diagnosis), it must not be hijacked by the new room-object defer.
  assert.doesNotMatch(String(r.output?.narration || ''), /wreckage|coopered oak|banded with rusted iron/i);
});

test('U681: a real NPC "is X still here?" — several present-NPC names — all stay on the roster voice', () => {
  let w = bootProcgen();
  w = playerMove(w, PACKS, 'I go outside.').world;
  for (const name of ['stranger', 'bandit', 'guard']) {
    const r = playerMove(w, PACKS, `Is the ${name} still here?`);
    const narr = String(r.output?.narration || '');
    assert.doesNotMatch(narr, /wreckage|coopered oak|banded with rusted iron/i,
      `"${name}" must never be treated as a furniture noun`);
  }
});

test('U681: "where\'s Corwin?" / "where\'s my friend?" — person-shaped where-questions stay untouched', () => {
  const w = bootAuthored();
  for (const text of ["Where's Corwin?", "Where's my friend?"]) {
    const r = playerMove(w, PACKS, text);
    assert.doesNotMatch(String(r.output?.narration || ''), /wreckage|coopered oak|iron-hooped/i,
      `"${text}" must never resolve through the room-furniture branch`);
  }
});

test('U681: the FURN-vocabulary gate rejects non-furniture nouns outright (no false-positive room-object answers)', () => {
  const w = bootAuthored();
  const r = playerMove(w, PACKS, 'Is the ghost still here?');
  assert.doesNotMatch(String(r.output?.narration || ''), /wreckage|coopered oak|iron-hooked|no ghost here/i,
    '"ghost" matches no FURN label — must fall through to the existing NPC-presence answer unchanged');
});
