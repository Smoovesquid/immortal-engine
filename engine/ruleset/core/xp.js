// SRD 5.1 — XP awards by Challenge Rating. Overcoming an encounter earns the
// XP whether you killed it, talked it down, or scared it off — the DM Test
// rewards the solution, not the body count.

const XP_BY_CR = [
  [0, 10], [0.125, 25], [0.25, 50], [0.5, 100],
  [1, 200], [2, 450], [3, 700], [4, 1100], [5, 1800],
  [6, 2300], [7, 2900], [8, 3900], [9, 5000], [10, 5900],
  [11, 7200], [12, 8400], [13, 10000], [14, 11500], [15, 13000],
  [16, 15000], [17, 18000], [18, 20000], [19, 22000], [20, 25000],
  [21, 33000], [22, 41000], [23, 50000], [24, 62000], [25, 75000],
  [26, 90000], [27, 105000], [28, 120000], [29, 135000], [30, 155000]
];

export function xpForCR(cr) {
  const c = Number(cr);
  if (!Number.isFinite(c) || c < 0) return 10;
  let best = XP_BY_CR[0][1];
  for (const [band, xp] of XP_BY_CR) {
    if (c >= band) best = xp;
    else break;
  }
  return best;
}

export function xpForEnemies(enemies) {
  const arr = Array.isArray(enemies) ? enemies : [];
  let total = 0;
  for (const e of arr) {
    if (!e) continue;
    total += xpForCR(e.cr ?? 0);
  }
  return total;
}
