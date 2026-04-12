/**
 * Rumor tier computation — deterministic, pure.
 *
 * baseTier = clamp(hopCount - sophistication, 0, 4)
 * agedTier = clamp(baseTier + floor(age / 10), 0, 4)
 *
 * Higher tier = less reliable / more distorted.
 */

export function computeTier(hopCount, age, sophistication) {
  const h = clamp(Math.trunc(Number(hopCount) || 0), 0, 99);
  const a = clamp(Math.trunc(Number(age) || 0), 0, 9999);
  const s = clamp(Math.trunc(Number(sophistication) || 0), 0, 4);

  const baseTier = clamp(h - s, 0, 4);
  return clamp(baseTier + Math.floor(a / 10), 0, 4);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
