// Rumor verification — compare rumor bodies against decompressed truth.
// Called when a source seed (node) is decompressed.

import { appendCanonEvent } from '../csl/canonLog.js';

/**
 * verifyRumorsForSeed(world, seedId, truthBody, canonLog) -> { world, canonLog }
 *
 * For each rumor whose sourceSeedId matches seedId:
 * - tier 0 → verified = 'true'
 * - tier ≤ 2 and body shares a word (>3 chars) with truthBody → verified = 'partial'
 * - otherwise → verified = 'false'
 */
export function verifyRumorsForSeed(world, seedId, truthBody, canonLog) {
  let w = world;
  let log = canonLog && typeof canonLog === 'object' && Array.isArray(canonLog.events)
    ? canonLog
    : { events: [] };

  const sid = String(seedId || '');
  const truth = String(truthBody || '');
  if (!sid) return { world: w, canonLog: log };

  const rumors = Array.isArray(w.rumors) ? w.rumors : [];
  if (!rumors.length) return { world: w, canonLog: log };

  // Extract significant words (>3 chars) from truth body for matching.
  const truthWords = new Set(
    truth.toLowerCase().split(/\s+/).filter(word => word.length > 3)
  );

  let changed = false;
  const nextRumors = rumors.map(r => {
    if (r.sourceSeedId !== sid) return r;

    let verdict;
    if (r.tier === 0) {
      verdict = 'true';
    } else if (r.tier <= 2) {
      const rumorWords = String(r.body || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const hasMatch = rumorWords.some(w => truthWords.has(w));
      verdict = hasMatch ? 'partial' : 'false';
    } else {
      verdict = 'false';
    }

    changed = true;

    log = appendCanonEvent(log, {
      id: `canon:verify:${r.id}`,
      type: 'rumor.verified',
      targetId: r.id,
      rumorId: r.id,
      verdict,
      turn: w.time?.turn ?? 0
    });

    return { ...r, verified: verdict };
  });

  if (changed) {
    w = { ...w, rumors: nextRumors };
  }

  return { world: w, canonLog: log };
}
