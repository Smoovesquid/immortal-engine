// CM8 — Transmutation spells.

export const haste = {
  defRef: 'haste', name: 'Haste', level: 3, school: 'transmutation',
  castingTime: 'action', range: '30ft', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: true,
  effects: [
    { kind: 'buff', stat: 'ac', value: 2, target: 'single' },
    { kind: 'conditions', condition: { name: 'hasted', until: { type: 'concentration' }, severity: 1, stackBehavior: 'replace' } }
  ]
};

export const slow = {
  defRef: 'slow', name: 'Slow', level: 3, school: 'transmutation',
  castingTime: 'action', range: '120ft', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'slowed', until: { type: 'concentration' }, severity: 1, stackBehavior: 'replace' }, area: { shape: 'cube', size: 40 } }]
};

export const enlarge_reduce = {
  defRef: 'enlarge_reduce', name: 'Enlarge/Reduce', level: 2, school: 'transmutation',
  castingTime: 'action', range: '30ft', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: true,
  effects: [{ kind: 'buff', stat: 'damage', value: '1d4', target: 'single' }]
};

export const stone_skin = {
  defRef: 'stone_skin', name: 'Stoneskin', level: 4, school: 'transmutation',
  castingTime: 'action', range: 'touch', components: ['V', 'S', 'M'],
  duration: '1 hour', concentration: true,
  effects: [{ kind: 'buff', stat: 'resistance', value: 'bludgeoning', target: 'single' }]
};

export const feather_fall = {
  defRef: 'feather_fall', name: 'Feather Fall', level: 1, school: 'transmutation',
  castingTime: 'reaction', range: '60ft', components: ['V', 'M'],
  duration: '1 minute', concentration: false,
  effects: [{ kind: 'buff', stat: 'fallDamage', value: 0, target: 'single' }]
};
