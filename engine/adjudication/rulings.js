// ── RULINGS LIBRARY ────────────────────────────────────────────────────────
//
// The core 7 adjudications that teach the player the rules and make the DM
// predictable and fair. Each ruling has preconditions, a fixed approach/stat,
// a base DC, and clear outcomes.

import { canBreak, canBurn, canTake } from '../objects/query.js';
import { breakOutcome, burnOutcome, takeOutcome } from '../objects/outcomes.js';

// ── 1. BREAK ────────────────────────────────────────────────────────────
//
// Smash an object apart. Only works on breakable objects.

const BREAK = {
  name: 'BREAK',
  ruleType: 'break',
  keywords: ['break', 'smash', 'shatter', 'crush', 'destroy'],
  precondition: (obj) => canBreak(obj),
  approach: 'force',
  stat: 'MIGHT',
  dcBase: 10,
  dcModifier: (obj) => obj.breakability || 0,
  outcomes: {
    success: (obj) => {
      // Object breaks, parts are created as items
      const outcome = breakOutcome(obj);
      return outcome.possible ? outcome.deltas || [] : [];
    },
    mixed: (obj) => {
      // Object gets damaged but doesn't fully break
      return [{
        op: 'modifyFurniture',
        nodeId: null, // will be filled in
        entityId: obj.id,
        state: 'damaged'
      }];
    },
    failure: () => [] // No change
  },
  narrationTemplate: {
    success: (obj) => `You wrench the ${obj.name} apart. Splinters spray everywhere.`,
    mixed: (obj) => `You strike the ${obj.name}, and it cracks, but holds.`,
    failure: (obj) => `You strike the ${obj.name} hard, but it withstands the impact.`
  }
};

// ── 2. IMPROVISED WEAPON ────────────────────────────────────────────────
//
// Use a mundane object as a weapon. Works on objects that are holdable.

const IMPROVISED_WEAPON = {
  name: 'IMPROVISED_WEAPON',
  ruleType: 'improvised-weapon',
  keywords: ['use', 'wield', 'swing', 'throw', 'club'],
  precondition: (obj) => canTake(obj) && obj.bulk <= 2,
  approach: 'force', // or finesse for throwing
  stat: 'MIGHT', // or AGILITY for finesse
  dcBase: 11, // Harder than real weapon
  dcModifier: () => 0,
  outcomes: {
    success: (obj) => {
      // Object becomes usable as weapon
      return [{
        op: 'createItem',
        name: `${obj.name} (weapon)`,
        category: 'weapon',
        damage: '1d6',
        durability: 'temporary'
      }];
    },
    mixed: (obj) => {
      // Object acts as weapon but unreliable
      return [{
        op: 'createItem',
        name: `${obj.name} (weapon)`,
        category: 'weapon',
        damage: '1d4'
      }];
    },
    failure: (obj) => {
      // Object breaks or slips from hand
      return [{
        op: 'modifyFurniture',
        nodeId: null,
        entityId: obj.id,
        state: 'broken'
      }];
    }
  },
  narrationTemplate: {
    success: (obj) => `The ${obj.name} makes a serviceable weapon in your hands.`,
    mixed: (obj) => `You grip the ${obj.name}, but it feels unreliable.`,
    failure: (obj) => `The ${obj.name} slips from your grasp and breaks.`
  }
};

// ── 3. LIGHT A FIRE ─────────────────────────────────────────────────────
//
// Set something aflame. Works on flammable objects.

const LIGHT_FIRE = {
  name: 'LIGHT_FIRE',
  ruleType: 'fire',
  keywords: ['fire', 'light', 'burn', 'ignite', 'torch'],
  precondition: (obj) => canBurn(obj),
  approach: 'finesse',
  stat: 'AGILITY',
  dcBase: 9,
  dcModifier: (obj) => obj.wet ? 3 : 0,
  outcomes: {
    success: (obj) => {
      // Fire spreads, damage and env deltas
      return [
        {
          op: 'modifyFurniture',
          nodeId: null,
          entityId: obj.id,
          state: 'burning'
        },
        {
          op: 'env',
          nodeId: null,
          heat: 3,
          noise: 3,
          light: 2
        }
      ];
    },
    mixed: (obj) => {
      // Fire starts but small
      return [
        {
          op: 'modifyFurniture',
          nodeId: null,
          entityId: obj.id,
          state: 'burning'
        },
        {
          op: 'env',
          nodeId: null,
          heat: 1,
          noise: 1,
          light: 1
        }
      ];
    },
    failure: () => [] // No fire
  },
  narrationTemplate: {
    success: (obj) => `Flames leap from the ${obj.name}, spreading quickly.`,
    mixed: (obj) => `A small flame catches on the ${obj.name}.`,
    failure: (obj) => `Your attempt to light the ${obj.name} fails.`
  }
};

// ── 4. FALL ─────────────────────────────────────────────────────────────
//
// Gravity adjudication for vertical drops or being pushed. DC scales by distance.

const FALL = {
  name: 'FALL',
  ruleType: 'fall',
  keywords: ['fall', 'drop', 'plunge', 'tumble'],
  precondition: () => true, // Fall can happen anywhere
  approach: 'endure',
  stat: 'GRIT',
  dcBase: 10,
  dcModifier: (distance) => {
    // distance in 5-ft increments
    return (distance || 1) * 1;
  },
  outcomes: {
    success: (obj, distance = 1) => {
      // Half damage, land safely
      const damage = Math.ceil((distance || 1) * 3 / 2);
      return [{
        op: 'wounds',
        amount: damage
      }];
    },
    mixed: (obj, distance = 1) => {
      // Full damage, prone
      const damage = distance || 1 * 3;
      return [
        {
          op: 'wounds',
          amount: damage
        },
        {
          op: 'condition',
          name: 'prone'
        }
      ];
    },
    failure: (obj, distance = 1) => {
      // Extra damage + prone
      const damage = (distance || 1) * 4;
      return [
        {
          op: 'wounds',
          amount: damage
        },
        {
          op: 'condition',
          name: 'prone'
        }
      ];
    }
  },
  narrationTemplate: {
    success: (obj, distance) => `You manage to land safely from the fall.`,
    mixed: (obj, distance) => `You crash down hard, but stay conscious.`,
    failure: (obj, distance) => `You tumble down, taking extra damage.`
  }
};

// ── 5. NOISE ────────────────────────────────────────────────────────────
//
// How loud is an action? Not a roll—automatic based on material + action.
// This doesn't follow the normal outcome path; it just adds to env.

const NOISE = {
  name: 'NOISE',
  ruleType: 'noise',
  keywords: ['noise', 'sound', 'loud', 'quiet'],
  isAutomatic: true, // No roll needed
  precondition: () => true,
  noiseLevels: {
    break: 4,
    fall: 5,
    footstep: 1,
    yell: 6,
    fire: 3
  },
  materialNoise: {
    wood: 3,
    stone: 2,
    metal: 5,
    glass: 6,
    cloth: 1,
    ceramic: 3,
    organic: 2
  },
  computeNoise: (action, material = 'wood') => {
    const baseNoise = NOISE.noiseLevels[action] || 2;
    const matNoise = NOISE.materialNoise[material] || 2;
    return Math.max(baseNoise, matNoise);
  },
  outcomes: {
    automatic: (noise) => [{
      op: 'env',
      nodeId: null,
      noise
    }]
  },
  narrationTemplate: {
    automatic: (noise) => `The sound echoes through the area.`
  }
};

// ── 6. HIDE BEHIND / BLOCK ──────────────────────────────────────────────
//
// Use an object for cover. Must be large enough and positioned between you
// and threat. Gives AC bonus.

const HIDE_BEHIND = {
  name: 'HIDE_BEHIND',
  ruleType: 'cover',
  keywords: ['hide', 'behind', 'cover', 'block', 'shelter'],
  precondition: (obj) => obj.bulk >= 3,
  approach: 'finesse',
  stat: 'AGILITY',
  dcBase: 10,
  dcModifier: () => 0, // Threat awareness would modify
  outcomes: {
    success: () => [{
      op: 'condition',
      name: 'full-cover',
      acBonus: 2
    }],
    mixed: () => [{
      op: 'condition',
      name: 'partial-cover',
      acBonus: 1
    }],
    failure: () => [] // Exposed
  },
  narrationTemplate: {
    success: (obj) => `You slide behind the ${obj.name}, gaining full cover.`,
    mixed: (obj) => `You crouch behind the ${obj.name}, but you're partially exposed.`,
    failure: (obj) => `You try to hide behind the ${obj.name}, but you're completely exposed.`
  }
};

// ── 7. MOVE OBJECT ──────────────────────────────────────────────────────
//
// Push/pull an object to a new location. Uses action economy (costs next
// action). Object must be moveable.

const MOVE_OBJECT = {
  name: 'MOVE_OBJECT',
  ruleType: 'move',
  keywords: ['push', 'pull', 'move', 'shove', 'drag'],
  precondition: (obj) => obj.state !== 'fixed',
  approach: 'force',
  stat: 'MIGHT',
  dcBase: 10,
  dcModifier: (obj) => obj.weight || 0,
  outcomes: {
    success: (obj) => [{
      op: 'modifyFurniture',
      nodeId: null,
      entityId: obj.id,
      position: { moved: true }
    }],
    mixed: (obj) => [{
      op: 'modifyFurniture',
      nodeId: null,
      entityId: obj.id,
      position: { partialMove: true }
    }],
    failure: () => [] // Stuck
  },
  narrationTemplate: {
    success: (obj) => `You shove the ${obj.name} out of the way.`,
    mixed: (obj) => `You manage to move the ${obj.name} a bit.`,
    failure: (obj) => `The ${obj.name} won't budge.`
  }
};

// ── EXPORTS ─────────────────────────────────────────────────────────────

export const RULINGS = {
  BREAK,
  IMPROVISED_WEAPON,
  LIGHT_FIRE,
  FALL,
  NOISE,
  HIDE_BEHIND,
  MOVE_OBJECT
};

// Given an action string and object, find the best matching ruling
export function findRuling(action, obj = null) {
  const actionLower = action.toLowerCase();

  for (const [name, ruling] of Object.entries(RULINGS)) {
    for (const keyword of ruling.keywords || []) {
      if (actionLower.includes(keyword)) {
        // Check precondition if object provided
        if (obj && ruling.precondition && !ruling.precondition(obj)) {
          continue; // This ruling doesn't apply to this object
        }
        return ruling;
      }
    }
  }
  return null;
}

// Apply a ruling given world, object, action, and roll result
export function applyRuling(ruling, outcome, obj, context = {}) {
  if (ruling.isAutomatic) {
    // For NOISE, compute noise and return deltas
    const noise = ruling.computeNoise(context.action, obj?.material || 'wood');
    return ruling.outcomes.automatic(noise);
  }

  // For normal rulings, look up the outcome
  const deltasFn = ruling.outcomes[outcome];
  if (!deltasFn) return [];

  return deltasFn(obj, context.distance);
}

// Get narration for a ruling outcome
export function getRulingNarration(ruling, outcome, obj, context = {}) {
  const narrateFn = ruling.narrationTemplate?.[outcome];
  if (!narrateFn) return `You attempt the ${ruling.name}.`;

  if (ruling.isAutomatic) {
    const noise = ruling.computeNoise(context.action, obj?.material || 'wood');
    return narrateFn(obj, noise);
  }

  return narrateFn(obj, context.distance);
}
