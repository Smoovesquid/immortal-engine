// CM8 — Enchantment spells.

export const command = {
  defRef: 'command', name: 'Command', level: 1, school: 'enchantment',
  castingTime: 'action', range: '60ft', components: ['V'],
  duration: '1 round', concentration: false,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'commanded', until: { type: 'rounds', rounds: 1 }, severity: 1, stackBehavior: 'replace' } }]
};

export const hold_person = {
  defRef: 'hold_person', name: 'Hold Person', level: 2, school: 'enchantment',
  castingTime: 'action', range: '60ft', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'paralyzed', until: { type: 'save', stat: 'WITS', dc: 0 }, severity: 1, stackBehavior: 'replace' } }]
};

export const charm_person = {
  defRef: 'charm_person', name: 'Charm Person', level: 1, school: 'enchantment',
  castingTime: 'action', range: '30ft', components: ['V', 'S'],
  duration: '1 hour', concentration: false,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'charmed', until: { type: 'rounds', rounds: 10 }, severity: 1, stackBehavior: 'replace' } }]
};

export const fear = {
  defRef: 'fear', name: 'Fear', level: 3, school: 'enchantment',
  castingTime: 'action', range: 'self', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'frightened', until: { type: 'save', stat: 'WITS', dc: 0 }, severity: 1, stackBehavior: 'replace' }, area: { shape: 'cone', length: 30 } }]
};

export const hideous_laughter = {
  defRef: 'hideous_laughter', name: 'Hideous Laughter', level: 1, school: 'enchantment',
  castingTime: 'action', range: '30ft', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'incapacitated', until: { type: 'save', stat: 'WITS', dc: 0 }, severity: 1, stackBehavior: 'replace' } }]
};
