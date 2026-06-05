/**
 * The price of forbidden Will. Magic costs not mana but MISALIGNMENT.
 *
 * Casting in harmony with your shaped Will is clean. Coercing another's will
 * (the Crowned Tongue on the unwilling), dragging back the unwilling dead, or
 * turning the forbidden Hour stains the world — corruption and instability rise,
 * scars form — and casting hard against your own nature frays your Will. This is
 * what ties magic to the living ecology: power has a price the *world* pays.
 *
 * PURE: returns deltas + reasons; applyCastCost returns a new world (no mutation).
 */

import { willProfile, castAffinity } from './will.js';
import { isCoercive, isForbidden, ascendantAeon } from './cosmology.js';

// castMoralCost({ world, school, againstUnwilling }) ->
//   { corruption, instability, scar, fray, reasons:[] }
export function castMoralCost({ world, school, againstUnwilling = false } = {}) {
  const cost = { corruption: 0, instability: 0, scar: null, fray: 0, reasons: [] };
  const prof = willProfile(world || {});
  const aff = castAffinity(prof, school);

  if (isCoercive(school) && againstUnwilling) {
    cost.corruption += school === 'enchantment' ? 6 : 4; // overriding a True Will is the great sin
    cost.reasons.push(school === 'enchantment' ? 'you bent an unwilling will' : 'you forced the unwilling');
    if (cost.corruption >= 6) cost.scar = 'will_broken';
  }
  if (isForbidden(school)) { cost.corruption += 3; cost.instability += 3; cost.reasons.push('you turned the forbidden Hour'); }

  // dissonance: forcing a school against a strong contrary self frays you and leaks a little rot
  if (aff.dissonance > 0.5) { cost.fray += Math.round(aff.dissonance * 4); cost.corruption += 1; cost.reasons.push('the working fought your nature'); }

  // the Aeon's blessed school is gentler; its taboo costs more this age
  const aeon = ascendantAeon((world && world.meta && world.meta.seed) || 'world');
  if (school === aeon.taboo && cost.corruption > 0) { cost.corruption += 1; cost.reasons.push(`this age abhors ${school}`); }

  return cost;
}

// applyCastCost(world, cost) -> new world with ecology stained + an optional scar.
export function applyCastCost(world, cost) {
  if (!world) return world;
  const e = world.ecology || { corruption: 0, instability: 0, scarcity: 0 };
  const clamp = n => Math.max(0, Math.min(100, n));
  const ecology = { ...e, corruption: clamp((e.corruption || 0) + (cost.corruption || 0)), instability: clamp((e.instability || 0) + (cost.instability || 0)) };
  let w = { ...world, ecology };
  if (cost.scar) { const scars = Array.isArray(world.scars) ? world.scars.slice() : []; if (!scars.some(s => s.id === cost.scar)) scars.push({ id: cost.scar, description: 'A will was broken here by magic.', source: 'magic' }); w = { ...w, scars }; }
  return w;
}
