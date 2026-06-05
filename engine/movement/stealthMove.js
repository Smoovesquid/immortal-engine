/**
 * Stealth / ambush resolver — the risk side of XCom-style movement.
 *
 * A careful step (one adjacent room) keeps full awareness: ambush is unlikely.
 * A bold dash (multi-room path) trades surprise for speed: each room you cross
 * raises the chance something was waiting. The roll is d20 + stealth vs an
 * ambush DC, through rng.js seeded by (worldSeed, nonce) — so it is deterministic
 * and replay-stable, and identical to how resolve.js seeds its rolls.
 *
 * PURE: this computes a result; it never mutates world state. Applying the result
 * (starting a surprise round, pushing an event) is the caller's job through the
 * normal effect path — keeping worldHash honest.
 *
 * resolveStealthMove({ seed, nonce, distance, mode, dangerRooms, agilityMod })
 *   -> { mode, distance, dangerRooms, agilityMod, dc, roll, total, ambushed, riskPct }
 */

import { makeRng, seedFromString } from '../rng.js';

export function resolveStealthMove({
  seed = '',
  nonce = 0,
  distance = 1,
  mode = 'careful',
  dangerRooms = 0,
  agilityMod = 0
} = {}) {
  const dist = Math.max(1, Math.trunc(Number(distance) || 1));
  const danger = Math.max(0, Math.trunc(Number(dangerRooms) || 0));
  const agi = Math.trunc(Number(agilityMod) || 0);
  const bold = mode === 'bold' && dist > 1;

  // Ambush DC. Careful is a low floor that only meaningful danger lifts; bold
  // climbs with both distance crossed and danger rooms passed through.
  const dc = bold
    ? (8 + 3 * (dist - 1) + 4 * danger)
    : (4 + 2 * danger);

  const rng = makeRng(seedFromString(`${seed}|stealth|${nonce}|${bold ? 'bold' : 'careful'}|${dist}|${danger}`));
  const roll = rng.int(1, 20);
  const total = roll + agi;
  const ambushed = total < dc;

  // Risk readout: P(d20 + agi < dc) = faces 1..(dc-agi-1) over 20.
  const failFaces = Math.min(20, Math.max(0, (dc - agi) - 1));
  const riskPct = Math.round((failFaces / 20) * 100);

  return { mode: bold ? 'bold' : 'careful', distance: dist, dangerRooms: danger, agilityMod: agi, dc, roll, total, ambushed, riskPct };
}

// riskLevel(pct) -> 'none' | 'Low' | 'Medium' | 'High' — for UI labels.
export function riskLevel(pct) {
  const p = Number(pct) || 0;
  if (p <= 0) return 'none';
  if (p < 30) return 'Low';
  if (p < 55) return 'Medium';
  return 'High';
}
