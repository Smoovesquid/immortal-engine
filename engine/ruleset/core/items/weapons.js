// Pass T2 — weapon definitions.

export const shortsword = {
  defRef: 'shortsword', name: 'Shortsword', kind: 'weapon', slot: 'main_hand',
  damage: { dice: '1d6', type: 'slashing' }, weight: 2,
  properties: ['finesse', 'light'], rarity: 'common', basePrice: 10
};

export const longsword = {
  defRef: 'longsword', name: 'Longsword', kind: 'weapon', slot: 'main_hand',
  damage: { dice: '1d8', type: 'slashing' }, weight: 3,
  properties: ['versatile'], rarity: 'common', basePrice: 15
};

export const longbow = {
  defRef: 'longbow', name: 'Longbow', kind: 'weapon', slot: 'main_hand',
  damage: { dice: '1d8', type: 'piercing' }, weight: 2,
  properties: ['ranged', 'two-handed'], rarity: 'common', basePrice: 50,
  stat: 'AGILITY'
};
