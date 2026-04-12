// Rumor prompt builder — constructs LLM prompts for rumor minting at each tier.
// Pure, deterministic (no randomness, no side effects).
// NOTE: Garble-specific prompts live in ./garble.js (buildGarblePrompt).

const TIER_INSTRUCTIONS = [
  // Tier 0 — Truth
  'Restate this fact faithfully in the carrier\'s voice.',
  // Tier 1 — Fresh
  'Slightly alter the framing or motive, keep facts correct.',
  // Tier 2 — Distorted
  'Keep the general framing, but garble details and names.',
  // Tier 3 — Rumor
  'Reduce to a name, a direction, and an emotional tone.',
  // Tier 4 — Whisper
  'Reduce to vague dread. One sentence maximum.'
];

/**
 * buildRumorPrompt({ seed, tier, carrier, tone }) -> string
 *
 * seed:    { id, primaryName, direction, tags[], truthBody }
 * tier:    0-4
 * carrier: { name, archetype, sophistication, traits }
 * tone:    string (from pack)
 */
export function buildRumorPrompt({ seed, tier, carrier, tone }) {
  const t = Math.max(0, Math.min(4, Math.trunc(Number(tier) || 0)));
  const instruction = TIER_INSTRUCTIONS[t];

  const seedName = String(seed?.primaryName || seed?.id || 'unknown');
  const seedDir = String(seed?.direction || 'somewhere');
  const truthBody = String(seed?.truthBody || '');
  const tags = Array.isArray(seed?.tags) ? seed.tags.map(String).join(', ') : '';

  const carrierName = String(carrier?.name || 'someone');
  const carrierArch = String(carrier?.archetype || 'commoner');
  const carrierSoph = Number(carrier?.sophistication ?? 2);

  const toneHint = tone ? `The world's tone is "${tone}".` : '';

  return [
    `You are generating a rumor for a tabletop RPG.`,
    ``,
    `ORIGINAL FACT:`,
    `- Subject: ${seedName}`,
    `- Direction: ${seedDir}`,
    `- Tags: ${tags || 'none'}`,
    truthBody ? `- Truth: ${truthBody}` : '',
    ``,
    `CARRIER NPC:`,
    `- Name: ${carrierName}`,
    `- Role: ${carrierArch}`,
    `- Sophistication: ${carrierSoph}/4 (higher = more perceptive)`,
    ``,
    toneHint,
    ``,
    `DISTORTION TIER: ${t} (0=truth, 4=whisper)`,
    `INSTRUCTION: ${instruction}`,
    ``,
    `Reply with JSON: { "body": "the rumor text" }`,
    `Keep the body under 120 characters.`
  ].filter(Boolean).join('\n');
}
