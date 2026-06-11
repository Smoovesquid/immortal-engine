// Loot for CR 5-10 — real coin, soldier's gear, the first taste of magic.
// (P-69: uncommon ~10%, a rare is a campaign memory.)

export const cr_5_10 = {
  id: 'cr_5_10',
  rolls: 2,
  entries: [
    { weight: 22, result: null },
    { weight: 17, result: { kind: 'currency', currency: 'silver', amount: '3d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'gold', amount: '1d6' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 6, result: { kind: 'item', defRef: 'healing_potion_greater', rarity: 'uncommon' } },
    { weight: 6, result: { kind: 'item', defRef: 'scale_mail', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'longsword', rarity: 'common' } },
    { weight: 4, result: { kind: 'item', defRef: 'longbow', rarity: 'common' } },
    { weight: 4, result: { kind: 'item', defRef: 'breastplate', rarity: 'common' } },
    { weight: 3, result: { kind: 'item', defRef: 'half_plate', rarity: 'uncommon' } },
    { weight: 2, result: { kind: 'item', defRef: 'longsword_magic_1', rarity: 'uncommon' } },
    { weight: 2, result: { kind: 'item', defRef: 'longbow_magic_1', rarity: 'uncommon' } },
    { weight: 1, result: { kind: 'item', defRef: 'mace_magic_1', rarity: 'uncommon' } },
    { weight: 1, result: { kind: 'item', defRef: 'leather_armor_magic_1', rarity: 'uncommon' } },
    { weight: 1, result: { kind: 'item', defRef: 'cloak_of_protection', rarity: 'uncommon' } },
    { weight: 1, result: { kind: 'item', defRef: 'longsword_magic_2', rarity: 'rare' } }
  ]
};
