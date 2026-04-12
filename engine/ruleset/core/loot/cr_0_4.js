// CM5 — loot table for CR 0–4 creatures.

export const cr_0_4 = {
  id: 'cr_0_4',
  rolls: 1,
  entries: [
    { weight: 35, result: null },
    { weight: 25, result: { kind: 'currency', currency: 'copper', amount: '2d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'silver', amount: '1d6' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 8, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'shortsword', rarity: 'common' } },
    { weight: 2, result: { kind: 'item', defRef: 'leather_armor', rarity: 'common' } }
  ]
};
