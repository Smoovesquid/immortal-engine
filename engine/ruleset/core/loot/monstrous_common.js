// Pass T2 — monstrous common loot table.

export const monstrous_common = {
  id: 'monstrous_common',
  rolls: 1,
  entries: [
    { weight: 40, result: null },
    { weight: 30, result: { kind: 'currency', currency: 'silver', amount: '1d6' } },
    { weight: 15, result: { kind: 'item', defRef: 'healing_potion_minor' } },
    { weight: 10, result: { kind: 'currency', currency: 'copper', amount: '2d6' } },
    { weight: 5, result: { kind: 'item', defRef: 'antidote' } }
  ]
};
