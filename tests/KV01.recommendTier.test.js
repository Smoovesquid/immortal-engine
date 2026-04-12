import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MODEL_TIERS, recommendTier } from '../engine/ruleset/core/modelTiers.js';

describe('KV01 — recommendTier returns correct tier for RAM levels', () => {
  it('returns compact for 8GB', () => {
    const tier = recommendTier(8);
    assert.equal(tier.id, 'compact');
  });

  it('returns standard for 16GB', () => {
    const tier = recommendTier(16);
    assert.equal(tier.id, 'standard');
  });

  it('returns enhanced for 24GB', () => {
    const tier = recommendTier(24);
    assert.equal(tier.id, 'enhanced');
  });

  it('returns enhanced for 32GB', () => {
    const tier = recommendTier(32);
    assert.equal(tier.id, 'enhanced');
  });

  it('returns compact for low/unknown RAM', () => {
    assert.equal(recommendTier(4).id, 'compact');
    assert.equal(recommendTier(0).id, 'compact');
    assert.equal(recommendTier(NaN).id, 'compact');
    assert.equal(recommendTier(null).id, 'compact');
  });

  it('MODEL_TIERS has exactly 3 entries', () => {
    assert.equal(MODEL_TIERS.length, 3);
  });

  it('tiers are ordered by minRam ascending', () => {
    for (let i = 1; i < MODEL_TIERS.length; i++) {
      assert.ok(MODEL_TIERS[i].minRam > MODEL_TIERS[i - 1].minRam);
    }
  });
});
