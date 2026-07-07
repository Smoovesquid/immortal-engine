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
import { decayMemories } from './npcMemory.js';

// ── Mood + Approach enums ───────────────────────────────────────────────────

const VALID_MOODS = new Set(['wary', 'warm', 'hostile', 'fearful', 'amused', 'fervent']);
const VALID_APPROACHES = new Set(['volunteer', 'wait_to_be_asked', 'deflect', 'lie', 'evangelize']);

// ── Soapbox (SOAPBOX-1) ─────────────────────────────────────────────────────
// A zealot preaches his cause to any stranger while staying guarded about
// personal things. `soapbox` is an OPTIONAL per-NPC field: { topics:[...words],
// cause:'...', eager:bool }. When the player's input names one of the topics,
// the SHARE gate flips open on-topic REGARDLESS of trust (public facts + rumors,
// never personal secrets). Off-topic, or no soapbox, the trust ladder is
// byte-unchanged. Pure string match — deterministic, no rng, no LLM.
//
// Matching is WHOLE-WORD only. We tokenize on non-letters (so apostrophes SPLIT
// words: "don't" → don, t) which sidesteps the known contraction pitfall in this
// repo where \b(n|s|e|w)\b matches inside "don't"/"isn't". Topics are stored as
// explicit surface forms (chicken + chickens) so there is no stemming ambiguity —
// "combat" never matches the topic "comb", "artery" never matches "art".
export function matchesSoapbox(soapbox, playerInput) {
  if (!soapbox || !Array.isArray(soapbox.topics) || soapbox.topics.length === 0) return false;
  const text = String(playerInput || '').toLowerCase();
  if (!text) return false;
  const tokens = new Set(text.split(/[^a-z]+/).filter(Boolean));
  if (tokens.size === 0) return false;
  for (const topic of soapbox.topics) {
    const k = String(topic || '').toLowerCase().trim();
    if (k && tokens.has(k)) return true;
  }
  return false;
}

// ── Faction standing helper ─────────────────────────────────────────────────

/**
 * getFactionStanding(npc, world) → { factionId, hostility, playerReputation } | null
 * Returns the NPC's faction context: how hostile the faction is and the player's
 * reputation with that faction. Returns null if NPC has no faction.
 */
function getFactionStanding(npc, world) {
  const factionId = String(npc.factionId || '').trim();
  if (!factionId) return null;

  const factions = Array.isArray(world?.factions) ? world.factions : [];
  const faction = factions.find(f => f.id === factionId);
  if (!faction) return null;

  const rep = world?.reputation?.factions || {};
  const playerReputation = Number(rep[factionId] ?? 0);

  return {
    factionId,
    hostility: Number(faction.hostility ?? 0),
    playerReputation  // -100 to +100
  };
}

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
    memories: (() => {
      const rawMemories = Array.isArray(npc.memory) ? npc.memory : [];
      const decayed = decayMemories(rawMemories, Number(world?.time?.turn ?? 0));
      return [...decayed].sort((a, b) => b.salience - a.salience);
    })(),
    playerInput: String(playerInput || ''),
    turn: Number(world?.time?.turn ?? 0),
    secrets: new Set(Array.isArray(npc.secrets) ? npc.secrets.map(String) : []),
    factionId: String(npc.factionId || ''),
    factionStanding: getFactionStanding(npc, world),
    // SOAPBOX-1 — the NPC's cause, if any. Flows to fallbackRules so an on-topic
    // ask flips the SHARE gate regardless of trust. Optional; null for most NPCs.
    soapbox: (npc.soapbox && typeof npc.soapbox === 'object') ? npc.soapbox : null
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

  const memoryLines = Array.isArray(ctx.memories) && ctx.memories.length > 0
    ? ctx.memories.map(m => {
        const text = typeof m === 'string' ? m : String(m.text || m);
        const sal = typeof m === 'object' && m.salience != null ? ` [${(m.salience * 10).toFixed(0)}/10]` : '';
        return `- ${text}${sal}`;
      }).join('\n')
    : '(nothing)';

  const relLines = ctx.relationships
    .map(r => `- ${r.targetId}: bond ${r.bond.toFixed(2)} (${r.history.join(', ')})`)
    .join('\n');

  const factionInfo = ctx.factionStanding
    ? `\nFaction: ${ctx.factionStanding.factionId} (player reputation: ${ctx.factionStanding.playerReputation}, faction hostility: ${ctx.factionStanding.hostility})`
    : '';

  return `You are ${ctx.name}, a ${ctx.archetype}.
Personality: ${traits}.
Trust toward this person: ${ctx.trust}/10.
Mood: ${ctx.mood}.${factionInfo}

You know:
${knowledgeBlock || '(nothing)'}

You remember:
${memoryLines}

Relationships:
${relLines || '(none)'}

The player says: "${ctx.playerInput}"

Reply as JSON:
{ "share": [...], "mood": "...", "approach": "...", "why": "..." }`;
}

// ── Prompt builder (compressed) ─────────────────────────────────────────────

// Mood code map: single-char codes for prompt compression
const MOOD_CODES = { wary: 'W', warm: 'H', hostile: 'X', fearful: 'F', amused: 'A', fervent: 'E' };
// Approach code map
const APPROACH_CODES = { volunteer: 'V', wait_to_be_asked: 'Q', deflect: 'D', lie: 'L', evangelize: 'E' };

function buildPromptCompressed(facts, rumors, ctx) {
  const traits = ctx.traits.length > 0 ? ctx.traits.join(', ') : 'unremarkable';

  const factionLine = ctx.factionStanding
    ? `\nFac:${ctx.factionStanding.factionId} rep:${ctx.factionStanding.playerReputation} host:${ctx.factionStanding.hostility}`
    : '';

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

  return `${ctx.name},${ctx.archetype}.${traits}.T${ctx.trust}/10.${MOOD_CODES[ctx.mood] || ctx.mood}.${factionLine}
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

  // Pass F1 — faction reputation influence on NPC decisions.
  // If the NPC belongs to a faction and the player has very negative reputation
  // with that faction, the NPC defaults to wary/deflect regardless of personal trust.
  // If very positive reputation, mood warms.
  const faction = context.factionStanding || null;
  let factionMoodShift = null;

  if (faction) {
    const rep = Number(faction.playerReputation ?? 0);
    const hostility = Number(faction.hostility ?? 0);

    // Hostile faction + player on bad terms → deflect
    if (rep <= -50 || (hostility >= 70 && rep < 0)) {
      factionMoodShift = 'hostile';
    }
    // Player on moderately bad terms → wary
    else if (rep <= -25) {
      factionMoodShift = 'wary';
    }
    // Very positive reputation → warm boost
    else if (rep >= 50) {
      factionMoodShift = 'warm';
    }
  }

  // Pass O3 — memory-based trust boost in the 4-6 range.
  // If any memory contains a word (>=4 chars) from the player input, treat
  // trust as +1 for share behavior. Only applies in the 4-6 band.
  // Pass D2 — salience gate: very faded memories (salience <= 0.2) don't trigger recall.
  const memories = Array.isArray(context.memories) ? context.memories : [];
  let effectiveTrust = trust;
  if (trust >= 4 && trust <= 6 && memories.length > 0) {
    const inputWords = String(context.playerInput || '').toLowerCase()
      .split(/\s+/).filter(w => w.length >= 4);
    const hasMemoryMatch = inputWords.length > 0 && memories.some(mem => {
      const memText = typeof mem === 'string' ? mem : String(mem.text || '');
      const memSalience = typeof mem === 'object' ? Number(mem.salience ?? 1) : 1;
      // Only match memories with salience > 0.2 (very faded memories don't trigger recall)
      if (memSalience <= 0.2) return false;
      const memLower = memText.toLowerCase();
      return inputWords.some(w => memLower.includes(w));
    });
    if (hasMemoryMatch) effectiveTrust = trust + 1;
  }

  // Pass F1 — warm faction boost: treat effective trust as +1 when trust >= 3
  if (factionMoodShift === 'warm' && trust >= 3) {
    effectiveTrust = effectiveTrust + 1;
  }

  // Separate personal (secret) facts from public facts.
  const publicFacts = allFacts.filter(f => !secrets.has(f.id));
  const personalFacts = allFacts.filter(f => secrets.has(f.id));

  // SOAPBOX-1 — the zealot's cause overrides the trust gate. If the player names
  // one of this NPC's soapbox topics, he EVANGELIZES: public facts + rumors open
  // REGARDLESS of trust, mood turns fervent, approach is 'evangelize'. Early
  // return, so the whole trust ladder below is byte-unchanged for every off-topic
  // ask and every NPC without a soapbox. Personal (secret) facts are NEVER added
  // here — a zealot preaches the cause but still guards personal things.
  // Deterministic: pure string match, no rng, no trust mutation.
  const soapbox = context.soapbox || null;
  if (soapbox && matchesSoapbox(soapbox, context.playerInput)) {
    return {
      share: [
        ...publicFacts.map(f => f.id),
        ...allRumors.map(r => r.id)
      ],
      mood: 'fervent',
      approach: 'evangelize',
      why: `Soapbox topic (${String(soapbox.cause || 'the cause')}) — evangelizing regardless of trust.`
    };
  }

  let share = [];
  let mood = 'wary';
  let approach = 'deflect';
  let why = '';

  if (effectiveTrust >= 7) {
    // High trust: share all non-personal facts + all rumors.
    share = [
      ...publicFacts.map(f => f.id),
      ...allRumors.map(r => r.id)
    ];
    // Trust 8+: also share personal facts.
    if (effectiveTrust >= 8) {
      share = share.concat(personalFacts.map(f => f.id));
    }
    mood = 'warm';
    approach = 'volunteer';
    why = 'Trust is high — sharing openly.';
  } else if (effectiveTrust >= 4) {
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

  // Pass F1 — faction mood overrides applied after trust-based computation.
  // Hostile faction forces deflect unless personal trust is very high (>=7).
  if (factionMoodShift === 'hostile' && trust < 7) {
    share = [];
    mood = 'hostile';
    approach = 'deflect';
    why = 'Faction hostility overrides — withholding.';
  }

  // Wary faction: override mood to 'wary' if it would have been warm/amused
  if (factionMoodShift === 'wary' && (mood === 'warm' || mood === 'amused')) {
    mood = 'wary';
  }

  // Warm faction: ensure approach is at least 'wait_to_be_asked' (not deflect/lie)
  if (factionMoodShift === 'warm' && trust >= 3) {
    if (approach === 'deflect' || approach === 'lie') {
      approach = 'wait_to_be_asked';
    }
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
