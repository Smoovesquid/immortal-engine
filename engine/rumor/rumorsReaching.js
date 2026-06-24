// Cross-lane READ-API contract — Homebase-owned interface.
//   PRODUCER: Lane "Light Up the World" W1·3 (P-83 rumor surface) fills the body.
//   CONSUMER: Lane "Make Every Turn Honest" W2·3 (morality / reputation-travels) imports it.
// Committed as a STUB so both lanes build against ONE locked signature + return shape. The
// implementation is W1·3's; do not pre-empt it here. Keep it pure, READ-ONLY, and deterministic.

/**
 * rumorsReaching — the rumors that have reached `nodeId`, told the way the locals would tell them.
 *
 * READ-ONLY + pure + deterministic: same (world, nodeId) → same list, every time (no rng, no I/O,
 * no mutation). Derived from engine/claims.js (per-holder beliefs), engine/rumor/* (tier + garble +
 * propagate), and the deeds ledger (for rumors ABOUT the player — the reputation-travels surface).
 *
 * @param {object} world
 * @param {string} nodeId
 * @param {{ subjectPrefix?: string, max?: number }} [opts]
 *   subjectPrefix — restrict to subjects with this stable-key prefix (e.g. "deed:").
 *   max — cap the returned count (default: caller's choice; the impl picks a sane default).
 * @returns {Array<{
 *   subject: string,         // stable claim key, e.g. "gallows_watch_fall" or "deed:<id>"
 *   body: string,            // the rumor as it ARRIVES here — garbled to its fidelity tier
 *   tier: number,            // 0..4 fidelity (0 firsthand → 4 heavily garbled)
 *   distortion: number,      // [0,1] cumulative drift from the raw observation
 *   provenance: string[],    // ordered npcId chain the claim traveled to get here
 *   eventRef: (string|null), // timeline event id (e.g. "scarFormed:7"), or null
 *   deedRef: (string|null)   // player-deed id when the rumor is ABOUT the PC, else null
 * }>}
 */
export function rumorsReaching(world, nodeId, opts = {}) {
  // TODO(W1·3 / P-83): read the claims reaching `nodeId`, tier + garble them via engine/rumor/*,
  // and fold in player-deed rumors so a stranger in the next town can have "heard about you."
  // Until then: empty, but correctly typed — W2·3 can build the reputation-travels consumer now.
  void world; void nodeId; void opts;
  return [];
}
