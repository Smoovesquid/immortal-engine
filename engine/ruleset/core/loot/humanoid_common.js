// Pass T2 — humanoid common loot table.

export const humanoid_common = {
  id: 'humanoid_common',
  rolls: 1,
  entries: [
    { weight: 35, result: null },
    { weight: 25, result: { kind: 'currency', currency: 'silver', amount: '2d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'gold', amount: '1d4' } },
    { weight: 15, result: { kind: 'item', defRef: 'healing_potion_minor' } },
    { weight: 10, result: { kind: 'item', defRef: 'shortsword' } }
  ]
};
