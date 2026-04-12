// Pass B1 — Goblin Archer (CR 0.25)

export const goblin_archer = {
  ref: 'goblin_archer',
  name: 'Goblin Archer',
  cr: 0.25,
  xp: 50,
  maxHp: 12,
  ac: 13,
  damage: 5,
  speed: 30,
  stats: { MIGHT: 8, AGILITY: 14, WITS: 10, GRIT: 10, CHARM: 8 },
  actions: [
    { name: 'Shortbow', toHit: 4, damage: '1d6+2', type: 'piercing', range: 80 },
    { name: 'Dagger', toHit: 4, damage: '1d4+2', type: 'piercing' }
  ],
  traits: ['Nimble Escape'],
  loreHook: 'Prefers to strike from cover, loosing arrows before fleeing.',
  lootTableRef: 'humanoid_common',
  canParley: true,
  regions: ['westmarch']
};
