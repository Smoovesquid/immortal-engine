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
  temporal_bolt, time_stop, age_ray, temporal_shield, entropic_decay
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
