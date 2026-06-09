// SRD 5.1 — leveling up. Pure functions: given a character, return the
// character one level higher with everything recomputed — HP (fixed average,
// the table standard), proficiency from the level table, saves/skills/spell
// DC re-derived, new slots, and the class's features for the new level.
//
// Deterministic: no dice at level-up (average HP), no rng needed.

import { ABILITY_KEYS, abilityMod } from './abilities.js';
import { SKILLS, SKILL_KEYS } from './skills.js';
import { LEVEL_TABLE, levelEntry } from '../../ruleset/core/levelTable.js';

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

// Spell slot progression (1st-level slots only — higher slots arrive with the
// higher-level packet). Full casters: 2/3/4/4... Half casters (paladin,
// ranger) gain spellcasting at 2. Warlock pact: 1/2/2/2...
function slotsAtLevel(classId, level) {
  const full = { bard: 1, cleric: 1, druid: 1, sorcerer: 1, wizard: 1 };
  if (classId in full) return level >= 3 ? 4 : level === 2 ? 3 : 2;
  if (classId === 'warlock') return level >= 2 ? 2 : 1;
  if (classId === 'paladin' || classId === 'ranger') return level >= 3 ? 3 : level === 2 ? 2 : 0;
  return 0;
}

// Half-casters' spellcasting blocks, granted at level 2.
const HALF_CASTER_SPELLCASTING = {
  paladin: { ability: 'CHA', knownAtTwo: ['cure_wounds', 'bless'] },
  ranger: { ability: 'WIS', knownAtTwo: ['cure_wounds'] }
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

  // HP: fixed average (die/2 + 1) + CON mod + per-level bonuses already on
  // the sheet (Dwarven Toughness, Draconic Resilience).
  let hpBonusPerLevel = 0;
  for (const f of d.features || []) {
    if (f.effect?.type === 'hpPerLevel') hpBonusPerLevel += f.effect.amount;
    if (f.effect?.type === 'draconicResilience') hpBonusPerLevel += f.effect.hpPerLevel;
  }
  const hpGain = Math.max(1, Math.floor(d.class.hitDie / 2) + 1 + d.mods.CON + hpBonusPerLevel);
  const maxHP = d.maxHP + hpGain;

  // Recompute everything proficiency touches, from the proficiency lists the
  // sheet already carries.
  const saves = {};
  for (const k of ABILITY_KEYS) saves[k] = d.mods[k] + (d.saveProfs.includes(k) ? profBonus : 0);
  const skills = {};
  for (const s of SKILL_KEYS) {
    const ab = SKILLS[s];
    let bonus = d.mods[ab];
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
  const slotCount = slotsAtLevel(classId, newLevel);
  if (spellcasting) {
    spellcasting.saveDC = 8 + profBonus + d.mods[spellcasting.ability];
    spellcasting.attackBonus = profBonus + d.mods[spellcasting.ability];
    spellcasting.slots = { 1: slotCount };
  }

  // New class features for this level.
  const gained = (newLevel === 2 ? (LEVEL2_FEATURES[classId] || []) : [])
    .map(f => ({ source: `${d.class.name} ${newLevel}`, name: f.name, text: f.text, effect: f.effect || null }));

  const dnd = {
    ...d,
    level: newLevel,
    profBonus,
    maxHP,
    saves,
    skills,
    passivePerception,
    spellcasting,
    features: [...(d.features || []), ...gained]
  };

  // Mirror onto the legacy entity fields + spells block.
  const spells = pc.spells ? { ...pc.spells } : { known: [], slots: {}, maxSlots: {}, concentration: null };
  if (spellcasting) {
    const known = [...(spells.known || [])];
    for (const ref of newKnown) if (!known.includes(ref)) known.push(ref);
    spells.known = known;
    spells.maxSlots = { ...spells.maxSlots, 1: slotCount };
    // The new slot capacity arrives ready to use (you levelled, not rested —
    // but the new slot itself is fresh). Current slots grow by the delta.
    const prevMax = Number(pc.spells?.maxSlots?.[1]) || 0;
    const cur = Number(pc.spells?.slots?.[1]) || 0;
    spells.slots = { ...spells.slots, 1: Math.min(slotCount, cur + Math.max(0, slotCount - prevMax)) };
  }

  return {
    ...pc,
    level: newLevel,
    dnd,
    spells,
    gainedFeatures: gained.map(g => g.name) // transient, for narration; dropped by ensureEntity
  };
}
