// Item catalog index (P-69: full SRD spread + the magic ladder).

import * as weapons from './weapons.js';
import * as armor from './armor.js';
import * as consumables from './consumables.js';
import * as magic from './magic.js';
import * as quest from './quest.js';
import * as materials from './materials.js';

export const ITEM_CATALOG = {};
for (const mod of [weapons, armor, consumables, magic, quest, materials]) {
  for (const def of Object.values(mod)) {
    if (def && typeof def === 'object' && def.defRef) ITEM_CATALOG[def.defRef] = def;
  }
}

export function getItemDef(defRef) {
  return ITEM_CATALOG[defRef] || null;
}

/** Catalog lookup by display name (case-insensitive); null if absent. */
export function findDefByName(name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  for (const def of Object.values(ITEM_CATALOG)) {
    if (def.name.toLowerCase() === n) return def;
  }
  // loose: "a suit of chain mail", "leather armour" — containment either way
  for (const def of Object.values(ITEM_CATALOG)) {
    if (n.includes(def.name.toLowerCase()) || def.name.toLowerCase().includes(n)) return def;
  }
  return null;
}

/** All defs of a rarity tier, optionally filtered by kind. */
export function defsByRarity(rarity, kind = null) {
  return Object.values(ITEM_CATALOG).filter(d =>
    d.rarity === rarity && (!kind || d.kind === kind) && d.kind !== 'quest');
}
