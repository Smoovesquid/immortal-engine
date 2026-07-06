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
import { statMod } from '../ruleset/core/stats.js';

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

// ── MP-3 — HEAT: the accumulator that carries the actor toward the hunt (§4) ─────────
//
// Heat is the running memory of unanswered cruelty. Each grave act adds to it; time and
// distance wear it down; at HUNT_HEAT the world stops waiting and sends the hunt (Tier 3).
// These are PURE functions in the SAME one home as the tier — same (deed, actor, ctx) →
// same number, every time; no rng, no Date, no LLM, no mutation. The LLM never sees or
// sets any of these numbers (invariant I).

// Only these deed kinds are cruelty the gods hunt — mercy/aid/atonement never accrue heat.
// This ALSO structurally enforces U556's law (helplessness is the gate): a fair fight
// records NO cruelty deed (only tryDarkDeed's helpless-context gate does), so a fair kill
// never reaches this function with an accruing kind → fair combat accrues ZERO heat, for
// free, with no combat-side check.
const HEAT_KINDS = new Set(['cruelty', 'forbidden']);

// Heat per point of deed severity. Severity tops out at DEED_SEV.HEAVY (20), so a single
// HEAVY witnessed atrocity's base is 20 * 0.6 = 12 heat — a handful crosses HUNT_HEAT (40),
// one does not (the ladder must be *climbed*, §4). Tuned against U563/U564, never at runtime.
const HEAT_PER_SEVERITY = 0.6;

// Each settlement witness who will carry the deed adds this much heat (the crime is louder
// the more eyes are on it), capped by HEAT_WITNESS_CAP so a mob doesn't spike heat to the
// pact tier in one act.
const HEAT_PER_WITNESS = 2;
const HEAT_WITNESS_CAP = 6; // up to 6 witnesses count; beyond that the signal saturates.

// WITS/deception REDUCES heat (§4: "WITS/deception reduces it"). A cunning actor covers
// their tracks: subtract statMod(WITS) * this per act (positive mods only — a dull actor
// gets no penalty, they simply don't reduce). Floored by HEAT_MIN_ACCRUAL so cunning can
// dampen but never fully erase a grave, witnessed act.
const HEAT_WITS_REDUCTION = 2;

// The wild asymmetry — the honest "GETTING AWAY WITH IT" (decision #7; §4/§6, a FEATURE,
// named so no one "fixes" it). A cruelty done in the unpainted wild, with no settlement
// witnesses, still leaves a trace on the doer's own heat — but it accrues SLOWLY (this
// factor) and mints NO travelling claim (that asymmetry lives at the rumor sink, MP-1).
// The doer can outrun reputation in the wild, but not the slow gathering of the hunt.
const HEAT_WILD_FACTOR = 0.35;

// The smallest heat a grave, accruing act can add once it has cleared the kind gate — so
// concealment/WITS can dampen but a HEAVY cruelty is never fully laundered to zero.
const HEAT_MIN_ACCRUAL = 1;

// Heat bleeds off with time/distance (§4: "Heat decays with distance/time") — but GENTLY:
// ONE point per HEAT_DECAY_INTERVAL world-ticks, not per tick. This matters because some
// single player turns advance the clock by many ticks at once (a multi-day build runs up to
// 30 downtime ticks inside one turn); a per-tick bleed would launder a fresh, witnessed
// atrocity to nothing before the turn even returned. At this rate a grave deed stays hot
// across a long span (the hunt can still catch a mobile actor), while a reformed actor cools
// over a genuinely long, clean stretch. Deterministic — the tick clock is the seed of WHEN,
// never a random draw. Tuned against U563/U564/U125, never at runtime.
export const HEAT_DECAY_PER_TICK = 1;      // points removed per decay step
export const HEAT_DECAY_INTERVAL = 5;      // world-ticks per decay step

/**
 * heatAccrual(deed, actor, ctx) → non-negative integer
 *
 * How much heat a single deed adds. PURE. Cruelty/forbidden only; scales with severity and
 * witness count; REDUCED by the actor's WITS (concealment/deception); accrues SLOWLY in the
 * wild (the "getting away with it" asymmetry — slow trace, no travelling claim).
 *
 *   if deed.kind not in {cruelty, forbidden}:            0            // helplessness gate (U556)
 *   base   = severity * HEAT_PER_SEVERITY
 *   eyes   = min(witnessReach, cap) * HEAT_PER_WITNESS   (0 in the wild — no settlement eyes)
 *   cover  = max(0, statMod(WITS)) * HEAT_WITS_REDUCTION
 *   raw    = (base + eyes) * (wild ? HEAT_WILD_FACTOR : 1) - cover
 *   heat  += max(HEAT_MIN_ACCRUAL, round(raw))
 *
 * @param {{ severity?: number, kind?: string }} deed  severity = engine weight (never LLM).
 * @param {{ stats?: { WITS?: number } }} actor         WITS drives concealment.
 * @param {{ witnessReach?: number, wild?: boolean }} [ctx]  witnessReach = |settlement
 *   witnesses|; wild = unpainted-wild act with no settlement eyes (forces eyes → 0 and
 *   applies the slow factor).
 * @returns {number} heat to add (≥ 0).
 */
export function heatAccrual(deed, actor, ctx = {}) {
  const d = (deed && typeof deed === 'object') ? deed : {};
  const a = (actor && typeof actor === 'object') ? actor : {};
  const c = (ctx && typeof ctx === 'object') ? ctx : {};

  const kind = String(d.kind || '');
  if (!HEAT_KINDS.has(kind)) return 0; // mercy/aid/atonement — and every fair kill — add nothing.

  const severity = Math.max(0, Number.isFinite(Number(d.severity)) ? Number(d.severity) : 0);
  const wild = Boolean(c.wild);
  // The wild has no settlement witnesses by definition (§6) — force reach to 0 there, so the
  // asymmetry is structural, not a caller convention.
  const witnessReach = wild ? 0 : Math.max(0, Math.trunc(Number(c.witnessReach) || 0));

  const base = severity * HEAT_PER_SEVERITY;
  const eyes = Math.min(witnessReach, HEAT_WITNESS_CAP) * HEAT_PER_WITNESS;
  // WITS is a raw score (1..20); statMod → 5e modifier. Only positive mods conceal.
  const witsScore = Number.isFinite(Number(a?.stats?.WITS)) ? Number(a.stats.WITS) : 10;
  const cover = Math.max(0, statMod(witsScore)) * HEAT_WITS_REDUCTION;

  const raw = (base + eyes) * (wild ? HEAT_WILD_FACTOR : 1) - cover;
  return Math.max(HEAT_MIN_ACCRUAL, Math.round(raw));
}

/**
 * heatDecay(heat, ticks) → non-negative integer
 *
 * Heat after `ticks` world-ticks of time/distance have elapsed. PURE, floored at 0. One point
 * bleeds per HEAT_DECAY_INTERVAL ticks (gentle — see the constant's note on multi-day turns).
 * Deterministic — the elapsed-tick count is the seed of WHEN, never a random draw.
 *
 * NOTE on the caller: worldTick decays against ELAPSED TIME (the tick clock), not a running
 * per-call counter, so the gentle rate holds whether a turn advances 1 tick or 30 at once —
 * see tickHeatDecay in worldTick.js, which passes `time.turn - lastDeedT`.
 *
 * @param {number} heat   current heat (≥ 0).
 * @param {number} [ticks=1]  world-ticks elapsed since the anchor (≥ 0).
 * @returns {number} decayed heat (≥ 0).
 */
export function heatDecay(heat, ticks = 1) {
  const h = Math.max(0, Number.isFinite(Number(heat)) ? Number(heat) : 0);
  const n = Math.max(0, Math.trunc(Number(ticks) || 0));
  const steps = Math.floor(n / HEAT_DECAY_INTERVAL);
  return Math.max(0, h - HEAT_DECAY_PER_TICK * steps);
}
