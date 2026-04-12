// Pass T3 — 1st level abjuration reaction: +5 AC until next turn.

export const shield_spell = {  // "shield" conflicts with JS builtins
  defRef: 'shield',
  name: 'Shield',
  level: 1,
  school: 'abjuration',
  castingTime: 'reaction',
  range: 'self',
  components: ['V', 'S'],
  duration: '1 round',
  concentration: false,
  effects: [
    { kind: 'acBoost', value: 5 }
  ]
};
