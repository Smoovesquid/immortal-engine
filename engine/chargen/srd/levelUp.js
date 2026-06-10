// SRD 5.1 — leveling up. Pure functions: given a character, return the
// character one level higher with everything recomputed — HP (fixed average,
// the table standard), proficiency from the level table, saves/skills/spell
// DC re-derived, new slots, and the class's features for the new level.
//
// Deterministic: no dice at level-up (average HP), no rng needed.

import { ABILITY_KEYS, abilityMod, clampScore } from './abilities.js';
import { SKILLS, SKILL_KEYS } from './skills.js';
import { LEVEL_TABLE, levelEntry } from '../../ruleset/core/levelTable.js';
import { computeSheetAC } from './sheet.js';

// SRD level-2 class features. `effect` tags the resolver understands fire in
// combat (actionSurge, recklessAttack); the rest ride the sheet as real
// entries until their packet comes.
const LEVEL2_FEATURES = {
  barbarian: [
    { name: 'Reckless Attack', text: 'Throw defense aside: advantage on your melee attacks this round, attacks against you gain the same. Type "reckless".', effect: { type: 'recklessAttack' } },
    { name: 'Danger Sense', text: 'Advantage on DEX saves against effects you can see.', effect: null }
  ],
  bard: [
    { name: 'Jack of All Trades', text: 'Add half your proficiency bonus to ability checks you are not proficient in.', effect: { type: 'halfProficiency' } },
    { name: 'Song of Rest', text: 'Your music adds 1d6 to healing during a short rest.', effect: { type: 'songOfRest', die: 6 } }
  ],
  cleric: [
    { name: 'Channel Divinity: Preserve Life', text: 'Restore HP equal to 5 x cleric level, divided among the wounded. Once per rest.', effect: null }
  ],
  druid: [
    { name: 'Wild Shape', text: 'Transform into a beast you have seen (CR 1/4, no flying/swimming). Twice per rest.', effect: null }
  ],
  fighter: [
    { name: 'Action Surge', text: 'Push past your limits: take two attacks this turn. Once per fight. Type "surge".', effect: { type: 'actionSurge' } }
  ],
  monk: [
    { name: 'Ki', text: 'Flurry of Blows, Patient Defense, Step of the Wind — 2 ki points per rest.', effect: null }
  ],
  paladin: [
    { name: 'Divine Smite', text: 'On a melee hit, burn a spell slot for +2d8 radiant.', effect: { type: 'divineSmite' } },
    { name: 'Fighting Style: Defense', text: '+1 AC while wearing armor.', effect: { type: 'acBonus', amount: 1, when: 'armored' } }
  ],
  ranger: [
    { name: 'Fighting Style: Archery', text: '+2 to attack rolls with ranged weapons.', effect: { type: 'rangedAttackBonus', amount: 2 } }
  ],
  rogue: [
    { name: 'Cunning Action', text: 'Dash, Disengage, or Hide as a bonus action.', effect: null }
  ],
  sorcerer: [
    { name: 'Font of Magic', text: '2 sorcery points: flexible casting fuel.', effect: null }
  ],
  warlock: [
    { name: 'Eldritch Invocations', text: 'Two invocations from your patron\'s deeper book (Agonizing Blast: +CHA to eldritch blast damage).', effect: { type: 'agonizingBlast' } }
  ],
  wizard: [
    { name: 'Arcane Tradition', text: 'You adopt a school of magic and its disciplines.', effect: null }
  ]
};

// SRD level-3 subclass features (the SRD subclass for each class) and the
// level-5 pillar. Effects the resolver fires: improvedCritical, colossusSlayer,
// extraAttack, sneak-attack scaling is derived from level directly.
const LEVEL3_FEATURES = {
  barbarian: [
    { name: 'Frenzy (Path of the Berserker)', text: 'In a rage you can fight past all restraint.', effect: null }
  ],
  bard: [
    { name: 'College of Lore: Cutting Words', text: 'Spend inspiration to subtract a d6 from an enemy roll.', effect: null }
  ],
  cleric: [],
  druid: [
    { name: 'Circle of the Land', text: 'Your magic draws from the land itself; recover slots on a short rest once per day.', effect: null }
  ],
  fighter: [
    { name: 'Improved Critical (Champion)', text: 'Your weapon attacks crit on a 19 or 20.', effect: { type: 'improvedCritical', critOn: 19 } }
  ],
  monk: [
    { name: 'Way of the Open Hand', text: 'Your flurries can topple, shove, or wind their target.', effect: null }
  ],
  paladin: [
    { name: 'Oath of Devotion: Sacred Weapon', text: 'Channel divinity to add CHA to weapon attacks for a minute.', effect: null }
  ],
  ranger: [
    { name: 'Colossus Slayer (Hunter)', text: 'Once per turn, +1d8 against a foe already below its hit point maximum.', effect: { type: 'colossusSlayer', die: 8 } }
  ],
  rogue: [
    { name: 'Thief: Fast Hands', text: 'Cunning Action can pick locks, disarm traps, or use objects.', effect: null }
  ],
  sorcerer: [
    { name: 'Metamagic', text: 'Twist your spells: twin, quicken, or subtle.', effect: null }
  ],
  warlock: [
    { name: 'Pact Boon', text: 'Your patron grants a blade, a book, or a chain.', effect: null }
  ],
  wizard: [
    { name: 'Arcane Tradition feature', text: 'Your school\'s second discipline.', effect: null }
  ]
};

const MARTIAL_EXTRA_ATTACK = new Set(['barbarian', 'fighter', 'monk', 'paladin', 'ranger']);

function level5Features(classId) {
  if (MARTIAL_EXTRA_ATTACK.has(classId)) {
    return [{ name: 'Extra Attack', text: 'You attack twice whenever you take the Attack action.', effect: { type: 'extraAttack' } }];
  }
  if (classId === 'rogue') {
    return [{ name: 'Uncanny Dodge', text: 'Reaction: halve the damage of an attack you can see.', effect: null }];
  }
  return [];
}

function featuresForLevel(classId, level) {
  if (level === 2) return LEVEL2_FEATURES[classId] || [];
  if (level === 3) return LEVEL3_FEATURES[classId] || [];
  if (level === 5) return level5Features(classId);
  return [];
}

// Spell slot progression, levels 1..5 of slots up to 3rd-level spells.
// Full casters follow the PHB table; warlock pact slots are few, high, and
// short-rest refreshed; half-casters lag by the book.
function slotsAtLevel(classId, level) {
  const FULL = { 1: { 1: 2 }, 2: { 1: 3 }, 3: { 1: 4, 2: 2 }, 4: { 1: 4, 2: 3 }, 5: { 1: 4, 2: 3, 3: 2 } };
  const HALF = { 1: {}, 2: { 1: 2 }, 3: { 1: 3 }, 4: { 1: 3 }, 5: { 1: 4, 2: 2 } };
  // Pact magic: slot LEVEL rises (cast everything at the highest tier).
  const PACT = { 1: { 1: 1 }, 2: { 1: 2 }, 3: { 2: 2 }, 4: { 2: 2 }, 5: { 3: 2 } };
  const lv = Math.max(1, Math.min(5, level));
  if (['bard', 'cleric', 'druid', 'sorcerer', 'wizard'].includes(classId)) return { ...FULL[lv] };
  if (classId === 'warlock') return { ...PACT[lv] };
  if (classId === 'paladin' || classId === 'ranger') return { ...HALF[lv] };
  return {};
}

// ASI levels: +2 to the class's primary ability, applied deterministically
// (the DM assigns sensibly; a choice UI can override later).
const ASI_LEVELS = new Set([4, 8, 12, 16, 19]);
const PRIMARY_ABILITY = {
  barbarian: 'STR', bard: 'CHA', cleric: 'WIS', druid: 'WIS', fighter: 'STR',
  monk: 'DEX', paladin: 'STR', ranger: 'DEX', rogue: 'DEX', sorcerer: 'CHA',
  warlock: 'CHA', wizard: 'INT'
};

// Half-casters' spellcasting blocks, granted at level 2.
const HALF_CASTER_SPELLCASTING = {
  paladin: { ability: 'CHA', knownAtTwo: ['cure_wounds', 'bless'] },
  ranger: { ability: 'WIS', knownAtTwo: ['cure_wounds'] }
};

// Spells learned at each level — curated SRD picks per class (every ref
// exists in the engine's spell catalog). Wizards copy two into the book per
// level per the PHB; known-casters add their one; prepared casters get the
// list staples as their slots unlock the tier.
const SPELLS_LEARNED = {
  wizard: {
    2: ['burning_hands', 'mage_armor'],
    3: ['scorching_ray', 'misty_step'],
    4: ['hold_person', 'blink'],
    5: ['fireball', 'counterspell']
  },
  sorcerer: {
    2: ['burning_hands'],
    3: ['scorching_ray'],
    4: ['hold_person'],
    5: ['fireball']
  },
  bard: {
    2: ['hideous_laughter'],
    3: ['hold_person'],
    4: ['enthrall'],
    5: ['hypnotic_pattern']
  },
  cleric: {
    2: ['shield_of_faith'],
    3: ['hold_person', 'spiritual_weapon'],
    5: ['spirit_guardians']
  },
  druid: {
    2: ['goodberry'],
    3: ['barkskin', 'heat_metal'],
    5: ['call_lightning']
  },
  warlock: {
    2: ['hellish_rebuke'],
    3: ['hold_person'],
    4: ['fear'],
    5: ['hypnotic_pattern']
  },
  paladin: {
    3: ['shield_of_faith'],
    5: ['protection_from_poison']
  },
  ranger: {
    3: ['entangle'],
    5: ['spike_growth']
  }
};

export function xpToNext(level) {
  const next = LEVEL_TABLE.find(row => row.level === Math.min(20, (Math.trunc(Number(level)) || 1) + 1));
  return next ? next.xpToReach : Infinity;
}

export function levelForXp(xp) {
  const x = Math.max(0, Math.trunc(Number(xp)) || 0);
  let lv = 1;
  for (const row of LEVEL_TABLE) {
    if (x >= row.xpToReach) lv = row.level;
    else break;
  }
  return lv;
}

/**
 * levelUpSheet(pc) -> pc'
 * One level. Pure; returns a new character object. No-op for characters
 * without a 5e sheet or already at 20.
 */
export function levelUpSheet(pc) {
  const d = pc?.dnd;
  if (!d || d.level >= 20) return pc;

  const newLevel = d.level + 1;
  const profBonus = levelEntry(newLevel).profBonus;
  const classId = d.class.id;

  // ── ASI levels: +2 to the class primary, applied BEFORE the HP roll so the
  // new CON counts for this level — and retroactively for the levels behind
  // you, per the book.
  let abilities = { ...d.abilities };
  let asiNote = null;
  if (ASI_LEVELS.has(newLevel)) {
    const primary = PRIMARY_ABILITY[classId] || 'STR';
    const before = abilities[primary];
    abilities[primary] = clampScore(before + 2);
    if (abilities[primary] !== before) asiNote = `${primary} ${before} -> ${abilities[primary]}`;
  }
  const mods = {};
  for (const k of ABILITY_KEYS) mods[k] = abilityMod(abilities[k]);
  // Retroactive HP for a CON-mod increase (d.level levels already banked).
  const conDelta = mods.CON - d.mods.CON;
  const retroHP = conDelta > 0 ? conDelta * d.level : 0;

  // HP: fixed average (die/2 + 1) + CON mod + per-level bonuses already on
  // the sheet (Dwarven Toughness, Draconic Resilience).
  let hpBonusPerLevel = 0;
  for (const f of d.features || []) {
    if (f.effect?.type === 'hpPerLevel') hpBonusPerLevel += f.effect.amount;
    if (f.effect?.type === 'draconicResilience') hpBonusPerLevel += f.effect.hpPerLevel;
  }
  const hpGain = Math.max(1, Math.floor(d.class.hitDie / 2) + 1 + mods.CON + hpBonusPerLevel);
  const maxHP = d.maxHP + hpGain + retroHP;

  // Recompute everything proficiency or ability mods touch, from the
  // proficiency lists the sheet already carries.
  const saves = {};
  for (const k of ABILITY_KEYS) saves[k] = mods[k] + (d.saveProfs.includes(k) ? profBonus : 0);
  const skills = {};
  for (const s of SKILL_KEYS) {
    const ab = SKILLS[s];
    let bonus = mods[ab];
    if (d.skillProfs.includes(s)) bonus += profBonus * (d.expertise.includes(s) ? 2 : 1);
    skills[s] = bonus;
  }
  const passivePerception = 10 + skills.Perception;

  // Spellcasting: existing casters re-derive DC/attack and grow slots;
  // half-casters AWAKEN at level 2.
  let spellcasting = d.spellcasting ? { ...d.spellcasting } : null;
  let newKnown = [];
  if (!spellcasting && newLevel === 2 && HALF_CASTER_SPELLCASTING[classId]) {
    const half = HALF_CASTER_SPELLCASTING[classId];
    spellcasting = { ability: half.ability, list: classId };
    newKnown = [...half.knownAtTwo];
  }
  const newSlots = slotsAtLevel(classId, newLevel);
  if (spellcasting) {
    spellcasting.saveDC = 8 + profBonus + mods[spellcasting.ability];
    spellcasting.attackBonus = profBonus + mods[spellcasting.ability];
    spellcasting.slots = { ...newSlots };
  }

  // New class features for this level (2: class pillar, 3: subclass, 5: Extra
  // Attack and friends).
  const gained = featuresForLevel(classId, newLevel)
    .map(f => ({ source: `${d.class.name} ${newLevel}`, name: f.name, text: f.text, effect: f.effect || null }));

  const dnd = {
    ...d,
    level: newLevel,
    profBonus,
    abilities,
    mods,
    maxHP,
    saves,
    skills,
    passivePerception,
    spellcasting,
    features: [...(d.features || []), ...gained]
  };
  // AC can shift when an ASI moves DEX/CON (unarmored monks, draconic
  // sorcerers, light-armor rogues). Recompute from the finished sheet.
  dnd.ac = computeSheetAC(dnd);
  dnd.initiative = mods.DEX;

  // Mirror onto the legacy entity fields + spells block. New slot capacity per
  // spell level arrives ready to use; spent slots stay spent.
  const spells = pc.spells ? { ...pc.spells } : { known: [], slots: {}, maxSlots: {}, concentration: null };
  // Spells learned at this level (in addition to a half-caster's awakening set).
  const learned = (SPELLS_LEARNED[classId]?.[newLevel] || []);
  if (spellcasting) {
    const known = [...(spells.known || [])];
    for (const ref of [...newKnown, ...learned]) if (!known.includes(ref)) known.push(ref);
    spells.known = known;
    const maxSlots = { ...spells.maxSlots };
    const slots = { ...spells.slots };
    for (const lvl of [1, 2, 3, 4, 5]) {
      const newMax = Number(newSlots[lvl]) || 0;
      const prevMax = Number(pc.spells?.maxSlots?.[lvl]) || 0;
      const cur = Number(pc.spells?.slots?.[lvl]) || 0;
      maxSlots[lvl] = newMax;
      slots[lvl] = Math.min(newMax, cur + Math.max(0, newMax - prevMax));
    }
    spells.maxSlots = maxSlots;
    spells.slots = slots;
  }

  // Legacy stat projection follows the new abilities (MIGHT<-STR etc.).
  const legacyStats = {
    MIGHT: abilities.STR, AGILITY: abilities.DEX,
    WITS: Math.max(abilities.INT, abilities.WIS),
    GRIT: abilities.CON, CHARM: abilities.CHA
  };
  const legacyMods = {};
  for (const k of Object.keys(legacyStats)) legacyMods[k] = abilityMod(legacyStats[k]);

  const gainedNames = gained.map(g => g.name);
  if (asiNote) gainedNames.unshift(`Ability Score Improvement (${asiNote})`);
  if (spellcasting && learned.length) {
    const pretty = learned.map(r => String(r).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
    gainedNames.push(`Learned: ${pretty.join(', ')}`);
  }

  return {
    ...pc,
    level: newLevel,
    stats: legacyStats,
    mods: legacyMods,
    dnd,
    spells,
    gainedFeatures: gainedNames // transient, for narration; dropped by ensureEntity
  };
}
