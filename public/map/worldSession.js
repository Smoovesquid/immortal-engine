/**
 * World session — the playable loop, deterministic and stateful-by-value.
 *
 * One seed generates a region (biomes, watershed, roads, tiered towns) and a
 * living ecosystem per biome. You enter a place: it's generated from the catalog
 * and its enemies are drawn from that biome's CURRENT population. You fight, you
 * record the kills, you leave, time passes — the ecosystems tick, the world
 * shifts (famine, predator booms), and the next time you come back it's changed.
 *
 * Ecology + time live HERE, as a projection over the seeded world — not in hashed
 * canon — so the world evolves with play without touching worldHash.
 *
 * PURE + DETERMINISTIC (every function returns new state).
 */

import { generateRegion } from '../../engine/world/regionGen.js';
import { regionEcosystems, spawnsFromEcology } from '../../engine/ecology/regionEcology.js';
import { stepEcosystem, applyRipple } from '../../engine/ecology/simulate.js';
import { ecologyEvents } from '../../engine/ecology/events.js';
import { getMonsterDef } from '../../engine/ruleset/core/bestiary/index.js';
import { generatePlace } from './generatePlace.js';
import { trivial } from '../../engine/ruleset/core/bestiary/catalog/trivial.js';
import { minor } from '../../engine/ruleset/core/bestiary/catalog/minor.js';
import { standard } from '../../engine/ruleset/core/bestiary/catalog/standard.js';
import { elite } from '../../engine/ruleset/core/bestiary/catalog/elite.js';

const CATALOG = [...trivial, ...minor, ...standard, ...elite];
const nameOf = ref => (getMonsterDef(ref) || {}).name || ref;

export function newSession({ seed = 'world', W = 52, H = 32, places = 8 } = {}) {
  const region = generateRegion({ seed, W, H, places });
  const biomes = new Set(region.biome.filter(b => b !== 'water'));
  // warm the ecosystems up to a living baseline
  let ecosystems = regionEcosystems(biomes, CATALOG, getMonsterDef);
  for (const b of Object.keys(ecosystems)) { let s = ecosystems[b]; for (let i = 0; i < 12; i++) s = stepEcosystem(s); ecosystems[b] = s; }
  return { seed, region, ecosystems, time: 0, log: [] };
}

// enterPlace(session, placeId) -> { place, biome } ; enemies are drawn from the
// biome's living population (over-hunted biome => emptier place).
export function enterPlace(session, placeId) {
  const rp = session.region.places.find(p => p.id === placeId) || session.region.places[0];
  const place = generatePlace({ seed: `${session.seed}|${rp.id}|${session.time}`, nodeType: rp.nodeType, tier: rp.tier });
  const eco = session.ecosystems[rp.biome];
  const mons = place.tokens.filter(t => t.type === 'mon');
  if (eco && mons.length) {
    const refs = spawnsFromEcology(eco, mons.length, `${session.seed}|${rp.id}|${session.time}`);
    mons.forEach((t, i) => { const ref = refs[i] || t.info.ref; const def = getMonsterDef(ref) || {}; t.info = { ref, name: def.name || ref, tags: def.tags || ['beast'] }; });
  }
  return { place, biome: rp.biome, tier: rp.tier, nodeType: rp.nodeType };
}

// recordKills(session, biome, refs) -> session' (the population remembers).
export function recordKills(session, biome, refs = []) {
  const eco = session.ecosystems[biome]; if (!eco) return session;
  let s = eco; const tally = {}; for (const r of refs) tally[r] = (tally[r] || 0) + 1;
  for (const ref of Object.keys(tally)) s = applyRipple(s, { cull: { ref, amount: tally[ref] * 6 } });
  return { ...session, ecosystems: { ...session.ecosystems, [biome]: s } };
}

// advanceTime(session, days) -> { session', events } — the world evolves.
export function advanceTime(session, days = 7) {
  const next = {}, events = [];
  for (const b of Object.keys(session.ecosystems)) {
    const before = session.ecosystems[b];
    let after = before; for (let i = 0; i < days; i++) after = stepEcosystem(after);
    next[b] = after;
    for (const e of ecologyEvents(before, after, { nameOf })) events.push(e);
  }
  return { session: { ...session, ecosystems: next, time: session.time + days, log: [...session.log, ...events.map(e => e.text)] }, events };
}
