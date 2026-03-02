import { stableStringify } from './log.js';
import { seedFromString, makeRng } from './rng.js';

function normalizeMythInput(mythInput) {
  if (mythInput === null || mythInput === undefined) return { text: '' };
  if (typeof mythInput === 'string') return { text: String(mythInput) };
  if (typeof mythInput === 'object') {
    // Ensure a stable, JSON-safe form (key order controlled by stableStringify downstream).
    try { return JSON.parse(JSON.stringify(mythInput)); } catch { return { text: String(mythInput) }; }
  }
  return { text: String(mythInput) };
}

function roundFate01(fate) {
  const n = Number(fate);
  if (!Number.isFinite(n)) return 0;
  const clamped = Math.max(0, Math.min(1, n));
  return Math.round(clamped * 100);
}

export function buildMythSpec({ seed = 'seed', pack = { primaryId: 'fantasy', mixerId: null }, fate = 0.2, mythInput = '' } = {}) {
  const primaryId = String(pack?.primaryId || 'fantasy');
  const mixerId = pack?.mixerId ? String(pack.mixerId) : null;
  const myth = normalizeMythInput(mythInput);

  const baseKey = [
    String(seed),
    'mythSpec',
    `p:${primaryId}`,
    `m:${mixerId || ''}`,
    `f:${roundFate01(fate)}`,
    `myth:${stableStringify(myth)}`
  ].join('|');

  const rng = makeRng(seedFromString(baseKey));

  // Contract-y, deterministic, minimal text/data.
  const motifsPool = ['ash', 'oath', 'hunger', 'iron', 'salt', 'thorn', 'veil', 'bell', 'cinder', 'glass'];
  const themesPool = ['duty', 'betrayal', 'mercy', 'courage', 'debt', 'exile', 'inheritance', 'sacrifice'];
  const archetypesPool = ['pilgrim', 'warden', 'heretic', 'oracle', 'mercenary', 'survivor', 'scavenger', 'healer'];
  const prohibitionsPool = ['no bargains', 'no retreat', 'no mercy', 'no witnesses', 'no fire', 'no names'];
  const promisesPool = ['a way opens', 'the dead answer', 'the map remembers', 'a debt comes due', 'the door yields', 'the truth costs'];

  function pickN(pool, n) {
    const out = [];
    const seen = new Set();
    while (out.length < n && seen.size < pool.length) {
      const v = String(rng.pick(pool) || '');
      if (!v || seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
    return out;
  }

  const motifs = pickN(motifsPool, 3);
  const themes = pickN(themesPool, 2);
  const archetypes = pickN(archetypesPool, 2);

  const prohibitions = pickN(prohibitionsPool, 2);
  const promises = pickN(promisesPool, 2);

  const tonePool = ['plain', 'grim', 'mythic'];
  const registerPool = ['low', 'mid', 'high'];

  const spec = {
    v: 1,
    inputs: {
      seed: String(seed),
      pack: { primaryId, mixerId },
      fate: Math.max(0, Math.min(1, Number(fate) || 0)),
      myth
    },
    motifs: motifs.slice().sort(),
    themes: themes.slice().sort(),
    archetypes: archetypes.slice().sort(),
    prohibitions: prohibitions.slice().sort(),
    promises: promises.slice().sort(),
    pressureBias: {
      dread: Number((rng.nextFloat() * 0.35).toFixed(3)),
      pressure: Number((rng.nextFloat() * 0.35).toFixed(3)),
      revelation: Number((rng.nextFloat() * 0.35).toFixed(3))
    },
    tone: String(rng.pick(tonePool) || 'plain'),
    register: String(rng.pick(registerPool) || 'mid')
  };

  return spec;
}

export function mythSpecJson(spec) {
  return stableStringify(spec);
}

export function mythSpecHash(spec) {
  // Deterministic int hash, rendered as a string.
  return String(seedFromString(mythSpecJson(spec)));
}
