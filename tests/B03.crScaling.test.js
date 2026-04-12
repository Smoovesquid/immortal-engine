// Pass B1 — CR scaling sanity checks.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BESTIARY_CATALOG } from '../engine/ruleset/core/bestiary/index.js';

describe('B03 — CR scaling', () => {
  it('higher-CR monsters have higher maxHp than lower-CR monsters', () => {
    const byCr = Object.values(BESTIARY_CATALOG).sort((a, b) => a.cr - b.cr);
    // Group by CR and check that average maxHp increases
    const crGroups = new Map();
    for (const m of byCr) {
      if (!crGroups.has(m.cr)) crGroups.set(m.cr, []);
      crGroups.get(m.cr).push(m);
    }
    const sorted = [...crGroups.entries()].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < sorted.length; i++) {
      const prevAvgHp = sorted[i - 1][1].reduce((s, m) => s + m.maxHp, 0) / sorted[i - 1][1].length;
      const currAvgHp = sorted[i][1].reduce((s, m) => s + m.maxHp, 0) / sorted[i][1].length;
      assert.ok(
        currAvgHp >= prevAvgHp,
        `CR ${sorted[i][0]} avg maxHp (${currAvgHp}) should be >= CR ${sorted[i - 1][0]} avg maxHp (${prevAvgHp})`
      );
    }
  });

  it('higher-CR monsters have higher damage', () => {
    const byCr = Object.values(BESTIARY_CATALOG).sort((a, b) => a.cr - b.cr);
    const crGroups = new Map();
    for (const m of byCr) {
      if (!crGroups.has(m.cr)) crGroups.set(m.cr, []);
      crGroups.get(m.cr).push(m);
    }
    const sorted = [...crGroups.entries()].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < sorted.length; i++) {
      const prevAvgDmg = sorted[i - 1][1].reduce((s, m) => s + m.damage, 0) / sorted[i - 1][1].length;
      const currAvgDmg = sorted[i][1].reduce((s, m) => s + m.damage, 0) / sorted[i][1].length;
      assert.ok(
        currAvgDmg >= prevAvgDmg,
        `CR ${sorted[i][0]} avg damage (${currAvgDmg}) should be >= CR ${sorted[i - 1][0]} avg damage (${prevAvgDmg})`
      );
    }
  });

  it('bandit_captain (CR 2) has maxHp > goblin (CR 0.25)', () => {
    assert.ok(
      BESTIARY_CATALOG.bandit_captain.maxHp > BESTIARY_CATALOG.goblin.maxHp,
      `bandit_captain maxHp (${BESTIARY_CATALOG.bandit_captain.maxHp}) should exceed goblin maxHp (${BESTIARY_CATALOG.goblin.maxHp})`
    );
  });

  it('owlbear (CR 3) has maxHp > bandit_captain (CR 2)', () => {
    assert.ok(
      BESTIARY_CATALOG.owlbear.maxHp > BESTIARY_CATALOG.bandit_captain.maxHp,
      `owlbear maxHp (${BESTIARY_CATALOG.owlbear.maxHp}) should exceed bandit_captain maxHp (${BESTIARY_CATALOG.bandit_captain.maxHp})`
    );
  });
});
