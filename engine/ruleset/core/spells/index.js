// Pass T3 + CM8 — spell definition registry.
// Same pattern as the item registries: keyed by defRef, frozen.

// Original 6 spells (top-level files).
import { fire_bolt } from './fire_bolt.js';
import { mage_armor } from './mage_armor.js';
import { shield_spell } from './shield.js';
import { misty_step } from './misty_step.js';
import { fireball } from './fireball.js';
import { counterspell } from './counterspell.js';

// CM8 — catalog by school.
import { lightning_bolt, ice_storm, shocking_grasp } from './catalog/evocation.js';
import { dispel_magic, protection_from_energy } from './catalog/abjuration.js';
import { grease, web, acid_splash, stinking_cloud } from './catalog/conjuration.js';
import { chill_touch, inflict_wounds, vampiric_touch, blight, ray_of_enfeeblement } from './catalog/necromancy.js';
import { haste, slow, enlarge_reduce, stone_skin, feather_fall } from './catalog/transmutation.js';
import { guidance, detect_magic, identify, see_invisibility, true_strike } from './catalog/divination.js';
import { command, hold_person, charm_person, fear, hideous_laughter } from './catalog/enchantment.js';
import { minor_illusion, blur, invisibility, mirror_image, phantasmal_killer } from './catalog/illusion.js';
import { cure_wounds, healing_word, lesser_restoration, greater_restoration, mass_healing_word } from './catalog/restoration.js';
import { temporal_bolt, time_stop, age_ray, temporal_shield, entropic_decay } from './catalog/chronomancy.js';

// CM8 ext — bestiary-referenced spells by school.
import {
  burning_hands, call_lightning, cone_of_cold, flame_strike, flaming_sphere,
  gust_of_wind, heat_metal, hellish_rebuke, magic_missile, scorching_ray,
  shatter, storm_sphere, thunderwave, wall_of_fire, wall_of_force, witch_bolt,
  produce_flame, eldritch_blast, sacred_flame
} from './catalog/evocation_ext.js';

import {
  beacon_of_hope, armor_of_agathys, banishment, bless, death_ward,
  protection_from_poison, remove_curse, shield_of_faith
} from './catalog/abjuration_ext.js';

import {
  arms_of_hadar, cloudkill, dimension_door, entangle, fog_cloud, gaseous_form,
  insect_plague, spike_growth, spirit_guardians, spiritual_weapon, plane_shift
} from './catalog/conjuration_ext.js';

import {
  blindness_deafness, animate_dead, bestow_curse, contagion, false_life,
  gentle_repose, ray_of_sickness
} from './catalog/necromancy_ext.js';

import {
  blink, barkskin, enhance_ability, fly_spell, goodberry, polymorph,
  telekinesis, water_breathing
} from './catalog/transmutation_ext.js';

import {
  augury, comprehend_languages, contact_other_plane, detect_poison,
  detect_poison_and_disease, detect_thoughts, legend_lore, nondetection, scrying
} from './catalog/divination_ext.js';

import {
  animal_friendship, bane, cause_fear, crown_of_madness, dominate_person,
  enemies_abound, enthrall, eyebite, hex, hypnotic_pattern, modify_memory,
  sleep, suggestion, vicious_mockery
} from './catalog/enchantment_ext.js';

import {
  dancing_lights, darkness, disguise_self, dream, faerie_fire, greater_invisibility,
  mirage_arcane, phantasmal_force, project_image, silence, silent_image
} from './catalog/illusion_ext.js';

const ALL_SPELLS = [
  // Original 6
  fire_bolt, mage_armor, shield_spell, misty_step, fireball, counterspell,
  // Evocation (+3)
  lightning_bolt, ice_storm, shocking_grasp,
  // Abjuration (+2)
  dispel_magic, protection_from_energy,
  // Conjuration (+4)
  grease, web, acid_splash, stinking_cloud,
  // Necromancy (+5)
  chill_touch, inflict_wounds, vampiric_touch, blight, ray_of_enfeeblement,
  // Transmutation (+5)
  haste, slow, enlarge_reduce, stone_skin, feather_fall,
  // Divination (+5)
  guidance, detect_magic, identify, see_invisibility, true_strike,
  // Enchantment (+5)
  command, hold_person, charm_person, fear, hideous_laughter,
  // Illusion (+5)
  minor_illusion, blur, invisibility, mirror_image, phantasmal_killer,
  // Restoration (+5)
  cure_wounds, healing_word, lesser_restoration, greater_restoration, mass_healing_word,
  // Chronomancy (+5)
  temporal_bolt, time_stop, age_ray, temporal_shield, entropic_decay,

  // --- CM8 ext: bestiary-referenced spells ---

  // Evocation ext (+17)
  burning_hands, call_lightning, cone_of_cold, flame_strike, flaming_sphere,
  gust_of_wind, heat_metal, hellish_rebuke, magic_missile, scorching_ray,
  shatter, storm_sphere, thunderwave, wall_of_fire, wall_of_force, witch_bolt,
  produce_flame, eldritch_blast, sacred_flame, vicious_mockery,
  // Abjuration ext (+8)
  beacon_of_hope, armor_of_agathys, banishment, bless, death_ward,
  protection_from_poison, remove_curse, shield_of_faith,
  // Conjuration ext (+11)
  arms_of_hadar, cloudkill, dimension_door, entangle, fog_cloud, gaseous_form,
  insect_plague, spike_growth, spirit_guardians, spiritual_weapon, plane_shift,
  // Necromancy ext (+7)
  blindness_deafness, animate_dead, bestow_curse, contagion, false_life,
  gentle_repose, ray_of_sickness,
  // Transmutation ext (+8)
  blink, barkskin, enhance_ability, fly_spell, goodberry, polymorph,
  telekinesis, water_breathing,
  // Divination ext (+9)
  augury, comprehend_languages, contact_other_plane, detect_poison,
  detect_poison_and_disease, detect_thoughts, legend_lore, nondetection, scrying,
  // Enchantment ext (+13)
  animal_friendship, bane, cause_fear, crown_of_madness, dominate_person,
  enemies_abound, enthrall, eyebite, hex, hypnotic_pattern, modify_memory,
  sleep, suggestion,
  // Illusion ext (+11)
  dancing_lights, darkness, disguise_self, dream, faerie_fire, greater_invisibility,
  mirage_arcane, phantasmal_force, project_image, silence, silent_image
];

/** defRef -> spell definition (frozen) */
export const SPELL_REGISTRY = Object.freeze(
  Object.fromEntries(ALL_SPELLS.map(s => [s.defRef, Object.freeze({ ...s })]))
);

/** Look up a spell by defRef. Returns the frozen def or null. */
export function lookupSpell(defRef) {
  const key = String(defRef ?? '').trim();
  return SPELL_REGISTRY[key] ?? null;
}

/** All spell defRefs. */
export function allSpellRefs() {
  return Object.keys(SPELL_REGISTRY);
}

/** Count of registered spells. */
export const SPELL_COUNT = ALL_SPELLS.length;
