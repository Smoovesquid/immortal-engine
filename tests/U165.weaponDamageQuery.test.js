import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Opus gate follow-up (2026-06-16, Rules Lawyer DM): weapon damage-die / item
// stat-block queries got in-fiction non-answers instead of the real numbers —
//   "What's the damage on the Hatchet versus the Worn Blade?"
//   "What die does the damage roll use?"
// Distinct from the META_STAT fix (ability-score modifiers). Weapons carry a
// real damage die (inventory.weapons[].damage "1d6", or the kit weapon's
// numeric dmgDie); a player asking for it should get the number, not a dodge.

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

function world(seed = 'stonewatch-hollow') {
  return beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), packs()).world;
}

test('U165: "damage on the Hatchet vs the Worn Blade" is a meta-question, answered with both dice', () => {
  const text = "What's the damage on the Hatchet versus the Worn Blade?";
  assert.ok(isMetaQuestion(text));
  const ans = handleMetaQuestion(text, world());
  assert.match(ans, /Hatchet/);
  assert.match(ans, /Worn Blade/);
  assert.match(ans, /1d6/);
});

test('U165: "what die does the damage roll use" reports the loadout dice', () => {
  const text = 'What die does the damage roll use?';
  assert.ok(isMetaQuestion(text));
  const ans = handleMetaQuestion(text, world());
  assert.match(ans, /1d6/);
});

test('U165: playerMove answers a weapon-damage question with no roll mechanics', () => {
  const w = world();
  const { output } = playerMove(w, packs(), "What's the damage on the Hatchet?");
  assert.doesNotMatch(output.mechanics || '', /roll:/);
  assert.match(output.narration, /1d6/);
});
