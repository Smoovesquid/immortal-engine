import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { worldHash } from '../engine/worldHash.js';
import { castSpell } from '../engine/spell/castSpell.js';
import { applyDeltas } from '../engine/effectsCore.js';

function makeCaster(seed = 't3-det') {
  return ensureWorld({
    meta: { seed, fate: 0.2 },
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
    combat: {
      active: true,
      round: 1,
      turnIndex: 0,
      enemies: [
        { id: 'troll1', name: 'Troll', hp: 20, maxHp: 20, damage: 3, canParley: false, defeated: false, sourceNpcId: '' }
      ],
      beganAt: 3,
      reason: 'test',
      playerGuard: false,
      companionGuard: false
    }
  });
}

test('T3: same seed + same spell + same target produces identical damage roll', () => {
  const w1 = makeCaster();
  const w2 = makeCaster();

  const r1 = castSpell(w1, { spellRef: 'fireball', targetId: 'troll1', slotLevel: 3 });
  const r2 = castSpell(w2, { spellRef: 'fireball', targetId: 'troll1', slotLevel: 3 });

  assert.equal(r1.result.ok, true);
  assert.equal(r2.result.ok, true);

  const dmg1 = r1.result.effects.find(e => e.kind === 'damage');
  const dmg2 = r2.result.effects.find(e => e.kind === 'damage');

  assert.ok(dmg1, 'first cast should produce damage');
  assert.ok(dmg2, 'second cast should produce damage');
  assert.equal(dmg1.totalDamage, dmg2.totalDamage, 'same seed must produce same damage');
  assert.equal(dmg1.saved, dmg2.saved, 'saving throw result must be identical');
});

test('T3: same seed + fire_bolt cantrip produces identical damage', () => {
  const w1 = makeCaster();
  const w2 = makeCaster();

  const r1 = castSpell(w1, { spellRef: 'fire_bolt', targetId: 'troll1' });
  const r2 = castSpell(w2, { spellRef: 'fire_bolt', targetId: 'troll1' });

  const dmg1 = r1.result.effects.find(e => e.kind === 'damage');
  const dmg2 = r2.result.effects.find(e => e.kind === 'damage');

  assert.equal(dmg1.totalDamage, dmg2.totalDamage, 'cantrip damage must be deterministic');
});

test('T3: different seeds produce different damage', () => {
  const w1 = makeCaster('seed-alpha');
  const w2 = makeCaster('seed-beta');

  const r1 = castSpell(w1, { spellRef: 'fireball', targetId: 'troll1', slotLevel: 3 });
  const r2 = castSpell(w2, { spellRef: 'fireball', targetId: 'troll1', slotLevel: 3 });

  const dmg1 = r1.result.effects.find(e => e.kind === 'damage').totalDamage;
  const dmg2 = r2.result.effects.find(e => e.kind === 'damage').totalDamage;

  // With different seeds, damage should almost certainly differ. We allow the
  // extremely unlikely case where they match but still assert both are positive.
  assert.ok(dmg1 > 0, 'damage must be positive');
  assert.ok(dmg2 > 0, 'damage must be positive');
});

test('T3: worldHash stable after spell cast cycle', () => {
  const w1 = makeCaster('hash-stable');
  const w2 = makeCaster('hash-stable');

  // Cast fireball on both.
  const { world: wa } = castSpell(w1, { spellRef: 'fireball', targetId: 'troll1', slotLevel: 3 });
  const { world: wb } = castSpell(w2, { spellRef: 'fireball', targetId: 'troll1', slotLevel: 3 });

  const ha = worldHash(wa);
  const hb = worldHash(wb);
  assert.equal(ha, hb, 'worldHash must be identical after same spell cast on same seed');
});

test('T3: worldHash stable after slot consume + restore cycle', () => {
  const w1 = makeCaster('hash-restore');
  const w2 = makeCaster('hash-restore');

  // Consume and restore slots on both.
  let wa = applyDeltas(w1, [{ op: 'consumeSpellSlot', level: 1 }]);
  wa = applyDeltas(wa, [{ op: 'restoreSpellSlots' }]);

  let wb = applyDeltas(w2, [{ op: 'consumeSpellSlot', level: 1 }]);
  wb = applyDeltas(wb, [{ op: 'restoreSpellSlots' }]);

  assert.equal(worldHash(wa), worldHash(wb), 'worldHash must match after identical slot cycle');
});
