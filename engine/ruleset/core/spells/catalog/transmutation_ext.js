// CM8 ext — Transmutation spells (bestiary references).

export const blink = {
  defRef: 'blink', name: 'Blink', level: 3, school: 'transmutation',
  castingTime: 'action', range: 'self', components: ['V', 'S'],
  duration: '1 minute', concentration: false,
  effects: [{ kind: 'conditions', condition: { name: 'blinking', until: { type: 'rounds', rounds: 10 }, severity: 1, stackBehavior: 'replace' } }]
};

export const barkskin = {
  defRef: 'barkskin', name: 'Barkskin', level: 2, school: 'transmutation',
  castingTime: 'action', range: 'touch', components: ['V', 'S', 'M'],
  duration: '1 hour', concentration: true,
  effects: [{ kind: 'buff', stat: 'ac', value: 16, target: 'single' }]
};

export const enhance_ability = {
  defRef: 'enhance_ability', name: 'Enhance Ability', level: 2, school: 'transmutation',
  castingTime: 'action', range: 'touch', components: ['V', 'S', 'M'],
  duration: '1 hour', concentration: true,
  effects: [{ kind: 'buff', stat: 'ability', value: 'advantage', target: 'single' }]
};

export const fly_spell = {
  defRef: 'fly', name: 'Fly', level: 3, school: 'transmutation',
  castingTime: 'action', range: 'touch', components: ['V', 'S', 'M'],
  duration: '10 minutes', concentration: true,
  effects: [{ kind: 'buff', stat: 'speed', value: 60, target: 'single' }]
};

export const goodberry = {
  defRef: 'goodberry', name: 'Goodberry', level: 1, school: 'transmutation',
  castingTime: 'action', range: 'touch', components: ['V', 'S', 'M'],
  duration: 'instant', concentration: false,
  effects: [{ kind: 'heal', dice: '1', target: 'item', count: 10 }]
};

export const polymorph = {
  defRef: 'polymorph', name: 'Polymorph', level: 4, school: 'transmutation',
  castingTime: 'action', range: '60ft', components: ['V', 'S', 'M'],
  duration: '1 hour', concentration: true,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'polymorphed', until: { type: 'concentration' }, severity: 2, stackBehavior: 'replace' } }]
};

export const telekinesis = {
  defRef: 'telekinesis', name: 'Telekinesis', level: 5, school: 'transmutation',
  castingTime: 'action', range: '60ft', components: ['V', 'S'],
  duration: '10 minutes', concentration: true,
  savingThrow: { stat: 'MIGHT', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'restrained', until: { type: 'save', stat: 'MIGHT', dc: 0 }, severity: 1, stackBehavior: 'replace' } }]
};

export const water_breathing = {
  defRef: 'water_breathing', name: 'Water Breathing', level: 3, school: 'transmutation',
  castingTime: 'action', range: '30ft', components: ['V', 'S', 'M'],
  duration: '24 hours', concentration: false,
  effects: [{ kind: 'buff', stat: 'breathing', value: 'aquatic', target: 'multi', maxTargets: 10 }]
};
