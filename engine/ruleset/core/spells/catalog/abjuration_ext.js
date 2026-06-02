// CM8 ext — Abjuration spells (bestiary references).

export const beacon_of_hope = {
  defRef: 'beacon_of_hope', name: 'Beacon of Hope', level: 3, school: 'abjuration',
  castingTime: 'action', range: '30ft', components: ['V', 'S'],
  duration: '1 minute', concentration: true,
  effects: [
    { kind: 'buff', stat: 'saves', value: 'advantage_wits', target: 'multi' },
    { kind: 'buff', stat: 'healing', value: 'maximize', target: 'multi' }
  ]
};

export const armor_of_agathys = {
  defRef: 'armor_of_agathys', name: 'Armor of Agathys', level: 1, school: 'abjuration',
  castingTime: 'action', range: 'self', components: ['V', 'S', 'M'],
  duration: '1 hour', concentration: false,
  effects: [
    { kind: 'buff', stat: 'tempHP', value: 5, target: 'self' },
    { kind: 'damage', dice: '5', damageType: 'cold', target: 'attacker' }
  ],
  scalingByLevel: { extraTempHP: 5, extraRetaliationDmg: 5 }
};

export const banishment = {
  defRef: 'banishment', name: 'Banishment', level: 4, school: 'abjuration',
  castingTime: 'action', range: '60ft', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'CHARM', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'banished', until: { type: 'concentration' }, severity: 2, stackBehavior: 'replace' } }]
};

export const bless = {
  defRef: 'bless', name: 'Bless', level: 1, school: 'abjuration',
  castingTime: 'action', range: '30ft', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: true,
  effects: [{ kind: 'buff', stat: 'attack_and_saves', value: '1d4', target: 'multi', maxTargets: 3 }]
};

export const death_ward = {
  defRef: 'death_ward', name: 'Death Ward', level: 4, school: 'abjuration',
  castingTime: 'action', range: 'touch', components: ['V', 'S'],
  duration: '8 hours', concentration: false,
  effects: [{ kind: 'buff', stat: 'deathSave', value: 'auto_stabilize', target: 'single' }]
};

export const protection_from_poison = {
  defRef: 'protection_from_poison', name: 'Protection from Poison', level: 2, school: 'abjuration',
  castingTime: 'action', range: 'touch', components: ['V', 'S'],
  duration: '1 hour', concentration: false,
  effects: [
    { kind: 'buff', stat: 'resistance', value: 'poison', target: 'single' },
    { kind: 'conditions', condition: { name: 'neutralize_poison', until: { type: 'instant' }, severity: 1, stackBehavior: 'replace' } }
  ]
};

export const remove_curse = {
  defRef: 'remove_curse', name: 'Remove Curse', level: 3, school: 'abjuration',
  castingTime: 'action', range: 'touch', components: ['V', 'S'],
  duration: 'instant', concentration: false,
  effects: [{ kind: 'counter', autoSuccess: true }]
};

export const shield_of_faith = {
  defRef: 'shield_of_faith', name: 'Shield of Faith', level: 1, school: 'abjuration',
  castingTime: 'bonus_action', range: '60ft', components: ['V', 'S', 'M'],
  duration: '10 minutes', concentration: true,
  effects: [{ kind: 'buff', stat: 'ac', value: 2, target: 'single' }]
};
