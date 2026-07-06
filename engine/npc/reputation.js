// Reputation that travels (W2·3 — Morality M2 consumer side).
//
// A notable ATROCITY the player commits in one town becomes a rumor that reaches the
// next (engine/rumor/rumorsReaching.js — the W1·3 producer). This module reads that
// traveled gossip and tells the dialogue layer "this stranger has HEARD of you," so a
// later, elsewhere reception can sour — DISCOVERED in the fiction, never announced as a
// "reputation −N" meter (memory/project_obscure_goals_no_quest_log.md).
//
// PURE + deterministic + READ-ONLY: derived entirely from the deeds ledger via
// rumorsReaching (no rng, no I/O, no mutation, no new persistent state → no
// WORLD_VERSION bump). §0-safe: it surfaces recorded deeds, never cosmology.
//
// NPC-DEED-1 (docs/MORAL_PHYSICS.md §7 Arc A) adds a THIRD-person mirror,
// notorietyReachingAbout, for what a town has heard about an NPC evildoer (Carl) — the same
// read model, the same one sink (REPUTATION_UNIFICATION.md R2). notorietyReaching stays the
// PLAYER's alone (now actor-filtered to 'party'), so the two never blur.

import { rumorsReaching } from '../rumor/rumorsReaching.js';

// The deed kinds that blacken a name. mercy/aid/atonement travel too, but they don't
// sour a greeting — reputation-travels (M2) is about the cost of cruelty.
const ATROCITY_KINDS = new Set(['cruelty', 'forbidden']);

// deedRef is the stable key "deed:<nodeId>:<kind>:<t>" (engine/rumor/rumorsReaching.js).
// kind is always the second-to-last colon field; nodeIds carry no colon.
function parseDeedKind(deedRef) {
  const parts = String(deedRef || '').split(':');
  return parts.length >= 3 ? parts[parts.length - 2] : '';
}

// Shared reducer: turn a filtered list of traveled deed-rumors into the {heard,score,worst}
// shape. Freshest/closest first (lowest tier), stable tiebreak by deedRef.
function summarizeNotoriety(bad) {
  if (!bad.length) return { heard: false, score: 0, worst: null };
  bad.sort((a, b) => (a.tier - b.tier) || String(a.deedRef).localeCompare(String(b.deedRef)));
  // tier 0 (witnessed here) → 1.0; tier 2 (heard secondhand) → 0.75; capped at 1.
  const score = Math.min(1, bad.reduce((s, r) => s + (1 - (Number(r.tier) || 0) / 8), 0));
  return { heard: true, score, worst: bad[0] };
}

/**
 * notorietyReaching(world, nodeId) -> { heard, score, worst }
 *   heard  — true if at least one of the PLAYER's atrocities has reached nodeId.
 *   score  — 0..1 intensity (closer / more numerous deeds read higher); flavour only.
 *   worst  — the most-resonant traveled rumor ({ body, tier, deedRef, … }) or null.
 *            `body` is already garbled to its travel tier — the version the locals heard.
 *
 * Pure + deterministic. A clean player (no qualifying deeds) returns heard:false, so the
 * dialogue layer is byte-identical to today for everyone who hasn't earned a reputation.
 *
 * NPC-DEED-1: this is the PLAYER's notoriety ONLY. It now filters on actorId === 'party', so an
 * NPC evildoer's traveled deed can NEVER surface here — the dialogue.js consumer of this function
 * greets the player in the SECOND person ("I know who *you* are"), and blaming the player for
 * Carl's crime would be actively wrong. A traveled NPC deed is read by notorietyReachingAbout below.
 */
export function notorietyReaching(world, nodeId) {
  const rumors = rumorsReaching(world, nodeId, { subjectPrefix: 'deed:' });
  const bad = rumors.filter(r =>
    String(r.actorId || 'party') === 'party' && ATROCITY_KINDS.has(parseDeedKind(r.deedRef))
  );
  return summarizeNotoriety(bad);
}

/**
 * notorietyReachingAbout(world, nodeId, subjectActorId) -> { heard, score, worst }
 *
 * NPC-DEED-1 (docs/MORAL_PHYSICS.md §7 Arc A) — the THIRD-person mirror of notorietyReaching:
 * what has the town at nodeId heard about a SPECIFIC OTHER PERSON (an NPC evildoer, e.g.
 * 'figure_carl')? Same read model, same sink (rumorsReaching — REPUTATION_UNIFICATION.md R2 forbids
 * a parallel read-path), just filtered to deeds whose actor IS the named subject. The PLAYER is
 * never the subject here (that is notorietyReaching's job), so an NPC's reputation and the player's
 * can never be confused. `worst.body` is the garbled-by-tier version the locals actually heard.
 *
 * Pure + deterministic. Returns heard:false for a subject nobody has heard of — so a clean NPC's
 * treatment is byte-identical to today.
 */
export function notorietyReachingAbout(world, nodeId, subjectActorId) {
  const subject = String(subjectActorId || '');
  if (!subject || subject === 'party') return { heard: false, score: 0, worst: null };
  const rumors = rumorsReaching(world, nodeId, { subjectPrefix: 'deed:' });
  const bad = rumors.filter(r =>
    String(r.actorId || 'party') === subject && ATROCITY_KINDS.has(parseDeedKind(r.deedRef))
  );
  return summarizeNotoriety(bad);
}
