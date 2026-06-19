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

function combatWorld(seed, profile = {}) {
  let w = beginAdventure(newWorld({
    seed,
    fate: 0.3,
    mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), packs).world;
  const npc = {
    id: profile.npcId || 'npc_corwin',
    name: profile.name || 'Corwin Boneknit',
    hostile: true,
    combatProfile: {
      maxHp: Number(profile.maxHp) || 8,
      hp: Number(profile.hp) || Number(profile.maxHp) || 8,
      ac: Number(profile.ac) || 10,
      damage: Number(profile.damage) || 1,
      canParley: false
    },
    personality: {},
    conversationState: { metPlayer: false, trustLevel: 5, topicsDiscussed: [] },
    knowledgeGraph: [],
    secrets: []
  };
  const nodeId = String(w.map?.currentNodeId ?? '');
  const nodes = Array.isArray(w.map?.nodes) ? [...w.map.nodes] : [];
  const idx = nodes.findIndex(n => n && n.id === nodeId);
  assert.ok(idx >= 0, 'test world has a current node');
  nodes[idx] = {
    ...nodes[idx],
    settlement: {
      ...(nodes[idx].settlement || {}),
      decompressed: true,
      npcs: [npc]
    }
  };
  w = ensureWorld({ ...w, map: { ...w.map, nodes } });
  w = beginCombat(w, { enemies: [mintEnemyFromNpc(npc)], reason: 'test' });
  w = applyDeltas(w, [{
    op: 'combatState',
    set: {
      round: Number(profile.round) || 2,
      enemies: [{
        ...w.combat.enemies[0],
        name: npc.name,
        hp: Number(profile.hp ?? profile.maxHp ?? 8),
        maxHp: Number(profile.maxHp) || 8,
        ac: Number(profile.ac) || 10,
        damage: Number(profile.damage) || 1,
        defeated: false
      }]
    }
  }]);
  return w;
}

test('U200: enemy attack mechanics label the PC HP delta, not enemy HP', () => {
  const w = combatWorld('h38b-pc-hp-label', { hp: 4, maxHp: 8, ac: 10, damage: 12, round: 2 });
  const enemyBefore = Number(w.combat.enemies[0].hp);
  const pcBefore = Number(w.meta.escapeHp);
  const { world, result } = resolveEscapeCombatTurn(w, "I lunge and smash my fist straight into Corwin's nose.");
  const mech = String(result.mechanicsLine || '');
  const pcAfter = Number(world.meta.escapeHp);
  const enemyAfter = Number(world.combat.enemies[0].hp);

  assert.ok(pcAfter < pcBefore, `enemy turn should damage PC in this trace: ${pcBefore} -> ${pcAfter}`);
  assert.equal(enemyAfter, enemyBefore, 'a missed player strike plus enemy retaliation must not mutate enemy HP');
  assert.match(mech, new RegExp(`pcHp:${pcBefore}->${pcAfter}`), `enemy action must identify the HP owner: ${mech}`);
  assert.doesNotMatch(mech, /\[enemy:[^\]]+\|\s*[^|\]]+\|\s*\d+ dmg(?: crit)?\s*\|\s*hp:\d+->\d+\]/, `enemy action must not expose unlabeled hp deltas: ${mech}`);
});

test('U200: torch ram stays an improvised flame strike label', () => {
  const w = combatWorld('h38b-torch-label', { name: 'Lingerer', npcId: 'npc_lingerer', hp: 8, maxHp: 8, ac: 1, damage: 1 });
  const { result } = resolveEscapeCombatTurn(w, 'I turn the torch on the Lingerer and ram the fire into its grinning face.');
  const mech = String(result.mechanicsLine || '');

  assert.match(mech, /\[strike:Improvised Flame \| atk:-?\d+ vs AC:1 → (?:hit|miss)(?: \| \d+ dmg)?\]/, `torch attack must surface as flame: ${mech}`);
  assert.doesNotMatch(mech, /strike:Worn Blade/i, `torch attack must not fall back to blade: ${mech}`);
});

test('U200: pure spit and crowd-taunt does not fire an unprompted strike roll', () => {
  const w = combatWorld('h38b-taunt', { hp: 4, maxHp: 8, ac: 10, damage: 1 });
  const beforeHp = Number(w.meta.escapeHp);
  const beforeEnemyHp = Number(w.combat.enemies[0].hp);
  const beforeRound = Number(w.combat.round);
  const result = playerMove(w, packs, "I stand up and spit on him, then turn to the crowd and yell that they're next.");
  const mech = String(result.output.mechanics || '');

  assert.equal(mech, '[combat:table-talk]', `taunt must not resolve as a strike: ${mech}`);
  assert.equal(Number(result.world.meta.escapeHp), beforeHp, 'taunt should not cost PC HP');
  assert.equal(Number(result.world.combat.enemies[0].hp), beforeEnemyHp, 'taunt should not damage enemy HP');
  assert.equal(Number(result.world.combat.round), beforeRound, 'taunt should not advance combat round');
});
