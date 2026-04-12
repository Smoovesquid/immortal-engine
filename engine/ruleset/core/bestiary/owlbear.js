// Pass B1 — Owlbear (CR 3)

export const owlbear = {
  ref: 'owlbear',
  name: 'Owlbear',
  cr: 3,
  xp: 700,
  maxHp: 68,
  ac: 13,
  damage: 14,
  speed: 40,
  stats: { MIGHT: 20, AGILITY: 12, WITS: 3, GRIT: 17, CHARM: 7 },
  actions: [
    { name: 'Beak', toHit: 7, damage: '1d10+5', type: 'piercing' },
    { name: 'Claws', toHit: 7, damage: '2d8+5', type: 'slashing' }
  ],
  traits: ['Keen Sight and Smell', 'Multiattack'],
  loreHook: 'A feathered terror that nests in ruins and caves.',
  lootTableRef: 'monstrous_common',
  canParley: false,
  regions: ['ashenmoor']
};
