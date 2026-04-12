/**
 * Pass CM2 — Condition mechanical effects.
 *
 * Pure lookup: no state mutation, no RNG. Maps active conditions to
 * mechanical modifiers that the combat resolver applies.
 *
 * getConditionModifiers(conditions) -> modifiers object
 */

/**
 * getConditionModifiers(conditions)
 *
 * Takes an array of active condition objects and returns aggregated
 * mechanical modifiers:
 *
 *   dcModifier      — added to DC for this entity's approaches
 *   acModifier      — added/subtracted from AC
 *   skipTurn        — entity loses their turn
 *   autoHit         — attacks against this entity auto-hit
 *   meleeCrit       — melee hits against this entity auto-crit
 *   cantAttackSource — cannot attack the charm source
 *   cantAdvanceZone  — cannot move forward in zones
 *   cantUseHeart     — heart approach blocked
 *   extraAction      — gets an extra action
 *   approachDcMods   — per-approach DC adjustments
 *   attacksAgainstDC — modifier to DC when others attack this entity
 */
export function getConditionModifiers(conditions) {
  const list = Array.isArray(conditions) ? conditions : [];

  const result = {
    dcModifier: 0,
    acModifier: 0,
    skipTurn: false,
    autoHit: false,
    meleeCrit: false,
    cantAttackSource: null,
    cantAdvanceZone: false,
    cantUseHeart: false,
    extraAction: false,
    approachDcMods: {},
    attacksAgainstDC: 0
  };

  for (const cond of list) {
    const name = String(cond.name ?? '');
    const fx = CONDITION_EFFECTS[name];
    if (!fx) continue;
    fx(result, cond);
  }

  return result;
}

// ── Per-condition effect applicators ──────────────────────────────────────
//
// Each function mutates the accumulator (result). This is safe because
// getConditionModifiers creates a fresh object per call.

const CONDITION_EFFECTS = {
  poisoned(r) {
    r.dcModifier += 2;
  },

  frightened(r) {
    r.dcModifier += 2;
  },

  blinded(r) {
    r.dcModifier += 3;
  },

  stunned(r) {
    r.skipTurn = true;
    r.acModifier -= 3;
  },

  paralyzed(r) {
    r.skipTurn = true;
    r.autoHit = true;
    r.meleeCrit = true;
  },

  prone(r) {
    // Melee against: -2 DC (advantage), Ranged against: +2 DC
    r.attacksAgainstDC -= 2;
  },

  charmed(r, cond) {
    r.cantAttackSource = cond.source || true;
  },

  restrained(r) {
    r.acModifier -= 2;
    r.dcModifier += 2;
  },

  slowed(r) {
    r.cantAdvanceZone = true;
    r.dcModifier += 1;
  },

  // burning: tick handled by onTick, no passive modifier

  // bleeding: tick handled by onTick, no passive modifier

  freezing(r) {
    r.dcModifier += 2;
  },

  despair(r) {
    r.cantUseHeart = true;
  },

  invisible(r) {
    r.dcModifier -= 3;
    r.attacksAgainstDC += 5;
  },

  hasted(r) {
    r.extraAction = true;
    r.acModifier += 2;
  }
};
