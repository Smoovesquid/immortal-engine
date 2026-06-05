import test from 'node:test';
import assert from 'node:assert/strict';
import { regionEcosystems, tickRegion, spawnsFromEcology } from '../engine/ecology/regionEcology.js';
import { applyRipple } from '../engine/ecology/simulate.js';
import { getMonsterDef } from '../engine/ruleset/core/bestiary/index.js';
import { trivial } from '../engine/ruleset/core/bestiary/catalog/trivial.js';
import { minor } from '../engine/ruleset/core/bestiary/catalog/minor.js';
import { standard } from '../engine/ruleset/core/bestiary/catalog/standard.js';
import { elite } from '../engine/ruleset/core/bestiary/catalog/elite.js';

const ALL = [...trivial, ...minor, ...standard, ...elite];

test('ECO3: a region builds a living ecosystem per biome', () => {
  const eco = regionEcosystems(['forest', 'marsh', 'plains'], ALL, getMonsterDef);
  assert.ok(eco.forest && Object.keys(eco.forest.pop).length > 5, 'forest has a populated ecosystem');
  const ticked = tickRegion(eco, 10);
  for (const b of Object.keys(ticked)) for (const v of Object.values(ticked[b].pop)) assert.ok(v >= 0 && Number.isFinite(v));
});

test('ECO3: spawns come from the living population — over-hunting empties the biome', () => {
  const eco = regionEcosystems(['forest'], ALL, getMonsterDef);
  let forest = tickRegion(eco, 12).forest;
  // pick the most abundant consumer and hammer its population
  const consumers = Object.keys(forest.pop).filter(r => forest.roles[r] !== 'producer');
  const victim = consumers.sort((a, b) => forest.pop[b] - forest.pop[a])[0];

  const before = spawnsFromEcology(forest, 400, 's').filter(r => r === victim).length;
  forest = applyRipple(forest, { cull: { ref: victim, frac: 0.95 } });
  const after = spawnsFromEcology(forest, 400, 's').filter(r => r === victim).length;

  assert.ok(after < before, `culling ${victim} should reduce its spawns (${after} < ${before})`);
});

test('ECO3: spawns are valid bestiary creatures and deterministic', () => {
  const eco = regionEcosystems(['plains'], ALL, getMonsterDef);
  const forest = tickRegion(eco, 8).plains;
  const a = spawnsFromEcology(forest, 20, 'seed');
  const b = spawnsFromEcology(forest, 20, 'seed');
  assert.deepEqual(a, b);
  for (const ref of a) assert.ok(getMonsterDef(ref), `unknown ${ref}`);
});
