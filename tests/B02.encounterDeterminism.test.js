// Pass B1 — encounter determinism and table integrity.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, seedFromString } from '../engine/rng.js';
import { ENCOUNTER_TABLES, rollEncounter } from '../engine/ruleset/core/encounters.js';
import { BESTIARY_CATALOG } from '../engine/ruleset/core/bestiary/index.js';

describe('B02 — encounter determinism', () => {
  it('same seed produces same enemies', () => {
    const seed = seedFromString('determinism-test');
    const rng1 = makeRng(seed);
    const rng2 = makeRng(seed);

    const result1 = rollEncounter('westmarch', rng1);
    const result2 = rollEncounter('westmarch', rng2);

    const refs1 = result1.enemies.map(e => e.ref);
    const refs2 = result2.enemies.map(e => e.ref);
    assert.deepStrictEqual(refs1, refs2);
  });

  it('different seeds produce different enemies (not all identical over 10 seeds)', () => {
    const results = [];
    for (let i = 0; i < 10; i++) {
      const rng = makeRng(seedFromString(`seed-${i}`));
      const result = rollEncounter('westmarch', rng);
      results.push(result.enemies.map(e => e.ref).join(','));
    }
    const unique = new Set(results);
    assert.ok(unique.size > 1, `all 10 seeds produced identical results: ${results[0]}`);
  });

  it('all enemy refs in encounter tables exist in BESTIARY_CATALOG', () => {
    for (const [region, table] of Object.entries(ENCOUNTER_TABLES)) {
      for (const entry of table) {
        for (const ref of entry.enemies) {
          assert.ok(
            BESTIARY_CATALOG[ref],
            `encounter table "${region}" references unknown monster "${ref}"`
          );
        }
      }
    }
  });

  it('encounter tables exist for westmarch and ashenmoor', () => {
    assert.ok(ENCOUNTER_TABLES.westmarch, 'missing westmarch table');
    assert.ok(ENCOUNTER_TABLES.ashenmoor, 'missing ashenmoor table');
    assert.ok(ENCOUNTER_TABLES.westmarch.length > 0);
    assert.ok(ENCOUNTER_TABLES.ashenmoor.length > 0);
  });

  it('rollEncounter returns resolved monster defs with required fields', () => {
    const rng = makeRng(seedFromString('shape-check'));
    const result = rollEncounter('ashenmoor', rng);
    assert.ok(result.enemies.length > 0);
    for (const enemy of result.enemies) {
      assert.ok(enemy.ref, 'enemy must have ref');
      assert.ok(enemy.maxHp >= 1, 'enemy must have maxHp');
      assert.ok(enemy.ac >= 1, 'enemy must have ac');
    }
  });
});
