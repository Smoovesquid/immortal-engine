// M4: Dark path capability unlocks.
//
// As corruption accumulates, forbidden spells arrive unbidden. The player
// doesn't choose this — KHORRUN's gifts arrive when the threshold is crossed.
// Narration never names the god. Only the knowledge and what it implies.
//
// Tiers mirror the moral axis: degradation is gradual, each threshold worse.

// corruption threshold → { ref, text }
// ref: spell from the known-forbidden catalog
// text: DM narration, appended after the turn. One sentence, present tense.
const GIFTS = [
  {
    threshold: 20,
    spells: ['animate_dead', 'inflict_wounds', 'false_life', 'ray_of_sickness', 'chill_touch'],
    text: "Something has shifted. A word you did not know arrives in your mind. The dead hear it."
  },
  {
    threshold: 40,
    spells: ['vampiric_touch', 'bestow_curse', 'blindness_deafness', 'blight'],
    text: "A new weight settles in you. Life is a thing you can take now."
  },
  {
    threshold: 60,
    spells: ['ray_of_enfeeblement', 'contagion'],
    text: "You wake knowing it. Not how. Only that you do."
  }
];

/**
 * darkGiftThresholds()
 *
 * The corruption thresholds at which dark gifts arrive, ascending. The SINGLE
 * source of these numbers — consumers (e.g. MP-2's escalation ladder, which derives
 * PACT_CORRUPTION from the lowest one) read this rather than forking the literals
 * (docs/MORAL_PHYSICS.md §4: "read from forbiddenGates thresholds — do not fork").
 * Pure; returns a fresh array.
 */
export function darkGiftThresholds() {
  return GIFTS.map(g => g.threshold);
}

/**
 * darkGiftForThreshold(oldCorruption, newCorruption)
 *
 * EDGE-triggered: returns the first spell from the newly-crossed tier, or null.
 * Fires only on the turn a corruption delta straddles a threshold. Used by the
 * live playloop hook (engine/playloop.js) which snapshots old→new corruption
 * inside a single player turn. Caller is responsible for checking if the spell
 * is already known (to avoid re-granting). Returns { ref, text } | null.
 */
export function darkGiftForThreshold(oldCorruption, newCorruption) {
  for (const tier of GIFTS) {
    if (oldCorruption < tier.threshold && newCorruption >= tier.threshold) {
      return { ref: tier.spells[0], text: tier.text };
    }
  }
  return null;
}

/**
 * darkGiftAtCorruption(corruption)
 *
 * LEVEL-triggered (the MP-4 organ, docs/MORAL_PHYSICS.md §4 T4): given the
 * actor's CURRENT standing corruption, returns the gift for the LOWEST tier
 * whose threshold is met, or null below the first threshold. Unlike the
 * edge-triggered darkGiftForThreshold (which needs a delta straddling a
 * boundary within one turn), this answers "what is this actor owed, right now"
 * — the shape the world-tick delivery needs, because corruption can reach the
 * pact threshold by slow accumulation across turns or by axis effects applied
 * outside a top-level player turn, paths the edge-trigger cannot see.
 *
 * Reads the SAME GIFTS table — the thresholds are never forked (MP-2's
 * PACT_CORRUPTION is Math.min(darkGiftThresholds()), i.e. GIFTS[0].threshold,
 * so a positive return here means corruption ≥ PACT_CORRUPTION by construction).
 * The world-tick returns the LOWEST qualifying tier (the first claiming) so the
 * gift arrives once at the pact threshold, not the deepest gift the actor could
 * theoretically hold. The caller latches (pactT) and checks spells.known to
 * avoid re-granting. Pure; returns { ref, text } | null.
 */
export function darkGiftAtCorruption(corruption) {
  const c = Number(corruption ?? 0);
  for (const tier of GIFTS) {
    if (c >= tier.threshold) {
      return { ref: tier.spells[0], text: tier.text };
    }
  }
  return null;
}

/**
 * canAccessForbiddenSpell(pc, spellRef)
 *
 * Returns true if the pc's corruption level grants access to this spell,
 * even if it's not in spells.known. Used by castSpell.js to allow corrupt
 * casters to use forbidden magic they've received as dark gifts.
 */
export function canAccessForbiddenSpell(pc, spellRef) {
  const corruption = Number(pc?.morality?.corruption ?? 0);
  for (const tier of GIFTS) {
    if (corruption >= tier.threshold && tier.spells.includes(spellRef)) {
      return true;
    }
  }
  return false;
}
