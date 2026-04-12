// CM5 — loot table for CR 11–16 creatures.

export const cr_11_16 = {
  id: 'cr_11_16',
  rolls: 2,
  entries: [
    { weight: 15, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'gold', amount: '2d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'gold', amount: '4d6' } },
    { weight: 12, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 12, result: { kind: 'item', defRef: 'half_plate', rarity: 'uncommon' } },
    { weight: 10, result: { kind: 'item', defRef: 'plate_armor', rarity: 'rare' } },
    { weight: 8, result: { kind: 'item', defRef: 'longsword_magic_1', rarity: 'rare' } },
    { weight: 5, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } },
    { weight: 3, result: { kind: 'currency', currency: 'platinum', amount: '1d4' } }
  ]
};
