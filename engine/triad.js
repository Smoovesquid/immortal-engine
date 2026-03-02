import { seedFromString, makeRng } from './rng.js';
import { mythSpecHash } from './mythSpec.js';

export function generateTriadFrames(mythSpec) {
  const h = mythSpecHash(mythSpec);
  const rng = makeRng(seedFromString(`${h}|triad|v1`));

  const lensPool = ['Oath', 'Hunger', 'Ash', 'Veil', 'Iron', 'Salt'];
  const stancePool = ['Approach', 'Endure', 'Confront'];
  const costPool = ['Time', 'Wounds', 'Revelation', 'Debt', 'Isolation', 'Fear'];

  const frames = [];
  for (let i = 0; i < 3; i++) {
    const lens = String(rng.pick(lensPool) || 'Oath');
    const stance = String(rng.pick(stancePool) || 'Approach');
    const cost = String(rng.pick(costPool) || 'Time');

    frames.push({
      i,
      id: `frame_${i}_${seedFromString(`${h}|frame|${i}`)}`,
      lens,
      stance,
      cost,
      blurb: `${lens}/${stance} (cost:${cost})`
    });
  }
  return frames;
}

export function deriveInvocationFromFrame({ baseSeed = 'seed', pack = { primaryId: 'fantasy', mixerId: null }, fate = 0.2, mythSpec, frameIndex = 0 } = {}) {
  const i = Math.max(0, Math.min(2, Number(frameIndex) || 0));
  const h = mythSpecHash(mythSpec);
  const derivedSeed = String(seedFromString(`${String(baseSeed)}|gate4|frame:${i}|myth:${h}`));

  const primaryId = String(pack?.primaryId || 'fantasy');
  const mixerId = pack?.mixerId ? String(pack.mixerId) : null;

  return {
    seed: derivedSeed,
    fate: Number(fate),
    campaignId: `campaign-${derivedSeed}`,
    pack: { primaryId, mixerId }
  };
}
