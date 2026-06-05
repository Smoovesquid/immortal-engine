/**
 * Region ecology — binds the living food web to the geography.
 *
 * Each biome present in a region runs its own population simulation. When a place
 * needs enemies, we don't roll a flat tier list — we draw from the biome's LIVING
 * population, weighted by what's actually abundant right now. Over-hunt a forest
 * and your next visit is emptier; clear an apex lair and prey overrun the region.
 * The world reacts and remembers.
 *
 * PURE + DETERMINISTIC.
 */

import { makeRng, seedFromString } from '../rng.js';
import { speciesByBiome } from './foodweb.js';
import { makeEcosystem, stepEcosystem } from './simulate.js';

// regionEcosystems(biomes, catalog, defByRef) -> { biome: ecosystemState }
export function regionEcosystems(biomes, catalog, defByRef) {
  const byBiome = speciesByBiome(catalog);
  const eco = {};
  for (const b of new Set(biomes)) { const refs = byBiome.get(b); if (refs && refs.length) eco[b] = makeEcosystem({ biome: b, refs, defByRef }); }
  return eco;
}

export function tickRegion(eco, n = 1) {
  const out = {};
  for (const b of Object.keys(eco)) { let s = eco[b]; for (let i = 0; i < n; i++) s = stepEcosystem(s); out[b] = s; }
  return out;
}

// spawnsFromEcology(ecosystem, count, seed) -> [ref...] — what you'd actually meet,
// weighted by the current living population (producers excluded; they're scenery).
export function spawnsFromEcology(ecosystem, count, seed = '') {
  if (!ecosystem) return [];
  const rng = makeRng(seedFromString(`${seed}|spawn|${ecosystem.biome}`));
  const cand = Object.keys(ecosystem.pop).filter(r => ecosystem.roles[r] !== 'producer' && ecosystem.pop[r] > 0.5);
  const weights = cand.map(r => ecosystem.pop[r]);
  const total = weights.reduce((s, w) => s + w, 0);
  const out = [];
  if (!total) return out;
  for (let i = 0; i < count; i++) {
    let t = rng.nextFloat() * total, k = 0;
    while (k < cand.length - 1 && (t -= weights[k]) > 0) k++;
    out.push(cand[k]);
  }
  return out;
}
