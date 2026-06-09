// SRD 5.1 — the twelve classes at level 1.
// Each class carries: hit die, saving throw proficiencies, armor/weapon
// proficiencies, skill choices, starting equipment options, level-1 features,
// and spellcasting where applicable. Subclass is the SRD-provided one where
// the SRD grants it at level 1 (Cleric: Life Domain; Sorcerer: Draconic
// Bloodline; Warlock: the Fiend).

export const CLASSES = [
  {
    id: 'barbarian',
    name: 'Barbarian',
    hitDie: 12,
    saves: ['STR', 'CON'],
    armor: ['light', 'medium', 'shields'],
    weapons: ['simple', 'martial'],
    skillChoices: { count: 2, from: ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'] },
    equipment: [
      { id: 'weapon', options: [['greataxe'], ['longsword'], ['warhammer']] },
      { id: 'secondary', options: [['two handaxes'], ['spear']] },
      { id: 'fixed', options: [['explorer\'s pack', 'four javelins']] }
    ],
    features: [
      { name: 'Rage', text: 'Bonus action: advantage on STR checks and saves, +2 melee damage, resistance to bludgeoning/piercing/slashing. 2 uses per long rest.', effect: { type: 'rage', uses: 2, bonusDamage: 2 } },
      { name: 'Unarmored Defense', text: 'While not wearing armor, AC = 10 + DEX mod + CON mod.', effect: { type: 'unarmoredDefense', formula: '10+DEX+CON' } }
    ],
    spellcasting: null
  },
  {
    id: 'bard',
    name: 'Bard',
    hitDie: 8,
    saves: ['DEX', 'CHA'],
    armor: ['light'],
    weapons: ['simple', 'hand crossbow', 'longsword', 'rapier', 'shortsword'],
    skillChoices: { count: 3, from: 'any' },
    equipment: [
      { id: 'weapon', options: [['rapier'], ['longsword'], ['dagger']] },
      { id: 'pack', options: [['diplomat\'s pack'], ['entertainer\'s pack']] },
      { id: 'fixed', options: [['lute', 'leather armor', 'dagger']] }
    ],
    features: [
      { name: 'Bardic Inspiration', text: 'Bonus action: give one creature a d6 to add to one check, attack, or save. CHA-mod uses per long rest.', effect: { type: 'bardicInspiration', die: 'd6' } }
    ],
    spellcasting: { ability: 'CHA', cantrips: 2, known: 4, slots: { 1: 2 }, list: 'bard' }
  },
  {
    id: 'cleric',
    name: 'Cleric',
    hitDie: 8,
    saves: ['WIS', 'CHA'],
    armor: ['light', 'medium', 'shields'],
    weapons: ['simple'],
    skillChoices: { count: 2, from: ['History', 'Insight', 'Medicine', 'Persuasion', 'Religion'] },
    equipment: [
      { id: 'weapon', options: [['mace'], ['warhammer (if proficient)']] },
      { id: 'armor', options: [['scale mail'], ['leather armor'], ['chain mail (if proficient)']] },
      { id: 'ranged', options: [['light crossbow and 20 bolts'], ['mace'], ['quarterstaff']] },
      { id: 'pack', options: [['priest\'s pack'], ['explorer\'s pack']] },
      { id: 'fixed', options: [['shield', 'holy symbol']] }
    ],
    subclass: {
      name: 'Life Domain',
      features: [
        { name: 'Bonus Proficiency', text: 'Proficiency with heavy armor.', effect: { type: 'armorProficiency', armor: 'heavy' } },
        { name: 'Disciple of Life', text: 'Healing spells of 1st level or higher restore +2 + spell level extra HP.', effect: { type: 'healingBonus' } }
      ]
    },
    features: [
      { name: 'Divine Domain', text: 'Your domain shapes your magic. (SRD: Life Domain.)', effect: null }
    ],
    spellcasting: { ability: 'WIS', cantrips: 3, prepared: 'WIS+level', slots: { 1: 2 }, list: 'cleric', domainSpells: ['bless', 'cure wounds'] }
  },
  {
    id: 'druid',
    name: 'Druid',
    hitDie: 8,
    saves: ['INT', 'WIS'],
    armor: ['light (nonmetal)', 'medium (nonmetal)', 'shields (nonmetal)'],
    weapons: ['clubs', 'daggers', 'darts', 'javelins', 'maces', 'quarterstaffs', 'scimitars', 'sickles', 'slings', 'spears'],
    skillChoices: { count: 2, from: ['Arcana', 'Animal Handling', 'Insight', 'Medicine', 'Nature', 'Perception', 'Religion', 'Survival'] },
    equipment: [
      { id: 'shield', options: [['wooden shield'], ['sickle']] },
      { id: 'weapon', options: [['scimitar'], ['spear'], ['quarterstaff']] },
      { id: 'fixed', options: [['leather armor', 'explorer\'s pack', 'druidic focus']] }
    ],
    features: [
      { name: 'Druidic', text: 'You know the secret language of druids.', effect: null }
    ],
    spellcasting: { ability: 'WIS', cantrips: 2, prepared: 'WIS+level', slots: { 1: 2 }, list: 'druid' }
  },
  {
    id: 'fighter',
    name: 'Fighter',
    hitDie: 10,
    saves: ['STR', 'CON'],
    armor: ['light', 'medium', 'heavy', 'shields'],
    weapons: ['simple', 'martial'],
    skillChoices: { count: 2, from: ['Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Perception', 'Survival'] },
    equipment: [
      { id: 'armor', options: [['chain mail'], ['leather armor', 'longbow', '20 arrows']] },
      { id: 'weapon', options: [['longsword', 'shield'], ['greataxe'], ['rapier', 'shield'], ['two handaxes']] },
      { id: 'ranged', options: [['light crossbow and 20 bolts'], ['two handaxes']] },
      { id: 'pack', options: [['dungeoneer\'s pack'], ['explorer\'s pack']] }
    ],
    choices: [{
      id: 'fightingStyle',
      name: 'Fighting Style',
      options: [
        { id: 'archery', name: 'Archery', text: '+2 to attack rolls with ranged weapons.', effect: { type: 'rangedAttackBonus', amount: 2 } },
        { id: 'defense', name: 'Defense', text: '+1 AC while wearing armor.', effect: { type: 'acBonus', amount: 1, when: 'armored' } },
        { id: 'dueling', name: 'Dueling', text: '+2 damage with a one-handed melee weapon and no other weapon.', effect: { type: 'meleeDamageBonus', amount: 2, when: 'one-handed-solo' } },
        { id: 'great-weapon', name: 'Great Weapon Fighting', text: 'Reroll 1s and 2s on damage with two-handed melee weapons.', effect: { type: 'rerollLowDamage', when: 'two-handed' } },
        { id: 'protection', name: 'Protection', text: 'Reaction with a shield: impose disadvantage on an attack against an ally within 5 ft.', effect: { type: 'protectAlly' } },
        { id: 'two-weapon', name: 'Two-Weapon Fighting', text: 'Add your ability modifier to off-hand damage.', effect: { type: 'offhandModDamage' } }
      ]
    }],
    features: [
      { name: 'Second Wind', text: 'Bonus action: regain 1d10 + fighter level HP. Once per rest.', effect: { type: 'secondWind', dice: '1d10+level' } }
    ],
    spellcasting: null
  },
  {
    id: 'monk',
    name: 'Monk',
    hitDie: 8,
    saves: ['STR', 'DEX'],
    armor: [],
    weapons: ['simple', 'shortswords'],
    skillChoices: { count: 2, from: ['Acrobatics', 'Athletics', 'History', 'Insight', 'Religion', 'Stealth'] },
    equipment: [
      { id: 'weapon', options: [['shortsword'], ['spear'], ['quarterstaff']] },
      { id: 'pack', options: [['dungeoneer\'s pack'], ['explorer\'s pack']] },
      { id: 'fixed', options: [['10 darts']] }
    ],
    features: [
      { name: 'Unarmored Defense', text: 'While unarmored and without a shield, AC = 10 + DEX mod + WIS mod.', effect: { type: 'unarmoredDefense', formula: '10+DEX+WIS' } },
      { name: 'Martial Arts', text: 'Use DEX for unarmed strikes and monk weapons; unarmed strikes deal 1d4; bonus-action unarmed strike after attacking.', effect: { type: 'martialArts', die: 'd4' } }
    ],
    spellcasting: null
  },
  {
    id: 'paladin',
    name: 'Paladin',
    hitDie: 10,
    saves: ['WIS', 'CHA'],
    armor: ['light', 'medium', 'heavy', 'shields'],
    weapons: ['simple', 'martial'],
    skillChoices: { count: 2, from: ['Athletics', 'Insight', 'Intimidation', 'Medicine', 'Persuasion', 'Religion'] },
    equipment: [
      { id: 'weapon', options: [['longsword', 'shield'], ['warhammer', 'shield'], ['greataxe']] },
      { id: 'secondary', options: [['five javelins'], ['mace']] },
      { id: 'pack', options: [['priest\'s pack'], ['explorer\'s pack']] },
      { id: 'fixed', options: [['chain mail', 'holy symbol']] }
    ],
    features: [
      { name: 'Divine Sense', text: 'Action: detect celestials, fiends, and undead within 60 ft. until end of next turn. 1 + CHA-mod uses per long rest.', effect: { type: 'divineSense' } },
      { name: 'Lay on Hands', text: 'Pool of healing equal to 5 × paladin level. Touch to restore HP or cure disease/poison.', effect: { type: 'layOnHands', pool: '5*level' } }
    ],
    spellcasting: null
  },
  {
    id: 'ranger',
    name: 'Ranger',
    hitDie: 10,
    saves: ['STR', 'DEX'],
    armor: ['light', 'medium', 'shields'],
    weapons: ['simple', 'martial'],
    skillChoices: { count: 3, from: ['Animal Handling', 'Athletics', 'Insight', 'Investigation', 'Nature', 'Perception', 'Stealth', 'Survival'] },
    equipment: [
      { id: 'armor', options: [['scale mail'], ['leather armor']] },
      { id: 'weapon', options: [['two shortswords'], ['two spears']] },
      { id: 'pack', options: [['dungeoneer\'s pack'], ['explorer\'s pack']] },
      { id: 'fixed', options: [['longbow and a quiver of 20 arrows']] }
    ],
    choices: [{
      id: 'favoredEnemy',
      name: 'Favored Enemy',
      options: [
        { id: 'beasts', name: 'Beasts' }, { id: 'fey', name: 'Fey' }, { id: 'humanoids', name: 'Humanoids (two types)' },
        { id: 'monstrosities', name: 'Monstrosities' }, { id: 'undead', name: 'Undead' }
      ]
    }, {
      id: 'terrain',
      name: 'Natural Explorer',
      options: [
        { id: 'forest', name: 'Forest' }, { id: 'grassland', name: 'Grassland' }, { id: 'mountain', name: 'Mountain' },
        { id: 'swamp', name: 'Swamp' }, { id: 'coast', name: 'Coast' }, { id: 'desert', name: 'Desert' }, { id: 'arctic', name: 'Arctic' }
      ]
    }],
    features: [
      { name: 'Favored Enemy', text: 'Advantage on Survival checks to track your favored enemies and INT checks to recall information about them.', effect: { type: 'favoredEnemy' } },
      { name: 'Natural Explorer', text: 'Expert navigator and tracker in your favored terrain.', effect: { type: 'naturalExplorer' } }
    ],
    spellcasting: null
  },
  {
    id: 'rogue',
    name: 'Rogue',
    hitDie: 8,
    saves: ['DEX', 'INT'],
    armor: ['light'],
    weapons: ['simple', 'hand crossbow', 'longsword', 'rapier', 'shortsword'],
    skillChoices: { count: 4, from: ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Performance', 'Persuasion', 'Sleight of Hand', 'Stealth'] },
    equipment: [
      { id: 'weapon', options: [['rapier'], ['shortsword']] },
      { id: 'ranged', options: [['shortbow and quiver of 20 arrows'], ['shortsword']] },
      { id: 'pack', options: [['burglar\'s pack'], ['dungeoneer\'s pack'], ['explorer\'s pack']] },
      { id: 'fixed', options: [['leather armor', 'two daggers', 'thieves\' tools']] }
    ],
    choices: [{
      id: 'expertise',
      name: 'Expertise',
      pickSkills: 2,
      from: 'proficient'
    }],
    features: [
      { name: 'Expertise', text: 'Double proficiency bonus on two of your skill proficiencies (or one skill and thieves\' tools).', effect: { type: 'expertise', count: 2 } },
      { name: 'Sneak Attack', text: 'Once per turn, +1d6 damage when you have advantage (or an ally is adjacent) with a finesse or ranged weapon.', effect: { type: 'sneakAttack', dice: '1d6' } },
      { name: 'Thieves\' Cant', text: 'You know the secret rogue argot.', effect: null }
    ],
    spellcasting: null
  },
  {
    id: 'sorcerer',
    name: 'Sorcerer',
    hitDie: 6,
    saves: ['CON', 'CHA'],
    armor: [],
    weapons: ['daggers', 'darts', 'slings', 'quarterstaffs', 'light crossbows'],
    skillChoices: { count: 2, from: ['Arcana', 'Deception', 'Insight', 'Intimidation', 'Persuasion', 'Religion'] },
    equipment: [
      { id: 'weapon', options: [['light crossbow and 20 bolts'], ['mace'], ['quarterstaff']] },
      { id: 'focus', options: [['component pouch'], ['arcane focus']] },
      { id: 'pack', options: [['dungeoneer\'s pack'], ['explorer\'s pack']] },
      { id: 'fixed', options: [['two daggers']] }
    ],
    subclass: {
      name: 'Draconic Bloodline',
      features: [
        { name: 'Draconic Resilience', text: '+1 HP per sorcerer level; unarmored AC = 13 + DEX mod.', effect: { type: 'draconicResilience', hpPerLevel: 1, baseAC: 13 } },
        { name: 'Dragon Ancestor', text: 'Choose a dragon type; you speak Draconic.', effect: null }
      ]
    },
    features: [],
    spellcasting: { ability: 'CHA', cantrips: 4, known: 2, slots: { 1: 2 }, list: 'sorcerer' }
  },
  {
    id: 'warlock',
    name: 'Warlock',
    hitDie: 8,
    saves: ['WIS', 'CHA'],
    armor: ['light'],
    weapons: ['simple'],
    skillChoices: { count: 2, from: ['Arcana', 'Deception', 'History', 'Intimidation', 'Investigation', 'Nature', 'Religion'] },
    equipment: [
      { id: 'weapon', options: [['light crossbow and 20 bolts'], ['mace'], ['quarterstaff']] },
      { id: 'focus', options: [['component pouch'], ['arcane focus']] },
      { id: 'pack', options: [['scholar\'s pack'], ['dungeoneer\'s pack']] },
      { id: 'fixed', options: [['leather armor', 'two daggers']] }
    ],
    subclass: {
      name: 'The Fiend',
      features: [
        { name: "Dark One's Blessing", text: 'When you reduce a hostile creature to 0 HP, gain temp HP equal to CHA mod + warlock level.', effect: { type: 'darkOnesBlessing' } }
      ]
    },
    features: [],
    spellcasting: { ability: 'CHA', cantrips: 2, known: 2, slots: { 1: 1 }, pact: true, list: 'warlock' }
  },
  {
    id: 'wizard',
    name: 'Wizard',
    hitDie: 6,
    saves: ['INT', 'WIS'],
    armor: [],
    weapons: ['daggers', 'darts', 'slings', 'quarterstaffs', 'light crossbows'],
    skillChoices: { count: 2, from: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Religion'] },
    equipment: [
      { id: 'weapon', options: [['quarterstaff'], ['dagger']] },
      { id: 'focus', options: [['component pouch'], ['arcane focus']] },
      { id: 'pack', options: [['scholar\'s pack'], ['explorer\'s pack']] },
      { id: 'fixed', options: [['spellbook']] }
    ],
    features: [
      { name: 'Arcane Recovery', text: 'Once per day after a short rest, recover spell slots totaling half your wizard level (rounded up).', effect: { type: 'arcaneRecovery' } },
      { name: 'Spellbook', text: 'Your spellbook holds six 1st-level wizard spells of your choice.', effect: { type: 'spellbook', spells: 6 } }
    ],
    spellcasting: { ability: 'INT', cantrips: 3, spellbook: 6, prepared: 'INT+level', slots: { 1: 2 }, list: 'wizard' }
  }
];

export function listClasses() {
  return CLASSES;
}

export function getClass(id) {
  return CLASSES.find(c => c.id === String(id)) || null;
}
