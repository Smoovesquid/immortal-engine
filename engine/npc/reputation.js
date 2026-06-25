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
// WORLD_VERSION bump). §0-safe: it surfaces the player's own deeds, never cosmology.

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

/**
 * notorietyReaching(world, nodeId) -> { heard, score, worst }
 *   heard  — true if at least one of the player's atrocities has reached nodeId.
 *   score  — 0..1 intensity (closer / more numerous deeds read higher); flavour only.
 *   worst  — the most-resonant traveled rumor ({ body, tier, deedRef, … }) or null.
 *            `body` is already garbled to its travel tier — the version the locals heard.
 *
 * Pure + deterministic. A clean player (no qualifying deeds) returns heard:false, so the
 * dialogue layer is byte-identical to today for everyone who hasn't earned a reputation.
 */
export function notorietyReaching(world, nodeId) {
  const rumors = rumorsReaching(world, nodeId, { subjectPrefix: 'deed:' });
  const bad = rumors.filter(r => ATROCITY_KINDS.has(parseDeedKind(r.deedRef)));
  if (!bad.length) return { heard: false, score: 0, worst: null };
  // Freshest/closest first (lowest tier), stable tiebreak by deedRef.
  bad.sort((a, b) => (a.tier - b.tier) || String(a.deedRef).localeCompare(String(b.deedRef)));
  // tier 0 (witnessed here) → 1.0; tier 2 (heard secondhand) → 0.75; capped at 1.
  const score = Math.min(1, bad.reduce((s, r) => s + (1 - (Number(r.tier) || 0) / 8), 0));
  return { heard: true, score, worst: bad[0] };
}
