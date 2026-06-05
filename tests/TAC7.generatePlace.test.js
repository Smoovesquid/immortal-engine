import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePlace, generateRegion } from '../public/map/generatePlace.js';
import { getMonsterDef } from '../engine/ruleset/core/bestiary/index.js';

test('TAC7: generated place has buildings, a player, and real-creature enemies', () => {
  const p = generatePlace({ seed: 'oak', nodeType: 'hamlet', tier: 2 });
  assert.ok(p.buildings.length >= 1, 'has buildings');
  const player = p.tokens.find(t => t.type === 'player');
  assert.ok(player, 'has a player token');
  const mons = p.tokens.filter(t => t.type === 'mon');
  assert.ok(mons.length >= 1, 'has enemies');
  for (const m of mons) { assert.ok(getMonsterDef(m.info.ref), `unknown creature ${m.info.ref}`); assert.ok(Array.isArray(m.info.tags)); }
});

test('TAC7: higher tier yields more enemies on the same layout seed', () => {
  const lo = generatePlace({ seed: 'oak', nodeType: 'town', tier: 1 });
  const hi = generatePlace({ seed: 'oak', nodeType: 'town', tier: 4 });
  const c = pl => pl.tokens.filter(t => t.type === 'mon').length;
  assert.ok(c(hi) > c(lo), `tier4 ${c(hi)} should exceed tier1 ${c(lo)}`);
});

test('TAC7: deterministic', () => {
  assert.deepEqual(generatePlace({ seed: 's', nodeType: 'wild', tier: 3 }), generatePlace({ seed: 's', nodeType: 'wild', tier: 3 }));
});

test('TAC7: region is a connected net of places (spanning roads)', () => {
  const r = generateRegion({ seed: 'reg', count: 6 });
  assert.equal(r.places.length, 6);
  assert.equal(r.roads.length, 5, 'count-1 roads => connected tree');
  assert.equal(r.places[0].nodeType, 'hamlet', 'start is a safe hamlet');
  assert.deepEqual(generateRegion({ seed: 'reg', count: 6 }), r);
});
