// CM8 — Chronomancy spells (time magic — unique to this world).

export const temporal_bolt = {
  defRef: 'temporal_bolt', name: 'Temporal Bolt', level: 0, school: 'chronomancy',
  castingTime: 'action', range: '90ft', components: ['V', 'S'],
  duration: 'instant', concentration: false,
  effects: [
    { kind: 'damage', dice: '1d8', damageType: 'temporal', target: 'single' },
    { kind: 'debuff', stat: 'initiative', penalty: -2, target: 'single' }
  ],
  scalingByLevel: { 5: '2d8', 11: '3d8', 17: '4d8' }
};

export const time_stop = {
  defRef: 'time_stop', name: 'Time Stop', level: 5, school: 'chronomancy',
  castingTime: 'action', range: 'self', components: ['V'],
  duration: '1 round', concentration: false,
  effects: [{ kind: 'buff', stat: 'extraTurns', value: 2, target: 'self' }]
};

export const age_ray = {
  defRef: 'age_ray', name: 'Age Ray', level: 2, school: 'chronomancy',
  castingTime: 'action', range: '60ft', components: ['V', 'S'],
  duration: 'instant', concentration: false,
  savingThrow: { stat: 'GRIT', halfOnSave: true },
  effects: [{ kind: 'damage', dice: '3d8', damageType: 'temporal', target: 'single' }],
  scalingByLevel: { extraDice: '1d8' }
};

export const temporal_shield = {
  defRef: 'temporal_shield', name: 'Temporal Shield', level: 1, school: 'chronomancy',
  castingTime: 'reaction', range: 'self', components: ['V', 'S'],
  duration: '1 round', concentration: false,
  effects: [{ kind: 'acBoost', value: 4 }]
};

export const entropic_decay = {
  defRef: 'entropic_decay', name: 'Entropic Decay', level: 4, school: 'chronomancy',
  castingTime: 'action', range: '60ft', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'GRIT', halfOnSave: false },
  effects: [
    { kind: 'damage', dice: '4d6', damageType: 'entropic', target: 'single' },
    { kind: 'debuff', stat: 'GRIT', penalty: -2, target: 'single' }
  ],
  scalingByLevel: { extraDice: '1d6' }
};
