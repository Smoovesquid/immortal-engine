// Pass T3 — 3rd level abjuration reaction: counter a spell of equal or lower level.

export const counterspell = {
  defRef: 'counterspell',
  name: 'Counterspell',
  level: 3,
  school: 'abjuration',
  castingTime: 'reaction',
  range: '60ft',
  components: ['S'],
  duration: 'instant',
  concentration: false,
  effects: [
    { kind: 'counter', autoSuccess: true }
  ]
};
