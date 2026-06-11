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

// P-69 — the rest of the SRD armor list + the shield.
export const chain_shirt = {
  defRef: 'chain_shirt', name: 'Chain Shirt', kind: 'armor', slot: 'armor',
  ac: 13, maxDexBonus: 2, weight: 20, rarity: 'common', basePrice: 50
};

export const breastplate = {
  defRef: 'breastplate', name: 'Breastplate', kind: 'armor', slot: 'armor',
  ac: 14, maxDexBonus: 2, weight: 20, rarity: 'common', basePrice: 400
};

export const ring_mail = {
  defRef: 'ring_mail', name: 'Ring Mail', kind: 'armor', slot: 'armor',
  ac: 14, maxDexBonus: 0, weight: 40, rarity: 'common', basePrice: 30
};

export const splint_armor = {
  defRef: 'splint_armor', name: 'Splint Armor', kind: 'armor', slot: 'armor',
  ac: 17, maxDexBonus: 0, weight: 60, rarity: 'common', basePrice: 200
};

export const shield = {
  defRef: 'shield', name: 'Shield', kind: 'armor', slot: 'off_hand',
  ac: 2, shield: true, weight: 6, rarity: 'common', basePrice: 10
};
