// U651 — DM-GATE-1b object-strike routing, plus visible furniture queries that
// must be answered from room truth rather than hidden-search rolls.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';
import { objectsHere } from '../engine/structures/roomObjects.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

function boot() {
  return beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

// DM-GATE-1b (OBJ-DURABILITY-1, 2026-07-14) SUPERSEDES DM-GATE-1a-R2 for the resolution:
// a declared furniture attack now resolves against the object's PERSISTENT AC/HP/threshold,
// so a swing legitimately MISSES (goes wide), is ABSORBED (sub-threshold), damages, or
// destroys — the old "furniture cannot dodge, never a miss" ruling no longer holds (the
// four outcomes are proven exhaustively in U697). What still holds and is guarded here: it
// resolves in fiction against the NAMED furniture, never starts combat, never rolls to
// WOUND THE PLAYER, and leaks no raw dice math into the prose.
test('U651-01: a declared furniture attack resolves against the object via the AC/HP path, never wounding the player', () => {
  const r = playerMove(boot(), PACKS, 'I attack the iron-bound chest with my Worn Blade.');
  const narration = String(r.output?.narration || '');
  const mechanics = String(r.output?.mechanics || '');

  assert.equal(r.world.combat?.active ?? false, false, 'furniture attacks never start combat');
  assert.match(mechanics, /object-strike/i, 'resolves through the persistent object-strike path');
  assert.match(mechanics, /vs AC:\d+/i, 'the AC model is in force');
  assert.doesNotMatch(mechanics, /stake:harm|wounds/i, 'never becomes the generic player-wounding floor');
  assert.match(narration, /iron-bound chest/i, 'names the furniture target');
  assert.doesNotMatch(narration, /\bd20\b|\b1d6\b|attack bonus/i, 'no raw dice math leaks into the prose');
});

const FURNITURE_QUERIES = [
  'look for furniture',
  'search for furniture',
  'what furniture is here?',
  'is there furniture here?',
  'enter the bedchamber and look for furniture',
];

test('U651-02: visible furniture queries list room-scoped furniture with no roll', () => {
  for (const text of FURNITURE_QUERIES) {
    const w = boot();
    const here = objectsHere(w).map(o => String(o.piece?.name || '')).filter(Boolean);
    assert.ok(here.includes('iron-bound chest'), 'test precondition: tallow wake room has visible furniture');

    const r = playerMove(w, PACKS, text);
    const narration = String(r.output?.narration || '');
    const mechanics = String(r.output?.mechanics || '');

    assert.doesNotMatch(mechanics, /\[roll:/i, `${text} must be observation, not a search roll`);
    assert.doesNotMatch(narration, /nothing worth the effort|turn up nothing|find a little for your trouble/i, `${text} must not contradict visible furniture`);
    assert.match(narration, /straw pallet|oil lantern|iron-bound chest|stone basin/i, `${text} must name actual room furniture`);
  }
});

test('U651-03: hidden-search phrases still roll', () => {
  for (const text of ['look for hidden compartments', 'search for traps', 'look for tracks']) {
    const r = playerMove(boot(), PACKS, text);
    assert.match(String(r.output?.mechanics || ''), /\[roll:/i, `${text} remains a skill check`);
  }
});
