// OBJ-THROW-6B — the PURE throw layer: verb grammar, phrase split, target
// classification, the named product constants, and the two-sided impact filter.
//
// ── IMPORT LAW (approved brief rev 5 §E) ─────────────────────────────────────
// This module is pure (no world, no rng, no I/O) and imports ONLY zero-import leaf
// modules. It must NEVER import map/spatial/tacticalPos.js: tacticalPos imports
// MAX_THROW_CELLS from HERE, and a back-import would close an evaluation-time cycle.
// The resolver (playloop.js resolveObjectThrow) owns world reads, RNG, and deltas;
// this module owns only the decisions that need neither.
//
// ── WHY THE NUMBERS BELOW ARE HONEST ─────────────────────────────────────────
// MAX_THROW_CELLS and THROW_NOISE are PRODUCT decisions (Basecamp ruling
// 2026-07-15), not facts discovered in the repo — declared here in the same shape
// and spirit as durability.js's PROFILE table ("a product/rules decision, not a repo
// fact… Amend here"). Everything ELSE in the throw contract is reused from live
// engine vocabulary and is NOT tuning:
//   • accuracy/impact — the existing IMPROVISED-WEAPON contract: d4, MIGHT modifier,
//     no proficiency, no equipped-weapon bonus (engine/combat/escapeCombat.js
//     improvisedStrikeProfile → `die: 4, atkBonus: might, dmgMod: might`;
//     engine/ruleset/core/items/materials.js → `improvised: { dice: '1d4' }`,
//     documented there as "RAW improvised rules, 1d4-ish, no proficiency bonus").
//     A thrown BODY uses d6+MIGHT (combat/grapple.js THROW_DAMAGE_DIE) — an object
//     is lighter, so the improvised d4 is the right sibling.
//   • thresholds/AC/materials — engine/objects/durability.js.
//   • the wall's material — engine/structures/structureMaterial.js (the ONE authority).

import { durabilityProfile } from './durability.js';

// ── Product constants (INITIAL TUNING — Basecamp ruling 2026-07-15) ───────────

// The environmental-object throw reaches 4 tactical cells. With CELL_FT = 5 that is
// 20 ft. Deliberately NOT MAX_WALK_CELLS: walking speed and throwing range are
// different rules and must never become accidentally coupled by sharing a constant.
// Applies to EVERY target class (room / wall / object) and is owned by the writer —
// no caller may supply or override it.
export const MAX_THROW_CELLS = 4;

// Noise raised by a throw, in the env 'noise' scale (0..6, engine/effectsCore.js).
// Initial product constants — deliberately NOT derived from unrelated inventory
// noise fields.
export const THROW_NOISE = Object.freeze({
  landing: 1,   // a room throw, and an object-target MISS that lands elsewhere
  impact: 2,    // an object or wall impact
  refused: 0,   // refusal, failed capacity roll, invalid target, unavailable landing
});

// ── The hard-surface law (Basecamp ruling 5) ─────────────────────────────────
// A projectile only takes reciprocal self-impact damage off a HARD surface:
//   hard = wood | iron | stone | glass | bone
//   soft = cloth | web | wax          → damaged BY the throw, gives nothing back
// durability.js also yields 'unknown' on its FALLBACK path. It is in NEITHER list,
// so it fails closed here (no self-damage) rather than being guessed hard — the one
// question this predicate answers is "does the projectile take damage back?", and
// everything that is not provably hard must answer no.
const HARD_SURFACES = Object.freeze(new Set(['wood', 'iron', 'stone', 'glass', 'bone']));

export function isHardSurface(material) {
  return HARD_SURFACES.has(String(material || '').toLowerCase());
}

/**
 * wallPhysicalMaterial(family) -> 'wood' | 'stone' | null
 * The structure-material FAMILY (structureMaterial().family) → the physical material
 * the impact resolves against. Only the two families the supported authored domain
 * can express are mapped; anything else ('open' market sides, 'chitin' hive resin,
 * an absent structure) FAILS CLOSED — null, meaning no projectile self-damage —
 * rather than sliding into durability.js's FALLBACK profile.
 *
 * NOTE (recorded in the brief): every authored structure hardcodes
 * buildingType:'cottage' (authoredStructure.js:772), so the LIVE supported domain
 * always resolves 'timber' → 'wood'. The 'stone' arm is real and reachable only via
 * a declared buildingType; U699 covers it with an explicit synthetic.
 */
export function wallPhysicalMaterial(family) {
  const f = String(family || '').toLowerCase();
  if (f === 'timber') return 'wood';
  if (f === 'stone') return 'stone';
  return null;
}

/**
 * filterImpact(rawImpact, threshold) -> number
 * The material filter, in the engine's LIVE 5e semantics (playloop.js
 * resolveObjectStrike): a hit below the material's damageThreshold is ABSORBED to
 * zero; at or above it lands in FULL. It is NOT a subtraction. One raw magnitude
 * filtered through two different thresholds is exactly why equal raw impact does not
 * imply equal final damage.
 */
export function filterImpact(rawImpact, threshold) {
  const raw = Math.max(0, Math.round(Number(rawImpact) || 0));
  const thr = Math.max(0, Math.round(Number(threshold) || 0));
  return raw < thr ? 0 : raw;
}

/**
 * impactMaterialOf(piece) -> string
 * The physical material class of a furniture piece, via the ONE durability authority
 * (kind precedence, then material, then 'unknown' on fallback).
 */
export function impactMaterialOf(piece) {
  const p = piece && typeof piece === 'object' ? piece : {};
  return durabilityProfile(p.kind || p.type, p.material).physicalMaterial;
}

// ── Verb grammar ─────────────────────────────────────────────────────────────

// The throw family. Kept to verbs that actually mean "propel this object away from
// me"; "launch"/"cast"/"propel" stay OUT — they collide with spells and the window
// shoot lane, which own them.
export const THROW_VERB_RE = /\b(?:throw|throws|throwing|threw|hurl|hurls|hurling|hurled|toss|tosses|tossing|tossed|fling|flings|flinging|flung|lob|lobs|lobbing|lobbed|chuck|chucks|chucking|chucked|pitch|pitches|pitching|pitched|sling|slings|slinging)\b/i;

// Idioms that LOOK like a throw but belong to other seams. Each is a live owner:
//   "throw open the shutters"       → WINDOW_OPEN_ACTION_RE (playloop.js:5059)
//   "throw my/your weight against"  → forcesBarrier (:5369) / WEIGHT_FORCE (:10318)
//   "throw up a barricade"          → BUILD_RE (:7089) — building, not throwing
const THROW_OPEN_RE = /\bthrow(?:s|ing)?\s+open\b/i;
const THROW_WEIGHT_RE = /\bthrow(?:s|ing|n)?\s+(?:my|your|his|her|their|its)\s+(?:whole\s+)?(?:weight|shoulder|body|self)\b/i;
const THROW_UP_RE = /\bthrow(?:s|ing)?\s+up\b/i;

// NON-PROPULSIVE HANDLING (Basecamp correction 2C, NARROWED by correction 6B-3).
// These use a throw verb for a way of HOLDING something, not for letting go of it:
// slinging a pack over your shoulder, or juggling a thing between your palms.
// Nothing leaves the actor, so the throw gate must decline and the object stays in
// the arms.
//
// ONLY the sling family carries the handling idiom. The first cut also swallowed
// throw/toss/hoist/heave "over my shoulder", which are genuine PROPULSION: you are
// letting go of the thing behind you. That over-broad guard declined
// "throw the cooking pot over my shoulder" and leaked it to the generic WITS floor,
// which narrated an unrelated shoulder/door struggle while the pot stayed held. A
// throw verb + a shoulder is a throw unless a more specific established seam owns
// the wording (THROW_WEIGHT_RE still owns "throw my shoulder against the door" —
// there the shoulder is the projectile, not the destination).
const CARRY_OVER_SHOULDER_RE = /\b(?:sling|slings|slinging|slung)\b[^.!?]*\b(?:over|on)\s+(?:my|your|his|her|their|the)\s+(?:good\s+|other\s+|left\s+|right\s+)?(?:shoulder|shoulders|back|arm)\b/i;
const HAND_TO_HAND_RE = /\b(?:toss|tosses|tossing|tossed|throw|throws|throwing|threw|flip|flips|juggle|juggles|bounce|bounces|pass|passes)\b[^.!?]*\bfrom\s+hand\s+to\s+hand\b|\b(?:toss|tosses|throw|throws|flip|flips|juggle|juggles)\b[^.!?]*\bhand\s+to\s+hand\b/i;

export function isThrowIdiom(text) {
  const t = String(text || '');
  return THROW_OPEN_RE.test(t) || THROW_WEIGHT_RE.test(t) || THROW_UP_RE.test(t)
    || CARRY_OVER_SHOULDER_RE.test(t) || HAND_TO_HAND_RE.test(t);
}

// ── Ordinals ─────────────────────────────────────────────────────────────────
// Whether the phrase carries an EXPLICIT ordinal ("the second barrel", "the 2nd").
// This is the discriminator Basecamp's ruling 2B turns on: a bare name or "it" may
// take the held-object-first convenience, but an explicit ordinal must index the
// complete ordered candidate list instead of being shortcut past. Detection mirrors
// playloop's strikeOrdinalIndex exactly — same numeric form, same word list, same
// 'zeroth' — so the two can never disagree about whether an ordinal is present.
const ORDINAL_WORD_RE = /\b(?:zeroth|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth)\b/i;
const ORDINAL_NUMERIC_RE = /\b\d+(?:st|nd|rd|th)\b/i;

export function hasExplicitOrdinal(text) {
  const t = String(text || '');
  return ORDINAL_NUMERIC_RE.test(t) || ORDINAL_WORD_RE.test(t);
}

// ── The throw stream (the ONE production RNG contract) ───────────────────────
/**
 * drawThrowOutcome(rng, { targetClass, mightMod, targetAc }) -> {
 *   rawDie, accuracyTotal, hit, rawImpact
 * }
 *
 * The complete, PURE randomness of a throw, so the draw ORDER and draw COUNT are a
 * property of one testable function instead of a shape buried in the resolver.
 * `rng` is any { int(lo,hi) } — production passes engine/rng.js's seeded stream;
 * tests pass a counting wrapper and assert the exact number of draws.
 *
 * The contract, drawn in this order and no other:
 *   room   → NO draws at all (a landing is not an impact; the floor has no material)
 *   wall   → exactly ONE d4 (no accuracy roll is invented for a wall)
 *   object → ONE d20; on a miss it stops there (no magnitude draw); on a hit exactly
 *            ONE further d4
 *
 * Accuracy is the improvised-weapon contract: d20 + MIGHT mod vs the target's live
 * durability AC — natural 1 always misses, natural 20 always hits, and a natural 20
 * grants NO damage bonus (mirroring resolveObjectStrike, which has no crit rule).
 */
export function drawThrowOutcome(rng, { targetClass, mightMod = 0, targetAc = 0 } = {}) {
  const mod = Number.isFinite(+mightMod) ? +mightMod : 0;
  const impact = () => Math.max(1, rng.int(1, 4) + mod);
  if (targetClass === 'room') return { rawDie: null, accuracyTotal: null, hit: null, rawImpact: 0 };
  if (targetClass === 'wall') return { rawDie: null, accuracyTotal: null, hit: null, rawImpact: impact() };
  const rawDie = rng.int(1, 20);
  const accuracyTotal = rawDie + mod;
  const hit = rawDie === 20 || (rawDie !== 1 && accuracyTotal >= (Number(targetAc) || 0));
  if (!hit) return { rawDie, accuracyTotal, hit: false, rawImpact: 0 };
  return { rawDie, accuracyTotal, hit: true, rawImpact: impact() };
}

// "throw MYSELF out the window" is a FALL, owned by the hazard path (U159) — the
// same self-referent shape windowVerbKind bails on (playloop.js:5073).
const SELF_THROW_RE = /\b(?:throw|throws|throwing|hurl|hurls|fling|flings|toss|tosses|lob|lobs|pitch|pitches|chuck|chucks|sling|slings)\s+(?:my(?:self)?|him(?:self)?|her(?:self)?|them(?:selves)?|your(?:self)?|itself|my\s+body|his\s+body|her\s+body)\b/i;

export function isSelfThrow(text) {
  return SELF_THROW_RE.test(String(text || ''));
}

// The aggression prepositions that separate the projectile from its target. "to" is
// deliberately absent: "throw a coin TO Corwin" is a gift, not a throw at a target
// (the same distinction ANY_VIOLENCE draws at playloop.js:10938).
const AGGRESSION_PREP_RE = /\s\b(?:at|into|against|onto)\b\s/i;

// Cardinal sides, in the engine's live convention (tacticalPos.js DIR_VEC:
// "North is up (−y), matching floorPlan/placeOnGrid and the interior compass").
const SIDE_RE = /\b(north|south|east|west)\b/i;
const WALL_NOUN_RE = /\bwalls?\b/i;

/**
 * parseThrowPhrases(text) -> { projectilePhrase, targetPhrase, syntacticClass, side } | null
 *
 * A SYNTACTIC split only — this module has no world, so it cannot know whether
 * "the wall shelf" names a real object. It reports `syntacticClass:'wall'` whenever
 * the target phrase contains a wall noun, and the resolver applies OBJECT-BEFORE-WALL
 * precedence: a target phrase that resolves to a real furniture piece is an object
 * target, and only an unresolvable one falls through to the generic wall.
 *
 *   "throw the pot at the north wall" → { proj:'throw the pot', tgt:'the north wall',
 *                                          syntacticClass:'wall', side:'north' }
 *   "throw the pot across the room"   → { …, tgt:'', syntacticClass:'room', side:null }
 */
export function parseThrowPhrases(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  if (!THROW_VERB_RE.test(t)) return null;
  if (isThrowIdiom(t) || isSelfThrow(t)) return null;

  const m = t.match(AGGRESSION_PREP_RE);
  if (!m || m.index == null) {
    // No aggression preposition — an untargeted heave ("throw it across the room").
    return { projectilePhrase: t, targetPhrase: '', syntacticClass: 'room', side: null };
  }
  const projectilePhrase = t.slice(0, m.index).trim();
  const targetPhrase = t.slice(m.index + m[0].length).trim();
  if (!projectilePhrase || !targetPhrase) {
    return { projectilePhrase: t, targetPhrase: '', syntacticClass: 'room', side: null };
  }
  const isWall = WALL_NOUN_RE.test(targetPhrase);
  const sideM = isWall ? targetPhrase.match(SIDE_RE) : null;
  return {
    projectilePhrase,
    targetPhrase,
    syntacticClass: isWall ? 'wall' : 'object',
    side: sideM ? String(sideM[1]).toLowerCase() : null,
  };
}
