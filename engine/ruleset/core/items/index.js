// Pass T2 — item catalog index.

import { shortsword, longsword, longbow } from './weapons.js';
import { leather_armor, chain_mail, studded_leather, padded, hide_armor, scale_mail, half_plate, plate_armor } from './armor.js';
import { healing_potion_minor, antidote } from './consumables.js';
import { longsword_magic_1, ring_of_protection } from './magic.js';
import { ancient_scroll, sigil_key } from './quest.js';

export const ITEM_CATALOG = {
  shortsword,
  longsword,
  longbow,
  leather_armor,
  chain_mail,
  studded_leather,
  padded,
  hide_armor,
  scale_mail,
  half_plate,
  plate_armor,
  healing_potion_minor,
  antidote,
  longsword_magic_1,
  ring_of_protection,
  ancient_scroll,
  sigil_key
};

export function getItemDef(defRef) {
  return ITEM_CATALOG[defRef] || null;
}
