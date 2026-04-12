// NPC Memory extraction — after each meaningful dialogue interaction,
// extract a 1-sentence memory from the NPC's perspective.
// Tries local LLM first, falls back to deterministic template.
//
// Pass D2 adds structured memory entries with turn + salience, plus
// decay and consolidation functions for natural NPC recall.

// ── Helpers ─────────────────────────────────────────────────────────────────

function clamp01(v) {
  const x = Number(v);
  return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

const IMPORTANT_RE = /\b(secret|betray|attack|death|treasure|kill|danger|warn|promise|oath)\b/i;

// ── Normalize ───────────────────────────────────────────────────────────────

/**
 * normalizeMemoryEntry(entry) → { text, turn, salience }
 * Normalizes a memory entry from string or object form.
 */
export function normalizeMemoryEntry(entry) {
  if (typeof entry === 'string') {
    return { text: entry, turn: 0, salience: 1.0 };
  }
  if (entry && typeof entry === 'object') {
    return {
      text: String(entry.text || ''),
      turn: Number.isFinite(Number(entry.turn)) ? Math.max(0, Math.trunc(Number(entry.turn))) : 0,
      salience: clamp01(entry.salience ?? 1.0)
    };
  }
  return { text: '', turn: 0, salience: 0 };
}

// ── Decay ───────────────────────────────────────────────────────────────────

/**
 * decayMemories(memories, currentTurn) → memory[]
 *
 * Reduces salience of memories based on age. Pure and deterministic.
 * - Memories lose 0.1 salience per 5 turns of age.
 * - Minimum salience is 0.1 (memories never fully vanish, just get very dim).
 * - "Important" memories (containing keywords like 'secret', 'betrayal',
 *   'attack', 'death', 'treasure') decay at half rate.
 *
 * @param {Array} memories - array of memory entries (string or object)
 * @param {number} currentTurn - current world turn
 * @returns {Array} - new array of normalized memory objects with updated salience
 */
export function decayMemories(memories, currentTurn) {
  const list = Array.isArray(memories) ? memories : [];
  const turn = Number.isFinite(Number(currentTurn)) ? Math.max(0, Math.trunc(Number(currentTurn))) : 0;

  return list.map(entry => {
    const m = normalizeMemoryEntry(entry);
    if (!m.text) return m;

    const age = Math.max(0, turn - m.turn);
    const isImportant = IMPORTANT_RE.test(m.text);
    const decayRate = isImportant ? 0.05 : 0.1; // per 5 turns
    const decayAmount = Math.floor(age / 5) * decayRate;
    const newSalience = Math.max(0.1, m.salience - decayAmount);

    return { ...m, salience: round2(newSalience) };
  });
}

// ── Consolidation ───────────────────────────────────────────────────────────

/**
 * consolidateMemories(memories) → memory[]
 *
 * Merges old low-salience memories with similar content into summary entries.
 * Pure and deterministic.
 *
 * Rules:
 * - Only consolidate memories with salience <= 0.3.
 * - Group by extracted topic key.
 * - If a group has 2+ entries, merge into one summary entry.
 * - Summary text: "{name} had several conversations about {topic}."
 * - Consolidated entries get salience = max of group's salience values.
 * - High-salience memories (> 0.3) are never consolidated.
 *
 * @param {Array} memories - array of normalized memory objects
 * @returns {Array} - new array with consolidated entries
 */
export function consolidateMemories(memories) {
  const list = Array.isArray(memories) ? memories : [];
  const normalized = list.map(normalizeMemoryEntry);

  const keep = [];     // salience > 0.3 — never consolidated
  const eligible = []; // salience <= 0.3 — candidates for consolidation

  for (const m of normalized) {
    if (!m.text) continue;
    if (m.salience > 0.3) {
      keep.push(m);
    } else {
      eligible.push(m);
    }
  }

  if (eligible.length < 2) return [...keep, ...eligible];

  // Group by extracted topic key
  const groups = new Map();
  for (const m of eligible) {
    const key = extractGroupKey(m.text);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }

  const consolidated = [];
  for (const [key, group] of groups) {
    if (group.length < 2) {
      consolidated.push(...group);
      continue;
    }
    // Merge the group into a single summary
    const maxSalience = Math.max(...group.map(m => m.salience));
    const latestTurn = Math.max(...group.map(m => m.turn));
    // Extract the NPC name from the first entry
    const nameMatch = group[0].text.match(/^(\S+)/);
    const name = nameMatch ? nameMatch[1] : 'They';

    consolidated.push({
      text: `${name} had several conversations about ${key}.`,
      turn: latestTurn,
      salience: round2(maxSalience)
    });
  }

  return [...keep, ...consolidated];
}

function extractGroupKey(text) {
  // Extract the topic — look for "about {topic}" or "discussed {topic}"
  const aboutMatch = text.match(/(?:about|discussed|regarding)\s+([a-z_]+(?:\s+[a-z_]+)?)/i);
  if (aboutMatch) return aboutMatch[1].toLowerCase().replace(/\s+/g, '_');

  // Fallback: first significant word
  const words = text.split(/\s+/).filter(w => w.length >= 4 && !/^(with|from|that|this|the|trust|traveler)$/i.test(w));
  return words[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'general';
}

// ── Initial salience ────────────────────────────────────────────────────────

function computeInitialSalience(outcome) {
  const mode = String(outcome?.mode || '');
  if (mode === 'recruited') return 1.0;
  if (mode === 'shared') return 0.9;
  if (mode === 'withheld' || mode === 'lied') return 0.8;
  if (mode === 'refused-soft' || mode === 'refused-hard') return 0.7;
  return 0.6; // deflected
}

// ── Extract memory ──────────────────────────────────────────────────────────

/**
 * extractMemory(npc, playerInput, decision, outcome, currentTurn?) → { text, turn, salience } | null
 *
 * After each askNpc interaction that produces a meaningful outcome,
 * extract a structured memory entry.
 *
 * @param {object} npc - the NPC object
 * @param {string} playerInput - what the player said
 * @param {object} decision - the brain decision (share/mood/approach/why)
 * @param {object} outcome - the dialogue outcome (mode, topic, trustDelta, etc.)
 * @param {number} [currentTurn=0] - current world turn for timestamping
 * @returns {{ text: string, turn: number, salience: number }|null}
 */
export function extractMemory(npc, playerInput, decision, outcome, currentTurn = 0) {
  // No memory for deflected interactions with no topic
  if (!outcome || (outcome.mode === 'deflected' && !outcome.topic)) return null;

  const text = buildDeterministicMemory(npc, playerInput, decision, outcome);
  return { text, turn: currentTurn, salience: computeInitialSalience(outcome) };
}

/**
 * extractMemoryWithLlm(npc, playerInput, decision, outcome, queryLocal) → string | null
 *
 * Async version that tries local LLM first, falls back to deterministic.
 */
export async function extractMemoryWithLlm(npc, playerInput, decision, outcome, queryLocal, currentTurn = 0) {
  if (!outcome || (outcome.mode === 'deflected' && !outcome.topic)) return null;

  if (typeof queryLocal === 'function') {
    try {
      const prompt = `Summarize what just happened between ${npc.name} and the player in one sentence, from ${npc.name}'s perspective. Context: The player said "${playerInput}". ${npc.name} ${outcome.mode === 'shared' ? 'shared information' : outcome.mode === 'withheld' ? 'withheld information' : outcome.mode === 'lied' ? 'lied' : 'deflected'}${outcome.topic ? ` about ${outcome.topic}` : ''}. Reply as JSON: { "memory": "..." }`;
      const resp = await queryLocal({ prompt, schema: { memory: 'string' }, timeout: 2000 });
      if (resp && resp.ok && resp.result && typeof resp.result.memory === 'string') {
        const mem = resp.result.memory.trim();
        if (mem.length > 0 && mem.length <= 200) {
          return { text: mem, turn: currentTurn, salience: computeInitialSalience(outcome) };
        }
      }
    } catch {
      // Silent fallback
    }
  }

  const text = buildDeterministicMemory(npc, playerInput, decision, outcome);
  return { text, turn: currentTurn, salience: computeInitialSalience(outcome) };
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
