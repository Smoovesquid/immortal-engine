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

function withCorwin(seed, profile = {}) {
  let w = beginAdventure(newWorld({
    seed,
    fate: 0.3,
    mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), packs).world;
  const nodeId = String(w.map?.currentNodeId ?? '');
  const nodes = Array.isArray(w.map?.nodes) ? [...w.map.nodes] : [];
  const idx = nodes.findIndex(n => n && n.id === nodeId);
  assert.ok(idx >= 0, 'test world has a current node');
  const node = nodes[idx];
  nodes[idx] = {
    ...node,
    settlement: {
      ...(node.settlement || {}),
      decompressed: true,
      npcs: [{
        id: 'npc_corwin',
        name: 'Corwin',
        role: 'healer',
        hostile: false,
        combatProfile: { maxHp: 20, damage: 1, canParley: false, ...profile },
        personality: {},
        conversationState: { metPlayer: false, trustLevel: 5, topicsDiscussed: [] },
        knowledgeGraph: [],
        secrets: []
      }]
    }
  };
  return ensureWorld({ ...w, map: { ...w.map, nodes } });
}

function combatWithCorwin(seed, profile = {}) {
  let w = withCorwin(seed, profile);
  const enemy = mintEnemyFromNpc({
    id: 'npc_corwin',
    name: 'Corwin',
    hostile: true,
    combatProfile: { maxHp: 20, damage: 1, canParley: false, ...profile }
  });
  w = beginCombat(w, { enemies: [enemy], reason: 'test' });
  w = applyDeltas(w, [{
    op: 'combatState',
    set: {
      round: 1,
      enemies: [{
        ...w.combat.enemies[0],
        hp: Number(profile.maxHp) || 20,
        maxHp: Number(profile.maxHp) || 20,
        ac: Number(profile.ac) || 1,
        damage: Number(profile.damage) || 1,
        defeated: false
      }]
    }
  }]);
  return w;
}

test('U193: present-NPC declared attack by the NPC starts combat instead of inventory table-talk', () => {
  const w = withCorwin('u193-satchel', { maxHp: 20, damage: 1 });
  const result = playerMove(w, packs, "Corwin swings his healer's satchel at my head. What do I roll to defend, and what's my Armor?");
  const mech = String(result.output.mechanics || '');

  assert.notEqual(mech, '', `must not fall through to inventory/meta output: ${result.output.narration}`);
  assert.doesNotMatch(mech, /combat:table-talk|observe only/, `declared violence must not be table-talk: ${mech}`);
  assert.match(mech, /(strike:|ward.*AC:\d+|combat:r|combat:victory)/, `combat resolver must run and surface defense: ${mech}`);
  assert.ok(result.world.combat?.active || /combat:victory/.test(mech), 'combat should start or resolve to victory');
});

test('U193: present-NPC dagger gut attack starts combat and applies real HP', () => {
  const w = withCorwin('u193-dagger', { maxHp: 20, damage: 1 });
  const result = playerMove(w, packs, 'I ram my dagger into his gut to see if this Corwin bleeds.');
  const mech = String(result.output.mechanics || '');
  const enemy = result.world.combat?.enemies?.find(e => e.sourceNpcId === 'npc_corwin' || e.name === 'Corwin');

  assert.match(mech, /strike:/, `attack must expose a real strike roll: ${mech}`);
  assert.doesNotMatch(mech, /combat:table-talk|observe only/, `must not table-talk: ${mech}`);
  assert.ok(enemy && Number(enemy.hp) < Number(enemy.maxHp), `Corwin HP should drop: ${JSON.stringify(enemy)}`);
});

test('U193: throat-grab windowsill kill intent rolls as combat, not table-talk or instant narration', () => {
  const w = combatWithCorwin('u193-grapple', { maxHp: 20, damage: 1, ac: 1 });
  const result = playerMove(w, packs, 'I grab him by the throat and slam his head into the windowsill.');
  const mech = String(result.output.mechanics || '');
  const enemy = result.world.combat?.enemies?.find(e => e.sourceNpcId === 'npc_corwin' || e.name === 'Corwin');

  assert.doesNotMatch(mech, /combat:table-talk/, `must not table-talk: ${mech}`);
  assert.match(mech, /(strike:Improvised Fixture|grapple:)/, `must resolve via rolled combat: ${mech}`);
  assert.ok(enemy, 'Corwin remains represented in combat state');
});

test('U193: strike damage in mechanics equals narration and lethal hit defeats before counterattack', () => {
  const nonlethal = playerMove(combatWithCorwin('u193-damage', { maxHp: 20, damage: 1, ac: 1 }), packs, 'kick Corwin');
  const nonlethalMech = String(nonlethal.output.mechanics || '');
  const mechDamage = Number(nonlethalMech.match(/\|\s*(\d+)\s*dmg/)?.[1] || NaN);
  assert.ok(Number.isFinite(mechDamage), `mechanics must surface damage: ${nonlethalMech}`);
  assert.match(nonlethal.output.narration, new RegExp(`for ${mechDamage}(?:\\D|$)`), `narration must use the mechanics damage: ${nonlethal.output.narration}`);

  const lethal = playerMove(combatWithCorwin('u193-lethal', { maxHp: 1, damage: 20, ac: 1 }), packs, 'kick Corwin');
  const lethalMech = String(lethal.output.mechanics || '');
  const enemy = lethal.world.combat?.enemies?.find(e => e.sourceNpcId === 'npc_corwin' || e.name === 'Corwin');

  assert.match(lethalMech, /strike:.*\|\s*\d+\s*dmg.*combat:victory/, `lethal strike keeps damage and victory: ${lethalMech}`);
  assert.equal(enemy?.hp, 0, `enemy hp should be zero: ${JSON.stringify(enemy)}`);
  // DEATH-2: the live combat path now flips dyingEnabled ON, so a felled COMMUNICATOR
  // (Corwin) enters DOWNED (dying, begging) instead of dying outright — the blow still
  // drops him to 0, victory still ends the fight, and he does NOT counterattack (dying,
  // not fighting). He is downed-or-defeated. (The beg + the four verbs finish him.)
  assert.ok(enemy?.downed || enemy?.defeated, `enemy should be dropped (downed or defeated): ${JSON.stringify(enemy)}`);
  assert.doesNotMatch(lethal.output.narration, /The Corwin hits you/, 'a dropped enemy must not counterattack');
});

test('U193: true non-action in active combat remains table-talk', () => {
  const w = combatWithCorwin('u193-non-action', { maxHp: 20, damage: 1, ac: 1 });
  const beforeHp = w.meta.escapeHp;
  const beforeRound = w.combat.round;
  const result = playerMove(w, packs, 'what are my options?');

  assert.match(String(result.output.mechanics || ''), /combat:table-talk/);
  assert.equal(result.world.meta.escapeHp, beforeHp, 'question costs no HP');
  assert.equal(result.world.combat.round, beforeRound, 'question does not advance the round');
});
