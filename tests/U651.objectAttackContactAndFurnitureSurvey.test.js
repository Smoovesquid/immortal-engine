// U651 — DM-GATE-1a-R2: furniture cannot dodge, and visible furniture queries
// must be answered from room truth, never as hidden-search rolls.

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

const MISS_WORDS = /\b(?:miss|misses|missed|skids?\s+off|glances?\s+off|whiffs?|fails?\s+to\s+(?:hit|connect))\b/i;
const CONTACT_WORDS = /\b(?:bites?|strikes?|rings?\s+against|catches?|lands?|takes?\s+the\s+blow|shudders?)\b/i;

test('U651-01: a resisted furniture attack still connects physically; failure means no meaningful damage, not a miss', () => {
  const r = playerMove(boot(), PACKS, 'I attack the iron-bound chest with my Worn Blade.');
  const narration = String(r.output?.narration || '');
  const mechanics = String(r.output?.mechanics || '');

  assert.equal(r.world.combat?.active ?? false, false, 'furniture attacks never start combat');
  assert.match(mechanics, /approach:force/i, 'still resolves through the object/force path');
  assert.doesNotMatch(mechanics, /stake:harm|wounds/i, 'never becomes the generic player-wounding floor');
  assert.match(narration, /iron-bound chest/i, 'names the furniture target');
  assert.doesNotMatch(narration, MISS_WORDS, 'furniture cannot dodge; narration must not read as a miss');
  assert.match(narration, CONTACT_WORDS, 'resisted outcome must still describe physical contact');
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
