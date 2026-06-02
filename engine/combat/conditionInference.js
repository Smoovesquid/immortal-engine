/**
 * Condition inference — automatically applies conditions to creature actions
 * based on damage type, action name, and creature traits.
 *
 * Rather than manually editing 754 creature definitions, this module infers
 * which conditions an action should apply based on patterns a D&D DM would
 * recognize: poison damage → poisoned, constrict → restrained, gaze → various.
 *
 * Called during action resolution to augment the conditions array on actions
 * that don't already have explicit conditions set.
 *
 * Pure. No RNG. Deterministic.
 */

// ── Condition templates ──────────────────────────────────────────────────

const POISONED = { name: 'poisoned', until: 'save_ends', saveToEnd: { stat: 'GRIT', dc: 12 }, severity: 1, stackBehavior: 'replace' };
const PARALYZED = { name: 'paralyzed', until: 'save_ends', saveToEnd: { stat: 'GRIT', dc: 14 }, severity: 2, stackBehavior: 'replace' };
const RESTRAINED = { name: 'restrained', until: 'save_ends', saveToEnd: { stat: 'MIGHT', dc: 12 }, severity: 1, stackBehavior: 'replace' };
const FRIGHTENED = { name: 'frightened', until: 'save_ends', saveToEnd: { stat: 'WITS', dc: 12 }, severity: 1, stackBehavior: 'replace' };
const CHARMED = { name: 'charmed', until: 'save_ends', saveToEnd: { stat: 'WITS', dc: 12 }, severity: 1, stackBehavior: 'replace' };
const BLINDED = { name: 'blinded', until: 'end_of_next_turn', severity: 1, stackBehavior: 'replace' };
const STUNNED = { name: 'stunned', until: 'end_of_next_turn', severity: 2, stackBehavior: 'replace' };
const PRONE = { name: 'prone', until: 'end_of_next_turn', severity: 1, stackBehavior: 'replace' };
const GRAPPLED = { name: 'grappled', until: 'save_ends', saveToEnd: { stat: 'MIGHT', dc: 12 }, severity: 1, stackBehavior: 'replace' };
const BURNING = { name: 'burning', until: 'save_ends', saveToEnd: { stat: 'AGILITY', dc: 12 }, severity: 1, stackBehavior: 'replace' };
const BLEEDING = { name: 'bleeding', until: 'save_ends', saveToEnd: { stat: 'GRIT', dc: 12 }, severity: 1, stackBehavior: 'stack' };
const FROZEN = { name: 'frozen', until: 'end_of_next_turn', severity: 1, stackBehavior: 'replace' };
const PETRIFIED = { name: 'petrified', until: 'save_ends', saveToEnd: { stat: 'GRIT', dc: 14 }, severity: 3, stackBehavior: 'replace' };

// ── Inference by damage type ─────────────────────────────────────────────

const DAMAGE_TYPE_CONDITIONS = {
  poison: POISONED,
  acid: POISONED,      // acid burns → poisoned (nausea)
  psychic: FRIGHTENED,
  necrotic: null,       // necrotic is damage, not a condition
  radiant: null,
  fire: null,           // fire damage alone doesn't inflict a condition (burning comes from action name)
  cold: null,
  lightning: null,
  force: null,
  sonic: null,
  temporal: null,
  entropic: null
};

// ── Inference by action name pattern ─────────────────────────────────────

const ACTION_NAME_PATTERNS = [
  // Grapple / restraint
  { pattern: /\b(constrict|grab|tentacle|grapple|ensnare|entangle|web|bind|wrap|coil)\b/i, condition: RESTRAINED },
  { pattern: /\b(swallow)\b/i, condition: RESTRAINED },

  // Stun / incapacitate
  { pattern: /\b(stun|slam|thunderclap|mind blast|psychic scream|brain)\b/i, condition: STUNNED },

  // Fear
  { pattern: /\b(horrifying|frightful|terrif|dread|howl|wail|shriek|scream|fear)\b/i, condition: FRIGHTENED },
  { pattern: /\b(death\s*gaze|doom)\b/i, condition: FRIGHTENED },

  // Charm / dominate
  { pattern: /\b(charm|lure|beguil|enthrall|mesmer|seduc|allur|enchant|dominate)\b/i, condition: CHARMED },
  { pattern: /\b(song|luring|captivat)\b/i, condition: CHARMED },

  // Blind
  { pattern: /\b(blind|flash|dazzl|ink\s*(cloud|spray)|sand\s*throw|dust)\b/i, condition: BLINDED },

  // Knockdown / prone
  { pattern: /\b(charge|trample|knockback|tail\s*sweep|wing\s*buffet|slam)\b/i, condition: PRONE },

  // Paralysis
  { pattern: /\b(paralyz|petrif|gaze|turn\s*to\s*stone)\b/i, condition: PARALYZED },

  // Poison (by action name)
  { pattern: /\b(poison|venom|toxic|sting|fang|bite.*poison)\b/i, condition: POISONED },

  // Burn
  { pattern: /\b(ignite|immolat|burning|fire\s*breath)\b/i, condition: BURNING },

  // Bleed
  { pattern: /\b(rend|tear|lacerat|bleed|gore|rip|claw.*rend)\b/i, condition: BLEEDING },

  // Freeze
  { pattern: /\b(freeze|frost\s*breath|ice\s*blast|cold\s*snap|glacial)\b/i, condition: FROZEN },

  // Petrify
  { pattern: /\b(petrif|stone\s*gaze|calcif)\b/i, condition: PETRIFIED },

  // Grapple (by action name)
  { pattern: /\b(tongue|appendage|vine|tendril|pseudopod)\b/i, condition: GRAPPLED }
];

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Infer conditions for an action that doesn't already have explicit conditions.
 * Returns the action's existing conditions if present, or inferred conditions.
 *
 * @param {object} action - { name, type, conditions?, ... }
 * @returns {Array<object>} conditions to apply on hit
 */
export function inferConditions(action) {
  const act = action && typeof action === 'object' ? action : {};

  // If the action already has explicit conditions, use those.
  if (Array.isArray(act.conditions) && act.conditions.length > 0) {
    return act.conditions;
  }

  const actionName = String(act.name || '').toLowerCase();
  const dmgType = String(act.type || '').toLowerCase();
  const inferred = [];

  // Check action name patterns first (more specific).
  for (const { pattern, condition } of ACTION_NAME_PATTERNS) {
    if (pattern.test(actionName)) {
      inferred.push({ ...condition });
      break; // One condition per action to avoid pile-on.
    }
  }

  // If no name match, check damage type (less specific).
  if (inferred.length === 0) {
    const dmgCond = DAMAGE_TYPE_CONDITIONS[dmgType];
    if (dmgCond) {
      inferred.push({ ...dmgCond });
    }
  }

  return inferred;
}

/**
 * Augment an action with inferred conditions.
 * Returns a new action object with conditions filled in.
 * Does NOT mutate the original.
 */
export function augmentActionConditions(action) {
  const act = action && typeof action === 'object' ? action : {};
  if (Array.isArray(act.conditions) && act.conditions.length > 0) return act;
  const conditions = inferConditions(act);
  if (conditions.length === 0) return act;
  return { ...act, conditions };
}
