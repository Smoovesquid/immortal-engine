/**
 * Food web — derives who-eats-whom from the bestiary's own ecology data.
 *
 * Every creature already declares a habitat, behavior, social structure, tags and
 * CR. From those we infer a trophic role (producer / herbivore / predator / apex
 * / scavenger), then wire predation edges within a habitat by role and size. This
 * is the skeleton the population simulation animates.
 *
 * PURE + DETERMINISTIC.
 */

const txt = e => `${e?.behavior || ''} ${e?.ecology || ''} ${e?.loreHook || ''}`.toLowerCase();
const has = (s, ...w) => w.some(x => s.includes(x));

// Normalize the bestiary's many habitats into ecological biomes.
const BIOME = {
  underground: 'underground', dungeon: 'underground', 'between walls': 'underground',
  ruins: 'ruins', urban: 'urban', farmland: 'urban',
  forest: 'forest', jungle: 'forest',
  marsh: 'marsh', swamp: 'marsh',
  coastal: 'coastal', ocean: 'water', 'deep ocean': 'water', deep_water: 'water',
  desert: 'desert', arctic: 'arctic', tundra: 'arctic',
  mountain: 'mountains', mountains: 'mountains', plains: 'plains',
  volcanic: 'volcanic', wilderness: 'wilderness'
};
export function biomeOf(entry) {
  const h = String(entry?.habitat || '').toLowerCase();
  return BIOME[h] || (['any', 'nowhere fixed', 'planar', 'orbit', 'sky'].includes(h) ? 'any' : 'wilderness');
}

export function trophicRole(entry) {
  const e = entry || {}, tags = (e.tags || []).map(t => String(t).toLowerCase());
  const b = txt(e), cr = Number(e.cr || 0);
  if (tags.includes('plant') && !tags.includes('undead')) return 'producer';
  if (tags.includes('ooze') || tags.includes('fungal') || has(b, 'scaveng', 'carrion', 'decompos', 'feeds on the dead', 'rot', 'eats anything', 'eats the dead')) return 'scavenger';
  const apexWord = has(`${e.ref || ''} ${e.name || ''}`.toLowerCase(), 'apex', 'alpha', 'elder', 'ancient', 'great ', 'tyrant', 'wyrm');
  const predatory = has(b, 'predat', 'hunts', 'stalks', 'ambush', 'charges', 'preys', 'carnivor', 'hunter', 'mob', 'devour');
  if (predatory || tags.includes('dragon') || cr >= 5) return (apexWord || cr >= 9 || tags.includes('dragon')) ? 'apex' : 'predator';
  if (has(b, 'graz', 'forage', 'passive', 'flees', 'herd', 'timid', 'docile') || cr < 1) return 'herbivore';
  return cr >= 3 ? 'predator' : 'herbivore';
}

const RANK = { producer: 0, herbivore: 1, scavenger: 1, predator: 2, apex: 3 };

// speciesByBiome(catalog) -> Map<biome, ref[]>  (terrestrial biomes only)
export function speciesByBiome(catalog) {
  const m = new Map();
  for (const e of catalog) {
    const bi = biomeOf(e);
    if (bi === 'any' || bi === 'water') continue;
    if (!m.has(bi)) m.set(bi, []);
    m.get(bi).push(String(e.ref));
  }
  return m;
}

// buildFoodWeb(refs, defByRef) -> { roles:{ref}, edges:[{pred,prey}], byRole }
export function buildFoodWeb(refs, defByRef) {
  const roles = {}, defs = {};
  for (const r of refs) { const d = defByRef(r); if (!d) continue; roles[r] = trophicRole(d); defs[r] = d; }
  const list = Object.keys(roles);
  const cr = r => Number(defs[r]?.cr || 0);
  const edges = [];
  for (const pred of list) {
    const pr = roles[pred];
    for (const prey of list) {
      if (pred === prey) continue;
      const py = roles[prey];
      let eats = false;
      if (pr === 'herbivore' && py === 'producer') eats = true;
      else if (pr === 'predator' && (py === 'herbivore' || py === 'scavenger')) eats = true;
      else if (pr === 'apex' && (py === 'predator' || py === 'herbivore')) eats = true;
      else if (pr === 'scavenger' && py === 'producer') eats = true;
      if (eats && (pr === 'herbivore' || cr(pred) >= cr(prey))) edges.push({ pred, prey });
    }
  }
  const byRole = {}; for (const r of list) (byRole[roles[r]] = byRole[roles[r]] || []).push(r);
  return { roles, edges, byRole, defs };
}

export { RANK };
