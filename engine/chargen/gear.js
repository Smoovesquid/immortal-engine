import { filterByTags, rollOnTable } from './rngTables.js';

export function emptyInventory() {
  return {
    weapons: [], armor: [], tools: [], clothes: [], spells: [], tech: [], oddities: [], consumables: [], junk: []
  };
}

export function buildLoadout({ packGear, tags = [], rng }) {
  const g = packGear && typeof packGear === 'object' ? packGear : {};
  const inv = emptyInventory();

  const pick = (key, count = 1) => {
    const arr = Array.isArray(g[key]) ? g[key] : [];
    const pool = filterByTags(arr, tags);
    const use = pool.length ? pool : arr;
    const out = [];
    for (let i = 0; i < count; i++) {
      const it = rollOnTable(use, rng);
      if (it) out.push(it);
    }
    return out;
  };

  inv.weapons = pick('weapons', 1);
  inv.armor = pick('armor', 1);
  inv.tools = pick('tools', 1);
  inv.clothes = pick('clothes', 1);

  // Pack-dependent extras.
  inv.spells = pick('spells', hasTag(tags, 'spell') ? 1 : 0);
  inv.tech = pick('tech', hasTag(tags, 'tech') ? 1 : 0);
  inv.oddities = pick('oddities', 1);
  inv.consumables = pick('consumables', 2);
  inv.junk = pick('junk', 1);

  // Signature = one meaningful object, biased to oddities/tools.
  const sigPool = [...(inv.oddities || []), ...(inv.tools || []), ...(inv.weapons || [])].filter(Boolean);
  const signature = sigPool.length ? (rng.pick(sigPool) || sigPool[0]) : null;

  return { inventory: inv, signature };
}

export function swapOptions({ packGear, category, tags = [], rng, n = 5 }) {
  const g = packGear && typeof packGear === 'object' ? packGear : {};
  const arr = Array.isArray(g[category]) ? g[category] : [];
  const pool = filterByTags(arr, tags);
  const use = pool.length ? pool : arr;

  const opts = [];
  const seen = new Set();
  while (opts.length < Math.min(n, use.length)) {
    const it = rng.pick(use);
    if (!it) break;
    const key = String(it.name || JSON.stringify(it));
    if (seen.has(key)) continue;
    seen.add(key);
    opts.push(it);
  }
  return opts;
}

function hasTag(tags, t) {
  return (tags || []).map(String).includes(String(t));
}
