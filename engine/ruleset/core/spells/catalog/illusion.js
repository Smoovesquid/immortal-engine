// CM8 — Illusion spells.

export const minor_illusion = {
  defRef: 'minor_illusion', name: 'Minor Illusion', level: 0, school: 'illusion',
  castingTime: 'action', range: '30ft', components: ['S', 'M'],
  duration: '1 minute', concentration: false,
  effects: [{ kind: 'buff', stat: 'stealth', value: 'advantage', target: 'self' }]
};

export const blur = {
  defRef: 'blur', name: 'Blur', level: 2, school: 'illusion',
  castingTime: 'action', range: 'self', components: ['V'],
  duration: '1 minute', concentration: true,
  effects: [{ kind: 'buff', stat: 'ac', value: 2, target: 'self' }]
};

export const invisibility = {
  defRef: 'invisibility', name: 'Invisibility', level: 2, school: 'illusion',
  castingTime: 'action', range: 'touch', components: ['V', 'S', 'M'],
  duration: '1 hour', concentration: true,
  effects: [{ kind: 'conditions', condition: { name: 'invisible', until: { type: 'concentration' }, severity: 1, stackBehavior: 'replace' } }]
};

export const mirror_image = {
  defRef: 'mirror_image', name: 'Mirror Image', level: 2, school: 'illusion',
  castingTime: 'action', range: 'self', components: ['V', 'S'],
  duration: '1 minute', concentration: false,
  effects: [{ kind: 'buff', stat: 'images', value: 3, target: 'self' }]
};

export const phantasmal_killer = {
  defRef: 'phantasmal_killer', name: 'Phantasmal Killer', level: 4, school: 'illusion',
  castingTime: 'action', range: '120ft', components: ['V', 'S'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'WITS', halfOnSave: true },
  effects: [
    { kind: 'damage', dice: '4d10', damageType: 'psychic', target: 'single' },
    { kind: 'conditions', condition: { name: 'frightened', until: { type: 'save', stat: 'WITS', dc: 0 }, severity: 2, stackBehavior: 'highest' } }
  ],
  scalingByLevel: { extraDice: '1d10' }
};
