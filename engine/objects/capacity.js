// OBJ-STRENGTH-1 — the pure, actor-agnostic object-capacity resolver.
//
// actorObjectCapacity(actorFacts, objectFacts, action) decides whether an actor can
// lift / carry / drag / push / throw a physical object. It is PURE (no world, no
// rng): players and NPCs run the identical math, so a party halfling and an NPC
// halfling of equal MIGHT and size reach the identical verdict. Randomness only
// enters at the borderline, where the caller hands the returned `difficulty` tier to
// the existing seeded rollPhysicsCheck (engine/resolve.js).
//
// Strength model (tuned to the live KIND_PHYSICS / TEMPLATES weight+bulk tables):
//   carryCap = base(MIGHT) + sizeShift[size]
//   load     = weight + bulkBurden + actionOffset
//   bulkBurden = +1 when the action bears the object (lift/carry/throw) AND it is
//                bulkier than it is heavy (bulk > weight) — a bundled rug is harder
//                to carry than a same-weight chair. Drag/push slide it, so no burden.
//   verdict:  load <= carryCap-1 → 'auto'      (no roll)
//             load === carryCap  → 'roll'      (difficulty = load-1, fed to the d20)
//             load >= carryCap+1 → 'impossible' (declines, no roll)
//   mobility 'fixed' → 'impossible' before any of this (a hearth moves for no one).

import { clampInt } from '../util.js';

// Size is a big lever on raw strength. Steps are weight-tiers, not a linear scale:
// a Large creature out-lifts a Medium by two tiers; Huge/Gargantuan pull further.
const SIZE_SHIFT = Object.freeze({
  Tiny: -2, Small: -1, Medium: 0, Large: 1, Huge: 3, Gargantuan: 5,
});

// push/drag permit the heaviest load (you slide it); carry is the take baseline;
// throw is hardest. Lift sits between drag and carry.
const ACTION_OFFSET = Object.freeze({
  push: -2, drag: -2, lift: -1, carry: 0, throw: 1,
});

const BEARING_ACTIONS = new Set(['lift', 'carry', 'throw']);

/**
 * baseCapacity(might) → 1..7. A middling-MIGHT Medium actor lands near tier 4, so a
 * weight-4 table is a borderline carry; a MIGHT-6 weakling near tier 3.
 */
export function baseCapacity(might) {
  const m = Number(might);
  const val = Number.isFinite(m) ? m : 10;
  return clampInt(Math.round((val + 2) / 3), 1, 7);
}

/**
 * actorObjectCapacity({ might, size }, { weight, bulk, mobility }, action) →
 *   { verdict, difficulty, carryCap, load, stat, reason }
 * verdict ∈ 'auto' | 'roll' | 'impossible'. `difficulty` (0..5) is set only for
 * 'roll' and is the tier the caller passes to rollPhysicsCheck as its `hardness`.
 */
export function actorObjectCapacity(actorFacts, objectFacts, action = 'carry') {
  const a = actorFacts && typeof actorFacts === 'object' ? actorFacts : {};
  const o = objectFacts && typeof objectFacts === 'object' ? objectFacts : {};
  const act = String(action || 'carry');

  const carryCap = baseCapacity(a.might) + (SIZE_SHIFT[a.size] ?? 0);

  // A fixed object is impossible for anyone — short-circuit before the load math.
  if (o.mobility === 'fixed') {
    return { verdict: 'impossible', difficulty: null, carryCap, load: null, stat: 'MIGHT', reason: 'fixed' };
  }

  const weight = clampInt(o.weight ?? 3, 0, 5);
  const bulk = clampInt(o.bulk ?? 3, 0, 5);
  const offset = ACTION_OFFSET[act] ?? 0;
  const bulkBurden = (BEARING_ACTIONS.has(act) && bulk > weight) ? 1 : 0;
  const load = weight + bulkBurden + offset;

  let verdict;
  if (load <= carryCap - 1) verdict = 'auto';
  else if (load === carryCap) verdict = 'roll';
  else verdict = 'impossible';

  const difficulty = verdict === 'roll' ? clampInt(load - 1, 0, 5) : null;
  return { verdict, difficulty, carryCap, load, stat: 'MIGHT', reason: verdict };
}
