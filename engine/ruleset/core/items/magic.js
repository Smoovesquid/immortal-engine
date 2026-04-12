// Pass T2 — magic item definitions.

export const longsword_magic_1 = {
  defRef: 'longsword_magic_1', name: 'Sword of Morning', kind: 'weapon', slot: 'main_hand',
  damage: { dice: '1d8', type: 'slashing' }, weight: 3,
  bonus: { attack: 1, damage: 1 },
  properties: ['versatile', 'light (bright radius 10ft)'], rarity: 'uncommon', basePrice: 500
};

export const ring_of_protection = {
  defRef: 'ring_of_protection', name: 'Ring of Protection', kind: 'accessory', slot: 'ring',
  acBonus: 1, weight: 0, rarity: 'uncommon', basePrice: 500
};
