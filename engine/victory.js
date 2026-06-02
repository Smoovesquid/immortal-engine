/**
 * v1 "Escape" game-mode helpers.
 *
 * Pure, deterministic. No RNG, no side effects.
 *
 * The Escape game is a thin layer over the existing engine: begin seeds a single
 * `reach` goal toward a far node, and arriving there locks a clean victory.
 * Losing is the engine's existing combat-defeat ending. Both are opt-in via
 * `world.meta.mode === 'escape'` so the open-sandbox engine is untouched.
 */

import { ensureWorld } from './state.js';
import { neighbors } from './map/mapState.js';

/**
 * pickEscapeTarget(world) -> nodeId | null
 *
 * The escape destination: the node farthest (by hop count) from the current
 * node. Deterministic — ties broken by lexicographically smallest id. Returns
 * null if the map has no reachable node other than the start.
 */
export function pickEscapeTarget(world) {
  const w = ensureWorld(world);
  const m = w.map;
  if (!m || !Array.isArray(m.nodes) || m.nodes.length === 0) return null;
  const start = String(m.currentNodeId || '');
  if (!start) return null;

  const dist = new Map([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    const d = dist.get(cur);
    for (const nb of neighbors(m, cur)) {
      const id = String(nb);
      if (dist.has(id)) continue;
      dist.set(id, d + 1);
      queue.push(id);
    }
  }

  let best = null;
  let bestD = 0;
  for (const [id, d] of dist) {
    if (id === start) continue;
    if (d > bestD || (d === bestD && best !== null && id.localeCompare(best) < 0)) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

/**
 * escapeOutcome(world) -> 'win' | 'lose' | null
 *
 * Classifies a locked ending for the Escape game so the UI can render the right
 * end screen. Only meaningful when mode === 'escape'.
 */
export function escapeOutcome(world) {
  const w = ensureWorld(world);
  if (w.meta?.mode !== 'escape') return null;
  if (!w.ending?.locked) return null;
  if (w.ending.reason === 'escaped') return 'win';
  if (w.ending.reason === 'defeated-in-combat') return 'lose';
  return null;
}
