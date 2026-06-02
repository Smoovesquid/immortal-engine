// CM8 ext — Illusion spells (bestiary references).

export const dancing_lights = {
  defRef: 'dancing_lights', name: 'Dancing Lights', level: 0, school: 'illusion',
  castingTime: 'action', range: '120ft', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: true,
  effects: [{ kind: 'buff', stat: 'light', value: 'dim', target: 'area' }]
};

export const darkness = {
  defRef: 'darkness', name: 'Darkness', level: 2, school: 'illusion',
  castingTime: 'action', range: '60ft', components: ['V', 'M'],
  duration: '10 minutes', concentration: true,
  effects: [{ kind: 'conditions', condition: { name: 'heavily_obscured', until: { type: 'concentration' }, severity: 2, stackBehavior: 'replace' }, area: { shape: 'sphere', radius: 15 } }]
};

export const disguise_self = {
  defRef: 'disguise_self', name: 'Disguise Self', level: 1, school: 'illusion',
  castingTime: 'action', range: 'self', components: ['V', 'S'],
  duration: '1 hour', concentration: false,
  effects: [{ kind: 'buff', stat: 'appearance', value: 'disguised', target: 'self' }]
};

export const dream = {
  defRef: 'dream', name: 'Dream', level: 5, school: 'illusion',
  castingTime: '1 minute', range: 'special', components: ['V', 'S', 'M'],
  duration: '8 hours', concentration: false,
  effects: [{ kind: 'buff', stat: 'communication', value: 'dream_message', target: 'single' }]
};

export const faerie_fire = {
  defRef: 'faerie_fire', name: 'Faerie Fire', level: 1, school: 'illusion',
  castingTime: 'action', range: '60ft', components: ['V'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'AGILITY', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'outlined', until: { type: 'concentration' }, severity: 1, stackBehavior: 'replace' }, area: { shape: 'cube', size: 20 } }]
};

export const greater_invisibility = {
  defRef: 'greater_invisibility', name: 'Greater Invisibility', level: 4, school: 'illusion',
  castingTime: 'action', range: 'touch', components: ['V', 'S'],
  duration: '1 minute', concentration: true,
  effects: [{ kind: 'conditions', condition: { name: 'invisible', until: { type: 'concentration' }, severity: 2, stackBehavior: 'highest' } }]
};

export const mirage_arcane = {
  defRef: 'mirage_arcane', name: 'Mirage Arcane', level: 7, school: 'illusion',
  castingTime: '10 minutes', range: 'sight', components: ['V', 'S'],
  duration: '10 days', concentration: false,
  effects: [{ kind: 'buff', stat: 'terrain', value: 'illusory_terrain', target: 'area', area: { shape: 'square', size: 5280 } }]
};

export const phantasmal_force = {
  defRef: 'phantasmal_force', name: 'Phantasmal Force', level: 2, school: 'illusion',
  castingTime: 'action', range: '60ft', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'damage', dice: '1d6', damageType: 'psychic', target: 'single' }]
};

export const project_image = {
  defRef: 'project_image', name: 'Project Image', level: 7, school: 'illusion',
  castingTime: 'action', range: '500mi', components: ['V', 'S', 'M'],
  duration: '24 hours', concentration: true,
  effects: [{ kind: 'buff', stat: 'senses', value: 'illusory_double', target: 'self' }]
};

export const silence = {
  defRef: 'silence', name: 'Silence', level: 2, school: 'illusion',
  castingTime: 'action', range: '120ft', components: ['V', 'S'],
  duration: '10 minutes', concentration: true,
  effects: [{ kind: 'conditions', condition: { name: 'silenced', until: { type: 'concentration' }, severity: 1, stackBehavior: 'replace' }, area: { shape: 'sphere', radius: 20 } }]
};

export const silent_image = {
  defRef: 'silent_image', name: 'Silent Image', level: 1, school: 'illusion',
  castingTime: 'action', range: '60ft', components: ['V', 'S', 'M'],
  duration: '10 minutes', concentration: true,
  effects: [{ kind: 'buff', stat: 'illusion', value: 'visual_only', target: 'area', area: { shape: 'cube', size: 15 } }]
};
