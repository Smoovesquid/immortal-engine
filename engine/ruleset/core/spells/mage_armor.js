// Pass T3 — 1st level abjuration: sets base AC to 13 + dex mod.

export const mage_armor = {
  defRef: 'mage_armor',
  name: 'Mage Armor',
  level: 1,
  school: 'abjuration',
  castingTime: 'action',
  range: 'touch',
  components: ['V', 'S', 'M'],
  duration: '8 hours',
  concentration: false,
  effects: [
    { kind: 'acBoost', value: 3 }
  ]
};
