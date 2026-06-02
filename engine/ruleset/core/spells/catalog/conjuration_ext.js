// CM8 ext — Conjuration spells (bestiary references).
// Also includes arms_of_hadar and plane_shift (conjuration school).

export const arms_of_hadar = {
  defRef: 'arms_of_hadar', name: 'Arms of Hadar', level: 1, school: 'conjuration',
  castingTime: 'action', range: 'self', components: ['V', 'S'],
  duration: 'instant', concentration: false,
  savingThrow: { stat: 'MIGHT', halfOnSave: true },
  effects: [{ kind: 'damage', dice: '2d6', damageType: 'necrotic', area: { shape: 'sphere', radius: 10 }, saveHalf: true }],
  scalingByLevel: { extraDice: '1d6' }
};

export const cloudkill = {
  defRef: 'cloudkill', name: 'Cloudkill', level: 5, school: 'conjuration',
  castingTime: 'action', range: '120ft', components: ['V', 'S'],
  duration: '10 minutes', concentration: true,
  savingThrow: { stat: 'GRIT', halfOnSave: true },
  effects: [{ kind: 'damage', dice: '5d8', damageType: 'poison', area: { shape: 'sphere', radius: 20 }, saveHalf: true }]
};

export const dimension_door = {
  defRef: 'dimension_door', name: 'Dimension Door', level: 4, school: 'conjuration',
  castingTime: 'action', range: '500ft', components: ['V'],
  duration: 'instant', concentration: false,
  effects: [{ kind: 'teleport', distance: 500, target: 'self_plus_one' }]
};

export const entangle = {
  defRef: 'entangle', name: 'Entangle', level: 1, school: 'conjuration',
  castingTime: 'action', range: '90ft', components: ['V', 'S'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'MIGHT', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'restrained', until: { type: 'save', stat: 'MIGHT', dc: 0 }, severity: 1, stackBehavior: 'replace' }, area: { shape: 'square', size: 20 } }]
};

export const fog_cloud = {
  defRef: 'fog_cloud', name: 'Fog Cloud', level: 1, school: 'conjuration',
  castingTime: 'action', range: '120ft', components: ['V', 'S'],
  duration: '1 hour', concentration: true,
  effects: [{ kind: 'conditions', condition: { name: 'heavily_obscured', until: { type: 'concentration' }, severity: 1, stackBehavior: 'replace' }, area: { shape: 'sphere', radius: 20 } }],
  scalingByLevel: { extraRadius: 20 }
};

export const gaseous_form = {
  defRef: 'gaseous_form', name: 'Gaseous Form', level: 3, school: 'conjuration',
  castingTime: 'action', range: 'touch', components: ['V', 'S', 'M'],
  duration: '1 hour', concentration: true,
  effects: [{ kind: 'conditions', condition: { name: 'gaseous', until: { type: 'concentration' }, severity: 1, stackBehavior: 'replace' } }]
};

export const insect_plague = {
  defRef: 'insect_plague', name: 'Insect Plague', level: 5, school: 'conjuration',
  castingTime: 'action', range: '300ft', components: ['V', 'S', 'M'],
  duration: '10 minutes', concentration: true,
  savingThrow: { stat: 'GRIT', halfOnSave: true },
  effects: [{ kind: 'damage', dice: '4d10', damageType: 'piercing', area: { shape: 'sphere', radius: 20 }, saveHalf: true }],
  scalingByLevel: { extraDice: '1d10' }
};

export const spike_growth = {
  defRef: 'spike_growth', name: 'Spike Growth', level: 2, school: 'conjuration',
  castingTime: 'action', range: '150ft', components: ['V', 'S', 'M'],
  duration: '10 minutes', concentration: true,
  effects: [{ kind: 'damage', dice: '2d4', damageType: 'piercing', area: { shape: 'sphere', radius: 20 } }]
};

export const spirit_guardians = {
  defRef: 'spirit_guardians', name: 'Spirit Guardians', level: 3, school: 'conjuration',
  castingTime: 'action', range: 'self', components: ['V', 'S', 'M'],
  duration: '10 minutes', concentration: true,
  savingThrow: { stat: 'WITS', halfOnSave: true },
  effects: [{ kind: 'damage', dice: '3d8', damageType: 'radiant', area: { shape: 'sphere', radius: 15 }, saveHalf: true }],
  scalingByLevel: { extraDice: '1d8' }
};

export const spiritual_weapon = {
  defRef: 'spiritual_weapon', name: 'Spiritual Weapon', level: 2, school: 'conjuration',
  castingTime: 'bonus_action', range: '60ft', components: ['V', 'S'],
  duration: '1 minute', concentration: false,
  effects: [{ kind: 'damage', dice: '1d8+3', damageType: 'force', target: 'single' }],
  scalingByLevel: { extraDice: '1d8' }
};

export const plane_shift = {
  defRef: 'plane_shift', name: 'Plane Shift', level: 7, school: 'conjuration',
  castingTime: 'action', range: 'touch', components: ['V', 'S', 'M'],
  duration: 'instant', concentration: false,
  savingThrow: { stat: 'CHARM', halfOnSave: false },
  effects: [{ kind: 'teleport', distance: 'planar', target: 'single' }]
};
