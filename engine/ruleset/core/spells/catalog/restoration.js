// CM8 — Restoration spells.

export const cure_wounds = {
  defRef: 'cure_wounds', name: 'Cure Wounds', level: 1, school: 'restoration',
  castingTime: 'action', range: 'touch', components: ['V', 'S'],
  duration: 'instant', concentration: false,
  effects: [{ kind: 'heal', dice: '1d8+3', target: 'single' }],
  scalingByLevel: { extraDice: '1d8' }
};

export const healing_word = {
  defRef: 'healing_word', name: 'Healing Word', level: 1, school: 'restoration',
  castingTime: 'bonus_action', range: '60ft', components: ['V'],
  duration: 'instant', concentration: false,
  effects: [{ kind: 'heal', dice: '1d4+3', target: 'single' }],
  scalingByLevel: { extraDice: '1d4' }
};

export const lesser_restoration = {
  defRef: 'lesser_restoration', name: 'Lesser Restoration', level: 2, school: 'restoration',
  castingTime: 'action', range: 'touch', components: ['V', 'S'],
  duration: 'instant', concentration: false,
  effects: [{ kind: 'conditions', removeCondition: true, conditionNames: ['poisoned', 'blinded', 'deafened', 'paralyzed'], target: 'single' }]
};

export const greater_restoration = {
  defRef: 'greater_restoration', name: 'Greater Restoration', level: 5, school: 'restoration',
  castingTime: 'action', range: 'touch', components: ['V', 'S', 'M'],
  duration: 'instant', concentration: false,
  effects: [{ kind: 'conditions', removeCondition: true, conditionNames: ['charmed', 'petrified', 'cursed', 'exhaustion', 'stunned'], target: 'single' }]
};

export const mass_healing_word = {
  defRef: 'mass_healing_word', name: 'Mass Healing Word', level: 3, school: 'restoration',
  castingTime: 'bonus_action', range: '60ft', components: ['V'],
  duration: 'instant', concentration: false,
  effects: [{ kind: 'heal', dice: '1d4+3', target: 'party' }],
  scalingByLevel: { extraDice: '1d4' }
};
