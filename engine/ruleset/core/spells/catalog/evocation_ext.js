// CM8 ext — Evocation spells (bestiary references).

export const burning_hands = {
  defRef: 'burning_hands', name: 'Burning Hands', level: 1, school: 'evocation',
  castingTime: 'action', range: 'self', components: ['V', 'S'],
  duration: 'instant', concentration: false,
  savingThrow: { stat: 'AGILITY', halfOnSave: true },
  effects: [{ kind: 'damage', dice: '3d6', damageType: 'fire', area: { shape: 'cone', length: 15 }, saveHalf: true }],
  scalingByLevel: { extraDice: '1d6' }
};

export const call_lightning = {
  defRef: 'call_lightning', name: 'Call Lightning', level: 3, school: 'evocation',
  castingTime: 'action', range: '120ft', components: ['V', 'S'],
  duration: '10 minutes', concentration: true,
  savingThrow: { stat: 'AGILITY', halfOnSave: true },
  effects: [{ kind: 'damage', dice: '3d10', damageType: 'lightning', area: { shape: 'cylinder', radius: 5, height: 100 }, saveHalf: true }],
  scalingByLevel: { extraDice: '1d10' }
};

export const cone_of_cold = {
  defRef: 'cone_of_cold', name: 'Cone of Cold', level: 5, school: 'evocation',
  castingTime: 'action', range: 'self', components: ['V', 'S', 'M'],
  duration: 'instant', concentration: false,
  savingThrow: { stat: 'GRIT', halfOnSave: true },
  effects: [{ kind: 'damage', dice: '8d8', damageType: 'cold', area: { shape: 'cone', length: 60 }, saveHalf: true }],
  scalingByLevel: { extraDice: '1d8' }
};

export const flame_strike = {
  defRef: 'flame_strike', name: 'Flame Strike', level: 5, school: 'evocation',
  castingTime: 'action', range: '60ft', components: ['V', 'S', 'M'],
  duration: 'instant', concentration: false,
  savingThrow: { stat: 'AGILITY', halfOnSave: true },
  effects: [
    { kind: 'damage', dice: '4d6', damageType: 'fire', area: { shape: 'cylinder', radius: 10, height: 40 }, saveHalf: true },
    { kind: 'damage', dice: '4d6', damageType: 'radiant', area: { shape: 'cylinder', radius: 10, height: 40 }, saveHalf: true }
  ],
  scalingByLevel: { extraDice: '1d6' }
};

export const flaming_sphere = {
  defRef: 'flaming_sphere', name: 'Flaming Sphere', level: 2, school: 'evocation',
  castingTime: 'action', range: '60ft', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'AGILITY', halfOnSave: true },
  effects: [{ kind: 'damage', dice: '2d6', damageType: 'fire', target: 'single', saveHalf: true }],
  scalingByLevel: { extraDice: '1d6' }
};

export const gust_of_wind = {
  defRef: 'gust_of_wind', name: 'Gust of Wind', level: 2, school: 'evocation',
  castingTime: 'action', range: 'self', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'MIGHT', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'pushed', until: { type: 'rounds', rounds: 1 }, severity: 1, stackBehavior: 'replace' }, area: { shape: 'line', length: 60 } }]
};

export const heat_metal = {
  defRef: 'heat_metal', name: 'Heat Metal', level: 2, school: 'evocation',
  castingTime: 'action', range: '60ft', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: true,
  effects: [
    { kind: 'damage', dice: '2d8', damageType: 'fire', target: 'single' },
    { kind: 'conditions', condition: { name: 'disadvantage_attacks', until: { type: 'rounds', rounds: 1 }, severity: 1, stackBehavior: 'replace' } }
  ],
  scalingByLevel: { extraDice: '1d8' }
};

export const hellish_rebuke = {
  defRef: 'hellish_rebuke', name: 'Hellish Rebuke', level: 1, school: 'evocation',
  castingTime: 'reaction', range: '60ft', components: ['V', 'S'],
  duration: 'instant', concentration: false,
  savingThrow: { stat: 'AGILITY', halfOnSave: true },
  effects: [{ kind: 'damage', dice: '2d10', damageType: 'fire', target: 'single', saveHalf: true }],
  scalingByLevel: { extraDice: '1d10' }
};

export const magic_missile = {
  defRef: 'magic_missile', name: 'Magic Missile', level: 1, school: 'evocation',
  castingTime: 'action', range: '120ft', components: ['V', 'S'],
  duration: 'instant', concentration: false,
  effects: [{ kind: 'damage', dice: '1d4+1', damageType: 'force', target: 'multi', projectiles: 3 }],
  scalingByLevel: { extraProjectiles: 1 }
};

export const scorching_ray = {
  defRef: 'scorching_ray', name: 'Scorching Ray', level: 2, school: 'evocation',
  castingTime: 'action', range: '120ft', components: ['V', 'S'],
  duration: 'instant', concentration: false,
  effects: [{ kind: 'damage', dice: '2d6', damageType: 'fire', target: 'multi', projectiles: 3 }],
  scalingByLevel: { extraProjectiles: 1 }
};

export const shatter = {
  defRef: 'shatter', name: 'Shatter', level: 2, school: 'evocation',
  castingTime: 'action', range: '60ft', components: ['V', 'S', 'M'],
  duration: 'instant', concentration: false,
  savingThrow: { stat: 'GRIT', halfOnSave: true },
  effects: [{ kind: 'damage', dice: '3d8', damageType: 'thunder', area: { shape: 'sphere', radius: 10 }, saveHalf: true }],
  scalingByLevel: { extraDice: '1d8' }
};

export const storm_sphere = {
  defRef: 'storm_sphere', name: 'Storm Sphere', level: 4, school: 'evocation',
  castingTime: 'action', range: '150ft', components: ['V', 'S'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'MIGHT', halfOnSave: true },
  effects: [
    { kind: 'damage', dice: '2d6', damageType: 'bludgeoning', area: { shape: 'sphere', radius: 20 }, saveHalf: true },
    { kind: 'damage', dice: '4d6', damageType: 'lightning', target: 'single' }
  ]
};

export const thunderwave = {
  defRef: 'thunderwave', name: 'Thunderwave', level: 1, school: 'evocation',
  castingTime: 'action', range: 'self', components: ['V', 'S'],
  duration: 'instant', concentration: false,
  savingThrow: { stat: 'GRIT', halfOnSave: true },
  effects: [
    { kind: 'damage', dice: '2d8', damageType: 'thunder', area: { shape: 'cube', size: 15 }, saveHalf: true },
    { kind: 'conditions', condition: { name: 'pushed', until: { type: 'instant' }, severity: 1, stackBehavior: 'replace' } }
  ],
  scalingByLevel: { extraDice: '1d8' }
};

export const wall_of_fire = {
  defRef: 'wall_of_fire', name: 'Wall of Fire', level: 4, school: 'evocation',
  castingTime: 'action', range: '120ft', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'AGILITY', halfOnSave: true },
  effects: [{ kind: 'damage', dice: '5d8', damageType: 'fire', area: { shape: 'wall', length: 60, height: 20, thickness: 1 }, saveHalf: true }],
  scalingByLevel: { extraDice: '1d8' }
};

export const wall_of_force = {
  defRef: 'wall_of_force', name: 'Wall of Force', level: 5, school: 'evocation',
  castingTime: 'action', range: '120ft', components: ['V', 'S', 'M'],
  duration: '10 minutes', concentration: true,
  effects: [{ kind: 'barrier', hp: 'invulnerable', area: { shape: 'wall', length: 100, height: 20, thickness: 1 } }]
};

export const witch_bolt = {
  defRef: 'witch_bolt', name: 'Witch Bolt', level: 1, school: 'evocation',
  castingTime: 'action', range: '30ft', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: true,
  effects: [{ kind: 'damage', dice: '1d12', damageType: 'lightning', target: 'single' }],
  scalingByLevel: { extraDice: '1d12' }
};

export const produce_flame = {
  defRef: 'produce_flame', name: 'Produce Flame', level: 0, school: 'evocation',
  castingTime: 'action', range: '30ft', components: ['V', 'S'],
  duration: '10 minutes', concentration: false,
  effects: [{ kind: 'damage', dice: '1d8', damageType: 'fire', target: 'single' }],
  scalingByLevel: { 5: '2d8', 11: '3d8', 17: '4d8' }
};

// SRD class cantrips — the chargen wizard hands these to level-1 casters
// (warlock: eldritch blast, cleric: sacred flame). Fire bolt and produce
// flame already exist above/in fire_bolt.js.
export const eldritch_blast = {
  defRef: 'eldritch_blast', name: 'Eldritch Blast', level: 0, school: 'evocation',
  castingTime: 'action', range: '120ft', components: ['V', 'S'],
  duration: 'instant', concentration: false,
  effects: [{ kind: 'damage', dice: '1d10', damageType: 'force', target: 'single' }],
  scalingByLevel: { extraDice: '1d10' }
};

export const sacred_flame = {
  defRef: 'sacred_flame', name: 'Sacred Flame', level: 0, school: 'evocation',
  castingTime: 'action', range: '60ft', components: ['V', 'S'],
  duration: 'instant', concentration: false,
  savingThrow: { stat: 'AGILITY', halfOnSave: false },
  effects: [{ kind: 'damage', dice: '1d8', damageType: 'radiant', target: 'single' }],
  scalingByLevel: { extraDice: '1d8' }
};
