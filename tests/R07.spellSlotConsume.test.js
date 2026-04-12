import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { castSpell } from '../engine/spell/castSpell.js';

// Minimal world with a caster who knows several spells.
function makeCaster(overrides = {}) {
  return ensureWorld({
    meta: { seed: 'r07-test', fate: 0.2 },
    party: [{
      id: 'party',
      name: 'Mage',
      level: 5,
      stats: { MIGHT: 10, AGILITY: 10, WITS: 16, GRIT: 12, CHARM: 10 },
      spells: {
        known: ['fire_bolt', 'fireball', 'mage_armor', 'shield', 'misty_step'],
        slots: { 1: 2, 2: 1, 3: 1, 4: 0, 5: 0 },
        maxSlots: { 1: 4, 2: 2, 3: 1, 4: 0, 5: 0 },
        concentration: null
      },
      ...overrides
    }],
    combat: {
      active: true,
      round: 1,
      turnIndex: 0,
      enemies: [{ id: 'goblin1', name: 'Goblin', hp: 12, maxHp: 12, damage: 2, canParley: false, defeated: false, sourceNpcId: '' }],
      beganAt: 0,
      reason: 'test',
      playerGuard: false,
      companionGuard: false
    }
  });
}

test('R07: cast fireball with available 3rd-level slot — slot decremented, damage applied', () => {
  const w = makeCaster();
  const slotsBefore = w.party[0].spells.slots[3];
  assert.equal(slotsBefore, 1, 'should start with 1 third-level slot');

  const { world: w2, result } = castSpell(w, { spellRef: 'fireball', targetId: 'goblin1', slotLevel: 3 });

  assert.equal(result.ok, true, 'cast should succeed');
  assert.equal(result.spellRef, 'fireball');
  assert.equal(result.slotConsumed, true);
  assert.equal(w2.party[0].spells.slots[3], 0, 'third-level slot should be decremented');

  const dmgEffect = result.effects.find(e => e.kind === 'damage');
  assert.ok(dmgEffect, 'should have a damage effect');
  assert.ok(dmgEffect.totalDamage > 0, 'damage should be positive');
  assert.equal(dmgEffect.damageType, 'fire');
});

test('R07: cast fireball with 0 slots — returns no-slots', () => {
  const w = makeCaster();
  // Consume the single 3rd-level slot first.
  const { world: w2 } = castSpell(w, { spellRef: 'fireball', targetId: 'goblin1', slotLevel: 3 });
  assert.equal(w2.party[0].spells.slots[3], 0);

  // Try again — should fail.
  const { result } = castSpell(w2, { spellRef: 'fireball', targetId: 'goblin1', slotLevel: 3 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no-slots');
});

test('R07: cast fire_bolt (cantrip) — no slot consumed', () => {
  const w = makeCaster();
  const slotsBefore = { ...w.party[0].spells.slots };

  const { world: w2, result } = castSpell(w, { spellRef: 'fire_bolt', targetId: 'goblin1' });

  assert.equal(result.ok, true);
  assert.equal(result.slotConsumed, false, 'cantrip should not consume a slot');
  // All slot counts unchanged.
  for (const lvl of [1, 2, 3, 4, 5]) {
    assert.equal(w2.party[0].spells.slots[lvl], slotsBefore[lvl], `slot level ${lvl} should be unchanged`);
  }

  const dmgEffect = result.effects.find(e => e.kind === 'damage');
  assert.ok(dmgEffect, 'fire_bolt should deal damage');
  assert.ok(dmgEffect.totalDamage > 0);
});

test('R07: cast at higher slot level — consumes correct slot', () => {
  const w = makeCaster();
  // Cast mage_armor (level 1) using a 2nd-level slot.
  const slots2Before = w.party[0].spells.slots[2];
  const slots1Before = w.party[0].spells.slots[1];

  const { world: w2, result } = castSpell(w, { spellRef: 'mage_armor', slotLevel: 2 });

  assert.equal(result.ok, true);
  assert.equal(result.slotConsumed, true);
  assert.equal(result.slotLevel, 2, 'should record slot level 2');
  assert.equal(w2.party[0].spells.slots[2], slots2Before - 1, '2nd-level slot decremented');
  assert.equal(w2.party[0].spells.slots[1], slots1Before, '1st-level slot unchanged');
});

test('R07: cast unknown spell — returns unknown-spell', () => {
  const w = makeCaster();
  const { result } = castSpell(w, { spellRef: 'nonexistent_spell' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'unknown-spell');
});

test('R07: cast spell not in known list — returns not-known', () => {
  const w = makeCaster();
  // counterspell is in the registry but not in our caster's known list.
  const { result } = castSpell(w, { spellRef: 'counterspell', slotLevel: 3 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not-known');
});

test('R07: consumeSpellSlot delta clamps to 0', () => {
  const w = makeCaster();
  // Slots[4] is already 0.
  const w2 = applyDeltas(w, [{ op: 'consumeSpellSlot', level: 4 }]);
  assert.equal(w2.party[0].spells.slots[4], 0, 'should stay at 0');
});

test('R07: restoreSpellSlots delta restores all to max', () => {
  const w = makeCaster();
  // Consume some slots first.
  let w2 = applyDeltas(w, [
    { op: 'consumeSpellSlot', level: 1 },
    { op: 'consumeSpellSlot', level: 1 },
    { op: 'consumeSpellSlot', level: 2 }
  ]);
  assert.equal(w2.party[0].spells.slots[1], 0);
  assert.equal(w2.party[0].spells.slots[2], 0);

  // Restore.
  w2 = applyDeltas(w2, [{ op: 'restoreSpellSlots' }]);
  assert.equal(w2.party[0].spells.slots[1], 4, 'slots[1] restored to max 4');
  assert.equal(w2.party[0].spells.slots[2], 2, 'slots[2] restored to max 2');
  assert.equal(w2.party[0].spells.slots[3], 1, 'slots[3] restored to max 1');
});
