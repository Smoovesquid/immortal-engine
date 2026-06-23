import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { beginCombat, mintEnemyFromNpc } from '../engine/combat/combatLifecycle.js';
import { resolveEscapeCombatTurn } from '../engine/combat/escapeCombat.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

function loadPacks() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

const packs = loadPacks();

function worldWithLowHpFoe(seed, { hp = 1, maxHp = 20, ac = 30, round = 1 } = {}) {
  let w = beginAdventure(newWorld({
    seed,
    fate: 0.3,
    mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), packs).world;
  const enemy = mintEnemyFromNpc({
    id: 'npc_lingerer',
    name: 'Lingerer',
    hostile: true,
    combatProfile: { maxHp, damage: 1, ac, canParley: false }
  });
  w = beginCombat(w, { enemies: [enemy], reason: 'test' });
  w = applyDeltas(w, [{
    op: 'combatState',
    set: {
      round,
      enemies: [{
        ...w.combat.enemies[0],
        name: 'Lingerer',
        hp,
        maxHp,
        ac,
        damage: 1,
        defeated: false
      }]
    }
  }]);
  return ensureWorld(w);
}

function assertDeclaredGrappleDoesNotFlee(input, seed) {
  const w = worldWithLowHpFoe(seed);
  const result = playerMove(w, packs, input);
  const mech = String(result.output.mechanics || '');

  assert.doesNotMatch(mech, /combat:fled/, `declared grapple/control must not become enemy flight: ${mech}`);
  assert.match(mech, /grapple:/, `declared grapple/control should stay on the grapple path: ${mech}`);
  assert.equal(result.world.combat?.active, true, 'the foe should remain in the fight after same-turn grapple resolution');
}

test('U229: tackle-smash intent on a 1-HP foe does not resolve as enemy flee', () => {
  assertDeclaredGrappleDoesNotFlee(
    'I tackle the Lingerer into the nearest produce cart and start smashing his face into the planks.',
    'u229-tackle'
  );
});

test('U229: grab-and-slam intent on a low-HP foe does not resolve as enemy flee', () => {
  assertDeclaredGrappleDoesNotFlee('grab him and slam him down', 'u229-grab-slam');
});

test('U229: low-HP foe can still flee when the player did not declare a grapple/control action', () => {
  const w = worldWithLowHpFoe('u229-morale-still-flees', { round: 4 });
  const result = resolveEscapeCombatTurn(w, 'strike');
  const mech = String(result.result.mechanicsLine || '');

  assert.match(mech, /combat:fled/, `morale flight should remain available: ${mech}`);
  assert.equal(result.world.combat?.active, false, 'fleeing the only foe should end combat');
});
