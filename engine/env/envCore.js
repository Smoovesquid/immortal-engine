import { ensureWorld } from '../state.js';

// Environmental Signals v1
// world.env = { noise, heat, scent, light } each 0..6

export function ensureEnv(env) {
  const x = env && typeof env === 'object' ? env : {};
  return {
    noise: clampInt(x.noise ?? 0, 0, 6),
    heat: clampInt(x.heat ?? 0, 0, 6),
    scent: clampInt(x.scent ?? 0, 0, 6),
    light: clampInt(x.light ?? 0, 0, 6)
  };
}

export function applyEnvDeltas(world, deltas = []) {
  const w = ensureWorld(world);
  const env = ensureEnv(w.env);
  const ops = Array.isArray(deltas) ? deltas : [];

  let next = { ...env };
  for (const d of ops) {
    if (!d || typeof d !== 'object') continue;
    const key = String(d.key || '');
    const by = toInt(d.by ?? 0);
    if (!key || !Number.isFinite(by) || by === 0) continue;
    if (!(key in next)) continue;
    next[key] = clampInt(next[key] + by, 0, 6);
  }

  return { ...w, env: next };
}

function toInt(x) {
  const n = Math.trunc(Number(x));
  return Number.isFinite(n) ? n : NaN;
}

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
