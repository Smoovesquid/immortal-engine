// CM8 — Necromancy spells.

export const chill_touch = {
  defRef: 'chill_touch', name: 'Chill Touch', level: 0, school: 'necromancy',
  castingTime: 'action', range: '120ft', components: ['V', 'S'],
  duration: 'instant', concentration: false,
  effects: [
    { kind: 'damage', dice: '1d8', damageType: 'necrotic', target: 'single' },
    { kind: 'conditions', condition: { name: 'no_healing', until: { type: 'rounds', rounds: 1 }, severity: 1, stackBehavior: 'replace' } }
  ],
  scalingByLevel: { 5: '2d8', 11: '3d8', 17: '4d8' }
};

export const inflict_wounds = {
  defRef: 'inflict_wounds', name: 'Inflict Wounds', level: 1, school: 'necromancy',
  castingTime: 'action', range: 'touch', components: ['V', 'S'],
  duration: 'instant', concentration: false,
  effects: [{ kind: 'damage', dice: '3d10', damageType: 'necrotic', target: 'single' }],
  scalingByLevel: { extraDice: '1d10' }
};

export const vampiric_touch = {
  defRef: 'vampiric_touch', name: 'Vampiric Touch', level: 3, school: 'necromancy',
  castingTime: 'action', range: 'touch', components: ['V', 'S'],
  duration: '1 minute', concentration: true,
  effects: [
    { kind: 'damage', dice: '3d6', damageType: 'necrotic', target: 'single' },
    { kind: 'heal', dice: 'half_damage', target: 'self' }
  ],
  scalingByLevel: { extraDice: '1d6' }
};

export const blight = {
  defRef: 'blight', name: 'Blight', level: 4, school: 'necromancy',
  castingTime: 'action', range: '30ft', components: ['V', 'S'],
  duration: 'instant', concentration: false,
  savingThrow: { stat: 'GRIT', halfOnSave: true },
  effects: [{ kind: 'damage', dice: '8d8', damageType: 'necrotic', target: 'single' }],
  scalingByLevel: { extraDice: '1d8' }
};

export const ray_of_enfeeblement = {
  defRef: 'ray_of_enfeeblement', name: 'Ray of Enfeeblement', level: 2, school: 'necromancy',
  castingTime: 'action', range: '60ft', components: ['V', 'S'],
  duration: '1 minute', concentration: true,
  effects: [{ kind: 'debuff', stat: 'MIGHT', penalty: -4, target: 'single' }]
};
