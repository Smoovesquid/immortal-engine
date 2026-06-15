import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Opus gate (2026-06-15) + crotchety-dm #7: a natural-language attack on a
// present NPC ("swing it at Corwin's head") was hand-waved as a trivial
// auto-success KO with no combat, no enemy, no HP. It must start real combat.
// The combat-begin detector failed when an object intervened between the verb
// and the target ("swing IT at X") and when the name shared no substring with
// the ref ("Corwin's head" vs "Corwin Boneknit").

function world() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  const w = beginAdventure(newWorld({ seed: 'glass-harbor', fate: 0.3, pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const npc = (node?.settlement?.npcs || [])[0];
  return { w, byId, npc, first: String(npc?.name || '').split(' ')[0] };
}

function combatStarts(text) {
  const { w, byId } = world();
  return playerMove(w, byId, text).world.combat?.active === true;
}

test('U145: object-mediated attack ("swing it at <Name>\'s head") starts combat', () => {
  const { first } = world();
  assert.equal(combatStarts(`I grab the nearest chair and swing it at ${first}'s head`), true);
});

test('U145: direct attack on a present NPC starts combat', () => {
  const { first } = world();
  assert.equal(combatStarts(`I punch ${first}`), true);
  assert.equal(combatStarts(`I lunge at ${first}`), true);
});

test('U145: swinging an improvised weapon AT an NPC starts combat', () => {
  const { first } = world();
  assert.equal(combatStarts(`I swing the heavy stool at ${first}`), true);
});

test('U145: a friendly "throw a coin to <Name>" does NOT start combat', () => {
  const { first } = world();
  assert.equal(combatStarts(`I throw a coin to ${first}`), false);
});

test('U145: attacking an object does NOT start combat', () => {
  assert.equal(combatStarts('I smash the barrel'), false);
  assert.equal(combatStarts('I swing the door open'), false);
});
