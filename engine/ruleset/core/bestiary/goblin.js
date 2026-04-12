// Pass B1 — Goblin (CR 0.25)

export const goblin = {
  ref: 'goblin',
  name: 'Goblin',
  cr: 0.25,
  xp: 50,
  maxHp: 12,
  ac: 15,
  damage: 5,
  speed: 30,
  stats: { MIGHT: 8, AGILITY: 14, WITS: 10, GRIT: 10, CHARM: 8 },
  actions: [
    { name: 'Scimitar', toHit: 4, damage: '1d6+2', type: 'slashing' },
    { name: 'Shortbow', toHit: 4, damage: '1d6+2', type: 'piercing', range: 80 }
  ],
  traits: ['Nimble Escape'],
  loreHook: 'Small, cunning, and always in groups.',
  lootTableRef: 'humanoid_common',
  canParley: true,
  regions: ['westmarch']
};
