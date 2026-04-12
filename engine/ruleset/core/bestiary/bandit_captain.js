// Pass B1 — Bandit Captain (CR 2)

export const bandit_captain = {
  ref: 'bandit_captain',
  name: 'Bandit Captain',
  cr: 2,
  xp: 450,
  maxHp: 65,
  ac: 15,
  damage: 10,
  speed: 30,
  stats: { MIGHT: 15, AGILITY: 16, WITS: 14, GRIT: 14, CHARM: 14 },
  actions: [
    { name: 'Scimitar', toHit: 5, damage: '1d6+3', type: 'slashing' },
    { name: 'Dagger', toHit: 5, damage: '1d4+3', type: 'piercing' },
    { name: 'Multiattack', toHit: 5, damage: '2d6+6', type: 'slashing' }
  ],
  traits: ['Multiattack'],
  loreHook: 'Commands through cunning and fear. Always has an escape plan.',
  lootTableRef: 'humanoid_common',
  canParley: true,
  regions: ['westmarch']
};
