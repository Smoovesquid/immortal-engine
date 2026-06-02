// Pass B1 — Bestiary catalog index.

import { goblin } from './goblin.js';
import { goblin_archer } from './goblin_archer.js';
import { wolf } from './wolf.js';
import { bandit } from './bandit.js';
import { bandit_captain } from './bandit_captain.js';
import { owlbear } from './owlbear.js';
import { cultist } from './cultist.js';
import { ashenmoor_warden } from './ashenmoor_warden.js';
import { trivial } from './catalog/trivial.js';
import { minor } from './catalog/minor.js';
import { standard } from './catalog/standard.js';
import { elite } from './catalog/elite.js';

export const BESTIARY_CATALOG = {
  goblin,
  goblin_archer,
  wolf,
  bandit,
  bandit_captain,
  owlbear,
  cultist,
  ashenmoor_warden
};

const TIER_INDEX = (() => {
  const idx = {};
  for (const tier of [trivial, minor, standard, elite]) {
    if (!Array.isArray(tier)) continue;
    for (const c of tier) {
      const ref = c && typeof c === 'object' ? String(c.ref || '') : '';
      if (ref && !idx[ref]) idx[ref] = c;
    }
  }
  return idx;
})();

/** Look up a monster definition by ref. Returns the def or null.
 *  Searches the named BESTIARY_CATALOG first, then the tier catalogs. */
export function getMonsterDef(ref) {
  return BESTIARY_CATALOG[ref] ?? TIER_INDEX[ref] ?? null;
}

/** List all monster defs whose regions array includes the given regionId. */
export function listMonstersForRegion(regionId) {
  const id = String(regionId ?? '');
  return Object.values(BESTIARY_CATALOG).filter(
    m => Array.isArray(m.regions) && m.regions.includes(id)
  );
}
