import { rngFrom } from './rngTables.js';
import { clampInt } from '../util.js';

export const STAT_KEYS = ['MIGHT', 'AGILITY', 'WITS', 'GRIT', 'CHARM'];

export function statMod(n) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return 0;
  const m = Math.floor((x - 10) / 2);
  return clampInt(m, -4, +6);
}

export function rollStats({ method = '2d6+2', seed = 'seed', rng = null } = {}) {
  const r = rng || rngFrom(`${seed}|stats|${method}`);
  const out = { stats: {}, mods: {}, dice: {} };

  for (const k of STAT_KEYS) {
    if (method === '3d6') {
      const d = [r.int(1, 6), r.int(1, 6), r.int(1, 6)];
      const val = d[0] + d[1] + d[2];
      out.stats[k] = val;
      out.mods[k] = statMod(val);
      out.dice[k] = d;
    } else {
      const d = [r.int(1, 6), r.int(1, 6)];
      const val = d[0] + d[1] + 2;
      out.stats[k] = val;
      out.mods[k] = statMod(val);
      out.dice[k] = [...d, '+2'];
    }
  }

  return out;
}

