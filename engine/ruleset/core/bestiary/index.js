// Pass B1 — Bestiary catalog index.

import { goblin } from './goblin.js';
import { goblin_archer } from './goblin_archer.js';
import { wolf } from './wolf.js';
import { bandit } from './bandit.js';
import { bandit_captain } from './bandit_captain.js';
import { owlbear } from './owlbear.js';
import { cultist } from './cultist.js';
import { ashenmoor_warden } from './ashenmoor_warden.js';

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

/** Look up a monster definition by ref. Returns the def or null. */
export function getMonsterDef(ref) {
  return BESTIARY_CATALOG[ref] ?? null;
}

/** List all monster defs whose regions array includes the given regionId. */
export function listMonstersForRegion(regionId) {
  const id = String(regionId ?? '');
  return Object.values(BESTIARY_CATALOG).filter(
    m => Array.isArray(m.regions) && m.regions.includes(id)
  );
}
