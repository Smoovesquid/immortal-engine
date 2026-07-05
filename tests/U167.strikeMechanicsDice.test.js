import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Opus gate follow-up (2026-06-16, Chaos-griefer): a declared in-combat action
// looked like it "resolved with zero dice." Root cause: the escape-combat
// weapon-strike and cantrip branches narrated the attack roll in the prose
// beats but never set the structured mechanics line, so it fell back to the
// bare round marker `[combat:rN]` — no roll surfaced for the judge or player.
// Grapple/parley/spell branches all surfaced their dice; the default strike did
// not. Fix: strike/cantrip now set actionMech with the to-hit and damage.

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

function inCombatWorld() {
  const byId = packs();
  let w = beginAdventure(newWorld({ seed: 'stonewatch-hollow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  // OCC-STORY-1: the wake cottage is now empty of strangers by design — you can't attack "the nearest
  // stranger" in your own bedroom. Step outside, where the townsfolk are, then engage.
  w = playerMove(w, byId, 'I step outside').world;
  const r = playerMove(w, byId, 'I attack the nearest stranger with my hatchet');
  return { world: r.world, byId };
}

test('U167: a weapon strike surfaces its attack roll in the mechanics line', () => {
  const { world, byId } = inCombatWorld();
  assert.ok(world.combat?.active, 'fixture should be in combat');
  const { output } = playerMove(world, byId, 'I strike the wolf with everything I have');
  // No longer the bare round marker — the dice are surfaced.
  assert.doesNotMatch(output.mechanics, /^\[combat:r\d+\]$/);
  assert.match(output.mechanics, /strike:/);
  assert.match(output.mechanics, /atk:-?\d+ vs AC:\d+|swings/);
});

test('U167: an unrecognized in-combat action (defaults to a strike) still surfaces dice', () => {
  const { world, byId } = inCombatWorld();
  const { output } = playerMove(world, byId, 'I slip free of the rope');
  assert.doesNotMatch(output.mechanics, /^\[combat:r\d+\]$/);
  assert.match(output.mechanics, /strike:|atk:|swings/);
});
