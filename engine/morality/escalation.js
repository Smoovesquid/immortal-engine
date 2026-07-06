// MP-2 — THE ESCALATION LADDER (docs/MORAL_PHYSICS.md §4).
//
// ONE engine-owned tier function under every moral act. Today, consequence is
// scattered and keyed on the SINGLE act; this module is the single deterministic
// core that grades an act on ACCUMULATION (the actor's standing corruption + heat)
// as well as the act itself. Every moral-fact source — deed recording, gratuitous
// magic, NPC villain arcs — routes its severity through `escalationTier` and carries
// the returned 0..4 tier on the deed/act record, so downstream packets (MP-3 heat→hunt,
// MP-4 corruption→pact, MP-5 surfacing) read ONE authoritative loudness number.
//
// PURITY (docs/IMMORTAL_INVARIANTS.md · MORAL_PHYSICS §1-I "Determinism owns every
// magnitude"): `escalationTier` is a PURE function — no rng, no Date, no LLM, no I/O,
// no mutation. Same (deed, actor, ctx) → same tier, every time. The magnitude constants
// live in THIS ONE module (§4: "Magnitude constants live in ONE module, named"); the
// LLM never sees, computes, or reveals any of them.
//
// This module is a ROUTER, not new effect code (§4): it computes a tier; it does NOT
// scarify, spawn, grant, or surface. T0–T2 express TODAY's live behavior through the
// ladder (no observable change); T3/T4 are COMPUTED AND STORED but NOT ACTED ON here —
// the hunt (spawnEncounter) is MP-3, the pact-gift is MP-4, the DM-prompt surfacing is
// MP-5. Nothing numeric this module produces may reach a player-facing string (invariant I).

import { darkGiftThresholds } from '../magic/forbiddenGates.js';

// ── Named magnitude constants (the ONE home; tuned by determinism tests + the Opus
//    gate, never by the model at runtime) ──────────────────────────────────────────

// Tier-1 threshold. A deed at or above this weight (or any forbidden-source deed) makes
// the world recoil. This is the deed-severity CEILING and MUST stay in lockstep with
// DEED_SEV.HEAVY in engine/playloop.js (which is NOT exported — the repo pattern, shared
// by engine/magic/castConsequence.js:33 and engine/social/reactionTable.js:22, is to
// mirror the value with a lockstep comment rather than import from the ~7.4k-line hot
// file). If DEED_SEV.HEAVY changes, change this. The witness→rumor bridge (MP-1,
// engine/rumor/rumorsReaching.js `DEED_GOSSIP_MIN`) is calibrated to the same number by
// design — Tier-1 (the world recoils) and Tier-2 (reputation travels) share the ceiling.
export const DEED_SEV = Object.freeze({ LIGHT: 5, MOD: 12, HEAVY: 20 });

// Tier-3 threshold. Accumulated heat at or above this and the hunt begins (MP-3 reads
// this to drive spawnEncounter). Starting calibration per §4 ("HUNT_HEAT ≈ 40"); a
// design-owned magnitude the farm tunes against determinism tests.
export const HUNT_HEAT = 40;

// Tier-4 threshold. Corruption at or above this and the gift arrives unbidden (MP-4
// routes forbiddenGates through the ladder as an omen). This is READ FROM
// forbiddenGates — the lowest dark-gift threshold — and is NEVER forked here (§4:
// "PACT_CORRUPTION = read from forbiddenGates thresholds — do not fork the number").
// If the first gift's threshold moves in forbiddenGates.js, PACT_CORRUPTION follows.
export const PACT_CORRUPTION = (() => {
  const ts = darkGiftThresholds();
  return (Array.isArray(ts) && ts.length > 0) ? Math.min(...ts) : 20;
})();

// The forbidden deed kind — always at least Tier-1 (a forbidden source is a recoil-worthy
// act regardless of its numeric severity: §4 `deed.kind == 'forbidden'`).
const FORBIDDEN_KIND = 'forbidden';

/**
 * escalationTier(deed, actor, ctx) → integer 0..4
 *
 * The deterministic core. Pure, seeded (needs none), replayable. Implements §4's
 * pseudocode exactly — a monotone ladder (each rung can only raise the tier):
 *
 *   tier = 0
 *   if deed.severity >= HEAVY or deed.kind == 'forbidden':   tier = max(tier, 1)  // the world recoils
 *   if tier >= 1 and ctx.witnessReach >= 1:                  tier = max(tier, 2)  // reputation travels
 *   if actor.heat >= HUNT_HEAT:                              tier = max(tier, 3)  // the hunt
 *   if actor.corruption >= PACT_CORRUPTION:                  tier = max(tier, 4)  // the gift unbidden
 *
 * @param {{ severity?: number, kind?: string }} deed
 *   severity — the deed's engine-set weight (DEED_SEV; never LLM). kind — deed kind
 *   ('cruelty'|'forbidden'|'aid'|'mercy'|'atonement'); 'forbidden' always reaches Tier-1.
 * @param {{ corruption?: number, heat?: number }} actor
 *   corruption ∈ 0..100 (derived max-vice; drives Tier-4). heat ≥ 0 (the accumulator;
 *   drives Tier-3).
 * @param {{ witnessReach?: number, wild?: boolean }} [ctx]
 *   witnessReach = |witnesses at the node| (settlement occupancy truth; drives Tier-2).
 *   wild = the act happened in the unpainted wild with no settlement witnesses (§6 seam:
 *   accrues heat slowly, mints NO claim — carried for MP-3 forward-compat and to make the
 *   "getting away with it" asymmetry explicit; with wild=true, witnessReach is 0 and the
 *   Tier-2 rung structurally cannot fire).
 * @returns {number} tier 0..4
 */
export function escalationTier(deed, actor, ctx = {}) {
  const d = (deed && typeof deed === 'object') ? deed : {};
  const a = (actor && typeof actor === 'object') ? actor : {};
  const c = (ctx && typeof ctx === 'object') ? ctx : {};

  const severity = Number.isFinite(Number(d.severity)) ? Number(d.severity) : 0;
  const kind = String(d.kind || '');
  const corruption = Number.isFinite(Number(a.corruption)) ? Number(a.corruption) : 0;
  const heat = Number.isFinite(Number(a.heat)) ? Number(a.heat) : 0;
  const wild = Boolean(c.wild);
  // The wild has no settlement witnesses by definition (§6): if it is wild, reach is 0
  // regardless of what a caller passed — this makes the asymmetry structural, not a
  // caller convention, and guarantees "wild ctx mints tier 2 never from zero witnesses".
  const witnessReach = wild ? 0 : Math.max(0, Math.trunc(Number(c.witnessReach) || 0));

  let tier = 0;
  // Tier 1 — the world recoils (a grave act, or any forbidden source).
  if (severity >= DEED_SEV.HEAVY || kind === FORBIDDEN_KIND) tier = Math.max(tier, 1);
  // Tier 2 — reputation travels (a recoil-worthy act SEEN by someone who will carry it).
  if (tier >= 1 && witnessReach >= 1) tier = Math.max(tier, 2);
  // Tier 3 — the hunt (accumulated heat crosses the threshold).
  if (heat >= HUNT_HEAT) tier = Math.max(tier, 3);
  // Tier 4 — the gift unbidden (accumulated corruption crosses the pact threshold).
  if (corruption >= PACT_CORRUPTION) tier = Math.max(tier, 4);

  return tier;
}
