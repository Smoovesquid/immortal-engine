import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Opus gate #1 (escape-mode chaos, 1e): unarmed/natural strikes (bite, sweep,
// knee, elbow, "sink my teeth into") got a generic skill roll instead of a fight.
// By SRD these are unarmed strikes / shove-to-prone — attacks. Also guards the
// stopword fix: epithet names ("Brennan the Fox") must not match "the door" via
// the shared token "the".

function world(seed = 'stonewatch-hollow') {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  const first = String(w.map.nodes.find(n => n.id === w.map.currentNodeId).settlement.npcs[0].name).split(' ')[0];
  return { w, byId, first };
}
const combat = (seed, text) => { const { w, byId } = world(seed); return playerMove(w, byId, text).world.combat?.active === true; };

test('U149: unarmed/natural strikes on a present NPC start combat', () => {
  const { first } = world();
  for (const t of [
    `I bite ${first}'s wrist`,
    `I sweep ${first}'s legs out`,
    `I sink my teeth into ${first}'s ankle`,
    `I elbow ${first} in the face`,
    `I knee ${first} in the gut`,
  ]) {
    assert.equal(combat('stonewatch-hollow', t), true, `should start combat: ${t}`);
  }
});

test('U149: benign uses of those verbs do NOT start combat', () => {
  for (const t of ['I kick the door open', 'I sweep the floor', 'I bite into the apple',
    'I trip over the rug', 'I open the chest']) {
    assert.equal(combat('stonewatch-hollow', t), false, `should NOT start combat: ${t}`);
  }
});

test('U149: an epithet NPC ("X the Fox") is not matched by "the" in a benign phrase', () => {
  // stonewatch-hollow has "Brennan the Fox"; "the door" must not resolve to him.
  assert.equal(combat('stonewatch-hollow', 'I kick the door open'), false);
});

test('U149: benign door-kick during active escape combat does not strike the enemy', () => {
  const { w, byId, first } = world('glass-harbor');
  const opened = playerMove(w, byId, `I bite ${first}'s wrist`).world;
  assert.equal(opened.combat?.active, true, 'fixture should already be in escape combat');

  const before = opened.combat.enemies[0];
  const result = playerMove(opened, byId, "I kick the door off its hinges and shout that I'm awake now");
  const after = result.world.combat?.enemies?.[0];

  assert.ok(String(result.output?.narration || '').trim(), 'response should be coherent and non-empty');
  assert.doesNotMatch(String(result.output?.mechanics || ''), /strike:/i, 'door-kick must not emit strike mechanics');
  assert.equal(after?.hp, before.hp, 'door-kick must not damage the enemy');
  assert.equal(Boolean(after?.defeated), Boolean(before.defeated), 'door-kick must not defeat the enemy');
});

test('U149: active-combat stomp does not surface as Worn Blade', () => {
  const { w, byId, first } = world('glass-harbor');
  const opened = playerMove(w, byId, `I bite ${first}'s wrist`).world;
  assert.equal(opened.combat?.active, true, 'fixture should already be in escape combat');

  const result = playerMove(opened, byId, `I stomp my heel down on ${first}'s skull`);
  const mechanics = String(result.output?.mechanics || '');
  const surface = `${result.output?.narration || ''} ${result.output?.combatSummary || ''}`;

  assert.ok(String(result.output?.narration || '').trim(), 'response should be coherent and non-empty');
  assert.match(mechanics, /strike|combat|grapple|attack/i, 'stomp should still resolve through combat');
  assert.doesNotMatch(mechanics, /Worn Blade/i, 'stomp must not surface as a Worn Blade strike');
  assert.doesNotMatch(surface, /worn blade/i, 'stomp narration/summary must not mention Worn Blade');
});
