// OBJ-BARRICADE-6C — the PURE barricade layer: verb grammar, phrase split, the
// qualification predicate, and the named product constants.
//
// ── IMPORT LAW (mirrors throwing.js) ─────────────────────────────────────────
// This module is pure (no world, no rng, no I/O) and imports ONLY zero-import leaf
// modules. World reads live in objects/placement.js (barricadeOnDoor — "is this
// door barricaded, and by what?"); the resolver in playloop.js owns RNG and deltas.
//
// ── WHAT A BARRICADE IS, AND IS NOT (arc law, docs/PACKETS.md:49) ─────────────
// A barricade is NOT door hardware. Door hardware (open/shut/barred/locked) is
// DERIVED state — engine/structures/doors.js + locks.js, a pure function of seed
// plus canon events, with no stored field. A barricade is a PHYSICAL OBJECT that a
// body shoved against a portal; it lives in the ONE live-object overlay
// (world.objects[id].obstructs) exactly like held/placed/damaged. The two stack and
// never speak to each other: an unlocked door with a wardrobe against it does not
// open, and unbarring a barricaded door does not clear the wardrobe.
//
// ── WHY THE OBJECT DOES NOT SIT IN THE DOORWAY CELL ───────────────────────────
// tacticalPos.reservedDoorCells exists precisely to keep furniture OUT of doorway
// cells: "a piece of furniture that would seal a doorway would soft-lock the
// building." A barricade must not smuggle that failure back in through a new door.
// So the two concerns are kept at DIFFERENT LAYERS:
//   • the PATHING MASK never sees a sealed doorway — the barricading object is
//     placed on a legal approach cell beside the door, and reservedDoorCells is
//     untouched (a building is never geometrically unreachable);
//   • the TRAVERSAL GATE refuses on the barricade RECORD — interiors.js
//     (interiorDoorBlock / moveWithinInterior / exitStructureInterior) and the
//     playloop egress sites.
// The refusal is therefore always deliberate, always explained, and ALWAYS
// clearable: drag the object off the door and the record dissolves.
//
// ── REVERSIBILITY IS A LAW, NOT A HOPE ───────────────────────────────────────
// The capacity action for a barricade is 'drag' — the same action that clears it.
// A body that could shove the wardrobe against the door can always shove it away
// again, so no actor can strand themselves behind their own barricade. Do not
// "upgrade" this to 'lift'/'carry' without replacing the guarantee it encodes.

// ── Product constants (INITIAL TUNING — Basecamp ruling 2026-07-18) ───────────
// Declared here in the same shape and spirit as durability.js's PROFILE table and
// throwing.js's MAX_THROW_CELLS: a product/rules decision, not a repo fact. Amend
// here, not at a call site.

// Shoving furniture is a DRAG, and drag is what clears it. See the law above.
export const BARRICADE_ACTION = 'drag';

// A barricade must be something a door cannot simply push aside. Bulk (0..5, the
// existing objectPhysics field) is the honest measure: a bulk-1 stool or a rolled
// rug does not hold a door, a bulk-2 chest does. Deliberately NOT weight — a heavy
// anvil-shaped thing that is small still does not span a doorway.
export const MIN_BARRICADE_BULK = 2;

// Noise raised by dragging furniture across a floor and jamming it home, in the env
// 'noise' scale (0..6, engine/effectsCore.js). Quieter than a throw's impact (2),
// louder than nothing: scraping wood carries.
export const BARRICADE_NOISE = 1;

// ── Verb grammar ─────────────────────────────────────────────────────────────
// The barricade family owns SHOVE/PUSH/WEDGE/BARRICADE/BLOCK/BAR/BRACE/PROP/JAM.
// It deliberately does NOT own the THROW family (throw/hurl/toss/fling/chuck/lob/
// pitch) — those stay with OBJ-THROW-6B. "throw the table against the door" is a
// throw at a surface, not a barricade: a thrown object lands where it lands, a
// shoved one is placed on purpose. One spelling, one physical claim (the same rule
// throwing.js states for release-vs-throw ref kinds).
//
// It also must not swallow the BARRIER-FORCING family (playloop forcesBarrier:
// ram/barge/bash/kick/boot/shoulder/slam a door) — that is an attack ON a door, the
// exact opposite claim. The two are kept apart by their objects: forcing names ONLY
// the portal, barricading names an object AND a portal ("with the X" / "X against
// the door"). isBarricadeIntent below requires both, so a bare "shoulder the door"
// can never parse as a barricade.
export const BARRICADE_VERB_RE =
  /\b(?:barricade|barricades|barricading|block|blocks|blocking|bar|bars|barring|wedge|wedges|wedging|jam|jams|jamming|brace|braces|bracing|prop|props|propping|shove|shoves|shoving|push|pushes|pushing|drag|drags|dragging|slide|slides|sliding|haul|hauls|hauling|heave|heaves|heaving)\b/i;

// The portal nouns a barricade can name. Windows are NOT here: this packet ships
// DOORS only (interior + entrance), because a door has a canonical stable id
// (doors.js interiorDoorId/exteriorDoorId), a canonical state record, and an
// existing traversal gate — a window has none of the three. See the packet report.
const DOOR_NOUN_RE = /\b(?:door|doorway|entrance|entry|front\s+door|back\s+door|gate|hatch|trapdoor)\b/i;

// "throw up a barricade" / "build a barricade" — BUILDING one from nothing, which
// belongs to the salvage/build lane (docs/SALVAGE_AND_BUILD.md), not to shoving an
// existing object against an existing door. Recognized here only so the resolver
// can decline it honestly instead of half-matching.
export const BARRICADE_BUILD_IDIOM_RE =
  /\b(?:throw|throws|throwing|put|puts|putting|build|builds|building|make|makes|making|construct|constructs|constructing|erect|erects|erecting)\b\s+(?:up\s+)?(?:a|an|some|the)?\s*(?:barricade|barrier|blockade)\b/i;

/** Does this text name a door-shaped portal at all? Pure. */
export function namesDoorPortal(text) {
  return DOOR_NOUN_RE.test(String(text || ''));
}

/**
 * parseBarricadePhrases(text) -> { objectPhrase, portalPhrase } | null
 *
 * Splits the two grammatical shapes the family actually takes:
 *   A. "<verb> the <PORTAL> with the <OBJECT>"      → barricade/block/bar/wedge/jam
 *   B. "<verb> the <OBJECT> against|across|in front of|behind|under the <PORTAL>"
 *                                                    → shove/push/drag/slide/haul
 * Returns null when the text does not carry BOTH halves — a bare "barricade the
 * door" (no object named) parses with an EMPTY objectPhrase so the resolver can
 * choose-or-ask in the fiction; a text naming no portal returns null outright.
 *
 * Pure; never throws; case-insensitive; returns lowercase trimmed phrases.
 */
export function parseBarricadePhrases(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return null;
  if (!BARRICADE_VERB_RE.test(t)) return null;
  if (!DOOR_NOUN_RE.test(t)) return null;

  // Shape B first — an explicit relational preposition is the strongest signal and
  // is unambiguous about which half is which.
  const relational = t.match(
    /\b(?:shove|shoves|shoving|push|pushes|pushing|drag|drags|dragging|slide|slides|sliding|haul|hauls|hauling|heave|heaves|heaving|wedge|wedges|wedging|jam|jams|jamming|brace|braces|bracing|prop|props|propping|barricade|barricades|barricading|block|blocks|blocking)\b\s+(.+?)\s+\b(?:against|across|in\s+front\s+of|infront\s+of|behind|under|underneath|up\s+against|over)\b\s+(.+)$/
  );
  if (relational) {
    const objectPhrase = stripArticles(relational[1]);
    const portalPhrase = stripArticles(relational[2]);
    // The portal half must actually be the portal. "shove the door against the
    // table" is not a barricade of the table — reject rather than guess.
    if (!DOOR_NOUN_RE.test(portalPhrase)) return null;
    return { objectPhrase, portalPhrase };
  }

  // Shape A — "<verb> the door with the table".
  const withForm = t.match(
    /\b(?:barricade|barricades|barricading|block|blocks|blocking|bar|bars|barring|wedge|wedges|wedging|jam|jams|jamming|brace|braces|bracing|prop|props|propping|secure|secures|securing)\b\s+(.+?)\s+\bwith\s+(.+)$/
  );
  if (withForm) {
    const portalPhrase = stripArticles(withForm[1]);
    const objectPhrase = stripArticles(withForm[2]);
    if (!DOOR_NOUN_RE.test(portalPhrase)) return null;
    return { objectPhrase, portalPhrase };
  }

  // Bare "barricade the door" / "block the doorway" — portal named, object left to
  // the fiction. An EMPTY objectPhrase is a real, distinct outcome (choose-or-ask),
  // not a parse failure.
  const bare = t.match(
    /\b(?:barricade|barricades|barricading|block|blocks|blocking|bar|bars|barring|brace|braces|bracing|jam|jams|jamming)\b\s+(.+)$/
  );
  if (bare) {
    const portalPhrase = stripArticles(bare[1]);
    if (!DOOR_NOUN_RE.test(portalPhrase)) return null;
    return { objectPhrase: '', portalPhrase };
  }

  return null;
}

/**
 * portalIsEntrance(portalPhrase) -> boolean
 *
 * Whether the named portal reads as the building's OUTER door rather than an
 * interior doorway. "the front door", "the entrance", "the gate" → true.
 * Pure; the caller still resolves the actual door record.
 */
export function portalIsEntrance(phrase) {
  const p = String(phrase || '').toLowerCase();
  return /\b(?:front\s+door|entrance|entry|outer\s+door|main\s+door|street\s+door|gate)\b/.test(p);
}

/**
 * qualifiesAsBarricade(physics, piece) -> { ok: true } | { ok: false, why }
 *
 * The pure qualification predicate: can THIS object hold a door? Takes the
 * objectPhysics() result plus the raw piece (for the flat flag). Reasons are a
 * sealed vocabulary the resolver turns into fiction — never raw text from here.
 *   'fixed'  — masonry; it was never going anywhere
 *   'flat'   — a rug/runner; nothing to wedge
 *   'slight' — too small/light to hold a door (bulk < MIN_BARRICADE_BULK)
 */
export function qualifiesAsBarricade(physics, piece) {
  const ph = physics && typeof physics === 'object' ? physics : {};
  if (String(ph.mobility) === 'fixed') return { ok: false, why: 'fixed' };
  if (piece && piece.flat) return { ok: false, why: 'flat' };
  const bulk = Number.isFinite(+ph.bulk) ? +ph.bulk : 0;
  if (bulk < MIN_BARRICADE_BULK) return { ok: false, why: 'slight' };
  return { ok: true };
}

// Strip leading articles/possessives so a phrase joins on its noun.
function stripArticles(s) {
  return String(s || '')
    .replace(/^\s*(?:the|a|an|my|your|our|that|this|some)\s+/i, '')
    .replace(/[.!?,;:]+\s*$/, '')
    .trim();
}
