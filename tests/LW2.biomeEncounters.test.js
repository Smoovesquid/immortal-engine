import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCreatures } from '../engine/combat/encounterSpawn.js';
import { biomeOf } from '../engine/ecology/foodweb.js';
import { makeRng, seedFromString } from '../engine/rng.js';

const rng = (s) => makeRng(seedFromString(s));

test('LW2: with a biome, picked creatures are native to it (or biome-agnostic)', () => {
  // A generous CR budget so each biome has a native pool to draw from.
  for (const biome of ['forest', 'marsh', 'mountains', 'desert']) {
    let nativeHits = 0, total = 0;
    for (let i = 0; i < 30; i++) {
      const picked = selectCreatures(6, 1, null, rng(`${biome}-${i}`), biome);
      for (const c of picked) {
        total++;
        const cb = biomeOf(c);
        if (cb === biome || cb === 'any') nativeHits++;
      }
    }
    // Every pick should be native or biome-agnostic (the filter is strict when a
    // native pool exists at this CR).
    assert.equal(nativeHits, total, `${biome}: ${nativeHits}/${total} native`);
  }
});

test('LW2: biome filter changes the creature mix vs no biome', () => {
  const noBiome = new Set();
  const forest = new Set();
  for (let i = 0; i < 40; i++) {
    noBiome.add(selectCreatures(6, 1, null, rng(`nb-${i}`))[0]?.ref);
    forest.add(selectCreatures(6, 1, null, rng(`f-${i}`), 'forest')[0]?.ref);
  }
  // The forest-filtered set should not be identical to the unfiltered set.
  assert.notDeepEqual([...forest].sort(), [...noBiome].sort());
});

test('LW2: deterministic — same seed + biome → same pick', () => {
  const a = selectCreatures(5, 2, null, rng('det'), 'marsh').map(c => c.ref);
  const b = selectCreatures(5, 2, null, rng('det'), 'marsh').map(c => c.ref);
  assert.deepEqual(a, b);
});

test('LW2: no biome arg behaves exactly as before (backwards-compatible)', () => {
  const a = selectCreatures(4, 2, null, rng('compat')).map(c => c.ref);
  const b = selectCreatures(4, 2, null, rng('compat'), null).map(c => c.ref);
  assert.deepEqual(a, b);
});
