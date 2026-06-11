// Loot for CR 11-16 — gold by the handful; uncommon is expected, rare is earned.
// (P-69 rarity ladder.)

export const cr_11_16 = {
  id: 'cr_11_16',
  rolls: 2,
  entries: [
    { weight: 15, result: null },
    { weight: 16, result: { kind: 'currency', currency: 'gold', amount: '2d6' } },
    { weight: 12, result: { kind: 'currency', currency: 'gold', amount: '4d6' } },
    { weight: 9, result: { kind: 'item', defRef: 'healing_potion_greater', rarity: 'uncommon' } },
    { weight: 6, result: { kind: 'item', defRef: 'healing_potion_superior', rarity: 'rare' } },
    { weight: 6, result: { kind: 'item', defRef: 'half_plate', rarity: 'uncommon' } },
    { weight: 5, result: { kind: 'item', defRef: 'greataxe_magic_1', rarity: 'uncommon' } },
    { weight: 5, result: { kind: 'item', defRef: 'rapier_magic_1', rarity: 'uncommon' } },
    { weight: 4, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'uncommon' } },
    { weight: 4, result: { kind: 'item', defRef: 'warhammer_magic_2', rarity: 'rare' } },
    { weight: 4, result: { kind: 'item', defRef: 'shortbow_magic_2', rarity: 'rare' } },
    { weight: 3, result: { kind: 'item', defRef: 'plate_armor', rarity: 'rare' } },
    { weight: 3, result: { kind: 'item', defRef: 'chain_mail_magic_1', rarity: 'rare' } },
    { weight: 3, result: { kind: 'item', defRef: 'greatsword_magic_2', rarity: 'rare' } },
    { weight: 3, result: { kind: 'item', defRef: 'bracers_of_defense', rarity: 'rare' } },
    { weight: 2, result: { kind: 'item', defRef: 'longsword_magic_3', rarity: 'very_rare' } }
  ]
};
