import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
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

function activeCombat(seed = 'u230-door-egress') {
  let w = beginAdventure(newWorld({
    seed,
    fate: 0.3,
    mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), packs).world;
  const enemy = mintEnemyFromNpc({
    id: 'npc_brokefang',
    name: 'Brokefang',
    hostile: true,
    combatProfile: { maxHp: 20, damage: 1, ac: 30, canParley: false }
  });
  w = beginCombat(w, { enemies: [enemy], reason: 'test' });
  w = applyDeltas(w, [{
    op: 'combatState',
    set: {
      round: 1,
      enemies: [{
        ...w.combat.enemies[0],
        name: 'Brokefang',
        hp: 20,
        maxHp: 20,
        ac: 30,
        damage: 1,
        defeated: false
      }]
    }
  }]);
  return ensureWorld(w);
}

function resolve(input) {
  const w = activeCombat(`u230:${input}`);
  const beforeHp = w.combat.enemies[0].hp;
  const out = resolveEscapeCombatTurn(w, input);
  const afterHp = out.world.combat?.enemies?.[0]?.hp;
  return { mech: String(out.result.mechanicsLine || ''), beforeHp, afterHp };
}

test('U230: kicking the door open is egress, not an improvised-fixture strike', () => {
  const { mech, beforeHp, afterHp } = resolve('I kick the door open and shout for everyone to clear the street.');

  assert.match(mech, /combat:egress/, `door-open should be scene egress: ${mech}`);
  assert.doesNotMatch(mech, /strike:Improvised/i, `door-open must not fabricate an improvised strike: ${mech}`);
  assert.equal(afterHp, beforeHp, 'door egress must not damage the foe');
});

test('U230: bolting through the door is egress, not Fire Bolt or an attack', () => {
  const { mech, beforeHp, afterHp } = resolve('I bolt through the door');

  assert.match(mech, /combat:egress/, `bolt-through-door should be scene egress: ${mech}`);
  assert.doesNotMatch(mech, /cantrip:Fire Bolt|strike:/i, `bolt-through-door must not become an attack: ${mech}`);
  assert.equal(afterHp, beforeHp, 'door egress must not damage the foe');
});

test('U230: directed chair and bottle prop attacks remain improvised strikes', () => {
  for (const input of ['I smash the chair into the bandit', 'I hurl the bottle at him']) {
    const { mech } = resolve(input);
    assert.match(mech, /strike:Improvised (Chair|Bottle)/, `directed prop attack should stay improvised: ${input} -> ${mech}`);
    assert.doesNotMatch(mech, /combat:egress/, `directed prop attack must not become egress: ${input} -> ${mech}`);
  }
});

test('U230: shoving the table onto him remains an improvised combat action', () => {
  const { mech } = resolve('I shove the table onto him');

  assert.match(mech, /strike:Improvised Table/, `table forced onto foe should stay in combat: ${mech}`);
  assert.doesNotMatch(mech, /combat:egress/, `table forced onto foe must not become egress: ${mech}`);
});
