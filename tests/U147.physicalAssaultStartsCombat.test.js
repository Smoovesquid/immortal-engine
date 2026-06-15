import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Opus gate #1 (2-seed run): the chaos persona's improvised violence — grapples,
// forced-into-harm shoves, blade-to-throat, hostage grabs, thrown people —
// engaged NO combat or contest mechanics (the dominant CRUNCH_INCONSISTENCY
// cluster). Such physical assaults on a present NPC must start real combat;
// non-violent uses of the same verbs (shove PAST, grab a cup, give/throw TO)
// must not.

function world() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  const w = beginAdventure(newWorld({ seed: 'glass-harbor', fate: 0.3, pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const first = String((node?.settlement?.npcs || [])[0]?.name || '').split(' ')[0];
  return { w, byId, first };
}
function combatStarts(text) {
  const { w, byId } = world();
  return playerMove(w, byId, text).world.combat?.active === true;
}

test('U147: grapple/forced/blade/hostage assaults on an NPC start combat', () => {
  const { first } = world();
  for (const t of [
    `I shove ${first} into the burning shelf`,
    `I press my dagger against ${first}'s throat`,
    `I drag ${first} in front of me as a shield`,
    `I throw ${first} into the guards`,
    `I hurl ${first} through the window`,
    `I choke ${first}`,
    `I slam ${first} against the wall`,
  ]) {
    assert.equal(combatStarts(t), true, `should start combat: ${t}`);
  }
});

test('U147: non-violent uses of the same verbs do NOT start combat', () => {
  const { first } = world();
  for (const t of [
    `I shove past ${first}`,
    `I grab a cup from the table`,
    `I give the dagger to ${first}`,
    `I throw a coin to ${first}`,
    `I throw my pack onto the table`,
    `I walk over to ${first}`,
  ]) {
    assert.equal(combatStarts(t), false, `should NOT start combat: ${t}`);
  }
});

test('U147: a physical assault produces tracked combat mechanics (not a bare skill roll)', () => {
  const { w, byId, first } = world();
  const { world: w2, output } = playerMove(w, byId, `I choke ${first}`);
  assert.ok(w2.combat?.active, 'combat active');
  assert.ok((w2.combat.enemies || []).length > 0, 'enemy entity minted');
  assert.match(String(output.mechanics || ''), /combat/);
});
