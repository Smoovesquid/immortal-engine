/**
 * Tactical battle — the playable fight that fuses the whole tactical stack.
 *
 * A turn-based skirmish on a grid: line-of-sight fog (T1), reachable-tile movement
 * (T2), targeted abilities (T3), cover + hit-chance (T4), and enemy AI that hunts
 * and flanks (T5). The player moves and acts, ends the turn, the enemies take
 * theirs, and visibility, cover, and death all resolve deterministically.
 *
 * PURE: every function returns a new battle state.
 */

import { computeVisibility, canSee } from './visibility.js';
import { reachable } from './turns.js';
import { rollInitiative } from './turns.js';
import { resolveAbility, getAbility } from './abilities.js';
import { coverAt, resolveAttack } from './combat.js';
import { enemyTurn } from './enemyAI.js';

// Clone the mutable battle state but keep the grid BY REFERENCE — the grid holds
// methods (get/set) that JSON cloning would strip, and it never changes mid-fight.
const clone = b => ({ ...b, actors: JSON.parse(JSON.stringify(b.actors)), moved: { ...b.moved }, acted: { ...b.acted }, log: [...b.log] });
const living = b => Object.values(b.actors).filter(a => a.hp > 0);
const player = b => b.actors[b.playerId];

export function makeBattle({ seed = 'battle', grid, actors = [], sight = 9 } = {}) {
  const map = {}; for (const a of actors) map[a.id] = { move: 5, aim: 68, sight, abilities: ['sword'], damage: '1d8', ...a, maxHp: a.maxHp || a.hp || 10, hp: a.hp || a.maxHp || 10 };
  const playerId = (actors.find(a => a.faction === 'player') || actors[0]).id;
  const order = rollInitiative(Object.values(map).map(a => ({ id: a.id, agility: a.agility || 0 })), seed);
  return { seed, grid, actors: map, playerId, order, round: 1, phase: 'player', moved: {}, acted: {}, log: [], over: null, nonce: 0 };
}

export function visibility(b) { const p = player(b); return computeVisibility(b.grid, Math.round(p.x), Math.round(p.y), p.sight); }
export function visibleEnemies(b) { const vis = visibility(b); return living(b).filter(a => a.faction !== 'player' && vis.has(Math.round(a.x) + ',' + Math.round(a.y))); }

export function reachableForActor(b, id) { const a = b.actors[id]; return reachable(b.grid, Math.round(a.x), Math.round(a.y), a.move, 'careful'); }

export function moveActor(b, id, x, y) {
  const nb = clone(b); const a = nb.actors[id];
  const r = reachable(nb.grid, Math.round(a.x), Math.round(a.y), a.move, 'careful');
  if (!r.tiles.has(x + ',' + y)) { nb.log.push(`${a.name || id} can't reach there`); return nb; }
  a.x = x; a.y = y; nb.moved[id] = true;
  return nb;
}

export function attack(b, attackerId, targetId, abilityId = 'sword') {
  const nb = clone(b); const at = nb.actors[attackerId], tg = nb.actors[targetId];
  if (!at || !tg || tg.hp <= 0) return nb;
  const ab = getAbility(abilityId) || getAbility('sword');
  const range = Math.hypot(at.x - tg.x, at.y - tg.y);
  nb.nonce++;
  if (ab.shape === 'aoe') {
    const res = resolveAbility({ seed: nb.seed, nonce: nb.nonce, ability: ab, origin: { x: at.x, y: at.y }, target: { x: tg.x, y: tg.y }, actors: living(nb), opacity: nb.grid });
    if (!res.legal) { nb.log.push(`${ab.name}: ${res.reason}`); return nb; }
    for (const h of res.hits) { const a = nb.actors[h.id]; if (a) { a.hp -= h.damage; nb.log.push(`${ab.name} hits ${a.name || h.id} for ${h.damage}${a.hp <= 0 ? ' — slain!' : ''}`); } }
  } else {
    if (range > ab.range + 1e-9) { nb.log.push(`${tg.name || targetId} out of range`); return nb; }
    if (ab.needsLoS && !canSee(nb.grid, Math.round(at.x), Math.round(at.y), Math.round(tg.x), Math.round(tg.y), 99)) { nb.log.push(`no line of sight to ${tg.name || targetId}`); return nb; }
    const cover = coverAt(nb.grid, Math.round(tg.x), Math.round(tg.y), Math.round(at.x), Math.round(at.y));
    const res = resolveAttack({ seed: nb.seed, nonce: nb.nonce, attacker: attackerId, target: targetId, baseAim: at.aim, cover, range, damage: ab.damage });
    if (res.hit) { tg.hp -= res.damage; nb.log.push(`${at.name || attackerId} ${res.crit ? 'crits' : 'hits'} ${tg.name || targetId} for ${res.damage} [${res.chance}%${cover !== 'none' ? ', ' + cover + ' cover' : ''}]${tg.hp <= 0 ? ' — slain!' : ''}`); }
    else nb.log.push(`${at.name || attackerId} misses ${tg.name || targetId} [${res.chance}%${cover !== 'none' ? ', ' + cover + ' cover' : ''}]`);
  }
  nb.acted[attackerId] = true;
  return checkOver(nb);
}

export function endPlayerTurn(b) {
  let nb = clone(b); nb.phase = 'enemy';
  const p = player(nb);
  for (const id of nb.order) {
    const e = nb.actors[id]; if (!e || e.hp <= 0 || e.faction === 'player') continue;
    if (player(nb).hp <= 0) break;
    nb.nonce++;
    const r = enemyTurn({ seed: nb.seed, nonce: nb.nonce, enemy: e, player: { id: p.id, x: p.x, y: p.y }, opacity: nb.grid });
    Object.assign(e, r.enemy);
    if (r.action.type === 'attack') {
      const range = Math.hypot(e.x - p.x, e.y - p.y);
      const cover = coverAt(nb.grid, Math.round(p.x), Math.round(p.y), Math.round(e.x), Math.round(e.y));
      const res = resolveAttack({ seed: nb.seed, nonce: nb.nonce + 777, attacker: id, target: p.id, baseAim: e.aim, cover, range, damage: e.damage });
      if (res.hit) { nb.actors[p.id].hp -= res.damage; nb.log.push(`${e.name || id} ${res.crit ? 'crits' : 'hits'} you for ${res.damage}${nb.actors[p.id].hp <= 0 ? ' — you fall!' : ''}`); }
      else nb.log.push(`${e.name || id} misses you`);
    }
  }
  nb.phase = 'player'; nb.round++; nb.moved = {}; nb.acted = {};
  return checkOver(nb);
}

export function checkOver(b) {
  const nb = b.over ? b : { ...b };
  if (player(nb).hp <= 0) nb.over = 'lose';
  else if (!living(nb).some(a => a.faction !== 'player')) nb.over = 'win';
  return nb;
}
