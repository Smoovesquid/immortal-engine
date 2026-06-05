// ── SPATIAL RULINGS ────────────────────────────────────────────────────────
//
// Board-aware tactics where position affects outcomes.
// These rulings check spatial preconditions and modify DC based on positioning.

import {
  distance,
  isAdjacent,
  hasLineOfSight,
  furnitureAtNode,
  dcModifierForDistance,
  moveToward,
  positionAround
} from '../spatial/positioning.js';

// ── 1. HIDE_BEHIND_POSITIONED ───────────────────────────────────────────
//
// Cover only works if you're adjacent to the object AND it blocks line of sight.

const HIDE_BEHIND_POSITIONED = {
  name: 'HIDE_BEHIND_POSITIONED',
  ruleType: 'cover-positioned',
  keywords: ['hide', 'behind', 'cover', 'crouch', 'shelter'],
  isSpatial: true,
  precondition: (obj, world, playerPos, threatPos) => {
    if (!obj || !playerPos || !threatPos) return false;

    const objPos = obj.position || { ux: 50, uy: 50, elevation: 0 };

    // Must be adjacent to object
    if (!isAdjacent(playerPos, objPos)) return false;

    // Object must be large enough
    if (!obj.bulk || obj.bulk < 3) return false;

    // Object must block line of sight between player and threat
    const others = [];
    return !hasLineOfSight(playerPos, threatPos, [{ position: objPos }, ...others]);
  },
  approach: 'finesse',
  stat: 'AGILITY',
  dcBase: 10,
  dcModifier: (obj, world, playerPos, threatPos) => {
    // Harder if threat is aware
    const threatAwareness = world?.conductor?.threat?.perception ?? 1;
    return threatAwareness;
  },
  outcomes: {
    success: (obj) => [{
      op: 'condition',
      name: 'full-cover',
      acBonus: 2,
      hidden: true
    }],
    mixed: (obj) => [{
      op: 'condition',
      name: 'partial-cover',
      acBonus: 1,
      hidden: false
    }],
    failure: () => []
  },
  narrationTemplate: {
    success: (obj) => `You slide behind the ${obj.name}, completely hidden.`,
    mixed: (obj) => `You crouch behind the ${obj.name}, but you're partially visible.`,
    failure: (obj) => `You try to hide behind the ${obj.name}, but there's nowhere to hide.`
  }
};

// ── 2. FLANK ────────────────────────────────────────────────────────────
//
// Move to the opposite side of an enemy to gain tactical advantage.

const FLANK = {
  name: 'FLANK',
  ruleType: 'flank',
  keywords: ['flank', 'surround', 'circle', 'position', 'move-around'],
  isSpatial: true,
  precondition: (enemy, world, playerPos) => {
    if (!enemy || !playerPos) return false;

    const enemyPos = enemy.position || { ux: 50, uy: 50, elevation: 0 };

    // Must not already be adjacent (would use regular attack)
    if (isAdjacent(playerPos, enemyPos, 15)) return false;

    // Enemy must be in reachable distance
    if (distance(playerPos, enemyPos) > 60) return false;

    return true;
  },
  approach: 'finesse',
  stat: 'AGILITY',
  dcBase: 10,
  dcModifier: (enemy, world, playerPos) => {
    // Harder if enemy is alert
    const awareness = enemy.awareness ?? 1;
    return awareness;
  },
  outcomes: {
    success: (enemy, world, playerPos) => {
      // Move to flank position (opposite side from current)
      const enemyPos = enemy.position || { ux: 50, uy: 50, elevation: 0 };
      const flankPos = positionAround(enemyPos, Math.PI, 12); // opposite side

      return [
        {
          op: 'modifyPosition',
          partyMemberId: 'party',
          position: flankPos
        },
        {
          op: 'condition',
          name: 'flanking',
          duration: 1,
          attackBonus: 2
        }
      ];
    },
    mixed: (enemy, world, playerPos) => {
      // Move to flank but no bonus
      const enemyPos = enemy.position || { ux: 50, uy: 50, elevation: 0 };
      const flankPos = positionAround(enemyPos, Math.PI, 12);

      return [{
        op: 'modifyPosition',
        partyMemberId: 'party',
        position: flankPos
      }];
    },
    failure: () => [] // Stay in place, exposed
  },
  narrationTemplate: {
    success: (enemy) => `You circle around the ${enemy.name} to gain the advantage.`,
    mixed: (enemy) => `You move to flank the ${enemy.name}, but it's aware of you.`,
    failure: (enemy) => `The ${enemy.name} moves to keep you in front.`
  }
};

// ── 3. BLOCK_DOORWAY ────────────────────────────────────────────────────
//
// Position yourself to prevent passage through a doorway.

const BLOCK_DOORWAY = {
  name: 'BLOCK_DOORWAY',
  ruleType: 'block',
  keywords: ['block', 'hold', 'defend', 'barricade'],
  isSpatial: true,
  precondition: (obj, world, playerPos) => {
    if (!obj || !playerPos) return false;

    const objPos = obj.position || { ux: 50, uy: 50, elevation: 0 };

    // Must be adjacent to doorway
    if (!isAdjacent(playerPos, objPos)) return false;

    // Must be large enough to block
    if (!obj.bulk || obj.bulk < 2) return false;

    // Object must be a doorway or entrance
    const tags = obj.tags || [];
    return tags.some(t => t === 'entrance' || t === 'doorway' || t === 'door');
  },
  approach: 'force',
  stat: 'MIGHT',
  dcBase: 10,
  dcModifier: () => 0,
  outcomes: {
    success: () => [{
      op: 'condition',
      name: 'blocking-doorway',
      duration: null, // until you move
      ac: 1 // +1 AC from being behind doorway
    }],
    mixed: () => [{
      op: 'condition',
      name: 'blocking-doorway-weak',
      duration: 1,
      ac: 0
    }],
    failure: () => [] // No blocking
  },
  narrationTemplate: {
    success: (obj) => `You plant yourself firmly in the ${obj.name}, blocking passage.`,
    mixed: (obj) => `You hold the ${obj.name}, but your grip is weak.`,
    failure: (obj) => `You attempt to block the ${obj.name}, but fail.`
  }
};

// ── 4. CHARGE ──────────────────────────────────────────────────────────
//
// Move at speed toward enemy with attack advantage but lower defense.

const CHARGE = {
  name: 'CHARGE',
  ruleType: 'charge',
  keywords: ['charge', 'rush', 'assault', 'sprint-at'],
  isSpatial: true,
  precondition: (enemy, world, playerPos) => {
    if (!enemy || !playerPos) return false;

    const enemyPos = enemy.position || { ux: 50, uy: 50, elevation: 0 };
    const dist = distance(playerPos, enemyPos);

    // Must be at least 20 units away (clear distance to charge)
    if (dist < 20) return false;

    // Can't charge from too far away
    if (dist > 80) return false;

    return true;
  },
  approach: 'force',
  stat: 'MIGHT',
  dcBase: 10,
  dcModifier: (enemy, world, playerPos) => {
    // DC increases with distance (longer charges are harder)
    const enemyPos = enemy.position || { ux: 50, uy: 50, elevation: 0 };
    const dist = distance(playerPos, enemyPos);
    return Math.floor(dist / 20); // +1 per 20 units
  },
  outcomes: {
    success: (enemy, world, playerPos) => {
      // Move to enemy, attack bonus, but AC penalty
      const enemyPos = enemy.position || { ux: 50, uy: 50, elevation: 0 };

      return [
        {
          op: 'modifyPosition',
          partyMemberId: 'party',
          position: moveToward(playerPos, enemyPos, 100)
        },
        {
          op: 'condition',
          name: 'charging',
          duration: 1,
          attackBonus: 1,
          acPenalty: 1
        }
      ];
    },
    mixed: (enemy, world, playerPos) => {
      // Move to enemy, no bonus/penalty
      const enemyPos = enemy.position || { ux: 50, uy: 50, elevation: 0 };

      return [{
        op: 'modifyPosition',
        partyMemberId: 'party',
        position: moveToward(playerPos, enemyPos, 100)
      }];
    },
    failure: (enemy, world, playerPos) => {
      // Stumble partway, prone
      return [{
        op: 'condition',
        name: 'prone',
        duration: 1
      }];
    }
  },
  narrationTemplate: {
    success: (enemy) => `You charge at the ${enemy.name} with overwhelming momentum.`,
    mixed: (enemy) => `You charge at the ${enemy.name}, reaching them.`,
    failure: (enemy) => `You stumble while charging at the ${enemy.name}.`
  }
};

// ── 5. DISENGAGE ────────────────────────────────────────────────────────
//
// Tactical retreat while maintaining safety (enemy doesn't get reaction).

const DISENGAGE = {
  name: 'DISENGAGE',
  ruleType: 'disengage',
  keywords: ['disengage', 'retreat', 'withdraw', 'back-away'],
  isSpatial: true,
  precondition: (enemy, world, playerPos) => {
    if (!playerPos) return false;

    // Must be adjacent to enemy to disengage from them
    const enemyPos = enemy?.position || { ux: 50, uy: 50, elevation: 0 };
    return isAdjacent(playerPos, enemyPos, 15);
  },
  approach: 'finesse',
  stat: 'AGILITY',
  dcBase: 10,
  dcModifier: () => 0, // Automatic on success
  outcomes: {
    success: (enemy, world, playerPos) => {
      // Move away, no reaction
      const enemyPos = enemy?.position || { ux: 50, uy: 50, elevation: 0 };
      const awayPos = moveToward(playerPos, enemyPos, -30); // move away

      return [{
        op: 'modifyPosition',
        partyMemberId: 'party',
        position: awayPos
      }];
    },
    mixed: (enemy, world, playerPos) => {
      // Move away, but enemy gets reaction
      const enemyPos = enemy?.position || { ux: 50, uy: 50, elevation: 0 };
      const awayPos = moveToward(playerPos, enemyPos, -30);

      return [
        {
          op: 'modifyPosition',
          partyMemberId: 'party',
          position: awayPos
        },
        {
          op: 'reaction',
          enemyId: enemy?.id,
          type: 'opportunity-attack-disadvantage'
        }
      ];
    },
    failure: () => [] // Can't escape
  },
  narrationTemplate: {
    success: (enemy) => `You smoothly retreat from the ${enemy.name} while keeping watch.`,
    mixed: (enemy) => `You back away from the ${enemy.name}, but it swipes at you.`,
    failure: (enemy) => `The ${enemy.name} blocks your escape.`
  }
};

// ── EXPORTS ─────────────────────────────────────────────────────────────

export const SPATIAL_RULINGS = {
  HIDE_BEHIND_POSITIONED,
  FLANK,
  BLOCK_DOORWAY,
  CHARGE,
  DISENGAGE
};

// Find a spatial ruling that matches the action
export function findSpatialRuling(action, target, world, playerPos, threatPos) {
  const actionLower = action.toLowerCase();

  for (const [name, ruling] of Object.entries(SPATIAL_RULINGS)) {
    for (const keyword of ruling.keywords || []) {
      if (actionLower.includes(keyword)) {
        // Check precondition with spatial context
        if (ruling.precondition && !ruling.precondition(target, world, playerPos, threatPos)) {
          continue;
        }
        return ruling;
      }
    }
  }
  return null;
}

// Apply a spatial ruling with position context
export function applySpatialRuling(ruling, outcome, target, world, playerPos, threatPos) {
  const deltasFn = ruling.outcomes?.[outcome];
  if (!deltasFn) return [];

  return deltasFn(target, world, playerPos, threatPos);
}

// Get narration for a spatial ruling
export function getSpatialRulingNarration(ruling, outcome, target) {
  const narrateFn = ruling.narrationTemplate?.[outcome];
  if (!narrateFn) return `You attempt that move.`;

  return narrateFn(target);
}
