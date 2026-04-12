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
