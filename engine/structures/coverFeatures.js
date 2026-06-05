/**
 * Tactical cover — now a thin view over the room's actual furniture.
 *
 * Cover used to be abstract geometry floating in an empty box. It isn't anymore:
 * the thing you hide behind is the heavy table, the stacked barrels, the altar,
 * the stone pillar — real furniture from roomDetail.js. This module just filters
 * that furniture down to the pieces that grant cover, so the combat resolver
 * (escapeCombat.js), the HUD (combatHud.js), and the map (LocalMap.js) all agree
 * on exactly what's coverable and where it sits.
 *
 * D&D 5e tiers: half = +2 AC, three-quarter = +5 AC. Pure + deterministic.
 */

import { roomDetail, COVER_BONUS } from './roomDetail.js';

/**
 * coverForRoom(room) -> Array<{ id, kind, label, tier, bonus, fx, fy }>
 * The cover-granting furniture in a room. Non-entry rooms always have at least
 * one piece (roomDetail guarantees it).
 */
export function coverForRoom(room) {
  const det = roomDetail(room);
  return det.furniture
    .filter(f => f && f.cover)
    .map(f => ({
      id: f.id, kind: f.kind, label: f.label, tier: f.cover,
      bonus: COVER_BONUS[f.cover] || 2, fx: f.fx, fy: f.fy
    }));
}

/**
 * bestCover(features) -> feature | null
 * The strongest piece of cover (highest AC bonus). What "take cover" grabs.
 */
export function bestCover(features) {
  let best = null;
  for (const f of (Array.isArray(features) ? features : [])) {
    if (!f) continue;
    if (!best || (Number(f.bonus) || 0) > (Number(best.bonus) || 0)) best = f;
  }
  return best;
}
