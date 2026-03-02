import { seedFromString } from './rng.js';

export function deriveSequelInvocation(chronicle) {
  const seedBase = String(chronicle?.seed || 'seed');
  const canon = JSON.stringify(chronicle?.canonLog?.events ?? []);
  const derivedSeed = String(
    seedFromString(`${seedBase}|sequel|${canon}`)
  );

  const fate = Number(chronicle?.fate ?? 0.2);
  const primaryId = String(chronicle?.pack?.primaryId || 'fantasy');
  const mixerId =
    chronicle?.pack?.mixerId === null || chronicle?.pack?.mixerId === undefined
      ? null
      : String(chronicle.pack.mixerId);

  return {
    seed: derivedSeed,
    fate,
    campaignId: `campaign-${derivedSeed}`,
    pack: { primaryId, mixerId }
  };
}
