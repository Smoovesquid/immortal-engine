// CM8 ext — Enchantment spells (bestiary references).

export const animal_friendship = {
  defRef: 'animal_friendship', name: 'Animal Friendship', level: 1, school: 'enchantment',
  castingTime: 'action', range: '30ft', components: ['V', 'S', 'M'],
  duration: '24 hours', concentration: false,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'charmed', until: { type: 'rounds', rounds: 10 }, severity: 1, stackBehavior: 'replace' } }]
};

export const bane = {
  defRef: 'bane', name: 'Bane', level: 1, school: 'enchantment',
  castingTime: 'action', range: '30ft', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'CHARM', halfOnSave: false },
  effects: [{ kind: 'debuff', stat: 'attack_and_saves', penalty: '-1d4', target: 'multi', maxTargets: 3 }]
};

export const cause_fear = {
  defRef: 'cause_fear', name: 'Cause Fear', level: 1, school: 'enchantment',
  castingTime: 'action', range: '60ft', components: ['V'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'frightened', until: { type: 'save', stat: 'WITS', dc: 0 }, severity: 1, stackBehavior: 'replace' } }]
};

export const crown_of_madness = {
  defRef: 'crown_of_madness', name: 'Crown of Madness', level: 2, school: 'enchantment',
  castingTime: 'action', range: '120ft', components: ['V', 'S'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'charmed', until: { type: 'save', stat: 'WITS', dc: 0 }, severity: 2, stackBehavior: 'replace' } }]
};

export const dominate_person = {
  defRef: 'dominate_person', name: 'Dominate Person', level: 5, school: 'enchantment',
  castingTime: 'action', range: '60ft', components: ['V', 'S'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'dominated', until: { type: 'save', stat: 'WITS', dc: 0 }, severity: 3, stackBehavior: 'replace' } }]
};

export const enemies_abound = {
  defRef: 'enemies_abound', name: 'Enemies Abound', level: 3, school: 'enchantment',
  castingTime: 'action', range: '120ft', components: ['V', 'S'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'confused', until: { type: 'save', stat: 'WITS', dc: 0 }, severity: 2, stackBehavior: 'replace' } }]
};

export const enthrall = {
  defRef: 'enthrall', name: 'Enthrall', level: 2, school: 'enchantment',
  castingTime: 'action', range: '60ft', components: ['V', 'S'],
  duration: '1 minute', concentration: false,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'distracted', until: { type: 'rounds', rounds: 10 }, severity: 1, stackBehavior: 'replace' } }]
};

export const eyebite = {
  defRef: 'eyebite', name: 'Eyebite', level: 6, school: 'enchantment',
  castingTime: 'action', range: '60ft', components: ['V', 'S'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'unconscious', until: { type: 'save', stat: 'WITS', dc: 0 }, severity: 3, stackBehavior: 'highest' } }]
};

export const hex = {
  defRef: 'hex', name: 'Hex', level: 1, school: 'enchantment',
  castingTime: 'bonus_action', range: '90ft', components: ['V', 'S', 'M'],
  duration: '1 hour', concentration: true,
  effects: [
    { kind: 'damage', dice: '1d6', damageType: 'necrotic', target: 'single' },
    { kind: 'debuff', stat: 'ability', penalty: 'disadvantage', target: 'single' }
  ]
};

export const hypnotic_pattern = {
  defRef: 'hypnotic_pattern', name: 'Hypnotic Pattern', level: 3, school: 'enchantment',
  castingTime: 'action', range: '120ft', components: ['S', 'M'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'charmed', until: { type: 'save', stat: 'WITS', dc: 0 }, severity: 2, stackBehavior: 'replace' }, area: { shape: 'cube', size: 30 } }]
};

export const modify_memory = {
  defRef: 'modify_memory', name: 'Modify Memory', level: 5, school: 'enchantment',
  castingTime: 'action', range: '30ft', components: ['V', 'S'],
  duration: '1 minute', concentration: true,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'charmed', until: { type: 'concentration' }, severity: 2, stackBehavior: 'replace' } }]
};

export const sleep = {
  defRef: 'sleep', name: 'Sleep', level: 1, school: 'enchantment',
  castingTime: 'action', range: '90ft', components: ['V', 'S', 'M'],
  duration: '1 minute', concentration: false,
  effects: [{ kind: 'conditions', condition: { name: 'unconscious', until: { type: 'rounds', rounds: 10 }, severity: 1, stackBehavior: 'replace' }, area: { shape: 'sphere', radius: 20 }, hpPool: '5d8' }]
};

export const suggestion = {
  defRef: 'suggestion', name: 'Suggestion', level: 2, school: 'enchantment',
  castingTime: 'action', range: '30ft', components: ['V', 'M'],
  duration: '8 hours', concentration: true,
  savingThrow: { stat: 'WITS', halfOnSave: false },
  effects: [{ kind: 'conditions', condition: { name: 'suggested', until: { type: 'concentration' }, severity: 2, stackBehavior: 'replace' } }]
};
