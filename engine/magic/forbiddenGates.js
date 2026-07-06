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
 * Returns the first spell from the newly-crossed tier, or null.
 * Caller is responsible for checking if the spell is already known
 * (to avoid re-granting). Returns { ref, text } | null.
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
