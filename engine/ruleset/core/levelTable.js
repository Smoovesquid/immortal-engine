// Pass T1 — level table.
//
// Twenty levels, milestone-based. `xpToReach` is the cumulative threshold
// to *reach* the given level; level 1 is 0. `profBonus` scales in +1 bands
// roughly every four levels. `features` is deliberately empty in T1 —
// level-up features are T3/T4 content that slots in later.
//
// The table is frozen so downstream code cannot mutate it by reference.

const RAW = [
  { level: 1,  xpToReach: 0,      profBonus: 2, features: [] },
  { level: 2,  xpToReach: 100,    profBonus: 2, features: [] },
  { level: 3,  xpToReach: 250,    profBonus: 2, features: [] },
  { level: 4,  xpToReach: 500,    profBonus: 2, features: [] },
  { level: 5,  xpToReach: 1000,   profBonus: 3, features: [] },
  { level: 6,  xpToReach: 2000,   profBonus: 3, features: [] },
  { level: 7,  xpToReach: 4000,   profBonus: 3, features: [] },
  { level: 8,  xpToReach: 8000,   profBonus: 3, features: [] },
  { level: 9,  xpToReach: 16000,  profBonus: 4, features: [] },
  { level: 10, xpToReach: 32000,  profBonus: 4, features: [] },
  { level: 11, xpToReach: 50000,  profBonus: 4, features: [] },
  { level: 12, xpToReach: 75000,  profBonus: 4, features: [] },
  { level: 13, xpToReach: 100000, profBonus: 5, features: [] },
  { level: 14, xpToReach: 125000, profBonus: 5, features: [] },
  { level: 15, xpToReach: 150000, profBonus: 5, features: [] },
  { level: 16, xpToReach: 180000, profBonus: 5, features: [] },
  { level: 17, xpToReach: 210000, profBonus: 6, features: [] },
  { level: 18, xpToReach: 240000, profBonus: 6, features: [] },
  { level: 19, xpToReach: 270000, profBonus: 6, features: [] },
  { level: 20, xpToReach: 300000, profBonus: 6, features: [] }
];

export const LEVEL_TABLE = Object.freeze(
  RAW.map(row => Object.freeze({ ...row, features: Object.freeze([...row.features]) }))
);

export function levelEntry(level) {
  const lv = Math.max(1, Math.min(20, Math.trunc(Number(level)) || 1));
  return LEVEL_TABLE[lv - 1];
}

export function profBonusFor(level) {
  return levelEntry(level).profBonus;
}

export function xpToReach(level) {
  return levelEntry(level).xpToReach;
}
