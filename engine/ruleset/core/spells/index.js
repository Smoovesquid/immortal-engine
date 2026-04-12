// Pass T3 — spell definition registry.
// Same pattern as the item registries: keyed by defRef, frozen.

import { fire_bolt } from './fire_bolt.js';
import { mage_armor } from './mage_armor.js';
import { shield_spell } from './shield.js';
import { misty_step } from './misty_step.js';
import { fireball } from './fireball.js';
import { counterspell } from './counterspell.js';

const ALL_SPELLS = [
  fire_bolt,
  mage_armor,
  shield_spell,
  misty_step,
  fireball,
  counterspell
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
