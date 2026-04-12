// Pass B1 — Bandit (CR 0.125)

export const bandit = {
  ref: 'bandit',
  name: 'Bandit',
  cr: 0.125,
  xp: 25,
  maxHp: 11,
  ac: 12,
  damage: 4,
  speed: 30,
  stats: { MIGHT: 11, AGILITY: 12, WITS: 10, GRIT: 10, CHARM: 10 },
  actions: [
    { name: 'Scimitar', toHit: 3, damage: '1d6+1', type: 'slashing' },
    { name: 'Light Crossbow', toHit: 3, damage: '1d8+1', type: 'piercing', range: 80 }
  ],
  traits: [],
  loreHook: 'Desperate or greedy — either way, they want your coin.',
  lootTableRef: 'humanoid_common',
  canParley: true,
  regions: ['westmarch']
};
