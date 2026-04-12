// CM8 — Evocation spells (new entries; fire_bolt and fireball remain in top-level files).

export const lightning_bolt = {
  defRef: 'lightning_bolt', name: 'Lightning Bolt', level: 3, school: 'evocation',
  castingTime: 'action', range: '100ft', components: ['V', 'S', 'M'],
  duration: 'instant', concentration: false,
  savingThrow: { stat: 'AGILITY', halfOnSave: true },
  effects: [{ kind: 'damage', dice: '8d6', damageType: 'lightning', area: { shape: 'line', length: 100 } }],
  scalingByLevel: { extraDice: '1d6' }
};

export const ice_storm = {
  defRef: 'ice_storm', name: 'Ice Storm', level: 4, school: 'evocation',
  castingTime: 'action', range: '300ft', components: ['V', 'S', 'M'],
  duration: 'instant', concentration: false,
  savingThrow: { stat: 'AGILITY', halfOnSave: true },
  effects: [
    { kind: 'area_damage', dice: '2d8', damageType: 'bludgeoning', area: { shape: 'cylinder', radius: 20, height: 40 } },
    { kind: 'area_damage', dice: '4d6', damageType: 'cold', area: { shape: 'cylinder', radius: 20, height: 40 } }
  ]
};

export const shocking_grasp = {
  defRef: 'shocking_grasp', name: 'Shocking Grasp', level: 0, school: 'evocation',
  castingTime: 'action', range: 'touch', components: ['V', 'S'],
  duration: 'instant', concentration: false,
  effects: [{ kind: 'damage', dice: '1d8', damageType: 'lightning', target: 'single' }],
  scalingByLevel: { 5: '2d8', 11: '3d8', 17: '4d8' }
};
