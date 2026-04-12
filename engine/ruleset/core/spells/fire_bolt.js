// Pass T3 — cantrip: ranged fire damage, scales with level.

export const fire_bolt = {
  defRef: 'fire_bolt',
  name: 'Fire Bolt',
  level: 0,  // cantrip
  school: 'evocation',
  castingTime: 'action',
  range: '120ft',
  components: ['V', 'S'],
  duration: 'instant',
  concentration: false,
  effects: [
    { kind: 'damage', dice: '1d10', damageType: 'fire', target: 'single' }
  ],
  scalingByLevel: { 5: '2d10', 11: '3d10', 17: '4d10' }
};
