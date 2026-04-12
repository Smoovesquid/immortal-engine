// Pass B1 — Cultist (CR 0.125)

export const cultist = {
  ref: 'cultist',
  name: 'Cultist',
  cr: 0.125,
  xp: 25,
  maxHp: 9,
  ac: 12,
  damage: 4,
  speed: 30,
  stats: { MIGHT: 11, AGILITY: 12, WITS: 10, GRIT: 10, CHARM: 11 },
  actions: [
    { name: 'Scimitar', toHit: 3, damage: '1d6+1', type: 'slashing' },
    { name: 'Dark Invocation', toHit: 3, damage: '1d8', type: 'necrotic', range: 60 }
  ],
  traits: ['Dark Devotion'],
  loreHook: 'Chants to powers best left unnamed. Eyes glow faintly in the dark.',
  lootTableRef: 'humanoid_common',
  canParley: true,
  regions: ['ashenmoor']
};
