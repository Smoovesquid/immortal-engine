/**
 * The bleed spectrum — a graduated cut, papercut → arterial.
 *
 * A PURE tier table + constructor. The world/table sets the number
 * (Biblioteca V11 — never the LLM), so bleed severity is deterministic and
 * seed-independent (no rng, no state, no Math.random). A bleed is a
 * `combat/conditions.js` condition: per-round onTick damage = severity, lasting
 * `until`. Applied through the sole mutation path as
 * `{ kind: 'condition', entityId, cond: makeBleed(tier, source) }`.
 *
 * Consumed by:
 *   - the self-harm handler in playloop.js (the player cuts themselves), which
 *     infers the tier from the fiction, and
 *   - monster attacks in the bestiary (`conditions: [makeBleed('deep')]`).
 *
 * This module only defines what each tier DOES; the fiction → tier inference
 * lives upstream (playloop) and the per-round tick lives in combatResolve.
 */

// tier → { severity (= HP lost per round), onTick (damage type | null), until, saveToEnd? }
// Ascending: a shallow nick stings and closes; an arterial cut won't stop unaided.
export const BLEED_TIERS = Object.freeze({
  papercut: { severity: 1, onTick: null,       until: 'end_of_next_turn' },                              // a bead of blood — flavor only, costs no HP
  shallow:  { severity: 1, onTick: 'slashing', until: 2 },                                                // stings and closes on its own (~2 rounds)
  deep:     { severity: 2, onTick: 'slashing', until: 'save_ends', saveToEnd: { stat: 'GRIT', dc: 11 } }, // won't quit without pressure on it
  severe:   { severity: 3, onTick: 'slashing', until: 'save_ends', saveToEnd: { stat: 'GRIT', dc: 13 } }, // needs binding / first aid to close
  arterial: { severity: 5, onTick: 'slashing', until: 'permanent' },                                      // won't stop unaided — lethal if ignored
});

// The escalation ladder — also the order narration should read as worsening.
export const BLEED_TIER_ORDER = Object.freeze(['papercut', 'shallow', 'deep', 'severe', 'arterial']);

/** True iff `tier` names a defined bleed tier. */
export function isBleedTier(tier) {
  return typeof tier === 'string' && Object.prototype.hasOwnProperty.call(BLEED_TIERS, tier);
}

/** Recover the tier word from a stored bleed condition (falls back via severity). */
export function bleedTierOf(cond) {
  if (cond && isBleedTier(cond.bleedTier)) return cond.bleedTier;
  const sev = Number(cond?.severity) || 0;
  if (sev >= 5) return 'arterial';
  if (sev >= 3) return 'severe';
  if (sev >= 2) return 'deep';
  if (sev >= 1) return 'shallow';
  return 'papercut';
}

/**
 * Build a raw `bleeding` condition for the given tier, ready for
 * normalizeCondition / the effectsCore `condition` op. Unknown tier → 'shallow'.
 * `bleedTier` is carried for narration (preserve it through normalizeCondition).
 */
export function makeBleed(tier, source = '') {
  const key = isBleedTier(tier) ? tier : 'shallow';
  const t = BLEED_TIERS[key];
  const cond = {
    name: 'bleeding',
    bleedTier: key,
    source: String(source || ''),
    severity: t.severity,
    onTick: t.onTick,
    until: t.until,
    stackBehavior: 'highest', // a worse cut supersedes a lesser one; nicks don't pile up to death
  };
  if (t.saveToEnd) cond.saveToEnd = t.saveToEnd;
  return cond;
}
