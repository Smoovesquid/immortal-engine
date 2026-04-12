// CM8 — Abjuration spells (new entries; shield, mage_armor, counterspell remain in top-level files).

export const dispel_magic = {
  defRef: 'dispel_magic', name: 'Dispel Magic', level: 3, school: 'abjuration',
  castingTime: 'action', range: '120ft', components: ['V', 'S'],
  duration: 'instant', concentration: false,
  effects: [{ kind: 'counter', autoSuccess: false }]
};

export const protection_from_energy = {
  defRef: 'protection_from_energy', name: 'Protection from Energy', level: 3, school: 'abjuration',
  castingTime: 'action', range: 'touch', components: ['V', 'S'],
  duration: '1 hour', concentration: true,
  effects: [{ kind: 'buff', stat: 'resistance', value: 'fire', target: 'single' }]
};
