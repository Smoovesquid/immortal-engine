// SRD-style backgrounds. The SRD itself ships only the Acolyte; the rest here
// follow the same chassis (2 skill proficiencies + a feature + flavor) with
// world-native flavor reusing the engine's existing background voice.

export const BACKGROUNDS_5E = [
  {
    id: 'acolyte',
    name: 'Acolyte',
    skills: ['Insight', 'Religion'],
    languages: 2,
    feature: { name: 'Shelter of the Faithful', text: 'You and your companions can expect free healing and care at temples of your faith.' },
    gear: ['holy symbol', 'prayer book', '5 sticks of incense', 'vestments', 'common clothes', 'pouch (15 gp)'],
    hook: 'You served a god; the god remembers.'
  },
  {
    id: 'soldier',
    name: 'Soldier',
    skills: ['Athletics', 'Intimidation'],
    tools: ['gaming set', 'vehicles (land)'],
    feature: { name: 'Military Rank', text: 'Soldiers loyal to your former organization still recognize your authority.' },
    gear: ['insignia of rank', 'trophy from a fallen enemy', 'gaming set', 'common clothes', 'pouch (10 gp)'],
    hook: 'You\'ve been paid to win and paid to lose.'
  },
  {
    id: 'criminal',
    name: 'Criminal',
    skills: ['Deception', 'Stealth'],
    tools: ['gaming set', 'thieves\' tools'],
    feature: { name: 'Criminal Contact', text: 'You have a reliable contact in the criminal underworld.' },
    gear: ['crowbar', 'dark common clothes with hood', 'pouch (15 gp)'],
    hook: 'The law knows your face; the gutters know your name.'
  },
  {
    id: 'sage',
    name: 'Sage',
    skills: ['Arcana', 'History'],
    languages: 2,
    feature: { name: 'Researcher', text: 'When you don\'t know a piece of lore, you often know where to find it.' },
    gear: ['bottle of ink', 'quill', 'small knife', 'letter from a dead colleague', 'common clothes', 'pouch (10 gp)'],
    hook: 'You found a sentence that rewrote you.'
  },
  {
    id: 'folk-hero',
    name: 'Folk Hero',
    skills: ['Animal Handling', 'Survival'],
    tools: ['artisan\'s tools', 'vehicles (land)'],
    feature: { name: 'Rustic Hospitality', text: 'Common folk will shelter and hide you from the law or anyone searching for you.' },
    gear: ['artisan\'s tools', 'shovel', 'iron pot', 'common clothes', 'pouch (10 gp)'],
    hook: 'The village still tells the story; you still pay for it.'
  },
  {
    id: 'hermit',
    name: 'Hermit',
    skills: ['Medicine', 'Religion'],
    tools: ['herbalism kit'],
    languages: 1,
    feature: { name: 'Discovery', text: 'Your seclusion gave you a unique and powerful revelation — work out its nature with the DM.' },
    gear: ['scroll case of notes', 'winter blanket', 'common clothes', 'herbalism kit', '5 gp'],
    hook: 'You went into the silence to forget; the silence remembered.'
  },
  {
    id: 'noble',
    name: 'Noble',
    skills: ['History', 'Persuasion'],
    tools: ['gaming set'],
    languages: 1,
    feature: { name: 'Position of Privilege', text: 'You are welcome in high society; common folk make every effort to accommodate you.' },
    gear: ['fine clothes', 'signet ring', 'scroll of pedigree', 'purse (25 gp)'],
    hook: 'Your family tree has knots where people went missing.'
  },
  {
    id: 'outlander',
    name: 'Outlander',
    skills: ['Athletics', 'Survival'],
    tools: ['musical instrument'],
    languages: 1,
    feature: { name: 'Wanderer', text: 'You have an excellent memory for geography and can always find food and water for yourself and up to five others.' },
    gear: ['staff', 'hunting trap', 'trophy from an animal', 'traveler\'s clothes', 'pouch (10 gp)'],
    hook: 'You follow roads that don\'t appear on any map.'
  },
  {
    id: 'urchin',
    name: 'Urchin',
    skills: ['Sleight of Hand', 'Stealth'],
    tools: ['disguise kit', 'thieves\' tools'],
    feature: { name: 'City Secrets', text: 'You can travel between any two points in a city twice as fast as your speed would suggest.' },
    gear: ['small knife', 'map of your home city', 'pet mouse', 'token of your parents', 'common clothes', 'pouch (10 gp)'],
    hook: 'You inventory food before you inventory people.'
  },
  {
    id: 'entertainer',
    name: 'Entertainer',
    skills: ['Acrobatics', 'Performance'],
    tools: ['disguise kit', 'musical instrument'],
    feature: { name: 'By Popular Demand', text: 'You can always find a place to perform, earning free lodging and food.' },
    gear: ['musical instrument', 'favor of an admirer', 'costume', 'pouch (15 gp)'],
    hook: 'You brought a song to a dark room; something sang back.'
  }
];

export function listBackgrounds5e() {
  return BACKGROUNDS_5E;
}

export function getBackground5e(id) {
  return BACKGROUNDS_5E.find(b => b.id === String(id)) || null;
}
