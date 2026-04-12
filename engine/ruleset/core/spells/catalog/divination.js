// CM8 — Divination spells.

export const guidance = {
  defRef: 'guidance', name: 'Guidance', level: 0, school: 'divination',
  castingTime: 'action', range: 'touch', components: ['V', 'S'],
  duration: '1 minute', concentration: true,
  effects: [{ kind: 'buff', stat: 'skill', value: '1d4', target: 'single' }]
};

export const detect_magic = {
  defRef: 'detect_magic', name: 'Detect Magic', level: 1, school: 'divination',
  castingTime: 'action', range: 'self', components: ['V', 'S'],
  duration: '10 minutes', concentration: true,
  effects: [{ kind: 'buff', stat: 'senses', value: 'magic_sight', target: 'self' }]
};

export const identify = {
  defRef: 'identify', name: 'Identify', level: 1, school: 'divination',
  castingTime: '1 minute', range: 'touch', components: ['V', 'S', 'M'],
  duration: 'instant', concentration: false,
  effects: [{ kind: 'buff', stat: 'knowledge', value: 'item_properties', target: 'single' }]
};

export const see_invisibility = {
  defRef: 'see_invisibility', name: 'See Invisibility', level: 2, school: 'divination',
  castingTime: 'action', range: 'self', components: ['V', 'S', 'M'],
  duration: '1 hour', concentration: false,
  effects: [{ kind: 'buff', stat: 'senses', value: 'truesight', target: 'self' }]
};

export const true_strike = {
  defRef: 'true_strike', name: 'True Strike', level: 0, school: 'divination',
  castingTime: 'action', range: '30ft', components: ['S'],
  duration: '1 round', concentration: true,
  effects: [{ kind: 'buff', stat: 'attack', value: 'advantage', target: 'self' }]
};
