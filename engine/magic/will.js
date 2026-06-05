/**
 * Hidden Will — magic shaped by deeds, never by a menu.
 *
 * Thelemic at root: magic is Will made manifest, and Will is the residue of what
 * you repeatedly DO. There is no skill tree, no allocation, no readout. Every
 * logged deed nudges a hidden affinity toward the mode of will it embodies
 * (burning -> the Unbound Flame / evocation; sparing -> the Warden / abjuration;
 * investigating -> the Open Eye / divination; coercing -> the Crowned Tongue /
 * enchantment; ...). When you cast, your shaped Will quietly raises or lowers the
 * spell's success — and forcing a school against a strong contrary Will can make
 * it BACKFIRE. The player never sees a number; only the DM's description of how
 * the magic *feels*.
 *
 * Will is a PROJECTION over the action history (Canon Log / timeline) — not stored
 * state — so it is deterministic, replay-stable, and adds nothing to worldHash.
 */

import { makeRng, seedFromString } from '../rng.js';

export const SCHOOLS = ['evocation', 'abjuration', 'restoration', 'enchantment', 'illusion', 'necromancy', 'divination', 'conjuration', 'transmutation', 'chronomancy'];
const DECAY = 0.985; // slow memory with a recency bias — a self that can still be turned

const KEYWORDS = {
  evocation: ['burn', 'blast', 'destroy', 'slay', 'kill', 'strike', 'attack', 'fire', 'explod', 'smite', 'rage', 'wrath', 'shatter', 'fought'],
  abjuration: ['shield', 'ward', 'protect', 'defend', 'guard', 'block', 'spare', 'save', 'hold', 'brace', 'parry', 'cover', 'shelter'],
  restoration: ['heal', 'mend', 'tend', 'cure', 'soothe', 'nurse', 'restore', 'revive', 'help', 'comfort', 'aid'],
  enchantment: ['persuade', 'charm', 'command', 'coerce', 'intimidate', 'dominate', 'lie', 'deceive', 'beguile', 'order', 'demand', 'bribe', 'threaten'],
  illusion: ['sneak', 'hide', 'disguise', 'feint', 'vanish', 'conceal', 'trick', 'mask', 'slip', 'stealth', 'ambush', 'lurk'],
  necromancy: ['raise', 'corpse', 'dead', 'grave', 'desecrate', 'rot', 'drain', 'curse', 'bone', 'undead', 'bleed'],
  divination: ['search', 'inspect', 'investigat', 'examine', 'study', 'scry', 'read', 'ask', 'learn', 'listen', 'observe', 'seek', 'look', 'discover'],
  conjuration: ['summon', 'call', 'bargain', 'deal', 'trade', 'recruit', 'offer', 'conjure', 'barter', 'pact'],
  transmutation: ['craft', 'forge', 'brew', 'transform', 'change', 'shape', 'melt', 'alter', 'build', 'mix'],
  chronomancy: ['wait', 'delay', 'rush', 'hasten', 'flee', 'retreat', 'stall', 'linger', 'hurry']
};

// classifyDeed(event) -> { school: weight } from the deed's text/intent/tags.
export function classifyDeed(event) {
  const d = event && event.data || {};
  const text = String(d.text || d.intent || d.input || event && event.text || '').toLowerCase();
  const tags = (event && event.tags) || d.tags || [];
  const out = {};
  for (const t of tags) { const s = String(t).toLowerCase(); if (SCHOOLS.includes(s)) out[s] = (out[s] || 0) + 2; }
  if (text) for (const s of SCHOOLS) for (const kw of KEYWORDS[s]) if (text.includes(kw)) { out[s] = (out[s] || 0) + 1; break; }
  return out;
}

// willProfile(world) -> { raw, profile (0..1, normalized to the dominant), dominant }
export function willProfile(world) {
  const events = (world && Array.isArray(world.timeline) ? world.timeline : []);
  const raw = {}; for (const s of SCHOOLS) raw[s] = 0;
  const n = events.length;
  for (let i = 0; i < n; i++) {
    const w = Math.pow(DECAY, n - 1 - i), sig = classifyDeed(events[i]);
    for (const s of Object.keys(sig)) raw[s] += w * sig[s];
  }
  let max = 0, dominant = null; for (const s of SCHOOLS) if (raw[s] > max) { max = raw[s]; dominant = s; }
  const profile = {}; for (const s of SCHOOLS) profile[s] = max > 0 ? raw[s] / max : 0;
  return { raw, profile, dominant, intensity: max };
}

const FEEL = {
  eager: 'The power leaps to your hand before the word is done.',
  willing: 'The working answers, steady and sure.',
  reluctant: 'It comes slowly, as if through deep water.',
  cold: 'The will is not in you; the spell gutters at the edge of forming.',
  recoils: 'Something in you refuses — the magic turns on its maker.'
};

// castAffinity(profile, school) -> { affinity, mod, dissonance, backfireChance, feel }
export function castAffinity(profileObj, school) {
  const p = profileObj.profile || {};
  const a = p[school] || 0;            // 0..1 how shaped you are for this mode
  const dom = profileObj.dominant ? (p[profileObj.dominant] || 0) : 0; // ~1 when you have any identity
  const dissonance = Math.max(0, dom - a); // strongly something else, weak here
  const backfireChance = dissonance > 0.55 ? Math.min(0.3, (dissonance - 0.55) * 0.6) : 0;
  let feel = 'cold';
  if (a > 0.7) feel = 'eager'; else if (a > 0.4) feel = 'willing'; else if (a > 0.18) feel = 'reluctant'; else if (dissonance > 0.6) feel = 'recoils';
  return { affinity: a, mod: a - 0.4, dissonance, backfireChance, feel, feelText: FEEL[feel] };
}

// applyWillToCast({ world, school, baseSuccess, nonce, seed }) -> { success, cast, backfired, feel, feelText, affinity }
export function applyWillToCast({ world, school, baseSuccess = 0.6, nonce = 0, seed } = {}) {
  const prof = willProfile(world);
  const aff = castAffinity(prof, school);
  const success = Math.max(0.05, Math.min(0.97, baseSuccess + aff.mod * 0.4));
  const wseed = (world && world.meta && world.meta.seed) || seed || 'will';
  const rng = makeRng(seedFromString(`${wseed}|will|${nonce}|${school}`));
  const cast = rng.nextFloat() < success;
  const backfired = !cast && aff.backfireChance > 0 && rng.nextFloat() < aff.backfireChance;
  return { success, cast, backfired, feel: aff.feel, feelText: aff.feelText, affinity: aff.affinity, dissonance: aff.dissonance };
}
