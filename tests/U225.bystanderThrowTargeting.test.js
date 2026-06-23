import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { beginCombat, mintEnemyFromNpc } from '../engine/combat/combatLifecycle.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// H-95 — grapple/throw target + hazard resolution (2026-06-23). Mid-fight, trying to
// throw/grab a NON-COMBATANT bystander ("the fleeing villager") into a hazard used to
// fabricate an improvised hazard-weapon and swing it at the WRONG foe:
//   "I grab the nearest fleeing villager and throw them into the burning stall."
//     → [strike:Improvised Burning Oil | atk:0 vs AC:10 → miss]   (at the Lingerer!)
// The escape resolver models only combatants, so there is no bystander to grab/haul
// and no throw-a-person-into-hazard mechanic (hazard.js FIRE_RE is "throw MYSELF into
// fire" only). The fix honestly DECLINES (combat:bystander-unreachable) instead of
// inventing a weapon from the hazard noun or retargeting the blow. The same default
// ("unknown text → swing at the foe") also turned a RESCUE into an attack:
//   "I help the fleeing villager away from the fire." → [strike:Worn Blade ...]
// which now declines too.
//
// Narrow by construction (isCombatBystanderHandling): a handling verb taking a
// BYSTANDER noun matching no present enemy. So the improvised-weapon path ("throw oil
// AT the monster"), grapple ("grab the monster"), a normal strike, and a mid-combat
// target-switch onto a fightable NPC ("lunge at the other guard") are untouched. The
// out-of-combat "assault a villager STARTS combat against them" path (C10-003) runs
// through engageNpcCombat, a different code path, and is unaffected.
//
// Sibling to U198/U211 (combat-truth), U171/U224 (initiation), U148 (target-switch),
// U191 (improvised action). Pure routing assertion on the mechanics tag. See
// docs/PACKETS.md H-95.

function loadPacks() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

const packs = loadPacks();

function combatWorld(seed, { foe = 'Lingerer', villager = false } = {}) {
  let w = beginAdventure(newWorld({
    seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null }
  }), packs).world;
  const enemy = mintEnemyFromNpc({
    id: 'npc_foe', name: foe, hostile: true,
    combatProfile: { maxHp: 12, damage: 1, ac: 10, canParley: false }
  });
  w = beginCombat(w, { enemies: [enemy], reason: 'test' });
  w = applyDeltas(w, [{
    op: 'combatState',
    set: { round: 1, enemies: [{ ...w.combat.enemies[0], hp: 12, maxHp: 12, ac: 10, damage: 1, defeated: false }] }
  }]);
  if (villager) {
    const nodeId = String(w.map?.currentNodeId ?? '');
    const nodes = [...w.map.nodes];
    const idx = nodes.findIndex(n => n && n.id === nodeId);
    const node = nodes[idx];
    nodes[idx] = {
      ...node,
      settlement: {
        ...(node.settlement || {}), decompressed: true,
        npcs: [...((node.settlement || {}).npcs || []), {
          id: 'npc_vil', name: 'Sela', role: 'villager', hostile: false,
          conversationState: { metPlayer: false, trustLevel: 2, topicsDiscussed: [] },
          knowledgeGraph: [], secrets: []
        }]
      }
    };
    w = { ...w, map: { ...w.map, nodes } };
  }
  return ensureWorld(w);
}

const run = (w, text) => playerMove(w, packs, text);
const DECLINE = '[combat:bystander-unreachable]';

// ── Positives — throw/grab a non-combatant bystander into a hazard ───────────

test('U225-01: the exact repro declines, fabricates no weapon, and stays in the real fight', () => {
  const r = run(combatWorld('u225-repro'), 'I grab the nearest fleeing villager and throw them into the burning stall.');
  const mech = String(r.output.mechanics || '');
  assert.equal(mech, DECLINE, `bystander throw must decline, not strike: ${mech}`);
  assert.doesNotMatch(mech, /strike:Improvised/i, 'must not fabricate an improvised hazard-weapon');
  assert.doesNotMatch(mech, /strike:/i, 'must not retarget a strike at the active foe');
  assert.equal(r.world.combat?.active, true, 'the real fight is still on');
});

test('U225-02: "grab the villager and throw him into the burning stall" preserves the person target (no retarget)', () => {
  const r = run(combatWorld('u225-grab', { villager: true }), 'I grab the villager and throw him into the burning stall.');
  assert.equal(String(r.output.mechanics || ''), DECLINE);
});

test('U225-03: "throw the fleeing villager into the fire" declines (no throw-into-hazard mechanic)', () => {
  const r = run(combatWorld('u225-fire', { villager: true }), 'I throw the fleeing villager into the fire.');
  assert.equal(String(r.output.mechanics || ''), DECLINE);
});

// ── Negatives / diverges — must NOT be swallowed by the bystander decline ─────

test('U225-10: "throw oil at the monster" stays an improvised-weapon attack (prop, not a person)', () => {
  const mech = String(run(combatWorld('u225-oil'), 'I throw oil at the monster.').output.mechanics || '');
  assert.match(mech, /strike:Improvised/i, `improvised hazard-weapon at the foe must remain: ${mech}`);
  assert.notEqual(mech, DECLINE);
});

test('U225-11: "grab the Lingerer" remains a normal grapple on the foe', () => {
  const mech = String(run(combatWorld('u225-grab-foe'), 'I grab the Lingerer.').output.mechanics || '');
  assert.match(mech, /grapple:/i, `grappling the actual foe must still resolve: ${mech}`);
  assert.notEqual(mech, DECLINE);
});

test('U225-12: "help the fleeing villager away from the fire" is NOT an attack on the foe', () => {
  const mech = String(run(combatWorld('u225-help', { villager: true }), 'I help the fleeing villager away from the fire.').output.mechanics || '');
  assert.equal(mech, DECLINE, `a rescue must not become a strike at the foe: ${mech}`);
  assert.doesNotMatch(mech, /strike:/i, 'helping a bystander must not swing a weapon');
});

// ── Regression — real combat actions untouched ───────────────────────────────

test('U225-20: "I strike the Lingerer with my blade" still resolves as a strike', () => {
  const mech = String(run(combatWorld('u225-strike'), 'I strike the Lingerer with my blade.').output.mechanics || '');
  assert.match(mech, /strike:/i, `a real strike on the foe must resolve: ${mech}`);
  assert.notEqual(mech, DECLINE);
});
