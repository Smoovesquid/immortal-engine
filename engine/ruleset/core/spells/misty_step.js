// Pass T3 — 2nd level conjuration bonus action: 30ft teleport.

export const misty_step = {
  defRef: 'misty_step',
  name: 'Misty Step',
  level: 2,
  school: 'conjuration',
  castingTime: 'bonus_action',
  range: 'self',
  components: ['V'],
  duration: 'instant',
  concentration: false,
  effects: [
    { kind: 'teleport', distance: 30 }
  ]
};
