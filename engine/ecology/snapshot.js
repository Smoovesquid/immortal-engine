/**
 * Living ecology over time — Living-World Merge, Phase 3.
 *
 * A pure, deterministic projection of a biome's living state at a given day.
 * No stored ecosystem state (so worldHash stays replay-stable, no version bump):
 * each biome's prey/predator/scavenger levels are a function of (seed, biome, day),
 * drifting on slow seasonal cycles. As the world clock advances with travel, the
 * land shifts — herds thicken and thin, hunters grow bold, carrion gathers — and
 * the player notices it without any readout.
 *
 * Surfaced sparingly (most arrivals are quiet) via ecologyTravelLine().
 */

function h32(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
const unit = (seed, key) => (h32(`${seed}|${key}`) % 100000) / 100000; // 0..1
const clamp01 = v => Math.max(0, Math.min(1, v));

// A band's level at `day`: a per-biome baseline plus a slow seasonal oscillation.
// Deterministic and cheap (no iterated simulation).
function band(seed, biome, key, day) {
  const base = 0.30 + unit(seed, `${biome}|${key}|base`) * 0.40;     // 0.30..0.70
  const phase = unit(seed, `${biome}|${key}|phase`) * Math.PI * 2;
  const period = 24 + Math.floor(unit(seed, `${biome}|${key}|period`) * 40); // 24..64 day cycle
  const swing = Math.sin((Number(day) || 0) / period * Math.PI * 2 + phase) * 0.32;
  return clamp01(base + swing);
}

const tier = v => (v < 0.30 ? 'scarce' : v > 0.68 ? 'teeming' : 'steady');

/**
 * ecologySnapshot(seed, biome, day) -> { prey, predators, scavengers, dominant }
 * Levels are 0..1; `dominant` names the most salient feature for prose.
 */
export function ecologySnapshot(seed, biome, day = 0) {
  const b = String(biome || 'wilderness');
  const prey = band(seed, b, 'prey', day);
  const predators = band(seed, b, 'predators', day);
  const scavengers = band(seed, b, 'scavengers', day);
  // Salience: an extreme (scarce/teeming) reads as a noticeable state; pick the
  // strongest deviation from "steady".
  const dev = { prey: Math.abs(prey - 0.5), predators: Math.abs(predators - 0.5), scavengers: Math.abs(scavengers - 0.5) };
  let dominant = 'prey';
  if (dev.predators >= dev.prey && dev.predators >= dev.scavengers) dominant = 'predators';
  else if (dev.scavengers >= dev.prey && dev.scavengers >= dev.predators) dominant = 'scavengers';
  return { prey, predators, scavengers, dominant };
}

const LINES = {
  prey: {
    teeming: ['The herds are thick here this season — good grass has drawn them down.', 'Game is everywhere: tracks, droppings, the rustle of grazers in the brush.'],
    scarce: ['The land has gone quiet; the herds have thinned to nothing.', 'You see no game at all — something has driven it off, or eaten it out.'],
    steady: []
  },
  predators: {
    teeming: ['Something has been hunting here. You find tracks, and bones picked clean.', 'The hunters are bold this season — you are not the only thing that kills here.'],
    scarce: ['No predator sign for miles. Whatever ruled this ground is gone.', 'The hunters have moved on; the prey grow careless.'],
    steady: []
  },
  scavengers: {
    teeming: ['Carrion birds wheel overhead, patient and many. Something keeps dying here.', 'The air carries rot. The scavengers have grown fat on whatever fell.'],
    scarce: [],
    steady: []
  }
};

/**
 * ecologyTravelLine(seed, biome, day, nodeId) -> string ('' most of the time).
 * Sparse by design: roughly one arrival in four carries an ecology note, keyed on
 * node + day so the same arrival always reads the same way.
 */
export function ecologyTravelLine(seed, biome, day = 0, nodeId = '') {
  // Gate: ~1 in 4 arrivals speak of the living land.
  if (h32(`${seed}|ecoGate|${nodeId}|${Math.floor((Number(day) || 0))}`) % 4 !== 0) return '';
  const snap = ecologySnapshot(seed, biome, day);
  const lvl = snap[snap.dominant];
  const bank = (LINES[snap.dominant] || {})[tier(lvl)] || [];
  if (!bank.length) return '';
  return bank[h32(`${seed}|ecoLine|${nodeId}|${snap.dominant}`) % bank.length];
}
