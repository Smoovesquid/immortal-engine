import { seedFromString, makeRng } from '../rng.js';

export function rngFrom(seed) {
  return makeRng(seedFromString(String(seed || 'seed')));
}

export function rollOnTable(table, rng) {
  const arr = Array.isArray(table) ? table : [];
  if (!arr.length) return null;
  return rng.pick(arr) ?? arr[0] ?? null;
}

export function weightedPick(rng, items) {
  const list = Array.isArray(items) ? items.filter(x => x && (x.w ?? x.weight) > 0) : [];
  if (!list.length) return null;
  const total = list.reduce((s, x) => s + (x.w ?? x.weight), 0);
  const r = rng.nextFloat() * total;
  let acc = 0;
  for (const it of list) {
    acc += (it.w ?? it.weight);
    if (r <= acc) return it;
  }
  return list[list.length - 1];
}

export function filterByTags(items, tags) {
  const set = new Set((tags || []).map(String));
  return (Array.isArray(items) ? items : []).filter(it => {
    const t = Array.isArray(it?.tags) ? it.tags.map(String) : [];
    if (!t.length) return true;
    return t.some(x => set.has(String(x)));
  });
}
