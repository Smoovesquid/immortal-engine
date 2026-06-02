// CM8 ext — Divination spells (bestiary references).

export const augury = {
  defRef: 'augury', name: 'Augury', level: 2, school: 'divination',
  castingTime: '1 minute', range: 'self', components: ['V', 'S', 'M'],
  duration: 'instant', concentration: false,
  effects: [{ kind: 'buff', stat: 'knowledge', value: 'omen', target: 'self' }]
};

export const comprehend_languages = {
  defRef: 'comprehend_languages', name: 'Comprehend Languages', level: 1, school: 'divination',
  castingTime: 'action', range: 'self', components: ['V', 'S', 'M'],
  duration: '1 hour', concentration: false,
  effects: [{ kind: 'buff', stat: 'senses', value: 'all_languages', target: 'self' }]
};

export const contact_other_plane = {
  defRef: 'contact_other_plane', name: 'Contact Other Plane', level: 5, school: 'divination',
  castingTime: '1 minute', range: 'self', components: ['V'],
  duration: '1 minute', concentration: false,
  effects: [{ kind: 'buff', stat: 'knowledge', value: 'extraplanar_contact', target: 'self' }]
};

export const detect_poison = {
  defRef: 'detect_poison', name: 'Detect Poison', level: 1, school: 'divination',
  castingTime: 'action', range: 'self', components: ['V', 'S', 'M'],
  duration: '10 minutes', concentration: true,
  effects: [{ kind: 'buff', stat: 'senses', value: 'poison_sight', target: 'self' }]
};

export const detect_poison_and_disease = {
  defRef: 'detect_poison_and_disease', name: 'Detect Poison and Disease', level: 1, school: 'divination',
  castingTime: 'action', range: 'self', components: ['V', 'S', 'M'],
  duration: '10 minutes', concentration: true,
  effects: [{ kind: 'buff', stat: 'senses', value: 'poison_disease_sight', target: 'self' }]
};

export const detect_thoughts = {
  defRef: 'detect_thoughts', name: 'Detect Thoughts', level: 2, school: 'divination',
  castingTime: 'action', range: 'self', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'buff', stat: 'senses', value: 'telepathy_read', target: 'self' }]
};

export const legend_lore = {
  defRef: 'legend_lore', name: 'Legend Lore', level: 5, school: 'divination',
  castingTime: '10 minutes', range: 'self', components: ['V', 'S', 'M'],
  duration: 'instant', concentration: false,
  effects: [{ kind: 'buff', stat: 'knowledge', value: 'legend', target: 'self' }]
};

export const nondetection = {
  defRef: 'nondetection', name: 'Nondetection', level: 3, school: 'divination',
  castingTime: 'action', range: 'touch', components: ['V', 'S', 'M'],
  duration: '8 hours', concentration: false,
  effects: [{ kind: 'buff', stat: 'stealth', value: 'undetectable', target: 'single' }]
};

export const scrying = {
  defRef: 'scrying', name: 'Scrying', level: 5, school: 'divination',
  castingTime: '10 minutes', range: 'self', components: ['V', 'S', 'M'],
  duration: '10 minutes', concentration: true,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'buff', stat: 'senses', value: 'remote_viewing', target: 'self' }]
};
