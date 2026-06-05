/**
 * Targeting & abilities — generalizes the blind-fire fireball into a system.
 *
 * An ability declares its range, whether it needs line of sight, its shape
 * (single target or area), AP cost, and damage. Blind-fire abilities (needsLoS
 * false, aoe) resolve on whatever is actually at the target — hidden enemy or
 * your own ally. Single-target attacks require LoS. All rolls seeded.
 *
 * PURE + DETERMINISTIC.
 */

import { makeRng, seedFromString } from '../rng.js';
import { losClear } from './visibility.js';

export const ABILITIES = {
  sword:    { id: 'sword',    name: 'Sword Strike', range: 1.6, needsLoS: true,  shape: 'single', radius: 0, apCost: 1, kind: 'attack', damage: '1d8' },
  shortbow: { id: 'shortbow', name: 'Shortbow',     range: 12,  needsLoS: true,  shape: 'single', radius: 0, apCost: 1, kind: 'attack', damage: '1d8' },
  firebolt: { id: 'firebolt', name: 'Firebolt',     range: 10,  needsLoS: true,  shape: 'single', radius: 0, apCost: 1, kind: 'spell',  damage: '1d10' },
  fireball: { id: 'fireball', name: 'Fireball',     range: 9,   needsLoS: false, shape: 'aoe',    radius: 2, apCost: 2, kind: 'spell',  damage: '3d6' },
  caltrops: { id: 'caltrops', name: 'Caltrops',     range: 5,   needsLoS: false, shape: 'aoe',    radius: 1.5, apCost: 1, kind: 'trap', damage: '1d4' }
};

export function getAbility(id) { return ABILITIES[String(id || '')] || null; }

function rollDice(rng, spec) {
  const m = String(spec || '').match(/^(\d+)d(\d+)$/);
  if (!m) return 0;
  const n = +m[1], faces = +m[2]; let sum = 0;
  for (let i = 0; i < n; i++) sum += rng.int(1, faces);
  return sum;
}

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// resolveAbility({ seed, nonce, ability, origin, target, actors, opacity })
//   -> { legal, reason, hits:[{ id, faction, cell, damage }], total, ability }
export function resolveAbility({ seed = '', nonce = 0, ability, origin, target, actors = [], opacity = null } = {}) {
  const ab = typeof ability === 'string' ? getAbility(ability) : ability;
  if (!ab) return { legal: false, reason: 'no_ability', hits: [] };
  const ox = origin.x, oy = origin.y, tx = target.x, ty = target.y;

  if (dist(ox, oy, tx, ty) > ab.range + 1e-9) return { legal: false, reason: 'out_of_range', hits: [] };
  if (ab.needsLoS) {
    if (!opacity) return { legal: false, reason: 'no_los_grid', hits: [] };
    if (!losClear(opacity, Math.round(ox), Math.round(oy), Math.round(tx), Math.round(ty))) return { legal: false, reason: 'no_line_of_sight', hits: [] };
  }

  const rng = makeRng(seedFromString(`${seed}|ability|${nonce}|${ab.id}|${tx}|${ty}`));
  const hits = [];
  if (ab.shape === 'aoe') {
    // hits everything in the blast — visible or not, friend or foe (blind-fire)
    for (const a of actors) if (dist(a.x, a.y, tx, ty) <= ab.radius + 1e-9) hits.push(a);
  } else {
    // single target: the actor on/closest to the targeted cell within ~1 tile
    let best = null, bd = 1.0;
    for (const a of actors) { const d = dist(a.x, a.y, tx, ty); if (d <= bd) { bd = d; best = a; } }
    if (best) hits.push(best);
  }

  const out = hits.map(a => ({ id: String(a.id), faction: a.faction || 'enemy', cell: { x: a.x, y: a.y }, damage: rollDice(rng, ab.damage) }));
  return { legal: true, reason: null, hits: out, total: out.reduce((s, h) => s + h.damage, 0), ability: ab.id };
}
