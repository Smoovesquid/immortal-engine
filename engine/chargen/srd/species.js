// SRD 5.1 — the nine core species, with subraces where the SRD defines one.
// Traits carry a machine-readable `effect` tag where the engine can honor them
// today (darkvision → env light model, resistances → combat damage matrix,
// skill proficiencies → skill system). Pure-flavor traits carry effect: null.

export const SPECIES = [
  {
    id: 'dwarf',
    name: 'Dwarf',
    subrace: 'Hill Dwarf',
    asi: { CON: 2, WIS: 1 },
    size: 'Medium',
    speed: 25,
    languages: ['Common', 'Dwarvish'],
    traits: [
      { name: 'Darkvision', text: 'You can see in dim light within 60 feet as if it were bright light.', effect: { type: 'darkvision', range: 60 } },
      { name: 'Dwarven Resilience', text: 'Advantage on saving throws against poison; resistance to poison damage.', effect: { type: 'resistance', damage: 'poison', saveAdvantage: 'poison' } },
      { name: 'Dwarven Combat Training', text: 'Proficiency with battleaxe, handaxe, light hammer, and warhammer.', effect: { type: 'weaponProficiency', weapons: ['battleaxe', 'handaxe', 'light hammer', 'warhammer'] } },
      { name: 'Stonecunning', text: 'Double proficiency on History checks about stonework.', effect: { type: 'expertiseConditional', skill: 'History', when: 'stonework' } },
      { name: 'Dwarven Toughness', text: 'Your hit point maximum increases by 1 per level.', effect: { type: 'hpPerLevel', amount: 1 } }
    ]
  },
  {
    id: 'elf',
    name: 'Elf',
    subrace: 'High Elf',
    asi: { DEX: 2, INT: 1 },
    size: 'Medium',
    speed: 30,
    languages: ['Common', 'Elvish'],
    traits: [
      { name: 'Darkvision', text: 'You can see in dim light within 60 feet as if it were bright light.', effect: { type: 'darkvision', range: 60 } },
      { name: 'Keen Senses', text: 'Proficiency in the Perception skill.', effect: { type: 'skillProficiency', skill: 'Perception' } },
      { name: 'Fey Ancestry', text: 'Advantage on saves against being charmed; magic can\'t put you to sleep.', effect: { type: 'saveAdvantage', against: 'charmed', immune: 'magical sleep' } },
      { name: 'Trance', text: 'You don\'t sleep; you meditate 4 hours a day.', effect: null },
      { name: 'Cantrip', text: 'You know one wizard cantrip of your choice. Intelligence is your spellcasting ability for it.', effect: { type: 'bonusCantrip', list: 'wizard', ability: 'INT' } }
    ]
  },
  {
    id: 'halfling',
    name: 'Halfling',
    subrace: 'Lightfoot Halfling',
    asi: { DEX: 2, CHA: 1 },
    size: 'Small',
    speed: 25,
    languages: ['Common', 'Halfling'],
    traits: [
      { name: 'Lucky', text: 'When you roll a 1 on a d20 for an attack, check, or save, reroll and use the new roll.', effect: { type: 'rerollOnes' } },
      { name: 'Brave', text: 'Advantage on saving throws against being frightened.', effect: { type: 'saveAdvantage', against: 'frightened' } },
      { name: 'Halfling Nimbleness', text: 'You can move through the space of any creature larger than you.', effect: null },
      { name: 'Naturally Stealthy', text: 'You can attempt to hide even when obscured only by a larger creature.', effect: null }
    ]
  },
  {
    id: 'human',
    name: 'Human',
    subrace: null,
    asi: { STR: 1, DEX: 1, CON: 1, INT: 1, WIS: 1, CHA: 1 },
    size: 'Medium',
    speed: 30,
    languages: ['Common', 'one extra of your choice'],
    traits: []
  },
  {
    id: 'dragonborn',
    name: 'Dragonborn',
    subrace: null,
    asi: { STR: 2, CHA: 1 },
    size: 'Medium',
    speed: 30,
    languages: ['Common', 'Draconic'],
    choices: [{
      id: 'ancestry',
      name: 'Draconic Ancestry',
      options: [
        { id: 'black', name: 'Black (acid)', damage: 'acid', breath: '5 by 30 ft. line (DEX save)' },
        { id: 'blue', name: 'Blue (lightning)', damage: 'lightning', breath: '5 by 30 ft. line (DEX save)' },
        { id: 'brass', name: 'Brass (fire)', damage: 'fire', breath: '5 by 30 ft. line (DEX save)' },
        { id: 'bronze', name: 'Bronze (lightning)', damage: 'lightning', breath: '5 by 30 ft. line (DEX save)' },
        { id: 'copper', name: 'Copper (acid)', damage: 'acid', breath: '5 by 30 ft. line (DEX save)' },
        { id: 'gold', name: 'Gold (fire)', damage: 'fire', breath: '15 ft. cone (DEX save)' },
        { id: 'green', name: 'Green (poison)', damage: 'poison', breath: '15 ft. cone (CON save)' },
        { id: 'red', name: 'Red (fire)', damage: 'fire', breath: '15 ft. cone (DEX save)' },
        { id: 'silver', name: 'Silver (cold)', damage: 'cold', breath: '15 ft. cone (CON save)' },
        { id: 'white', name: 'White (cold)', damage: 'cold', breath: '15 ft. cone (CON save)' }
      ]
    }],
    traits: [
      { name: 'Breath Weapon', text: 'Exhale destructive energy (2d6, save DC 8 + CON mod + proficiency, half on success). Once per rest.', effect: { type: 'breathWeapon', dice: '2d6', saveDC: '8+CON+prof' } },
      { name: 'Damage Resistance', text: 'Resistance to the damage type of your draconic ancestry.', effect: { type: 'resistance', damage: 'ancestry' } }
    ]
  },
  {
    id: 'gnome',
    name: 'Gnome',
    subrace: 'Rock Gnome',
    asi: { INT: 2, CON: 1 },
    size: 'Small',
    speed: 25,
    languages: ['Common', 'Gnomish'],
    traits: [
      { name: 'Darkvision', text: 'You can see in dim light within 60 feet as if it were bright light.', effect: { type: 'darkvision', range: 60 } },
      { name: 'Gnome Cunning', text: 'Advantage on all INT, WIS, and CHA saving throws against magic.', effect: { type: 'saveAdvantage', abilities: ['INT', 'WIS', 'CHA'], against: 'magic' } },
      { name: "Artificer's Lore", text: 'Double proficiency on History checks about magical, alchemical, or technological items.', effect: { type: 'expertiseConditional', skill: 'History', when: 'devices' } },
      { name: 'Tinker', text: 'You can construct tiny clockwork devices.', effect: null }
    ]
  },
  {
    id: 'half-elf',
    name: 'Half-Elf',
    subrace: null,
    asi: { CHA: 2 },
    asiChoice: { count: 2, amount: 1, exclude: ['CHA'] },
    size: 'Medium',
    speed: 30,
    languages: ['Common', 'Elvish', 'one extra of your choice'],
    choices: [{
      id: 'skills',
      name: 'Skill Versatility',
      pickSkills: 2,
      from: 'any'
    }],
    traits: [
      { name: 'Darkvision', text: 'You can see in dim light within 60 feet as if it were bright light.', effect: { type: 'darkvision', range: 60 } },
      { name: 'Fey Ancestry', text: 'Advantage on saves against being charmed; magic can\'t put you to sleep.', effect: { type: 'saveAdvantage', against: 'charmed', immune: 'magical sleep' } },
      { name: 'Skill Versatility', text: 'Proficiency in two skills of your choice.', effect: { type: 'skillChoice', count: 2 } }
    ]
  },
  {
    id: 'half-orc',
    name: 'Half-Orc',
    subrace: null,
    asi: { STR: 2, CON: 1 },
    size: 'Medium',
    speed: 30,
    languages: ['Common', 'Orc'],
    traits: [
      { name: 'Darkvision', text: 'You can see in dim light within 60 feet as if it were bright light.', effect: { type: 'darkvision', range: 60 } },
      { name: 'Menacing', text: 'Proficiency in the Intimidation skill.', effect: { type: 'skillProficiency', skill: 'Intimidation' } },
      { name: 'Relentless Endurance', text: 'When reduced to 0 HP but not killed outright, drop to 1 HP instead. Once per long rest.', effect: { type: 'relentlessEndurance' } },
      { name: 'Savage Attacks', text: 'On a melee critical hit, roll one extra weapon damage die.', effect: { type: 'critExtraDie' } }
    ]
  },
  {
    id: 'tiefling',
    name: 'Tiefling',
    subrace: null,
    asi: { CHA: 2, INT: 1 },
    size: 'Medium',
    speed: 30,
    languages: ['Common', 'Infernal'],
    traits: [
      { name: 'Darkvision', text: 'You can see in dim light within 60 feet as if it were bright light.', effect: { type: 'darkvision', range: 60 } },
      { name: 'Hellish Resistance', text: 'Resistance to fire damage.', effect: { type: 'resistance', damage: 'fire' } },
      { name: 'Infernal Legacy', text: 'You know the thaumaturgy cantrip. Charisma is your spellcasting ability for it.', effect: { type: 'bonusCantrip', cantrip: 'thaumaturgy', ability: 'CHA' } }
    ]
  }
];

export function listSpecies() {
  return SPECIES;
}

export function getSpecies(id) {
  return SPECIES.find(s => s.id === String(id)) || null;
}
