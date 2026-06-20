// Pass T2 — consumable definitions.

export const healing_potion_minor = {
  defRef: 'healing_potion_minor', name: 'Minor Healing Potion', kind: 'consumable',
  slot: null, weight: 0.5, rarity: 'common', basePrice: 50,
  effect: { kind: 'heal', amount: '2d4+2' }
};

export const antidote = {
  defRef: 'antidote', name: 'Antidote', kind: 'consumable',
  slot: null, weight: 0, rarity: 'common', basePrice: 50,
  effect: { kind: 'removeCondition', condition: 'poisoned' }
};

// P-69 — the healing ladder.
export const healing_potion_greater = {
  defRef: 'healing_potion_greater', name: 'Greater Healing Potion', kind: 'consumable',
  slot: null, weight: 0.5, rarity: 'uncommon', basePrice: 150,
  effect: { kind: 'heal', amount: '4d4+4' }
};

export const healing_potion_superior = {
  defRef: 'healing_potion_superior', name: 'Superior Healing Potion', kind: 'consumable',
  slot: null, weight: 0.5, rarity: 'rare', basePrice: 450,
  effect: { kind: 'heal', amount: '8d4+8' }
};

// H-45 — the fantasy pack's starting-gear flavor consumables, wired to real
// effects (gear.json/fantasyGear.js carry a matching defRef). Rations and
// Lamp oil stay flavor-only on purpose — no def here for those.
export const bandages = {
  defRef: 'bandages', name: 'Bandages', kind: 'consumable',
  slot: null, weight: 1, rarity: 'common', basePrice: 5,
  effect: { kind: 'heal', amount: '1d4', applied: true }
};

export const tonic_of_grit = {
  defRef: 'tonic_of_grit', name: 'Tonic of grit', kind: 'consumable',
  slot: null, weight: 1, rarity: 'common', basePrice: 15,
  effect: { kind: 'heal', amount: '2d4' }
};

export const holy_water_questionable = {
  defRef: 'holy_water_questionable', name: 'Holy water (questionable)', kind: 'consumable',
  slot: null, weight: 1, rarity: 'common', basePrice: 20,
  effect: { kind: 'removeCondition', condition: 'cursed' }
};
