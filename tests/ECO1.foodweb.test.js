import test from 'node:test';
import assert from 'node:assert/strict';
import { biomeOf, trophicRole, speciesByBiome, buildFoodWeb } from '../engine/ecology/foodweb.js';
import { getMonsterDef } from '../engine/ruleset/core/bestiary/index.js';
import { trivial } from '../engine/ruleset/core/bestiary/catalog/trivial.js';
import { minor } from '../engine/ruleset/core/bestiary/catalog/minor.js';
import { standard } from '../engine/ruleset/core/bestiary/catalog/standard.js';
import { elite } from '../engine/ruleset/core/bestiary/catalog/elite.js';

const ALL = [...trivial, ...minor, ...standard, ...elite];

test('ECO1: habitats normalize into biomes', () => {
  assert.equal(biomeOf({ habitat: 'swamp' }), 'marsh');
  assert.equal(biomeOf({ habitat: 'mountains' }), 'mountains');
  assert.equal(biomeOf({ habitat: 'jungle' }), 'forest');
  assert.equal(biomeOf({ habitat: 'dungeon' }), 'underground');
});

test('ECO1: trophic roles are inferred sensibly', () => {
  assert.equal(trophicRole({ tags: ['plant'], cr: 0, behavior: 'immobile' }), 'producer');
  assert.equal(trophicRole({ tags: ['beast'], cr: 0, behavior: 'Passive. Flees from anything larger.' }), 'herbivore');
  assert.equal(trophicRole({ tags: ['beast'], cr: 2, behavior: 'Predatory. Charges warm-blooded targets.' }), 'predator');
  assert.ok(['apex'].includes(trophicRole({ tags: ['dragon'], cr: 12, name: 'Ancient Wyrm', behavior: 'hunts' })));
  assert.equal(trophicRole({ tags: ['ooze'], cr: 1, behavior: 'feeds on the dead' }), 'scavenger');
});

test('ECO1: the bestiary groups into biomes with full food webs', () => {
  const byBiome = speciesByBiome(ALL);
  assert.ok(byBiome.has('forest') && byBiome.get('forest').length > 10, 'forest is populated');
  const forest = byBiome.get('forest');
  const web = buildFoodWeb(forest, getMonsterDef);
  const roleSet = new Set(Object.values(web.roles));
  assert.ok(roleSet.has('herbivore') && roleSet.has('predator'), 'forest has prey and predators');
  assert.ok(web.edges.length > 0, 'predation edges exist');
  // every predation edge respects size for non-herbivores
  for (const { pred, prey } of web.edges) {
    if (web.roles[pred] !== 'herbivore') assert.ok(Number(web.defs[pred].cr) >= Number(web.defs[prey].cr), `${pred} should outrank ${prey}`);
  }
});

test('ECO1: deterministic', () => {
  const a = speciesByBiome(ALL).get('marsh') || [];
  const w1 = buildFoodWeb(a, getMonsterDef), w2 = buildFoodWeb(a, getMonsterDef);
  assert.deepEqual(w1.edges, w2.edges);
});
