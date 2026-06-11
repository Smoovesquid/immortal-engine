// Loot for CR 17+ — platinum and legends. Even here, a +3 is an event.
// (P-69 rarity ladder.)

export const cr_17_plus = {
  id: 'cr_17_plus',
  rolls: 3,
  entries: [
    { weight: 8, result: null },
    { weight: 15, result: { kind: 'currency', currency: 'gold', amount: '4d6' } },
    { weight: 13, result: { kind: 'currency', currency: 'platinum', amount: '1d6' } },
    { weight: 8, result: { kind: 'currency', currency: 'platinum', amount: '2d6' } },
    { weight: 8, result: { kind: 'item', defRef: 'healing_potion_superior', rarity: 'rare' } },
    { weight: 7, result: { kind: 'item', defRef: 'longsword_magic_2', rarity: 'rare' } },
    { weight: 6, result: { kind: 'item', defRef: 'plate_armor_magic_1', rarity: 'very_rare' } },
    { weight: 6, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'uncommon' } },
    { weight: 6, result: { kind: 'item', defRef: 'bracers_of_defense', rarity: 'rare' } },
    { weight: 5, result: { kind: 'item', defRef: 'greatsword_magic_2', rarity: 'rare' } },
    { weight: 5, result: { kind: 'item', defRef: 'longsword_magic_3', rarity: 'very_rare' } },
    { weight: 5, result: { kind: 'item', defRef: 'greataxe_magic_3', rarity: 'very_rare' } },
    { weight: 4, result: { kind: 'currency', currency: 'gold', amount: '8d6' } },
    { weight: 4, result: { kind: 'item', defRef: 'chain_mail_magic_1', rarity: 'rare' } }
  ]
};
