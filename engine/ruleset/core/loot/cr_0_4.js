// Loot for CR 0-4 — coppers and tools of the trade; magic is a rumor here.
// (P-69: rarity ladder — at this band an uncommon drop is a story.)

export const cr_0_4 = {
  id: 'cr_0_4',
  rolls: 1,
  entries: [
    { weight: 33, result: null },
    { weight: 24, result: { kind: 'currency', currency: 'copper', amount: '2d6' } },
    { weight: 14, result: { kind: 'currency', currency: 'silver', amount: '1d6' } },
    { weight: 9, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } },
    { weight: 4, result: { kind: 'item', defRef: 'dagger', rarity: 'common' } },
    { weight: 3, result: { kind: 'item', defRef: 'shortsword', rarity: 'common' } },
    { weight: 3, result: { kind: 'item', defRef: 'handaxe', rarity: 'common' } },
    { weight: 2, result: { kind: 'item', defRef: 'leather_armor', rarity: 'common' } },
    { weight: 1, result: { kind: 'item', defRef: 'chain_shirt', rarity: 'common' } },
    { weight: 1, result: { kind: 'item', defRef: 'shield', rarity: 'common' } },
    { weight: 1, result: { kind: 'item', defRef: 'dagger_magic_1', rarity: 'uncommon' } }
  ]
};
