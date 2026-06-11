// SRD 5.1 — character assembly. Takes the wizard's picks and produces a
// complete, legal level-1 character: six canonical abilities, derived numbers
// (HP, AC, initiative, saves, skills, passive Perception), equipment, and a
// legacy-compatible entity shape so the rest of the engine keeps working.
//
// Deterministic: all rolls come from the seeded rng; rerolls salt the seed.

import { seedFromString, makeRng } from '../../rng.js';
import {
  ABILITY_KEYS, STANDARD_ARRAY, abilityMod, roll4d6DropLowest,
  normalizeAssignment, applyASI, clampScore, toLegacyStats
} from './abilities.js';
import { SKILLS, SKILL_KEYS } from './skills.js';
import { getSpecies } from './species.js';
import { getClass } from './classes.js';
import { getBackground5e } from './backgrounds5e.js';
import { getAlignment } from './alignment.js';
import { computeAC, findArmor } from './armor.js';
import { rollDarkFate } from '../fate.js';
import { rollDetailOptions, normalizeRitualPicks } from '../details.js';

export const PROFICIENCY_BONUS_L1 = 2;

// Roll the six ability pools for a given seed (+ optional reroll count).
export function rollAbilityPools({ seed = 'seed', reroll = 0 } = {}) {
  const salt = reroll > 0 ? `|reroll${Math.trunc(reroll)}` : '';
  const rng = makeRng(seedFromString(`${seed}|srd|abilities${salt}`));
  return roll4d6DropLowest(rng);
}

/**
 * createCharacter5e — assemble the full sheet.
 *
 * picks = {
 *   seed, name,
 *   speciesId, speciesChoices: { ancestry?, asiChoice?: ['STR','DEX'], skills?: [..] },
 *   classId, classChoices: { skills: [..], fightingStyle?, favoredEnemy?, terrain?, expertise?: [..], equipment?: {slotId: optionIndex} },
 *   abilityMethod: '4d6' | 'standard',
 *   abilityAssignment: { STR: 15, ... },   // totals assigned by the player
 *   reroll: 0,
 *   backgroundId, alignmentId,
 *   ritualPicks: { detail, keepsake, lineYouWontCross, rumor }
 * }
 */
function startingGold(background) {
  for (const g of (background?.gear || [])) {
    const m = String(g).match(/(\d+)\s*gp/i);
    if (m) return Math.max(0, parseInt(m[1], 10));
  }
  return 10;
}

export function createCharacter5e(picks = {}) {
  const seed = String(picks.seed || 'seed');
  const species = getSpecies(picks.speciesId) || getSpecies('human');
  const klass = getClass(picks.classId) || getClass('fighter');
  const background = getBackground5e(picks.backgroundId) || getBackground5e('outlander');
  const alignment = getAlignment(picks.alignmentId) || getAlignment('n');

  // ---- Abilities ----
  const method = picks.abilityMethod === 'standard' ? 'standard' : '4d6';
  const pools = method === '4d6' ? rollAbilityPools({ seed, reroll: picks.reroll || 0 }) : null;
  const totals = method === '4d6' ? pools.totals : [...STANDARD_ARRAY];

  let base = normalizeAssignment(totals, picks.abilityAssignment);
  if (!base) {
    // No/invalid assignment: assign best-first in class-sensible order.
    const order = defaultAssignOrder(klass.id);
    const sorted = [...totals].sort((a, b) => b - a);
    base = {};
    order.forEach((k, i) => { base[k] = sorted[i]; });
  }

  // Species ASI (fixed + chosen, e.g. half-elf +1/+1)
  let abilities = applyASI(base, species.asi);
  if (species.asiChoice) {
    const exclude = species.asiChoice.exclude || [];
    let chosen = (picks.speciesChoices?.asiChoice || [])
      .map(String)
      .filter((k, i, arr) => ABILITY_KEYS.includes(k) && !exclude.includes(k) && arr.indexOf(k) === i)
      .slice(0, species.asiChoice.count);
    // No/partial picks: default to the class's priority order so the sheet is
    // always legal (a half-elf never loses its +1/+1).
    if (chosen.length < species.asiChoice.count) {
      for (const k of defaultAssignOrder(klass.id)) {
        if (chosen.length >= species.asiChoice.count) break;
        if (!exclude.includes(k) && !chosen.includes(k)) chosen.push(k);
      }
    }
    for (const k of chosen) abilities[k] = clampScore(abilities[k] + species.asiChoice.amount);
  }

  const mods = {};
  for (const k of ABILITY_KEYS) mods[k] = abilityMod(abilities[k]);

  // ---- Proficiencies ----
  const profBonus = PROFICIENCY_BONUS_L1;
  const saveProfs = [...klass.saves];

  const skillProfs = new Set();
  // Background skills (fixed)
  for (const s of background.skills || []) skillProfs.add(s);
  // Species skills (fixed traits)
  for (const t of species.traits || []) {
    if (t.effect?.type === 'skillProficiency') skillProfs.add(t.effect.skill);
  }
  // Species skill choices (half-elf)
  for (const s of (picks.speciesChoices?.skills || [])) {
    if (SKILL_KEYS.includes(String(s))) skillProfs.add(String(s));
  }
  // Class skill choices — validated against the class list, clipped to count.
  const classFrom = klass.skillChoices.from === 'any' ? SKILL_KEYS : klass.skillChoices.from;
  const chosenClassSkills = (picks.classChoices?.skills || [])
    .map(String)
    .filter(s => classFrom.includes(s) && !skillProfs.has(s))
    .slice(0, klass.skillChoices.count);
  // Fill any unchosen slots deterministically so the sheet is always legal.
  if (chosenClassSkills.length < klass.skillChoices.count) {
    const rng = makeRng(seedFromString(`${seed}|srd|skills|${klass.id}`));
    const pool = classFrom.filter(s => !skillProfs.has(s) && !chosenClassSkills.includes(s));
    while (chosenClassSkills.length < klass.skillChoices.count && pool.length) {
      const idx = rng.int(0, pool.length - 1);
      chosenClassSkills.push(pool.splice(idx, 1)[0]);
    }
  }
  for (const s of chosenClassSkills) skillProfs.add(s);

  // Rogue expertise — must be proficient skills.
  const expertise = new Set(
    (picks.classChoices?.expertise || [])
      .map(String)
      .filter(s => skillProfs.has(s))
      .slice(0, klass.choices?.find(c => c.id === 'expertise')?.pickSkills || 0)
  );

  // ---- Class choice features (fighting style, favored enemy, ancestry...) ----
  const chosenOptions = {};
  for (const choice of klass.choices || []) {
    if (choice.pickSkills) continue; // handled above
    const pickId = String(picks.classChoices?.[choice.id] || '');
    const opt = (choice.options || []).find(o => o.id === pickId) || (choice.options || [])[0] || null;
    if (opt) chosenOptions[choice.id] = opt;
  }
  let ancestry = null;
  for (const choice of species.choices || []) {
    if (choice.id === 'ancestry') {
      const pickId = String(picks.speciesChoices?.ancestry || '');
      ancestry = (choice.options || []).find(o => o.id === pickId) || choice.options[0];
    }
  }

  // ---- Equipment ----
  const equipment = [];
  for (const slot of klass.equipment || []) {
    const idx = Math.trunc(Number(picks.classChoices?.equipment?.[slot.id] ?? 0)) || 0;
    const opt = slot.options[Math.max(0, Math.min(idx, slot.options.length - 1))] || slot.options[0];
    equipment.push(...opt);
  }
  equipment.push(...(background.gear || []));

  // ---- Derived numbers ----
  const hpFeatures = [];
  let hpBonusPerLevel = 0;
  for (const t of species.traits || []) {
    if (t.effect?.type === 'hpPerLevel') { hpBonusPerLevel += t.effect.amount; hpFeatures.push(t.name); }
  }
  for (const f of klass.subclass?.features || []) {
    if (f.effect?.type === 'draconicResilience') { hpBonusPerLevel += f.effect.hpPerLevel; hpFeatures.push(f.name); }
  }
  const maxHP = klass.hitDie + mods.CON + hpBonusPerLevel;

  // AC: find worn armor among equipment; respect class proficiencies and STR reqs.
  const wornArmor = pickWornArmor(equipment, klass, abilities);
  const hasShield = equipment.some(e => /shield/i.test(e)) && (klass.armor || []).some(a => /shield/i.test(a));
  const unarmoredDefense = (klass.features || []).map(f => f.effect).find(e => e?.type === 'unarmoredDefense') || null;
  const draconicBase = (klass.subclass?.features || []).map(f => f.effect).find(e => e?.type === 'draconicResilience')?.baseAC || 0;
  const defenseBonus = chosenOptions.fightingStyle?.effect?.type === 'acBonus' && wornArmor ? chosenOptions.fightingStyle.effect.amount : 0;
  const ac = computeAC({
    armorName: wornArmor?.name || null,
    shield: hasShield,
    mods,
    unarmoredDefense: wornArmor ? null : unarmoredDefense,
    draconicBase: wornArmor ? 0 : draconicBase,
    acBonus: defenseBonus
  });

  const saves = {};
  for (const k of ABILITY_KEYS) saves[k] = mods[k] + (saveProfs.includes(k) ? profBonus : 0);

  const skills = {};
  for (const s of SKILL_KEYS) {
    const ab = SKILLS[s];
    let bonus = mods[ab];
    if (skillProfs.has(s)) bonus += profBonus * (expertise.has(s) ? 2 : 1);
    skills[s] = bonus;
  }

  const passivePerception = 10 + skills.Perception;
  const initiative = mods.DEX;

  // ---- Features (species + class + subclass + chosen) ----
  const features = [
    ...(species.traits || []).map(t => ({ source: species.name, name: t.name, text: t.text, effect: t.effect || null })),
    ...(klass.features || []).map(f => ({ source: klass.name, name: f.name, text: f.text, effect: f.effect || null })),
    ...(klass.subclass?.features || []).map(f => ({ source: klass.subclass.name, name: f.name, text: f.text, effect: f.effect || null })),
    ...Object.values(chosenOptions).filter(o => o.text).map(o => ({ source: klass.name, name: o.name, text: o.text, effect: o.effect || null }))
  ];

  // ---- Flavor (keep the engine's ritual + dark fate) ----
  const ritualOpts = rollDetailOptions('fantasy', `${seed}|srd`, makeRng(seedFromString(`${seed}|srd|ritual`)));
  const ritual = normalizeRitualPicks(ritualOpts, picks.ritualPicks);
  const darkFate = rollDarkFate(makeRng(seedFromString(`${seed}|srd|darkfate`)));

  const name = String(picks.name || '').trim() || defaultName(species.id, seed);

  // ---- The 5e sheet (canonical) ----
  const sheet = {
    version: 1,
    species: { id: species.id, name: species.name, subrace: species.subrace, size: species.size, speed: species.speed, languages: species.languages, ancestry: ancestry ? { id: ancestry.id, name: ancestry.name, damage: ancestry.damage } : null },
    class: { id: klass.id, name: klass.name, hitDie: klass.hitDie, subclass: klass.subclass?.name || null },
    level: 1,
    profBonus,
    abilities,
    mods,
    abilityMethod: method,
    abilityRolls: pools ? pools.pools : null,
    maxHP,
    ac,
    initiative,
    speed: species.speed,
    saves,
    saveProfs,
    skills,
    skillProfs: [...skillProfs].sort(),
    expertise: [...expertise].sort(),
    passivePerception,
    armorProfs: [...(klass.armor || []), ...((klass.subclass?.features || []).some(f => f.effect?.type === 'armorProficiency') ? ['heavy'] : [])],
    weaponProfs: klass.weapons || [],
    alignment: { id: alignment.id, name: alignment.name },
    background: { id: background.id, name: background.name, feature: background.feature, hook: background.hook },
    spellcasting: klass.spellcasting ? { ...klass.spellcasting, saveDC: 8 + profBonus + mods[klass.spellcasting.ability], attackBonus: profBonus + mods[klass.spellcasting.ability] } : null,
    features,
    equipment,
    fightingStyle: chosenOptions.fightingStyle?.name || null,
    favoredEnemy: chosenOptions.favoredEnemy?.name || null,
    naturalExplorerTerrain: chosenOptions.terrain?.name || null
  };

  // ---- Legacy entity (what the rest of the engine consumes) ----
  const legacyStats = toLegacyStats(abilities);
  const legacyMods = {};
  for (const k of Object.keys(legacyStats)) legacyMods[k] = abilityMod(legacyStats[k]);

  // Casters know their class cantrip(s) plus two signature level-1 spells, and
  // carry real slots. The refs must exist in the spell catalog.
  const CLASS_SPELLS = {
    bard: ['vicious_mockery', 'cure_wounds', 'charm_person'],
    cleric: ['sacred_flame', 'cure_wounds', 'bless'],
    druid: ['produce_flame', 'cure_wounds', 'entangle'],
    sorcerer: ['fire_bolt', 'magic_missile', 'shield'],
    warlock: ['eldritch_blast', 'witch_bolt', 'armor_of_agathys'],
    wizard: ['fire_bolt', 'magic_missile', 'shield']
  };
  const spellsBlock = klass.spellcasting
    ? {
        known: CLASS_SPELLS[klass.id] || [],
        maxSlots: { ...(klass.spellcasting.slots || {}) },
        slots: { ...(klass.spellcasting.slots || {}) },
        concentration: null
      }
    : { known: [], maxSlots: {}, slots: {}, concentration: null };

  return {
    id: `pc_${seedFromString(`${seed}|srd|id|${name}`)}`,
    name,
    archetype: `${species.name} ${klass.name}`,
    vibe: alignment.name.toLowerCase(),
    stress: 0,
    wounds: 0,
    level: 1,
    xp: 0,
    spells: spellsBlock,

    stats: legacyStats,
    mods: legacyMods,
    rollDetails: { method: method === '4d6' ? '4d6-drop-lowest' : 'standard-array', dice: pools ? Object.fromEntries(ABILITY_KEYS.map((k, i) => [k, pools.pools[i]?.dice || []])) : {} },

    inventory: equipmentToInventory(equipment),

    // P-67 — starting coin: every SRD background carries pocket money in its
    // gear list ("pouch (15 gp)"). Parse it; 10 gp if a background omits it.
    purse: { copper: 0, silver: 0, gold: startingGold(background), platinum: 0 },

    traits: {
      vibe: alignment.name.toLowerCase(),
      fear: '',
      flaw: '',
      ideal: alignment.text,
      detail: ritual.detail,
      keepsake: ritual.keepsake,
      lineYouWontCross: ritual.lineYouWontCross,
      rumor: ritual.rumor
    },

    background: {
      name: background.name,
      tags: [],
      hook: background.hook,
      darkFate
    },

    signature: { itemName: equipment[0] || 'a worn blade', meaning: 'a reminder' },
    position: { zone: 'far' },

    // Canonical 5e sheet — preserved verbatim by ensureEntity.
    dnd: sheet
  };
}

// ---- helpers ----

function defaultAssignOrder(classId) {
  // Primary stat first, then sensible spread.
  const orders = {
    barbarian: ['STR', 'CON', 'DEX', 'WIS', 'CHA', 'INT'],
    bard: ['CHA', 'DEX', 'CON', 'WIS', 'INT', 'STR'],
    cleric: ['WIS', 'CON', 'STR', 'CHA', 'DEX', 'INT'],
    druid: ['WIS', 'CON', 'DEX', 'INT', 'CHA', 'STR'],
    fighter: ['STR', 'CON', 'DEX', 'WIS', 'CHA', 'INT'],
    monk: ['DEX', 'WIS', 'CON', 'STR', 'INT', 'CHA'],
    paladin: ['STR', 'CHA', 'CON', 'WIS', 'DEX', 'INT'],
    ranger: ['DEX', 'WIS', 'CON', 'STR', 'INT', 'CHA'],
    rogue: ['DEX', 'INT', 'CON', 'CHA', 'WIS', 'STR'],
    sorcerer: ['CHA', 'CON', 'DEX', 'INT', 'WIS', 'STR'],
    warlock: ['CHA', 'CON', 'DEX', 'WIS', 'INT', 'STR'],
    wizard: ['INT', 'CON', 'DEX', 'WIS', 'CHA', 'STR']
  };
  return orders[classId] || orders.fighter;
}

/**
 * computeSheetAC(dnd) -> number
 * Recompute AC from a finished sheet (used by level-ups when an ASI shifts
 * DEX/CON, and by anything that changes equipment later). Mirrors the chargen
 * derivation but reads everything off the sheet itself.
 */
export function computeSheetAC(d) {
  if (!d || typeof d !== 'object') return 10;
  const profs = (d.armorProfs || []).map(p => String(p).split(' ')[0]); // 'medium (nonmetal)' -> 'medium'
  let worn = null;
  for (const item of d.equipment || []) {
    const a = findArmor(item);
    if (!a) continue;
    if (!profs.includes(a.category)) continue;
    if (a.strReq && (d.abilities?.STR ?? 10) < a.strReq) continue;
    if (!worn || a.base > worn.base) worn = a;
  }
  const hasShield = (d.equipment || []).some(e => /shield/i.test(String(e))) && profs.includes('shields');
  const unarmored = (d.features || []).map(f => f.effect).find(e => e?.type === 'unarmoredDefense') || null;
  const draconicBase = (d.features || []).map(f => f.effect).find(e => e?.type === 'draconicResilience')?.baseAC || 0;
  const defenseStyle = (d.fightingStyle === 'Defense' || (d.features || []).some(f => f.effect?.type === 'acBonus')) && worn ? 1 : 0;
  return computeAC({
    armorName: worn?.name || null,
    shield: hasShield,
    mods: d.mods || {},
    unarmoredDefense: worn ? null : unarmored,
    draconicBase: worn ? 0 : draconicBase,
    acBonus: defenseStyle
  });
}

function pickWornArmor(equipment, klass, abilities) {
  // Best AC armor in the kit that the class can wear and the character can carry.
  const profs = klass.armor || [];
  let best = null;
  for (const item of equipment) {
    const a = findArmor(item);
    if (!a) continue;
    if (!profs.includes(a.category) && !profs.some(p => String(p).startsWith(a.category))) continue;
    if (a.strReq && abilities.STR < a.strReq) continue;
    if (!best || a.base > best.base) best = a;
  }
  return best;
}

function equipmentToInventory(equipment) {
  const inv = {
    weapons: [], armor: [], tools: [], clothes: [], spells: [], tech: [],
    oddities: [], consumables: [], junk: [], items: []
  };
  const weaponWords = /axe|sword|hammer|mace|bow|crossbow|dagger|javelin|spear|staff|quarterstaff|dart|sling|rapier|scimitar|club|sickle|trap/i;
  const armorWords = /armor|mail|plate|leather|shield|hide/i;
  const clothesWords = /clothes|vestments|costume|hood/i;
  const toolWords = /tools|kit|pack|tinderbox|crowbar|shovel|pot|case|lute|instrument|spellbook|focus|pouch|symbol|book|ink|quill|knife|incense|bolts|arrows/i;
  for (const raw of equipment) {
    const item = String(raw);
    if (armorWords.test(item) && !weaponWords.test(item)) inv.armor.push(item);
    else if (weaponWords.test(item)) inv.weapons.push(item);
    else if (clothesWords.test(item)) inv.clothes.push(item);
    else if (toolWords.test(item)) inv.tools.push(item);
    else inv.oddities.push(item);
  }
  return inv;
}

function defaultName(speciesId, seed) {
  const NAMES = {
    dwarf: ['Bruenor', 'Dagnal', 'Torbera', 'Harbek', 'Eberk', 'Vistra'],
    elf: ['Adran', 'Enna', 'Galinndan', 'Mialee', 'Soveliss', 'Shanairra'],
    halfling: ['Alton', 'Cora', 'Eldon', 'Lavinia', 'Merric', 'Seraphina'],
    human: ['Thorn', 'Mira', 'Bran', 'Sera', 'Orin', 'Kathra'],
    dragonborn: ['Arjhan', 'Akra', 'Donaar', 'Farideh', 'Kriv', 'Sora'],
    gnome: ['Boddynock', 'Ellywick', 'Fonkin', 'Nyx', 'Roondar', 'Zanna'],
    'half-elf': ['Aramil', 'Bree', 'Carric', 'Lia', 'Rolen', 'Theren'],
    'half-orc': ['Dench', 'Emen', 'Holg', 'Shautha', 'Thokk', 'Vola'],
    tiefling: ['Akmenos', 'Damaia', 'Ekemon', 'Kallista', 'Mordai', 'Rieta']
  };
  const list = NAMES[speciesId] || NAMES.human;
  const rng = makeRng(seedFromString(`${seed}|srd|name`));
  return rng.pick(list) || list[0];
}
