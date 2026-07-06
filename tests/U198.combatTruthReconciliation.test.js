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
        combatProfile: { maxHp: 20, damage: 1, ac: 1, canParley: false, ...profile },
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
  const maxHp = Number(profile.maxHp) || 20;
  const enemy = mintEnemyFromNpc({
    id: 'npc_corwin',
    name: 'Corwin',
    hostile: true,
    combatProfile: { maxHp, damage: 1, ac: 1, canParley: false, ...profile }
  });
  w = beginCombat(w, { enemies: [enemy], reason: 'test' });
  w = applyDeltas(w, [{
    op: 'combatState',
    set: {
      round: Number(profile.round) || 1,
      enemies: [{
        ...w.combat.enemies[0],
        hp: Number(profile.hp ?? maxHp),
        maxHp,
        ac: Number(profile.ac) || 1,
        damage: Number(profile.damage) || 1,
        defeated: false
      }]
    }
  }]);
  return w;
}

test('U198: enemy damage after a player miss surfaces the enemy roll and PC HP delta', () => {
  const w = combatWithCorwin('h36b', { maxHp: 20, hp: 20, ac: 10, damage: 12, round: 2 });
  const beforeHp = Number(w.meta.escapeHp);
  const { world, result } = resolveEscapeCombatTurn(w, "I lunge and smash my fist straight into Corwin's nose.");
  const mech = String(result.mechanicsLine || '');
  const afterHp = Number(world.meta.escapeHp);

  assert.match(mech, /\[strike:Punch \| atk:6 vs AC:10 → miss\]/, `sanity: player punch should miss: ${mech}`);
  assert.ok(afterHp < beforeHp, `enemy turn should have changed PC HP in this trace: ${beforeHp} -> ${afterHp}`);
  assert.match(mech, /\[enemy:Corwin \| atk:\d+ vs AC:\d+ → hit \| \d+ dmg(?: crit)? \| pcHp:\d+->\d+\]/, `enemy hit must be visible in mechanics: ${mech}`);
  assert.match(mech, new RegExp(`pcHp:${beforeHp}->${afterHp}`), `mechanics must show exact PC HP delta: ${mech}`);
});

test('U198: lethal improvised natural strike defeats and emits victory', () => {
  const w = combatWithCorwin('h36b-r', { maxHp: 3, hp: 3, ac: 1, damage: 1 });
  const result = playerMove(w, packs, 'I spit blood and headbutt Corwin right between the eyes.');
  const mech = String(result.output.mechanics || '');
  const enemy = result.world.combat?.enemies?.find(e => e.sourceNpcId === 'npc_corwin' || e.name === 'Corwin');
  const dmg = Number(mech.match(/\|\s*(\d+)\s*dmg/)?.[1] || NaN);

  assert.match(mech, /\[strike:Headbutt \| atk:\d+ vs AC:1 → hit \| \d+ dmg\] \[combat:victory\]/, `lethal headbutt must keep damage + victory: ${mech}`);
  assert.ok(Number.isFinite(dmg) && dmg >= 3, `damage should meet or exceed target HP: ${mech}`);
  assert.equal(enemy?.hp, 0, `Corwin HP should be zero: ${JSON.stringify(enemy)}`);
  // DEATH-2: the live path flips dyingEnabled ON — a felled COMMUNICATOR (Corwin) enters
  // DOWNED (dying, begging) rather than dying outright. The blow still zeroes him and ends
  // combat in victory; he is downed-or-defeated (the four verbs finish him).
  assert.ok(enemy?.downed || enemy?.defeated, `Corwin should be dropped (downed or defeated): ${JSON.stringify(enemy)}`);
  assert.equal(result.world.combat?.active, false, 'victory should end active combat');
});

test('U198: movement and lore while active combat stays in combat instead of exiting silently', () => {
  const w = combatWithCorwin('h36b-r3', { maxHp: 8, hp: 8, ac: 10, damage: 1, round: 2 });
  const beforeHp = Number(w.meta.escapeHp);
  const result = playerMove(w, packs, 'I leave Corwin and go find Kael — through that creaking door. Kael, did the Boneknits found this village?');
  const mech = String(result.output.mechanics || '');

  assert.equal(mech, '[combat:table-talk]', `movement out of active combat must be reconciled: ${mech}`);
  assert.equal(result.world.combat?.active, true, 'combat should remain active when the player is held in the fight');
  assert.equal(Number(result.world.meta.escapeHp), beforeHp, 'held movement should not spend the turn or take HP');
  assert.doesNotMatch(String(result.output.narration || ''), /Kael.*Boneknits founded|step back outside/i, 'must not narrate having left the fight');
});

test('U198: lore question mid-combat does not fabricate a strike, flee, or victory', () => {
  const w = combatWithCorwin('h36b-r3b', { maxHp: 8, hp: 1, ac: 1, damage: 1, round: 2 });
  const beforeHp = Number(w.meta.escapeHp);
  const result = playerMove(w, packs, "Before the first stone? Then who laid that first stone, Kael — name the founder Corwin wouldn't.");
  const mech = String(result.output.mechanics || '');

  assert.equal(mech, '[combat:table-talk]', `pure lore question must not run combat math: ${mech}`);
  assert.equal(result.world.combat?.active, true, 'combat should still be active after table-talk');
  assert.equal(Number(result.world.meta.escapeHp), beforeHp, 'lore table-talk should not cost HP');
  assert.doesNotMatch(mech, /strike:|combat:fled|combat:victory/, `must not fabricate combat resolution: ${mech}`);
});

test('U198: a real attack mid-combat still resolves normally', () => {
  const w = combatWithCorwin('h36b-real-attack', { maxHp: 20, hp: 20, ac: 1, damage: 1 });
  const result = playerMove(w, packs, 'I stab Corwin again.');
  const mech = String(result.output.mechanics || '');

  assert.match(mech, /strike:/, `real attack should still hit the combat resolver: ${mech}`);
  assert.doesNotMatch(mech, /combat:table-talk/, `real attack must not be swallowed as table-talk: ${mech}`);
});
