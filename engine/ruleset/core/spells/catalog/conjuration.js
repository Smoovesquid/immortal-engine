// CM8 — Conjuration spells (new entries; misty_step remains in top-level file).

export const grease = {
  defRef: 'grease', name: 'Grease', level: 1, school: 'conjuration',
  castingTime: 'action', range: '60ft', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: false,
  savingThrow: { stat: 'AGILITY', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'prone', until: { type: 'save', stat: 'AGILITY', dc: 0 }, severity: 1, stackBehavior: 'replace' }, area: { shape: 'square', size: 10 } }]
};

export const web = {
  defRef: 'web', name: 'Web', level: 2, school: 'conjuration',
  castingTime: 'action', range: '60ft', components: ['V', 'S', 'M'],
  duration: '1 hour', concentration: true,
  savingThrow: { stat: 'AGILITY', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'restrained', until: { type: 'save', stat: 'MIGHT', dc: 0 }, severity: 1, stackBehavior: 'replace' }, area: { shape: 'cube', size: 20 } }]
};

export const acid_splash = {
  defRef: 'acid_splash', name: 'Acid Splash', level: 0, school: 'conjuration',
  castingTime: 'action', range: '60ft', components: ['V', 'S'],
  duration: 'instant', concentration: false,
  savingThrow: { stat: 'AGILITY', halfOnSave: false },
  effects: [{ kind: 'damage', dice: '1d6', damageType: 'acid', target: 'single' }],
  scalingByLevel: { 5: '2d6', 11: '3d6', 17: '4d6' }
};

export const stinking_cloud = {
  defRef: 'stinking_cloud', name: 'Stinking Cloud', level: 3, school: 'conjuration',
  castingTime: 'action', range: '90ft', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'GRIT', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'poisoned', until: { type: 'rounds', rounds: 3 }, severity: 1, stackBehavior: 'replace' }, area: { shape: 'sphere', radius: 20 } }]
};
