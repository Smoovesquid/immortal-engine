// Pre-rolled heroes — a ready-made roster you can one-click into the game,
// skipping the 6-step chargen wizard (the recurring playtest pain point:
// "I have to roll a new character every time").
//
// Each is a REAL character built deterministically through createCharacter (the
// same genesis path beginAdventure uses), so they carry full inventory, traits,
// background, and a stable id — nothing hand-faked. We override only the stat
// spread so each hero plays to a clear archetype (the brawler is strong, the
// scout nimble, the priest wise), then recompute mods to match.

import { createCharacter } from './genesis.js';
import { FANTASY_STARTER_GEAR } from './fantasyGear.js';
import { statMod, STAT_KEYS } from './stats.js';

// Stats use the 5-key system (MIGHT/AGILITY/WITS/GRIT/CHARM). Spreads sit in the
// normal 2d6+2 band (~4–14) with one or two standout traits per hero.
export const PRE_ROLLED = [
  {
    id: 'bryn', name: 'Bryn Holt', archetype: 'Sellsword',
    blurb: 'A scarred blade-for-hire — hits hard, soaks a beating.',
    seed: 'prerolled:bryn', stats: { MIGHT: 14, AGILITY: 11, WITS: 8, GRIT: 13, CHARM: 9 },
  },
  {
    id: 'wrenna', name: 'Wrenna Vale', archetype: 'Outrider',
    blurb: 'Quick and watchful; reads the ground and the trouble on it.',
    seed: 'prerolled:wrenna', stats: { MIGHT: 9, AGILITY: 14, WITS: 12, GRIT: 10, CHARM: 10 },
  },
  {
    id: 'oswin', name: 'Father Oswin', archetype: 'Hedge-Priest',
    blurb: 'A wandering cleric with steady hands and a steadier tongue.',
    seed: 'prerolled:oswin', stats: { MIGHT: 9, AGILITY: 8, WITS: 13, GRIT: 11, CHARM: 13 },
  },
  {
    id: 'mim', name: 'Mim Cobble', archetype: 'Cutpurse',
    blurb: 'Light fingers, lighter feet, and a grin you should not trust.',
    seed: 'prerolled:mim', stats: { MIGHT: 7, AGILITY: 14, WITS: 11, GRIT: 9, CHARM: 12 },
  },
  {
    id: 'aldith', name: 'Dame Aldith', archetype: 'Knight-Errant',
    blurb: 'A landless knight chasing a vow — brave nearly to a fault.',
    seed: 'prerolled:aldith', stats: { MIGHT: 13, AGILITY: 9, WITS: 9, GRIT: 12, CHARM: 12 },
  },
];

function modsFor(stats) {
  const m = {};
  for (const k of STAT_KEYS) m[k] = statMod(Number(stats[k]) || 10);
  return m;
}

// Build a full, playable PC from a roster entry. Deterministic: same entry → same
// character, every time.
export function buildPreRolledCharacter(entry) {
  if (!entry) return null;
  const c = createCharacter({
    seed: entry.seed,
    packId: 'fantasy',
    fate: 0.2,
    name: entry.name,
    archetype: entry.archetype,
    packGear: FANTASY_STARTER_GEAR,
  });
  if (entry.stats) {
    c.stats = { ...c.stats, ...entry.stats };
    c.mods = modsFor(c.stats);
  }
  return c;
}

export function preRolledById(id) {
  const entry = PRE_ROLLED.find(e => e.id === id);
  return entry ? buildPreRolledCharacter(entry) : null;
}
