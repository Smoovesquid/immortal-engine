/**
 * Enemy AI — what hides in the fog actually does something.
 *
 * Each enemy turn: if it can see the player, it attacks (in range) or closes in,
 * and remembers where it last saw you. If it's lost sight, it hunts toward that
 * last-known position (the "last-seen ghost" the renderer can mark) until it
 * arrives and gives up the trail. Otherwise it patrols its waypoints.
 *
 * PURE + DETERMINISTIC. Returns the chosen action and the enemy's updated state.
 */

import { canSee } from './visibility.js';
import { reachableTiles } from './turns.js';

function stepToward(blocked, x, y, tx, ty, move) {
  const r = reachableTiles(blocked, x, y, move);
  let best = { x, y }, bd = Math.hypot(x - tx, y - ty), bc = 0;
  for (const [k, v] of r) {
    const c = k.indexOf(','), nx = +k.slice(0, c), ny = +k.slice(c + 1);
    const d = Math.hypot(nx - tx, ny - ty);
    if (d < bd - 1e-9 || (Math.abs(d - bd) < 1e-9 && v.cost < bc)) { bd = d; best = { x: nx, y: ny }; bc = v.cost; }
  }
  return best;
}

export function enemyTurn({ seed = '', nonce = 0, enemy, player, opacity, blocked } = {}) {
  const e = { ...enemy };
  const grid = blocked || opacity;
  const sight = e.sight || 8, move = e.move || 5, atk = e.attackRange || 1.6;

  const sees = opacity && player && canSee(opacity, e.x, e.y, player.x, player.y, sight);
  let action;

  if (sees) {
    e.lastSeen = { x: player.x, y: player.y };
    if (Math.hypot(e.x - player.x, e.y - player.y) <= atk) {
      action = { type: 'attack', targetId: player.id || 'player', at: { x: player.x, y: player.y } };
    } else {
      const m = stepToward(grid, e.x, e.y, player.x, player.y, move); e.x = m.x; e.y = m.y;
      action = { type: 'move', to: { x: e.x, y: e.y } };
    }
  } else if (e.lastSeen) {
    const m = stepToward(grid, e.x, e.y, e.lastSeen.x, e.lastSeen.y, move); e.x = m.x; e.y = m.y;
    if (e.x === e.lastSeen.x && e.y === e.lastSeen.y) e.lastSeen = null; // reached it, trail goes cold
    action = { type: 'hunt', to: { x: e.x, y: e.y } };
  } else if (Array.isArray(e.patrol) && e.patrol.length) {
    const i = (e.patrolIdx || 0) % e.patrol.length, wp = e.patrol[i];
    const m = stepToward(grid, e.x, e.y, wp.x, wp.y, move); e.x = m.x; e.y = m.y;
    if (e.x === wp.x && e.y === wp.y) e.patrolIdx = (i + 1) % e.patrol.length;
    action = { type: 'patrol', to: { x: e.x, y: e.y } };
  } else {
    action = { type: 'wait' };
  }
  return { action, enemy: e };
}
