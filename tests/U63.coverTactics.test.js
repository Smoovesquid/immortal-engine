// U63 — tactical cover (the first slice of the tactical-map system).
//
// A room now carries cover features (a pillar, a table, rubble). Fighting inside
// one lets you "take cover" for a D&D-style AC bonus (half = +2, three-quarter =
// +5). This guard locks the wiring:
//
//   • cover is deterministic by room id (so the map glyph and the combat bonus
//     never drift, and replays are identical),
//   • "take cover" inside a room with cover raises the player's effective AC,
//     persists across rounds, and is stored scoped to the fight,
//   • a blade strike breaks cover (you step out); a fire bolt keeps it (ranged),
//   • an open-road ambush (no interior room) offers nothing to hide behind.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginCombat } from '../engine/combat/combatLifecycle.js';
import {
  resolveEscapeCombatTurn, initEscapeHp, initEscapeKit, parseEscapeAction
} from '../engine/combat/escapeCombat.js';
import { coverForRoom, bestCover } from '../engine/structures/coverFeatures.js';

// A non-entry room always carries at least one piece of cover.
const ROOM_ID = 'room:test:2';
const STRUCT = {
  id: 'st1', kind: 'building', nodeId: 'n1',
  topology: {
    kind: 'rooms',
    rooms: [{ id: 'room:test:1', tags: ['entry'] }, { id: ROOM_ID, tags: [] }],
    edges: [{ a: 'room:test:1', b: ROOM_ID, kind: 'door' }]
  }
};

function baseWorld(seedKey) {
  let w = newWorld({ seed: seedKey, fate: 0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = ensureWorld({
    ...w,
    party: [{ id: 'party', name: 'Escapee', stats: { MIGHT: 18, AGILITY: 14, GRIT: 14, CHARM: 10, WITS: 18 } }]
  });
  w = initEscapeHp(w);
  w = initEscapeKit(w);
  w = { ...w, meta: { ...w.meta, escapeHp: 9999 } };
  return w;
}

function mkInteriorFight(seedKey) {
  let w = baseWorld(seedKey);
  w = {
    ...w,
    // currentNodeId must match STRUCT.nodeId — otherwise scene.interior points at a
    // registered structure sitting at a different node (a position-desync the
    // NODE-DESYNC-1 invariant now rejects and ensureWorld repairs by clearing it).
    map: { ...w.map, currentNodeId: STRUCT.nodeId },
    structures: { byId: { st1: STRUCT } },
    scene: { ...w.scene, interior: { structureKey: 'st1', roomId: ROOM_ID } }
  };
  const enemy = { name: 'Husk', hp: 30, maxHp: 30, damage: 4, ac: 8, cr: 0.125, lootTableRef: null, canParley: false, defeated: false };
  return beginCombat(w, { enemies: [enemy], reason: 'ambush' });
}

function mkBigEnemyFight(seedKey) {
  let w = baseWorld(seedKey);
  w = {
    ...w,
    map: { ...w.map, currentNodeId: STRUCT.nodeId },
    structures: { byId: { st1: STRUCT } },
    scene: { ...w.scene, interior: { structureKey: 'st1', roomId: ROOM_ID } }
  };
  // Huge HP so the enemy never dies during the sampling window.
  const enemy = { name: 'Husk', hp: 100000, maxHp: 100000, damage: 6, ac: 8, cr: 0.125, lootTableRef: null, canParley: false, defeated: false };
  return beginCombat(w, { enemies: [enemy], reason: 'ambush' });
}

function mkOpenFight(seedKey) {
  const w = baseWorld(seedKey); // no scene.interior
  const enemy = { name: 'Husk', hp: 30, maxHp: 30, damage: 4, ac: 8, cr: 0.125, lootTableRef: null, canParley: false, defeated: false };
  return beginCombat(w, { enemies: [enemy], reason: 'ambush' });
}

describe('U63 — tactical cover', () => {
  it('cover is deterministic by room id', () => {
    const room = { id: ROOM_ID, tags: [] };
    const a = JSON.stringify(coverForRoom(room));
    const b = JSON.stringify(coverForRoom(room));
    assert.equal(a, b, 'same room must yield identical cover');
    assert.ok(coverForRoom(room).length >= 1, 'a non-entry room should have cover');
  });

  it('bestCover picks the highest AC bonus', () => {
    const feats = [
      { id: 'a', tier: 'half', bonus: 2 },
      { id: 'b', tier: 'three-quarter', bonus: 5 },
      { id: 'c', tier: 'half', bonus: 2 }
    ];
    assert.equal(bestCover(feats).id, 'b');
    assert.equal(bestCover([]), null);
    assert.equal(bestCover(null), null);
  });

  it('parses cover intent', () => {
    assert.equal(parseEscapeAction('take cover').verb, 'cover');
    assert.equal(parseEscapeAction('hide behind the pillar').verb, 'cover');
    assert.equal(parseEscapeAction('duck').verb, 'cover');
    assert.equal(parseEscapeAction('strike').verb, 'strike');
  });

  it('taking cover activates a bonus that persists, scoped to the fight', () => {
    const w0 = mkInteriorFight('u63-cover');
    const beganAt = Number(w0.combat.beganAt) || 0;
    const expected = bestCover(coverForRoom({ id: ROOM_ID, tags: [] }));
    assert.ok(expected, 'test room must have cover');

    const w1 = resolveEscapeCombatTurn(w0, 'take cover').world;
    const cov = w1.meta?.escapeCover;
    assert.ok(cov && cov.active, 'cover should be active after taking cover');
    assert.equal(cov.bonus, expected.bonus, 'cover bonus matches the room cover');
    assert.equal(cov.beganAt, beganAt, 'cover is scoped to this fight');

    // Fire bolt is ranged → cover holds.
    const w2 = resolveEscapeCombatTurn(w1, 'fire bolt').world;
    assert.ok(w2.meta?.escapeCover?.active, 'fire bolt keeps cover');

    // Blade strike → cover breaks (you step out).
    const w3 = resolveEscapeCombatTurn(w2, 'strike').world;
    assert.equal(w3.meta?.escapeCover?.active, false, 'strike breaks cover');
  });

  it('cover raises effective AC (fewer hits land)', () => {
    // Isolate AC as the only variable. Both runs fire bolt every round (identical
    // rng draws → identical enemy attack rolls); the covered run starts already
    // behind cover (pre-seeded, and fire bolt keeps cover). So any roll that
    // lands in [openAC, coveredAC) is blocked only in the covered run. The enemy
    // has huge HP so it never dies and both runs see the same number of attacks.
    function damageTaken(useCover, seedKey) {
      let w = mkBigEnemyFight(seedKey);
      if (useCover) {
        const beganAt = Number(w.combat.beganAt) || 0;
        const c = bestCover(coverForRoom({ id: ROOM_ID, tags: [] }));
        w = { ...w, meta: { ...w.meta, escapeCover: { active: true, bonus: c.bonus, label: c.label, tier: c.tier, beganAt } } };
      }
      let prev = 9999, taken = 0;
      for (let i = 0; i < 10 && w.combat?.active; i++) {
        w = resolveEscapeCombatTurn(w, 'fire bolt').world;
        const hp = Number(w.meta.escapeHp) || 0;
        taken += Math.max(0, prev - hp);
        prev = hp;
      }
      return taken;
    }
    let openTotal = 0, coveredTotal = 0;
    for (let s = 0; s < 20; s++) {
      const open = damageTaken(false, 'u63-ac-' + s);
      const covered = damageTaken(true, 'u63-ac-' + s);
      assert.ok(covered <= open, `cover must never increase damage (seed ${s}: covered ${covered} vs open ${open})`);
      openTotal += open;
      coveredTotal += covered;
    }
    assert.ok(coveredTotal < openTotal, `cover should reduce damage in aggregate (covered ${coveredTotal} vs open ${openTotal})`);
  });

  it('open-road ambush offers no cover', () => {
    const w0 = mkOpenFight('u63-open');
    const w1 = resolveEscapeCombatTurn(w0, 'take cover').world;
    assert.equal(w1.meta?.escapeCover?.active, false, 'no cover available outdoors');
  });
});
