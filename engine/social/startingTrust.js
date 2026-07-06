// engine/social/startingTrust.js — SP-3: starting trust reads standing.
//
// When a settlement is decompressed, its people are MINTED into being. Until now
// every fresh NPC started at trust 5 (neutral) regardless of who the player is —
// so "your reputation beats you to town" (docs/MORALITY_SYSTEM.md:23) only bit
// through the F1 threshold override, never through the number itself. This module
// sets the INITIAL trustLevel from the player's standing at mint time, so a hated
// stranger opens the conversation already guarded and a celebrated hero opens it
// already warm — DISCOVERED in the cold/warm greeting, never announced as a meter
// ([[project_obscure_goals_no_quest_log]]).
//
// PURE + DETERMINISTIC: no rng, no I/O, no mutation, no world reads. The functions
// take plain numbers (a faction rep, or a notoriety score) and return a clamped
// integer trust. Standing is read at the CALLER (decompress, which holds the world
// and the node) and handed in — genesis stays a pure (seed, …) → NPCs function.
//
// MAGNITUDE ONLY FROM TABLES (Social Physics Contract §2 law 1, Biblioteca Vol 11
// §7.3): the constants below are the sole source of the number. No LLM, no rng.
//
// HASH-STABLE with NO WORLD_VERSION bump: a freshly decompressed NPC is NEW state,
// not reshaped existing state. This is genesis-time initialization of a field that
// already exists (conversationState.trustLevel), so the shape is unchanged and the
// value is derived deterministically from state (reputation/deeds) that is already
// hashed. Same seed + same standing → same trust → equal worldHash.

// ── The constants ───────────────────────────────────────────────────────────

// Neutral starting trust — the value every NPC minted before SP-3 (npcGenesis).
export const NEUTRAL_TRUST = 5;

// The floor/ceiling on a MINTED trust. Standing tilts the opening disposition but
// never mints an outright ally or an outright enemy — that is earned/lost in play,
// and the F1 thresholds still override on top (rep ≤ −50 deflects regardless).
// Calibration anchors to the F1 bands (npcBrain.js:346–356: wary −25, hostile −50,
// warm +50): a −50-and-below town mints its people at the floor; a +50-and-above
// town mints them at the ceiling.
export const MIN_TRUST = 3;
export const MAX_TRUST = 7;

// Faction path: one trust step per 25 points of standing. floor() (toward −∞) is
// deliberate — it makes the negative side bite one step sooner than a symmetric
// round would (rep −60 → floor(−2.4) = −3 → trust 2 → clamped 3), matching the
// contract asymmetry "standing is easier to lose than to earn." 25 mirrors the F1
// wary threshold spacing (−25 = one step down = trust 4).
export const REP_PER_TRUST_STEP = 25;

// Unaffiliated path: notoriety is a NEGATIVE-VALENCE channel only (a person with no
// faction hears of your CRIMES via rumor — engine/npc/reputation.js notorietyReaching
// returns a 0..1 `score`; there is no "good notoriety" that travels this way, so the
// unaffiliated ceiling stays NEUTRAL_TRUST — an unknown-to-them hero is simply a
// stranger, trust 5). The score maps to a 0..−2 penalty in discrete bands, so the
// worst-heard stranger bottoms at exactly MIN_TRUST (3) — SYMMETRIC with the faction
// floor. Bands are thirds of the 0..1 score, aligned with the two faction steps.
export const NOTORIETY_TRUST_PENALTY = [
  { minScore: 0.67, penalty: 2 }, // widely/closely heard of → floor (trust 3)
  { minScore: 0.34, penalty: 1 }, // heard secondhand        → trust 4
  { minScore: 0,    penalty: 0 }, // barely/not heard         → trust 5
];

function clampTrust(n) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return NEUTRAL_TRUST;
  return Math.max(MIN_TRUST, Math.min(MAX_TRUST, x));
}

/**
 * startingTrustForFaction(rep) → int 3..7
 *
 * rep — the player's standing with this NPC's faction (w.reputation.factions[fid],
 *       −100..100). A non-finite/absent rep is treated as 0 (neutral → trust 5),
 *       so an affiliated NPC in a world where standing never moved is byte-identical
 *       to a pre-SP-3 mint.
 */
export function startingTrustForFaction(rep) {
  const r = Number(rep);
  const standing = Number.isFinite(r) ? r : 0;
  return clampTrust(NEUTRAL_TRUST + Math.floor(standing / REP_PER_TRUST_STEP));
}

/**
 * startingTrustForNotoriety(score) → int 3..5
 *
 * score — notorietyReaching(world, nodeId).score, 0..1 (how loudly the player's
 *         crimes have reached this node). Only lowers trust (negative-valence).
 *         A clean/unheard player (score 0, or non-finite) → NEUTRAL_TRUST, so an
 *         unaffiliated NPC is byte-identical to a pre-SP-3 mint until the player
 *         has earned traveling notoriety.
 */
export function startingTrustForNotoriety(score) {
  const s = Number(score);
  const val = Number.isFinite(s) ? s : 0;
  let penalty = 0;
  for (const band of NOTORIETY_TRUST_PENALTY) {
    if (val >= band.minScore) { penalty = band.penalty; break; }
  }
  return clampTrust(NEUTRAL_TRUST - penalty);
}

/**
 * startingTrust({ factionId, factionRep, notorietyScore }) → int 3..7
 *
 * The one entry point genesis uses. An AFFILIATED NPC reads its faction's standing;
 * an UNAFFILIATED NPC (no factionId) reads the traveling-notoriety score. Both paths
 * are table-driven and clamp to the same floor. Absent standing on either path →
 * NEUTRAL_TRUST (invisible until the player has a reputation).
 */
export function startingTrust({ factionId = null, factionRep = 0, notorietyScore = 0 } = {}) {
  const fid = factionId == null ? '' : String(factionId).trim();
  return fid
    ? startingTrustForFaction(factionRep)
    : startingTrustForNotoriety(notorietyScore);
}
