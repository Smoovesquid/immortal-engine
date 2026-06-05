import test from 'node:test';
import assert from 'node:assert/strict';
import { ecosystemFrom, makeEcosystem, stepEcosystem, runEcosystem, applyRipple, totalByRole } from '../engine/ecology/simulate.js';
import { speciesByBiome } from '../engine/ecology/foodweb.js';
import { getMonsterDef } from '../engine/ruleset/core/bestiary/index.js';
import { trivial } from '../engine/ruleset/core/bestiary/catalog/trivial.js';
import { minor } from '../engine/ruleset/core/bestiary/catalog/minor.js';
import { standard } from '../engine/ruleset/core/bestiary/catalog/standard.js';
import { elite } from '../engine/ruleset/core/bestiary/catalog/elite.js';

function grassDeerWolf() {
  return ecosystemFrom({
    pop: { grass: 600, deer: 120, wolf: 22 },
    roles: { grass: 'producer', deer: 'herbivore', wolf: 'predator' },
    edges: [{ pred: 'deer', prey: 'grass' }, { pred: 'wolf', prey: 'deer' }],
    resource: 1000
  });
}

test('ECO2: removing the predator booms the prey, then crashes the producer (trophic cascade)', () => {
  let s = grassDeerWolf();
  for (let i = 0; i < 24; i++) s = stepEcosystem(s);
  const baseDeer = s.pop.deer, baseGrass = s.pop.grass;

  s = applyRipple(s, { cull: { ref: 'wolf', frac: 0.9 } });
  let maxDeer = 0, minGrass = Infinity;
  for (let i = 0; i < 16; i++) { s = stepEcosystem(s); maxDeer = Math.max(maxDeer, s.pop.deer); minGrass = Math.min(minGrass, s.pop.grass); }

  assert.ok(maxDeer > baseDeer, `deer should boom (${Math.round(maxDeer)} > ${Math.round(baseDeer)})`);
  assert.ok(minGrass < baseGrass, `grass should be overgrazed (${Math.round(minGrass)} < ${Math.round(baseGrass)})`);
});

test('ECO2: the system recovers — predators rebound and prey settle back', () => {
  let s = grassDeerWolf();
  for (let i = 0; i < 24; i++) s = stepEcosystem(s);
  const baseDeer = s.pop.deer;
  s = applyRipple(s, { cull: { ref: 'wolf', frac: 0.9 } });
  for (let i = 0; i < 40; i++) s = stepEcosystem(s); // let it ride out
  assert.ok(s.pop.wolf > 5, 'predators recover');
  assert.ok(Math.abs(s.pop.deer - baseDeer) < baseDeer, 'prey settle back near a balance, not exploded');
});

test('ECO2: populations stay finite and non-negative; deterministic', () => {
  const a = runEcosystem(grassDeerWolf(), 60).state;
  const b = runEcosystem(grassDeerWolf(), 60).state;
  assert.deepEqual(a.pop, b.pop);
  for (const v of Object.values(a.pop)) { assert.ok(v >= 0 && Number.isFinite(v)); }
});

test('ECO2: a real bestiary biome simulates stably for many ticks', () => {
  const ALL = [...trivial, ...minor, ...standard, ...elite];
  const forest = speciesByBiome(ALL).get('forest');
  let s = makeEcosystem({ biome: 'forest', refs: forest, defByRef: getMonsterDef });
  for (let i = 0; i < 50; i++) s = stepEcosystem(s);
  for (const v of Object.values(s.pop)) { assert.ok(v >= 0 && Number.isFinite(v), 'no NaN/negative/explosion'); }
  const byRole = totalByRole(s);
  assert.ok((byRole.producer || 0) >= 0 && (byRole.herbivore || 0) >= 0);
});
