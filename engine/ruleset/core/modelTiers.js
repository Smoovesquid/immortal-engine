// Model Tier Recommendation — maps available RAM to recommended local LLM model.
// Pure data + pure function. No side effects, no imports.

export const MODEL_TIERS = [
  {
    id: 'compact',
    name: 'Compact',
    minRam: 8,
    model: 'phi3:3.8b',
    contextWindow: 2048,
    description: 'Phi-3 3.8B — fits 8GB machines, fast inference, basic NPC decisions'
  },
  {
    id: 'standard',
    name: 'Standard',
    minRam: 16,
    model: 'llama3.1:8b',
    contextWindow: 4096,
    description: 'Llama 3.1 8B — recommended for 16GB, good NPC personality + rumor garbling'
  },
  {
    id: 'enhanced',
    name: 'Enhanced',
    minRam: 24,
    model: 'llama3.1:14b',
    contextWindow: 8192,
    description: 'Llama 3.1 14B — 24GB+, richer NPC reasoning + longer context for memory'
  }
];

/**
 * recommendTier(ramGB) → tier object
 *
 * Returns the highest-capability tier that fits the given RAM.
 * Falls back to 'compact' if RAM is unknown or very low.
 *
 * @param {number} ramGB - available system RAM in gigabytes
 * @returns {object} - matching tier from MODEL_TIERS
 */
export function recommendTier(ramGB) {
  const ram = Number(ramGB);
  if (!Number.isFinite(ram) || ram < 8) return MODEL_TIERS[0];

  // Find the highest tier that fits
  let best = MODEL_TIERS[0];
  for (const tier of MODEL_TIERS) {
    if (ram >= tier.minRam) best = tier;
  }
  return best;
}
