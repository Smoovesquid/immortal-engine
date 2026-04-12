// CM5 — loot table for CR 17+ creatures.

export const cr_17_plus = {
  id: 'cr_17_plus',
  rolls: 3,
  entries: [
    { weight: 10, result: null },
    { weight: 18, result: { kind: 'currency', currency: 'gold', amount: '4d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'platinum', amount: '1d6' } },
    { weight: 12, result: { kind: 'item', defRef: 'plate_armor', rarity: 'rare' } },
    { weight: 12, result: { kind: 'item', defRef: 'longsword_magic_1', rarity: 'rare' } },
    { weight: 10, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 8, result: { kind: 'currency', currency: 'platinum', amount: '2d6' } },
    { weight: 5, result: { kind: 'currency', currency: 'gold', amount: '8d6' } }
  ]
};
