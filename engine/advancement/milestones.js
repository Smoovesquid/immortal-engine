// Milestone advancement — pure, deterministic, no RNG.
//
// Goals completed → level. Milestone pacing (not XP): meaningful narrative
// achievements cross the threshold, not grinding. Each milestone maps to the
// completed-goals count that unlocks the next level.
//
// Levels 1→5 only (the engine's current play range). levelUpSheet handles
// everything mechanical; this module decides when it fires.

import { levelUpSheet } from '../chargen/srd/levelUp.js';

// Goals completed needed to reach each level.
const THRESHOLDS = [
  { goalsNeeded: 2, toLevel: 2 },
  { goalsNeeded: 5, toLevel: 3 },
  { goalsNeeded: 9, toLevel: 4 },
  { goalsNeeded: 14, toLevel: 5 },
];

/**
 * checkMilestone(world) -> { world, leveled, newLevel, gainedFeatures }
 *
 * Pure. Returns the world (with pc leveled up if milestone was just crossed),
 * a boolean flag, the new level, and the feature names gained (for narration).
 * No-op if the pc has no 5e sheet, already at max, or milestone not yet reached.
 * Idempotent: will not re-level at a threshold already passed.
 */
export function checkMilestone(world) {
  const NONE = { world, leveled: false, newLevel: null, gainedFeatures: [] };
  const party = Array.isArray(world?.party) ? world.party : [];
  const pc = party[0];
  if (!pc?.dnd) return NONE;

  const currentLevel = pc.dnd.level;
  if (currentLevel >= 5) return NONE;

  const completedCount = (world.goals || []).filter(g => g.status === 'completed').length;
  const next = THRESHOLDS.find(m => m.toLevel === currentLevel + 1);
  if (!next || completedCount < next.goalsNeeded) return NONE;

  const leveled = levelUpSheet(pc);
  const newParty = [leveled, ...party.slice(1)];
  return {
    world: { ...world, party: newParty },
    leveled: true,
    newLevel: leveled.dnd?.level ?? currentLevel + 1,
    gainedFeatures: leveled.gainedFeatures || []
  };
}

/**
 * buildLevelUpLine(newLevel, gainedFeatures) -> string
 *
 * DM-voiced single line for narration injection. Short, concrete.
 */
export function buildLevelUpLine(newLevel, gainedFeatures) {
  const feats = Array.isArray(gainedFeatures) && gainedFeatures.length
    ? ` ${gainedFeatures.join('. ')}.`
    : '';
  return `Level ${newLevel}.${feats}`;
}
