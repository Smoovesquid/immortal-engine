// Rumor garbling — distorts tier-0 truth according to tier level and
// carrier personality. Tries local LLM first, falls back to deterministic
// template. Never throws.

/**
 * garbleRumor(originalBody, tier, carrierTraits) → string
 *
 * Synchronous deterministic fallback. Always produces a result.
 *
 * @param {string} originalBody — the tier-0 truth text
 * @param {number} tier — distortion level 0-4
 * @param {object} carrierTraits — { honesty, trustOfOutsiders, selfPreservation }
 * @returns {string} — garbled body
 */
export function garbleRumor(originalBody, tier, carrierTraits) {
  const body = String(originalBody || '').trim();
  if (!body) return '';
  if (tier <= 0) return body; // tier 0 = truth, no garbling

  const traits = carrierTraits && typeof carrierTraits === 'object' ? carrierTraits : {};
  const honesty = Number(traits.honesty ?? 0.5);

  // Tier 1: slight rewording — swap specifics for vague terms
  if (tier === 1) {
    return `They say ${lowerFirst(body)}`;
  }

  // Tier 2: correct framing, wrong details
  if (tier === 2) {
    if (honesty < 0.3) {
      return `I heard something about that — though who can say what's true anymore.`;
    }
    return `Word is, something like that happened — the details get muddled in the telling.`;
  }

  // Tier 3: vague impression, garbled
  if (tier === 3) {
    return `There are whispers... something about ${extractKeyPhrase(body)}. Can't say more than that.`;
  }

  // Tier 4: pure dread, almost no info
  return `Something dark stirs. Best not to ask too many questions.`;
}

/**
 * garbleRumorWithLlm(originalBody, tier, carrierTraits, queryLocalFn) → Promise<string>
 *
 * Async version. Tries local LLM for richer garbling, falls back to deterministic.
 * Never throws.
 */
export async function garbleRumorWithLlm(originalBody, tier, carrierTraits, queryLocalFn) {
  const body = String(originalBody || '').trim();
  if (!body || tier <= 0) return garbleRumor(originalBody, tier, carrierTraits);

  if (typeof queryLocalFn === 'function') {
    try {
      const prompt = buildGarblePrompt(originalBody, tier, carrierTraits);
      const resp = await queryLocalFn({ prompt, schema: { body: 'string' }, timeout: 2000 });
      if (resp && resp.ok && resp.result && typeof resp.result.body === 'string') {
        const garbled = resp.result.body.trim();
        if (garbled.length > 0 && garbled.length <= 300 && garbled !== body) {
          return garbled;
        }
      }
    } catch {
      // Silent fallback
    }
  }

  return garbleRumor(originalBody, tier, carrierTraits);
}

/**
 * buildGarblePrompt(originalBody, tier, carrierTraits) → string
 *
 * Builds the LLM prompt for garbling. Exported for testing.
 */
export function buildGarblePrompt(originalBody, tier, carrierTraits) {
  const traits = carrierTraits && typeof carrierTraits === 'object' ? carrierTraits : {};
  const honesty = Number(traits.honesty ?? 0.5);
  const selfPres = Number(traits.selfPreservation ?? 0.5);

  const tierRules = {
    1: 'Slightly reword: keep the core truth but add hedging language ("they say", "I heard"). Do not change factual content.',
    2: 'Correct framing, wrong details: keep the general topic but swap names, numbers, or directions. The listener should get the gist but not the specifics.',
    3: 'Vague impression: reduce to a feeling or hint. Strip most specifics. The listener should sense something but not know what.',
    4: 'Pure dread: reduce to a single ominous sentence. Almost no factual content. Just unease.'
  };

  const personalityHint = honesty < 0.3
    ? 'The carrier is a practiced liar — they might embellish or self-servingly distort.'
    : selfPres > 0.7
    ? 'The carrier is cautious — they downplay anything that might bring trouble.'
    : 'The carrier retells casually.';

  return `Rewrite this fact at fidelity tier ${tier}:
Original: "${originalBody}"
Tier ${tier} rules: ${tierRules[tier] || tierRules[4]}
Carrier personality: ${personalityHint}

Reply as JSON:
{ "body": "the garbled version" }`;
}

// Helper: lowercase first character
function lowerFirst(s) {
  if (!s) return '';
  return s.charAt(0).toLowerCase() + s.slice(1);
}

// Helper: extract a key phrase (first 3-5 meaningful words) from the body
export function extractKeyPhrase(body) {
  const words = String(body || '').split(/\s+/).filter(w => w.length >= 3);
  if (words.length === 0) return 'unknown matters';
  return words.slice(0, Math.min(4, words.length)).join(' ').toLowerCase().replace(/[.,!?;:]+$/, '');
}
