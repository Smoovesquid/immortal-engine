import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { beginCombat, mintEnemyFromNpc } from '../engine/combat/combatLifecycle.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

function loadPacks() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

function setupCombat(round = 4) {
  const byId = loadPacks();
  let w = beginAdventure(newWorld({
    seed: 'h30-lantern-oil',
    fate: 0.3,
    mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), byId).world;
  const enemy = {
    ...mintEnemyFromNpc({ id: 'npc_lingerer', name: 'Lingerer', hostile: true }),
    hp: 30,
    maxHp: 30,
    ac: 1,
    damage: 1,
    defeated: false
  };
  w = beginCombat(w, { enemies: [enemy], reason: 'test' });
  w = applyDeltas(w, [{
    op: 'combatState',
    set: {
      round,
      enemies: [{ ...w.combat.enemies[0], name: 'Lingerer', hp: 30, maxHp: 30, ac: 1, damage: 1, defeated: false }]
    }
  }]);
  return { w, byId };
}

test('U191: improvised object attack during active combat rolls and applies enemy HP', () => {
  const { w, byId } = setupCombat(4);
  const beforeHp = w.combat.enemies[0].hp;
  const result = playerMove(w, byId, 'I grab the lantern off the wall and smash it against the Lingerer');
  const mech = String(result.output.mechanics || '');
  const after = result.world.combat?.enemies?.find(e => e.name === 'Lingerer');

  assert.doesNotMatch(mech, /combat:table-talk/, `must not table-talk: ${mech}`);
  assert.match(mech, /atk:-?\d+ vs AC:\d+/, `must surface the roll: ${mech}`);
  assert.ok(after && after.hp < beforeHp, `enemy HP should drop: ${beforeHp} -> ${after?.hp}`);
});

test('U191: improvised oil attack plus movement phrase is still a combat action', () => {
  const { w, byId } = setupCombat(4);
  const beforeHp = w.combat.enemies[0].hp;
  const result = playerMove(w, byId, 'I kick the burning oil toward the Lingerer and bolt for the door');
  const mech = String(result.output.mechanics || '');
  const after = result.world.combat?.enemies?.find(e => e.name === 'Lingerer');

  assert.doesNotMatch(mech, /combat:table-talk/, `must not table-talk: ${mech}`);
  assert.match(mech, /atk:-?\d+ vs AC:\d+/, `must surface the roll: ${mech}`);
  assert.ok(after && after.hp < beforeHp, `enemy HP should drop: ${beforeHp} -> ${after?.hp}`);
});

test('U191: genuine in-combat question remains free table-talk', () => {
  const { w, byId } = setupCombat(4);
  const beforeHp = w.meta.escapeHp;
  const beforeRound = w.combat.round;
  const result = playerMove(w, byId, 'what are my options?');

  assert.match(String(result.output.mechanics || ''), /combat:table-talk/);
  assert.equal(result.world.meta.escapeHp, beforeHp, 'question costs no HP');
  assert.equal(result.world.combat.round, beforeRound, 'question does not advance the round');
});

test('U191: bare combat round tag matches the canonical post-turn round', () => {
  const { w, byId } = setupCombat(6);
  const result = playerMove(w, byId, 'take cover');
  const canonRound = result.world.combat?.round;

  assert.equal(canonRound, 7);
  assert.equal(String(result.output.mechanics || ''), `[combat:r${canonRound}]`);
});
