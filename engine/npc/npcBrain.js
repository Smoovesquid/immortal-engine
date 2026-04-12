// NPC Brain — personality-aware decision-making via local LLM, with
// deterministic rule-based fallback. Never throws. Never mutates state.
//
// Three exports:
//   buildNpcContext(npc, world, playerInput) → context object
//   queryBrain(context, opts)               → NpcDecision | null
//   fallbackRules(context)                  → NpcDecision (deterministic)
//
// Decisions are canonized in Canon Log for replay fidelity.

import { makeRng, seedFromString } from '../rng.js';
import { gatherNpcKnowledge } from './perspectiveFilter.js';

// ── Mood + Approach enums ───────────────────────────────────────────────────

const VALID_MOODS = new Set(['wary', 'warm', 'hostile', 'fearful', 'amused']);
const VALID_APPROACHES = new Set(['volunteer', 'wait_to_be_asked', 'deflect', 'lie']);

// ── Context builder ─────────────────────────────────────────────────────────

/**
 * deriveMood(npc, world) → string
 * Derive a mood tag from NPC trust + personality + recent events.
 */
function deriveMood(npc, world) {
  const trust = Number(npc.conversationState?.trustLevel ?? 5);
  const honesty = Number(npc.personality?.honesty ?? 0.5);
  const selfPres = Number(npc.personality?.selfPreservation ?? 0.5);

  if (trust >= 7) return 'warm';
  if (trust <= 1) return 'hostile';
  if (trust <= 3 && selfPres > 0.6) return 'fearful';
  if (trust <= 3) return 'wary';
  if (honesty > 0.7 && trust >= 5) return 'amused';
  return 'wary';
}

/**
 * buildNpcContext(npc, world, playerInput) → context
 * Assembles the prompt context for the NPC brain.
 */
export function buildNpcContext(npc, world, playerInput) {
  const { facts, rumors } = gatherNpcKnowledge(npc, world);

  const relationships = [];
  if (npc.relationships && typeof npc.relationships === 'object') {
    for (const [key, rel] of Object.entries(npc.relationships)) {
      if (rel && typeof rel === 'object') {
        relationships.push({
          targetId: rel.targetId || key,
          bond: Number(rel.bond ?? 0),
          history: Array.isArray(rel.history) ? rel.history : []
        });
      }
    }
  }

  return {
    npcId: String(npc.id || ''),
    name: String(npc.name || ''),
    archetype: String(npc.role || npc.archetype || ''),
    traits: Array.isArray(npc.traits) ? npc.traits : [],
    personality: {
      honesty: Number(npc.personality?.honesty ?? 0.5),
      trustOfOutsiders: Number(npc.personality?.trustOfOutsiders ?? 0.5),
      selfPreservation: Number(npc.personality?.selfPreservation ?? 0.5)
    },
    trust: Number(npc.conversationState?.trustLevel ?? 5),
    mood: deriveMood(npc, world),
    knownFacts: facts,
    carriedRumors: rumors,
    relationships,
    playerInput: String(playerInput || ''),
    turn: Number(world?.time?.turn ?? 0),
    secrets: new Set(Array.isArray(npc.secrets) ? npc.secrets.map(String) : [])
  };
}

// ── Token budget ────────────────────────────────────────────────────────────

const DEFAULT_TOKEN_BUDGET = 1500;

/**
 * countTokensApprox(text) → number
 * Rough estimate: 1 token ≈ 4 characters.
 */
export function countTokensApprox(text) {
  return Math.ceil(String(text || '').length / 4);
}

// ── Prompt builder (verbose — original format) ─────────────────────────────

function buildPromptVerbose(ctx) {
  const traits = ctx.traits.length > 0 ? ctx.traits.join(', ') : 'unremarkable';

  const factLines = ctx.knownFacts
    .map(f => `- [fact:${f.id}] ${f.text}`)
    .join('\n');
  const rumorLines = ctx.carriedRumors
    .map(r => `- [rumor:${r.id}] ${r.text} (tier ${r.tier})`)
    .join('\n');
  const knowledgeBlock = [factLines, rumorLines].filter(Boolean).join('\n');

  const relLines = ctx.relationships
    .map(r => `- ${r.targetId}: bond ${r.bond.toFixed(2)} (${r.history.join(', ')})`)
    .join('\n');

  return `You are ${ctx.name}, a ${ctx.archetype}.
Personality: ${traits}.
Trust toward this person: ${ctx.trust}/10.
Mood: ${ctx.mood}.

You know:
${knowledgeBlock || '(nothing)'}

Relationships:
${relLines || '(none)'}

The player says: "${ctx.playerInput}"

Reply as JSON:
{ "share": [...], "mood": "...", "approach": "...", "why": "..." }`;
}

// ── Prompt builder (compressed) ─────────────────────────────────────────────

// Mood code map: single-char codes for prompt compression
const MOOD_CODES = { wary: 'W', warm: 'H', hostile: 'X', fearful: 'F', amused: 'A' };
// Approach code map
const APPROACH_CODES = { volunteer: 'V', wait_to_be_asked: 'Q', deflect: 'D', lie: 'L' };

function buildPromptCompressed(facts, rumors, ctx) {
  const traits = ctx.traits.length > 0 ? ctx.traits.join(', ') : 'unremarkable';

  const factLines = facts.map(f => `[F:${f.id}] ${f.text}`).join('\n');
  const rumorLines = rumors.map(r => `[R:${r.id}] ${r.text} t${r.tier}`).join('\n');
  const knowledgeBlock = [factLines, rumorLines].filter(Boolean).join('\n');

  let relBlock = '';
  if (ctx.relationships.length > 0) {
    const relLines = ctx.relationships
      .map(r => `${r.targetId}:${r.bond.toFixed(2)}(${r.history.join(',')})`)
      .join('\n');
    relBlock = `\nRel:\n${relLines}\n`;
  }

  return `${ctx.name},${ctx.archetype}.${traits}.T${ctx.trust}/10.${MOOD_CODES[ctx.mood] || ctx.mood}.
K:
${knowledgeBlock || '-'}
${relBlock}P:"${ctx.playerInput}"
JSON:{share:[],mood:"W/H/X/F/A",approach:"V/Q/D/L",why:""}`;
}

/**
 * compressPrompt(ctx, opts?) → string
 *
 * Budget-aware compressed prompt builder. Exported for testing.
 * opts.tokenBudget — max tokens (default 1500).
 */
export function compressPrompt(ctx, opts = {}) {
  const budget = opts.tokenBudget ?? DEFAULT_TOKEN_BUDGET;
  let facts = [...(ctx.knownFacts || [])];
  let rumors = [...(ctx.carriedRumors || [])];

  let prompt = buildPromptCompressed(facts, rumors, ctx);
  let tokens = countTokensApprox(prompt);

  if (tokens <= budget) return prompt;

  // Sort by priority (lowest first) — items without priority get 1
  const sortByPriority = arr => [...arr].sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1));
  facts = sortByPriority(facts);
  rumors = sortByPriority(rumors);

  // Truncate: remove lowest-priority items first
  // Start with low-tier rumors, then old facts
  while (tokens > budget && rumors.length > 0 && (rumors[0].priority ?? 1) <= 1) {
    rumors.shift();
    prompt = buildPromptCompressed(facts, rumors, ctx);
    tokens = countTokensApprox(prompt);
  }

  while (tokens > budget && facts.length > 0 && (facts[0].priority ?? 1) <= 1) {
    facts.shift();
    prompt = buildPromptCompressed(facts, rumors, ctx);
    tokens = countTokensApprox(prompt);
  }

  // If still over budget, remove remaining lowest-priority items
  while (tokens > budget && (rumors.length > 0 || facts.length > 0)) {
    // Remove whichever has lower priority
    const rPri = rumors.length > 0 ? (rumors[0].priority ?? 1) : Infinity;
    const fPri = facts.length > 0 ? (facts[0].priority ?? 1) : Infinity;
    if (rPri <= fPri && rumors.length > 0) {
      rumors.shift();
    } else if (facts.length > 0) {
      facts.shift();
    } else {
      break;
    }
    prompt = buildPromptCompressed(facts, rumors, ctx);
    tokens = countTokensApprox(prompt);
  }

  return prompt;
}

// Backward-compatible buildPrompt — now uses compressed format
function buildPrompt(ctx) {
  return compressPrompt(ctx);
}

// ── Decision validation ─────────────────────────────────────────────────────

function validateDecision(d) {
  if (!d || typeof d !== 'object') return null;
  if (!Array.isArray(d.share)) return null;
  if (!d.share.every(s => typeof s === 'string')) return null;
  if (typeof d.mood !== 'string' || !VALID_MOODS.has(d.mood)) return null;
  if (typeof d.approach !== 'string' || !VALID_APPROACHES.has(d.approach)) return null;
  if (typeof d.why !== 'string') return null;
  return d;
}

// ── LLM query ───────────────────────────────────────────────────────────────

export { buildPromptVerbose as _buildPromptVerbose };

const DECISION_SCHEMA = {
  share: ['string'],
  mood: 'wary | warm | hostile | fearful | amused',
  approach: 'volunteer | wait_to_be_asked | deflect | lie',
  why: 'string'
};

/**
 * queryBrain(context, opts?) → NpcDecision | null
 *
 * Calls the local LLM via queryLocal. Returns null if the model is
 * unavailable, times out, or returns invalid output. Never throws.
 *
 * opts.queryLocal — injectable queryLocal function (for testing / DI).
 */
export async function queryBrain(context, opts = {}) {
  const queryLocal = opts.queryLocal;
  if (typeof queryLocal !== 'function') return null;

  try {
    const prompt = buildPrompt(context);
    const resp = await queryLocal({
      prompt,
      schema: DECISION_SCHEMA,
      model: opts.model || undefined,
      timeout: opts.timeout || 3000
    });

    if (!resp || !resp.ok) return null;
    return validateDecision(resp.result);
  } catch (_) {
    // Silent fallback — never throw.
    return null;
  }
}

// ── Deterministic fallback ──────────────────────────────────────────────────

/**
 * fallbackRules(context) → NpcDecision
 *
 * Deterministic rule-based fallback matching the existing trust-threshold
 * behavior from dialogue.js. Uses seeded RNG for any selection.
 */
export function fallbackRules(context) {
  const trust = Number(context.trust ?? 5);
  const secrets = context.secrets instanceof Set
    ? context.secrets
    : new Set(Array.isArray(context.secrets) ? context.secrets : []);

  const allFacts = (context.knownFacts || []);
  const allRumors = (context.carriedRumors || []);

  // Separate personal (secret) facts from public facts.
  const publicFacts = allFacts.filter(f => !secrets.has(f.id));
  const personalFacts = allFacts.filter(f => secrets.has(f.id));

  let share = [];
  let mood = 'wary';
  let approach = 'deflect';
  let why = '';

  if (trust >= 7) {
    // High trust: share all non-personal facts + all rumors.
    share = [
      ...publicFacts.map(f => f.id),
      ...allRumors.map(r => r.id)
    ];
    // Trust 8+: also share personal facts.
    if (trust >= 8) {
      share = share.concat(personalFacts.map(f => f.id));
    }
    mood = 'warm';
    approach = 'volunteer';
    why = 'Trust is high — sharing openly.';
  } else if (trust >= 4) {
    // Medium trust: share exactly one fact, picked deterministically.
    const candidates = publicFacts;
    if (candidates.length > 0) {
      const rng = makeRng(seedFromString(`${context.npcId}:${context.turn}`));
      const idx = rng.int(0, candidates.length - 1);
      share = [candidates[idx].id];
    }
    mood = 'wary';
    approach = 'wait_to_be_asked';
    why = 'Moderate trust — sharing cautiously.';
  } else {
    // Low trust: share nothing.
    share = [];
    mood = trust <= 1 ? 'hostile' : 'wary';
    approach = 'deflect';
    why = 'Trust is low — withholding.';
  }

  return { share, mood, approach, why };
}

// ── Canon Log helpers ───────────────────────────────────────────────────────

/**
 * findCachedDecision(canonLog, npcId, turn) → NpcDecision | null
 * Looks up a previously canonized NPC decision for this npc+turn pair.
 */
export function findCachedDecision(canonLog, npcId, turn) {
  if (!canonLog || !Array.isArray(canonLog.events)) return null;
  const eventId = `npcDecision:${npcId}:${turn ?? 0}`;
  const evt = canonLog.events.find(e => e.id === eventId && e.type === 'npcDecision');
  if (!evt || !evt.decision) return null;
  return validateDecision(evt.decision) ? evt.decision : null;
}
