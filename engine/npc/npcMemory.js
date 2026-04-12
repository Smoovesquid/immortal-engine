// NPC Memory extraction — after each meaningful dialogue interaction,
// extract a 1-sentence memory from the NPC's perspective.
// Tries local LLM first, falls back to deterministic template.

/**
 * extractMemory(npc, playerInput, decision, outcome) → string | null
 *
 * After each askNpc interaction that produces a meaningful outcome,
 * extract a 1-sentence memory.
 *
 * @param {object} npc - the NPC object
 * @param {string} playerInput - what the player said
 * @param {object} decision - the brain decision (share/mood/approach/why)
 * @param {object} outcome - the dialogue outcome (mode, topic, trustDelta, etc.)
 * @returns {string|null} - memory string or null if no meaningful memory
 */
export function extractMemory(npc, playerInput, decision, outcome) {
  // No memory for deflected interactions with no topic
  if (!outcome || (outcome.mode === 'deflected' && !outcome.topic)) return null;

  return buildDeterministicMemory(npc, playerInput, decision, outcome);
}

/**
 * extractMemoryWithLlm(npc, playerInput, decision, outcome, queryLocal) → string | null
 *
 * Async version that tries local LLM first, falls back to deterministic.
 */
export async function extractMemoryWithLlm(npc, playerInput, decision, outcome, queryLocal) {
  if (!outcome || (outcome.mode === 'deflected' && !outcome.topic)) return null;

  if (typeof queryLocal === 'function') {
    try {
      const prompt = `Summarize what just happened between ${npc.name} and the player in one sentence, from ${npc.name}'s perspective. Context: The player said "${playerInput}". ${npc.name} ${outcome.mode === 'shared' ? 'shared information' : outcome.mode === 'withheld' ? 'withheld information' : outcome.mode === 'lied' ? 'lied' : 'deflected'}${outcome.topic ? ` about ${outcome.topic}` : ''}. Reply as JSON: { "memory": "..." }`;
      const resp = await queryLocal({ prompt, schema: { memory: 'string' }, timeout: 2000 });
      if (resp && resp.ok && resp.result && typeof resp.result.memory === 'string') {
        const mem = resp.result.memory.trim();
        if (mem.length > 0 && mem.length <= 200) return mem;
      }
    } catch {
      // Silent fallback
    }
  }

  return buildDeterministicMemory(npc, playerInput, decision, outcome);
}

/**
 * buildDeterministicMemory(npc, playerInput, decision, outcome) → string
 *
 * Template-based fallback. Same inputs → same output (deterministic).
 */
function buildDeterministicMemory(npc, playerInput, decision, outcome) {
  const name = String(npc?.name || 'Someone');
  const topic = outcome.topic || 'general matters';
  const trust = Number(outcome.trustLevel ?? npc?.conversationState?.trustLevel ?? 5);
  const mode = String(outcome.mode || 'deflected');

  switch (mode) {
    case 'shared':
      return `${name} discussed ${topic} with the traveler (trust: ${trust}).`;
    case 'withheld':
      return `${name} withheld information about ${topic} from the traveler (trust: ${trust}).`;
    case 'lied':
      return `${name} misled the traveler about ${topic} (trust: ${trust}).`;
    case 'recruited':
      return `${name} agreed to travel with the adventurer.`;
    case 'refused-soft':
    case 'refused-hard':
      return `${name} refused the traveler's invitation (trust: ${trust}).`;
    default:
      return `${name} spoke with the traveler about ${topic} (trust: ${trust}).`;
  }
}
