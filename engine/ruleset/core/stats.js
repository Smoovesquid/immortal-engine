// Pass T1 — core stat helpers.
//
// statMod: 5e-style modifier from a raw stat score.
//   floor((score - 10) / 2)
//
// maxWounds: dynamic wound cap as a function of level and GRIT mod.
//   6 + (level - 1) * 2 + max(0, gritMod)
//
// These are pure helpers. They do not read or mutate world state; the
// engine calls them from ensureEntity (for clamping) and from the
// invariants layer (for validation).

export function statMod(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.floor((n - 10) / 2);
}

export function maxWounds(level, gritMod) {
  const lvRaw = Math.trunc(Number(level));
  const lv = Number.isFinite(lvRaw) ? Math.max(1, Math.min(20, lvRaw || 1)) : 1;
  const g = Number.isFinite(Number(gritMod)) ? Math.trunc(Number(gritMod)) : 0;
  return 6 + (lv - 1) * 2 + Math.max(0, g);
}
