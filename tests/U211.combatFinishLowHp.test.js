import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld, ensureWorld } from '../engine/state.js';
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

const packs = loadPacks();

function worldWithLowHpFoe(seed, { name = 'Corwin', hp = 2 } = {}) {
  let w = beginAdventure(newWorld({
    seed,
    fate: 0.3,
    mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), packs).world;
  const enemy = mintEnemyFromNpc({
    id: `npc_${name.toLowerCase()}`,
    name,
    hostile: true,
    combatProfile: { maxHp: 20, damage: 1, ac: 1, canParley: false }
  });
  w = beginCombat(w, { enemies: [enemy], reason: 'test' });
  w = applyDeltas(w, [{
    op: 'combatState',
    set: {
      round: 2,
      enemies: [{
        ...w.combat.enemies[0],
        hp,
        maxHp: 20,
        ac: 1,
        damage: 1,
        defeated: false
      }]
    }
  }]);
  return ensureWorld(w);
}

function assertFinishingStrike(input, opts = {}) {
  const w = worldWithLowHpFoe(opts.seed, opts);
  const before = w.combat.enemies[0];
  const result = playerMove(w, packs, input);
  const mech = String(result.output.mechanics || '');
  const after = result.world.combat?.enemies?.find(e => e.name === before.name);

  assert.doesNotMatch(mech, /combat:table-talk/, `finishing blow must not table-talk: ${mech}`);
  assert.match(mech, /strike:.*atk:-?\d+ vs AC:\d+/, `finishing blow must roll a strike: ${mech}`);
  assert.match(mech, /\|\s*\d+\s*dmg/, `finishing blow must surface damage: ${mech}`);
  assert.ok(after, 'enemy remains inspectable in combat state after the turn');
  assert.ok(Number(after.hp) < Number(before.hp), `enemy HP should drop: ${before.hp} -> ${after.hp}`);
  assert.equal(after.hp, 0, `lethal finishing blow should zero enemy HP: ${JSON.stringify(after)}`);
  assert.equal(after.defeated, true, `lethal finishing blow should mark defeated: ${JSON.stringify(after)}`);
  assert.match(mech, /combat:victory/, `lethal finishing blow should end combat: ${mech}`);
}

test('U211: "bury my blade in his throat" resolves as a lethal strike, not table-talk', () => {
  assertFinishingStrike('I spin and bury my blade in his throat to finish him.', {
    seed: 'u211-bury',
    hp: 1
  });
});

test('U211: "ram my blade up under his jaw" resolves as a lethal strike, not table-talk', () => {
  assertFinishingStrike('I ram my blade up under his jaw.', {
    seed: 'u211-ram',
    hp: 1
  });
});

test('U211: "stomp on his skull" resolves as a lethal strike, not table-talk', () => {
  assertFinishingStrike("I let go of his collar and stomp on his skull while he's down.", {
    seed: 'u211-stomp',
    name: 'Brokefang',
    hp: 1
  });
});

test('U211: true non-action in active combat remains table-talk', () => {
  const w = worldWithLowHpFoe('u211-non-action', { hp: 2 });
  const beforeHp = w.meta.escapeHp;
  const beforeRound = w.combat.round;
  const result = playerMove(w, packs, "what's his name?");

  assert.match(String(result.output.mechanics || ''), /combat:table-talk/);
  assert.equal(result.world.meta.escapeHp, beforeHp, 'question costs no HP');
  assert.equal(result.world.combat.round, beforeRound, 'question does not advance the round');
});
