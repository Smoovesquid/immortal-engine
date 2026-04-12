// Pass T2 — armor definitions.

export const leather_armor = {
  defRef: 'leather_armor', name: 'Leather Armor', kind: 'armor', slot: 'armor',
  ac: 11, maxDexBonus: null, weight: 10, rarity: 'common', basePrice: 10
};

export const chain_mail = {
  defRef: 'chain_mail', name: 'Chain Mail', kind: 'armor', slot: 'armor',
  ac: 16, maxDexBonus: 0, weight: 55, rarity: 'common', basePrice: 75
};

export const studded_leather = {
  defRef: 'studded_leather', name: 'Studded Leather', kind: 'armor', slot: 'armor',
  ac: 12, maxDexBonus: null, weight: 13, rarity: 'common', basePrice: 45
};

// CM4 — five additional armor types spanning light → heavy.
export const padded = {
  defRef: 'padded', name: 'Padded Armor', kind: 'armor', slot: 'armor',
  ac: 11, maxDexBonus: null, weight: 8, rarity: 'common', basePrice: 5
};

export const hide_armor = {
  defRef: 'hide_armor', name: 'Hide Armor', kind: 'armor', slot: 'armor',
  ac: 12, maxDexBonus: 2, weight: 12, rarity: 'common', basePrice: 10
};

export const scale_mail = {
  defRef: 'scale_mail', name: 'Scale Mail', kind: 'armor', slot: 'armor',
  ac: 14, maxDexBonus: 2, weight: 45, rarity: 'common', basePrice: 50
};

export const half_plate = {
  defRef: 'half_plate', name: 'Half Plate', kind: 'armor', slot: 'armor',
  ac: 15, maxDexBonus: 2, weight: 40, rarity: 'uncommon', basePrice: 750
};

export const plate_armor = {
  defRef: 'plate_armor', name: 'Plate Armor', kind: 'armor', slot: 'armor',
  ac: 18, maxDexBonus: 0, weight: 65, rarity: 'rare', basePrice: 1500
};
