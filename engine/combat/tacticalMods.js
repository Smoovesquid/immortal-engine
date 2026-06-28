/**
 * DX-2a — tactical position math (the engine-owned number).
 *
 * The D&D × XCOM adopt-table, in d20 terms:
 *   - cover raises the defender's effective AC: half +2, three-quarter (full) +5.
 *   - flanking (the DEFENDER is flanked) OR the ATTACKER holding high ground
 *     lets the attacker roll with advantage.
 *
 * THE LAW (docs/DND_XCOM.md): these numbers live in the engine and never reach
 * the player as figures — the DM narrates the read, never the modifier. This
 * module is the single source of the mapping; resolvers consume it, prose never
 * sees it.
 *
 * PURE + DETERMINISTIC. No rng, no state, no I/O.
 */

export const COVER_LEVELS = Object.freeze(['none', 'half', 'full']);

const COVER_AC = Object.freeze({ none: 0, half: 2, full: 5 });

/** Normalize an unknown cover value to a valid level. */
export function normalizeCover(cover) {
  const c = String(cover ?? 'none');
  return COVER_AC[c] === undefined ? 'none' : c;
}

/** Effective-AC bonus conferred by a cover level: none 0, half +2, full +5. */
export function coverAcBonus(cover) {
  return COVER_AC[normalizeCover(cover)] ?? 0;
}

/** Defender's effective AC once cover is folded in. */
export function effectiveAc(baseAc, cover) {
  const base = Number.isFinite(baseAc) ? baseAc : 10;
  return base + coverAcBonus(cover);
}

/**
 * Does the attacker roll with advantage?
 * Advantage when the attacker holds high ground OR the defender is flanked.
 * (Flanking is a property of the DEFENDER — being caught between foes — so it
 * grants advantage to whoever is striking them.)
 */
export function attackHasAdvantage({ attackerHighGround = false, defenderFlanked = false } = {}) {
  return Boolean(attackerHighGround) || Boolean(defenderFlanked);
}

/** A fresh, all-default tactical block. */
export function defaultTactical() {
  return { cover: 'none', flanked: false, highGround: false };
}

/** Coerce any value into a valid tactical block (used by ensureWorld / deltas). */
export function normalizeTactical(t) {
  const src = t && typeof t === 'object' ? t : {};
  return {
    cover: normalizeCover(src.cover),
    flanked: Boolean(src.flanked),
    highGround: Boolean(src.highGround)
  };
}
