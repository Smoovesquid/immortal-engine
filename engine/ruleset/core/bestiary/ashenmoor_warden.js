// Pass B1 — The Peat Warden (CR 1, Ashenmoor unique)

export const ashenmoor_warden = {
  ref: 'ashenmoor_warden',
  name: 'The Peat Warden',
  cr: 1,
  xp: 200,
  maxHp: 33,
  ac: 14,
  damage: 8,
  speed: 25,
  stats: { MIGHT: 16, AGILITY: 10, WITS: 12, GRIT: 16, CHARM: 6 },
  actions: [
    { name: 'Peat-Crusted Fist', toHit: 5, damage: '1d8+3', type: 'bludgeoning' },
    { name: 'Bog Grasp', toHit: 5, damage: '1d6+3', type: 'necrotic', range: 15 }
  ],
  traits: ['Swamp Camouflage', 'Undercroft Warding'],
  loreHook: 'A shambling guardian bound to the sealed undercroft beneath the moor.',
  lootTableRef: 'monstrous_common',
  canParley: false,
  regions: ['ashenmoor']
};
