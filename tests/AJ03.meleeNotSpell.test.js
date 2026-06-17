import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { playerMove } from '../engine/playloop.js';
import { adjudicate } from '../engine/gracefulAdjudication.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel'],
    locations: ['tower'],
    objectives: ['find the key'],
    complications: ['a clock starts'],
    npcArchetypes: ['wary guide'],
    sensoryMotifs: ['air tastes of dust']
  }
};

function makeMage(extra = {}) {
  return ensureWorld({
    meta: { seed: 'aj03', fate: 0.2 },
    pack: { primaryId: 'fantasy', mixerId: null },
    time: { turn: 3, scene: 1 },
    party: [{
      id: 'party',
      name: 'Mage',
      level: 5,
      stats: { MIGHT: 10, AGILITY: 10, WITS: 16, GRIT: 12, CHARM: 10 },
      spells: {
        known: ['fire_bolt', 'fireball', 'mage_armor'],
        slots: { 1: 4, 2: 2, 3: 2, 4: 0, 5: 0 },
        maxSlots: { 1: 4, 2: 2, 3: 2, 4: 0, 5: 0 },
        concentration: null
      }
    }],
    ...extra
  });
}

test('AJ03: "cast a glance over the room" is NOT a spell', () => {
  const w = makeMage();
  const decision = adjudicate(w, 'cast a glance over the room');
  assert.notEqual(decision.route, 'spell', 'a non-spell "cast" phrase must not route to spell');
});

test('AJ03: "cast a glance" consumes no spell slot through playerMove', () => {
  const w = makeMage();
  const slotsBefore = JSON.stringify(w.party[0].spells.slots);
  const { world: after } = playerMove(w, packsById, 'cast a glance over the room');
  assert.equal(JSON.stringify(after.party[0].spells.slots), slotsBefore, 'no slot may be consumed');
});

test('AJ03: a real known spell still routes to spell', () => {
  const w = makeMage();
  const decision = adjudicate(w, 'cast fire_bolt at the troll');
  assert.equal(decision.route, 'spell');
  assert.equal(decision.move.approachTag, 'occult', 'occult approach only on the spell route');
  assert.equal(decision.move.toolTag, 'fire_bolt');
});

test('AJ03: "ward off the goblin with my blade" in combat routes to combat/force', () => {
  const w = makeMage({
    combat: {
      active: true,
      round: 1,
      turnIndex: 0,
      enemies: [{ id: 'gob1', name: 'Goblin', hp: 7, maxHp: 7, damage: 2, canParley: false, defeated: false, sourceNpcId: '' }],
      beganAt: 3,
      reason: 'test',
      playerGuard: false,
      companionGuard: false
    }
  });
  const decision = adjudicate(w, 'ward off the goblin with my blade');
  assert.equal(decision.route, 'combat', 'a melee verb in combat is combat, not a spell');
  assert.equal(decision.move.approachTag, 'force');
  assert.equal(decision.move.stakeTag, 'harm');
});
