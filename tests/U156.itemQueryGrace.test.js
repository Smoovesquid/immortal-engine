import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Opus gate (2026-06-16): now that the PC has a real loadout, "what does the
// Tonic of grit do?" / "is it in my pack?" were dodged (room survey, trivial
// success, unrelated roll). Grace now answers from the real pack — honestly, and
// only for actual carried items (non-item "what does X do" falls through).

function escWorld(seed = 'glass-harbor') {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
}

test('U156: "what does <carried item> do" is answered from canon, not dodged', () => {
  const w = escWorld();
  const ans = handleMetaQuestion('what does the Tonic of grit do?', w);
  assert.ok(ans, 'answered');
  assert.match(ans, /tonic of grit/i);
});

test('U156: "is <item> in my pack" gives a real yes', () => {
  const w = escWorld();
  assert.match(handleMetaQuestion('is the Tonic of grit in my pack?', w), /yes/i);
});

test('U156: a non-item "what does X do" falls through (not a meta-question route)', () => {
  // "what do you have for sale" is TRADE, "what do I do now" is open — neither is
  // an item query.
  assert.equal(isMetaQuestion('what do you have for sale?'), false);
  assert.equal(isMetaQuestion('what do I do now?'), false);
});

test('U156: an item query for a thing NOT carried falls through (null)', () => {
  const w = escWorld();
  // the PC doesn't carry a "magic wand"; grace returns null → normal resolution
  assert.equal(handleMetaQuestion('what does the magic wand do?', w), null);
});
