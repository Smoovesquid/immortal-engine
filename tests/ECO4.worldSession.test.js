import test from 'node:test';
import assert from 'node:assert/strict';
import { newSession, enterPlace, recordKills, advanceTime } from '../public/map/worldSession.js';
import { ecologyEvents } from '../engine/ecology/events.js';
import { ecosystemFrom, stepEcosystem, applyRipple } from '../engine/ecology/simulate.js';
import { getMonsterDef } from '../engine/ruleset/core/bestiary/index.js';

test('ECO4: a session builds a region + living ecosystems; deterministic', () => {
  const a = newSession({ seed: 'mira' });
  const b = newSession({ seed: 'mira' });
  assert.ok(a.region.places.length >= 4);
  assert.ok(Object.keys(a.ecosystems).length >= 2, 'multiple biomes alive');
  assert.deepEqual(Object.keys(a.ecosystems).sort(), Object.keys(b.ecosystems).sort());
});

test('ECO4: entering a place draws real enemies from the biome ecology', () => {
  const s = newSession({ seed: 'mira' });
  const land = s.region.places.find(p => s.ecosystems[p.biome]) || s.region.places[0];
  const { place } = enterPlace(s, land.id);
  const mons = place.tokens.filter(t => t.type === 'mon');
  assert.ok(place.tokens.some(t => t.type === 'player'));
  for (const m of mons) assert.ok(getMonsterDef(m.info.ref), `unknown enemy ${m.info.ref}`);
});

test('ECO4: the world remembers — over-hunting + time empties a species', () => {
  let s = newSession({ seed: 'mira' });
  // find a biome with a clear most-abundant consumer
  const biome = Object.keys(s.ecosystems).find(b => Object.values(s.ecosystems[b].pop).some(v => v > 1)) || Object.keys(s.ecosystems)[0];
  const eco = s.ecosystems[biome];
  const consumers = Object.keys(eco.pop).filter(r => eco.roles[r] !== 'producer' && eco.pop[r] > 1);
  const victim = consumers.sort((a, b) => eco.pop[b] - eco.pop[a])[0];
  const before = eco.pop[victim];
  // hammer it repeatedly, let time pass
  for (let i = 0; i < 8; i++) s = recordKills(s, biome, Array(20).fill(victim));
  s = advanceTime(s, 6).session;
  assert.ok(s.ecosystems[biome].pop[victim] < before, `${victim} should be depleted (${s.ecosystems[biome].pop[victim]} < ${before})`);
});

test('ECO4: time produces ecology events; advanceTime is deterministic', () => {
  const s = newSession({ seed: 'mira' });
  const r1 = advanceTime(s, 8), r2 = advanceTime(s, 8);
  assert.deepEqual(r1.events, r2.events);

  // a forced cascade fires the famine/overrun story
  let e = ecosystemFrom({ pop: { grass: 600, deer: 120, wolf: 22 }, roles: { grass: 'producer', deer: 'herbivore', wolf: 'predator' }, edges: [{ pred: 'deer', prey: 'grass' }, { pred: 'wolf', prey: 'deer' }], resource: 1000 });
  for (let i = 0; i < 20; i++) e = stepEcosystem(e);
  const before = e; e = applyRipple(e, { cull: { ref: 'wolf', frac: 0.95 } });
  for (let i = 0; i < 10; i++) e = stepEcosystem(e);
  const evs = ecologyEvents(before, e, { nameOf: r => r });
  assert.ok(evs.some(x => x.type === 'overrun' || x.type === 'famine'), 'predator collapse -> overrun/famine');
});
