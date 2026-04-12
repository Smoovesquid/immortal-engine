// CM5 — loot table for CR 5–10 creatures.

export const cr_5_10 = {
  id: 'cr_5_10',
  rolls: 2,
  entries: [
    { weight: 25, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'silver', amount: '3d6' } },
    { weight: 18, result: { kind: 'currency', currency: 'gold', amount: '1d6' } },
    { weight: 12, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 10, result: { kind: 'item', defRef: 'scale_mail', rarity: 'common' } },
    { weight: 8, result: { kind: 'item', defRef: 'longsword', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'half_plate', rarity: 'uncommon' } },
    { weight: 2, result: { kind: 'item', defRef: 'longsword_magic_1', rarity: 'rare' } }
  ]
};
