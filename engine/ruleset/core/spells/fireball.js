// Pass T3 — 3rd level evocation: 8d6 fire in a 20ft sphere, DEX save for half.

export const fireball = {
  defRef: 'fireball',
  name: 'Fireball',
  level: 3,
  school: 'evocation',
  castingTime: 'action',
  range: '150ft',
  components: ['V', 'S', 'M'],
  duration: 'instant',
  concentration: false,
  savingThrow: { stat: 'AGILITY', halfOnSave: true },
  effects: [
    { kind: 'damage', dice: '8d6', damageType: 'fire', area: { shape: 'sphere', radius: 20 }, target: 'area' }
  ],
  scalingByLevel: { extraDice: '1d6' }
};
