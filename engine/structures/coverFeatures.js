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
 * FUNC-MINIS-1 — cover reads LIVE state: pass ctx = { world, structureId } and a
 * placed (authored) piece the player smashed to a wreck or carried off stops
 * granting cover — the SAME stored node.furniture record that effectsCore
 * mutations wrote is the record this filter consults. Without ctx (or for
 * procgen loadout pieces, which have no stored twin yet) behavior is exactly
 * as before.
 *
 * D&D 5e tiers: half = +2 AC, three-quarter = +5 AC. Pure + deterministic.
 */

import { roomDetail, COVER_BONUS } from './roomDetail.js';
import { destroyedAuthoredPieceIds, procgenPlanPieceStatus } from './authoredFurniture.js';

/**
 * coverForRoom(room, ctx?) -> Array<{ id, kind, label, tier, bonus, fx, fy }>
 * The cover-granting furniture in a room. Non-entry procgen rooms always have at
 * least one piece (roomDetail guarantees it); an authored room offers exactly
 * what its author placed — minus whatever the world has since destroyed.
 */
export function coverForRoom(room, ctx = null) {
  const det = roomDetail(room);
  let pieces = det.furniture.filter(f => f && f.cover);

  const world = ctx && typeof ctx === 'object' ? ctx.world : null;
  const structureId = ctx && typeof ctx === 'object' ? String(ctx.structureId || '') : '';
  if (world && structureId && pieces.some(f => f.authored === 1)) {
    const st = world?.structures?.byId?.[structureId];
    if (st) {
      const dead = destroyedAuthoredPieceIds(world, st);
      if (dead.size) pieces = pieces.filter(f => !dead.has(String(f.id)));
    }
  }
  // FURN-PARITY-1 — a PROCGEN loadout piece grants cover only while its Model A
  // twin stands intact: smashed (destroyed) or carried off (absent) both stop
  // sheltering. Unseeded structures (no twins yet) keep full cover, exactly as
  // before — the map still draws every piece there.
  if (world && structureId && pieces.some(f => f && f.authored !== 1)) {
    const st = world?.structures?.byId?.[structureId];
    if (st && !st.authoredPlan) {
      const s = procgenPlanPieceStatus(world, st);
      if (s.seeded) {
        pieces = pieces.filter(f => f.authored === 1
          || (s.present.has(String(f.id)) && !s.destroyed.has(String(f.id))));
      }
    }
  }

  return pieces.map(f => ({
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
