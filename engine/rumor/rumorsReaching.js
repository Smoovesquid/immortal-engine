// Cross-lane READ-API contract — Homebase-owned interface.
//   PRODUCER: Lane "Light Up the World" W1·3 (P-83 rumor surface) fills the body.
//   CONSUMER: Lane "Make Every Turn Honest" W2·3 (morality / reputation-travels) imports it.
// Committed as a STUB so both lanes build against ONE locked signature + return shape. The
// implementation is W1·3's; do not pre-empt it here. Keep it pure, READ-ONLY, and deterministic.

import { garbleRumor } from './garble.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Derive a stable deed id from (t, kind, nodeId) — the deed schema has no explicit id field.
function deedId(deed) {
  return `deed:${String(deed.nodeId || 'unknown')}:${String(deed.kind || 'unknown')}:${Number(deed.t || 0)}`;
}

/**
 * rumorsReaching — the rumors that have reached `nodeId`, told the way the locals would tell them.
 *
 * READ-ONLY + pure + deterministic: same (world, nodeId) → same list, every time (no rng, no I/O,
 * no mutation). Derived from world.rumors (per-holder minted rumors with pre-garbled bodies)
 * and world.deeds (player-deed rumors synthesized at read-time, tier-graded by proximity).
 *
 * @param {object} world
 * @param {string} nodeId
 * @param {{ subjectPrefix?: string, max?: number }} [opts]
 *   subjectPrefix — restrict to subjects with this stable-key prefix (e.g. "deed:").
 *   max — cap the returned count (default: 8).
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
  const nid = String(nodeId || '');
  const subjectPrefix = String(opts?.subjectPrefix || '');
  const max = (Number(opts?.max) > 0) ? Math.trunc(Number(opts.max)) : 8;

  // Find the target node's NPC ids (for rumors that already traveled here).
  const nodes = Array.isArray(world?.map?.nodes) ? world.map.nodes : [];
  const node = nodes.find(n => n && String(n.id) === nid);
  const localNpcIds = new Set(
    (Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [])
      .filter(n => n && n.id)
      .map(n => String(n.id))
  );

  const result = [];

  // ── 1. Minted rumors already carried by local NPCs ──────────────────────────
  // world.rumors entries have pre-garbled bodies, stored tiers, and carrier ids.
  // Sorted by ascending tier (freshest/most-accurate first) for stable output.
  const worldRumors = Array.isArray(world?.rumors) ? world.rumors : [];
  const localRumors = worldRumors
    .filter(r => r && localNpcIds.has(String(r.carrierNpcId || '')))
    .sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0));

  for (const rumor of localRumors) {
    if (result.length >= max) break;
    const subject = String(rumor.sourceSeedId || rumor.id || '');
    if (subjectPrefix && !subject.startsWith(subjectPrefix)) continue;
    const body = String(rumor.body || '').trim();
    if (!body) continue;
    const tier = clamp(Math.trunc(Number(rumor.tier ?? 0)), 0, 4);
    result.push({
      subject,
      body,
      tier,
      distortion: clamp(tier / 4, 0, 1),
      // Provenance: the rumor system stores a flat carrier; reconstruct the chain
      // from the stored provenance field when present (mintRumorForNpc doesn't
      // store it, but propagateRumors includes it in the new claim structure).
      provenance: Array.isArray(rumor.provenance) && rumor.provenance.length > 0
        ? rumor.provenance.map(String)
        : [String(rumor.carrierNpcId || '')],
      eventRef: rumor.eventRef ? String(rumor.eventRef) : null,
      deedRef: null,
    });
  }

  // ── 2. Player-deed rumors (world.deeds) ─────────────────────────────────────
  // Notable deeds (severity >= 25) become diegetic reputation. The body is the
  // deed's summary, garbled by tier. Tier = 0 when the deed happened at this
  // exact node (witnessed here); tier = 2 when it happened elsewhere (heard
  // secondhand). This is a SYNTHETIC rumor derived at read-time — pure, no rng.
  const deeds = Array.isArray(world?.deeds) ? world.deeds : [];
  // Stable sort: most recent first (t descending), then by kind for ties.
  const sortedDeeds = [...deeds].sort((a, b) =>
    (Number(b.t ?? 0) - Number(a.t ?? 0)) || String(a.kind || '').localeCompare(String(b.kind || ''))
  );

  for (const deed of sortedDeeds) {
    if (result.length >= max) break;
    const severity = Number(deed.severity ?? 0);
    if (severity < 25) continue; // below gossip threshold
    const summary = String(deed.summary || '').trim();
    if (!summary) continue;

    const subject = deedId(deed);
    if (subjectPrefix && !subject.startsWith(subjectPrefix)) continue;

    // Skip if we've already emitted this deed (can happen if the same deed was
    // also carried by a world.rumors entry — prefer that version; skip synthetic).
    if (result.some(r => r.deedRef === subject)) continue;

    const isLocal = String(deed.nodeId || '') === nid;
    const tier = isLocal ? 0 : 2;
    const body = garbleRumor(summary, tier, {});

    result.push({
      subject,
      body,
      tier,
      distortion: clamp(tier / 4, 0, 1),
      provenance: Array.isArray(deed.witnesses) && deed.witnesses.length > 0
        ? deed.witnesses.map(String)
        : [],
      eventRef: null,
      deedRef: subject,
    });
  }

  return result;
}
