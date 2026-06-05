/**
 * Cover + hit-chance — the XCom combat core.
 *
 * Cover is directional: a target is protected only on the side it has a wall (or
 * low cover) facing the attacker. Move to a flank and the cover stops counting —
 * that's the whole positioning game. hitChance folds cover, range falloff, and
 * flanking into a percent; resolveAttack rolls it deterministically, with crits
 * favored when you catch a target in the open or flanked.
 *
 * PURE + DETERMINISTIC.
 */

import { makeRng, seedFromString } from '../rng.js';

function rollDice(rng, spec) { const m = String(spec || '').match(/^(\d+)d(\d+)$/); if (!m) return 0; let s = 0; for (let i = 0; i < +m[1]; i++) s += rng.int(1, +m[2]); return s; }
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// coverAt(opacity, tx,ty, fromX,fromY, lowCover?) -> 'none' | 'half' | 'full'
// Checks the cells between the target and the attacker's direction; a wall there
// is full cover, a low-cover cell is half. Flanking (no blocker on that side)
// returns 'none'. lowCover is an optional Set of "x,y" keys.
export function coverAt(opacity, tx, ty, fromX, fromY, lowCover = null) {
  const dx = Math.sign(fromX - tx), dy = Math.sign(fromY - ty);
  const checks = [];
  if (dx !== 0) checks.push([tx + dx, ty]);
  if (dy !== 0) checks.push([tx, ty + dy]);
  if (dx !== 0 && dy !== 0) checks.push([tx + dx, ty + dy]);
  let full = false, half = false;
  for (const [cx, cy] of checks) {
    if (opacity && opacity.get(cx, cy)) full = true;
    else if (lowCover && lowCover.has && lowCover.has(cx + ',' + cy)) half = true;
  }
  return full ? 'full' : half ? 'half' : 'none';
}

// hitChance({ baseAim, cover, range, optimal, falloffPer }) -> integer percent (5..95)
export function hitChance({ baseAim = 70, cover = 'none', range = 0, optimal = 8, falloffPer = 4 } = {}) {
  let aim = baseAim;
  if (cover === 'half') aim -= 20;
  else if (cover === 'full') aim -= 40;
  if (range > optimal) aim -= Math.floor(range - optimal) * falloffPer;
  return clamp(Math.round(aim), 5, 95);
}

// resolveAttack({ seed, nonce, attacker, target, baseAim, cover, range, damage })
//   -> { hit, crit, roll, chance, damage, cover }
export function resolveAttack({ seed = '', nonce = 0, attacker = '', target = '', baseAim = 70, cover = 'none', range = 0, damage = '1d8' } = {}) {
  const chance = hitChance({ baseAim, cover, range });
  const rng = makeRng(seedFromString(`${seed}|atk|${nonce}|${attacker}|${target}`));
  const roll = rng.int(1, 100);
  const hit = roll <= chance;
  // Crit when you connect against an exposed (uncovered) target on a good roll.
  const crit = hit && cover === 'none' && roll <= Math.max(5, Math.round(chance * 0.15));
  const dmg = hit ? rollDice(rng, damage) * (crit ? 2 : 1) : 0;
  return { hit, crit, roll, chance, damage: dmg, cover };
}
