/*
Gate 3.1 — Regional World Contract (Packet 1)

Deterministic region + faction personality scaffolding.
No integration into state/map yet.
Pure generation utilities.
*/

import crypto from 'node:crypto';

function hashInt(seed, salt, mod) {
  const h = crypto
    .createHash('sha256')
    .update(String(seed) + '::' + String(salt))
    .digest('hex');
  const n = parseInt(h.slice(0, 8), 16);
  return n % mod;
}

const PERSONALITY_AXES = [
  'scarcity',
  'curiosity',
  'dominance',
  'mercy',
  'paranoia',
  'honor',
  'corruption',
  'isolation'
];

export function generateFactionVector(seed, regionIndex) {
  const vector = {};
  for (let i = 0; i < PERSONALITY_AXES.length; i++) {
    const axis = PERSONALITY_AXES[i];
    vector[axis] = hashInt(seed, `faction-${regionIndex}-${axis}`, 6); // 0–5
  }
  return vector;
}

export function generateRegionThemeVector(seed, regionIndex, tier) {
  return {
    regionId: `region-${regionIndex}`,
    tier, // origin | mid | high | anomaly
    toneBias: hashInt(seed, `tone-${regionIndex}`, 5),
    baseHostility:
      tier === 'origin' ? 0 :
      tier === 'mid' ? 2 :
      tier === 'high' ? 4 :
      3,
    baseInstability:
      tier === 'origin' ? 0 :
      tier === 'mid' ? 2 :
      tier === 'high' ? 4 :
      3,
    scarDensityBaseline: hashInt(seed, `scar-${regionIndex}`, 4),
    environmentalModifier: hashInt(seed, `env-${regionIndex}`, 5),
    factionVector: generateFactionVector(seed, regionIndex)
  };
}

export function generateRegions(seed) {
  const tiers = ['origin', 'mid', 'mid', 'high', 'anomaly'];
  return tiers.map((tier, i) =>
    generateRegionThemeVector(seed, i, tier)
  );
}
