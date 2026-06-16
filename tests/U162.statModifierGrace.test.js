import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Opus gate (2026-06-16): "what's my Might modifier?" got a dice roll, and the
// NPC voice then INVENTED a wrong value ("-3 Might"). Grace now answers a single
// ability score (with its D&D modifier) from canon, and the full stat block
// includes modifiers — so the LLM never has to (and can't) make one up.

function world(seed = 'stonewatch-hollow') {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
}

test('U162: a single ability-score query reports the score + D&D modifier from canon', () => {
  const w = world();
  w.party[0].stats = { MIGHT: 9, AGILITY: 14, WITS: 8, GRIT: 12, CHARM: 10 };
  assert.ok(isMetaQuestion('what is my Might modifier?'));
  assert.match(handleMetaQuestion('what is my Might modifier?', w), /MIGHT is 9, a -1 modifier/);
  assert.match(handleMetaQuestion('my agility mod', w), /AGILITY is 14, a \+2 modifier/);
});

test('U162: the full stat block includes modifiers', () => {
  const w = world();
  w.party[0].stats = { MIGHT: 9, AGILITY: 6, WITS: 8, GRIT: 12, CHARM: 10 };
  const ans = handleMetaQuestion('what are my stats?', w);
  assert.match(ans, /MIGHT 9 \(-1\)/);
  assert.match(ans, /GRIT 12 \(\+1\)/);
});

test('U162: an action is not a stat query', () => {
  assert.equal(isMetaQuestion('I swing my sword'), false);
});
