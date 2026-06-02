// CM8 ext — Necromancy spells (bestiary references).

export const blindness_deafness = {
  defRef: 'blindness_deafness', name: 'Blindness/Deafness', level: 2, school: 'necromancy',
  castingTime: 'action', range: '30ft', components: ['V'],
  duration: '1 minute', concentration: false,
  savingThrow: { stat: 'GRIT', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'blinded', until: { type: 'save', stat: 'GRIT', dc: 0 }, severity: 1, stackBehavior: 'replace' } }]
};

export const animate_dead = {
  defRef: 'animate_dead', name: 'Animate Dead', level: 3, school: 'necromancy',
  castingTime: '1 minute', range: '10ft', components: ['V', 'S', 'M'],
  duration: 'instant', concentration: false,
  effects: [{ kind: 'summon', creature: 'skeleton_or_zombie', count: 1, target: 'corpse' }],
  scalingByLevel: { extraSummons: 2 }
};

export const bestow_curse = {
  defRef: 'bestow_curse', name: 'Bestow Curse', level: 3, school: 'necromancy',
  castingTime: 'action', range: 'touch', components: ['V', 'S'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'cursed', until: { type: 'concentration' }, severity: 2, stackBehavior: 'highest' } }]
};

export const contagion = {
  defRef: 'contagion', name: 'Contagion', level: 5, school: 'necromancy',
  castingTime: 'action', range: 'touch', components: ['V', 'S'],
  duration: '7 days', concentration: false,
  savingThrow: { stat: 'GRIT', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'diseased', until: { type: 'save', stat: 'GRIT', dc: 0 }, severity: 2, stackBehavior: 'replace' } }]
};

export const false_life = {
  defRef: 'false_life', name: 'False Life', level: 1, school: 'necromancy',
  castingTime: 'action', range: 'self', components: ['V', 'S', 'M'],
  duration: '1 hour', concentration: false,
  effects: [{ kind: 'buff', stat: 'tempHP', value: '1d4+4', target: 'self' }],
  scalingByLevel: { extraTempHP: 5 }
};

export const gentle_repose = {
  defRef: 'gentle_repose', name: 'Gentle Repose', level: 2, school: 'necromancy',
  castingTime: 'action', range: 'touch', components: ['V', 'S', 'M'],
  duration: '10 days', concentration: false,
  effects: [{ kind: 'conditions', condition: { name: 'preserved', until: { type: 'duration' }, severity: 1, stackBehavior: 'replace' } }]
};

export const ray_of_sickness = {
  defRef: 'ray_of_sickness', name: 'Ray of Sickness', level: 1, school: 'necromancy',
  castingTime: 'action', range: '60ft', components: ['V', 'S'],
  duration: 'instant', concentration: false,
  savingThrow: { stat: 'GRIT', halfOnSave: false },
  effects: [
    { kind: 'damage', dice: '2d8', damageType: 'poison', target: 'single' },
    { kind: 'conditions', condition: { name: 'poisoned', until: { type: 'rounds', rounds: 1 }, severity: 1, stackBehavior: 'replace' } }
  ],
  scalingByLevel: { extraDice: '1d8' }
};
