// Pass B1 — Wolf (CR 0.25)

export const wolf = {
  ref: 'wolf',
  name: 'Wolf',
  cr: 0.25,
  xp: 50,
  maxHp: 11,
  ac: 13,
  damage: 7,
  speed: 40,
  stats: { MIGHT: 12, AGILITY: 15, WITS: 3, GRIT: 12, CHARM: 6 },
  actions: [
    { name: 'Bite', toHit: 4, damage: '2d4+2', type: 'piercing' }
  ],
  traits: ['Pack Tactics', 'Keen Hearing and Smell'],
  loreHook: 'Hunts in packs, circling prey before striking.',
  lootTableRef: 'monstrous_common',
  canParley: false,
  regions: ['westmarch', 'ashenmoor']
};
