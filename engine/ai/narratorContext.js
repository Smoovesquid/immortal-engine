/**
 * N1 — Narrator Context Builder / DM Context Packet
 *
 * Assembles everything the AI narrator (DM) is allowed to know.
 * Canonical facts only — no invented detail.
 * Pure function: no world mutation, no API calls.
 *
 * Two modes:
 *   buildNarratorContext(world, outcome)  — original slim context for narration polish
 *   buildDMContext(world, outcome, pack)  — full DM briefing with NPCs, world pressure, player, rules
 */

import { ensureWorld } from '../state.js';
import { ensureInstrumentLayer } from '../instrument.js';
import { fateBand } from '../rulesets.js';
import { filterContext } from '../npc/perspectiveFilter.js';
import { availableTopics as dialogueAvailableTopics } from '../npc/dialogue.js';

/**
 * buildNarratorContext(world, outcome) → NarratorContext (original slim context)
 */
export function buildNarratorContext(world, outcome = {}) {
  const w = ensureWorld(world);
  const scene = buildScene(w, outcome);

  const nodeId = String(w.map?.currentNodeId ?? '');
  const currentNode = (w.map?.nodes ?? []).find(n => n.id === nodeId) ?? null;
  const settlement = currentNode?.settlement ?? null;

  // Auto-select speaker from settlement NPCs
  let speaker = null;
  if (settlement?.npcs?.length) {
    const actionText = String(outcome?.input ?? outcome?.text ?? '').toLowerCase();
    // Pick NPC mentioned in action text, or default to first
    let picked = null;
    if (actionText) {
      picked = settlement.npcs.find(npc => {
        const name = String(npc.name ?? npc.role ?? '').toLowerCase();
        return name && actionText.includes(name);
      });
    }
    picked = picked || settlement.npcs[0];
    speaker = buildSpeakerContext(picked, picked.knowledgeGraph || []);
  }

  return {
    placeName: scene.location.name,
    nodeType: scene.location.type,
    location: scene.location.name,
    objective: String(w.scene?.objective ?? ''),
    structuresHere: scene.structuresHere,
    interior: scene.interior,
    tone: scene.tone,
    actionText: String(outcome?.input ?? outcome?.text ?? ''),
    mechanicsText: String(outcome?.mechanics ?? ''),
    fate: Number(w.meta?.fate ?? 0.5),
    settlement: settlement ? {
      npcs: settlement.npcs || [],
      factions: settlement.factions || [],
      tensions: Array.isArray(settlement.tensions) ? settlement.tensions : [],
      economy: settlement.economy ?? null,
      population: settlement.population ?? null
    } : null,
    speaker,
    dialogueTurn: buildDialogueTurn(w)
  };
}

/**
 * buildDMContext(world, outcome, pack) → DMContext
 *
 * Full DM briefing packet. Rebuilt every turn. Capped at ~6K tokens worth of data.
 *
 * @param {object} world    — canonical world state
 * @param {object} outcome  — result of the last engine action
 * @param {object} pack     — resolved pack data
 * @returns {DMContext}
 */
export function buildDMContext(world, outcome = {}, pack = {}) {
  const w = ensureWorld(world);

  const scene = buildScene(w, outcome);
  const npcsPresent = buildNPCsPresent(w);
  const worldPressure = buildWorldPressure(w);
  const player = buildPlayer(w);
  const rules = buildRules(w, pack);
  const worldWhisper = pickWorldWhisper(w);
  const goals = buildGoalsBlock(w);

  return {
    scene,
    npcsPresent,
    worldPressure,
    player,
    rules,
    worldWhisper,
    goals,
    recentBeats: Array.isArray(w.recentBeats) ? w.recentBeats.slice() : [],
    dialogueTurn: buildDialogueTurn(w)
  };
}

// ── Dialogue Turn ─────────────────────────────────────────────────────────
// Derived view for LLM/DM prompts when scene.dialogue is active.
// sharedFacts are computed from the ledger (`npc:{id} shared:{factId}` markers).
// withheldFacts are computed from topicsOffered minus shared + current trust rules.

const DIALOGUE_TRUST_REVEAL_PUBLIC = 4;
const DIALOGUE_TRUST_REVEAL_SECRET = 7;

export function buildDialogueTurn(world) {
  const w = ensureWorld(world);
  const d = w.scene?.dialogue;
  if (!d) return null;

  const nodeId = String(w.map?.currentNodeId ?? '');
  const node = (w.map?.nodes || []).find(n => n.id === nodeId) || null;
  const npcs = node?.settlement?.npcs || [];
  const npc = npcs.find(n => String(n?.id) === String(d.npcId)) || null;
  if (!npc) return null;

  const trust = Number(npc.conversationState?.trustLevel ?? 5);
  const secrets = new Set(Array.isArray(npc.secrets) ? npc.secrets.map(String) : []);

  const sharedFacts = computeSharedFacts(w, String(d.npcId));
  const sharedSet = new Set(sharedFacts);

  const topicsOffered = Array.isArray(d.topicsOffered) ? d.topicsOffered.map(String) : [];
  const withheldFacts = [];
  for (const t of topicsOffered) {
    if (sharedSet.has(t)) continue;
    if (secrets.has(t)) {
      if (trust < DIALOGUE_TRUST_REVEAL_SECRET) withheldFacts.push(t);
    } else {
      if (trust < DIALOGUE_TRUST_REVEAL_PUBLIC) withheldFacts.push(t);
    }
  }

  return {
    npc: {
      name: String(npc.name || ''),
      role: String(npc.role || ''),
      mood: dialogueMood(npc, trust),
      trustLevel: trust,
      personality: npc.personality || null,
      factionId: npc.factionId || null
    },
    sharedFacts,
    withheldFacts,
    lastMode: d.lastAnswer?.mode || null,
    lastFactId: d.lastAnswer?.factId || null,
    availableTopics: dialogueAvailableTopics(w)
  };
}

function computeSharedFacts(w, npcId) {
  const facts = Array.isArray(w.ledger?.facts) ? w.ledger.facts : [];
  const prefix = `npc:${npcId} shared:`;
  const out = [];
  for (const f of facts) {
    const t = String(f?.text || '');
    if (t.startsWith(prefix)) out.push(t.slice(prefix.length));
  }
  return out;
}

function dialogueMood(npc, trust) {
  const h = Number(npc?.personality?.honesty ?? 0.5);
  if (trust >= 7) return 'warm';
  if (h > 0.7) return 'open';
  if (h < 0.3) return 'guarded';
  if (trust <= 2) return 'wary';
  return 'measured';
}

// ── Goals ─────────────────────────────────────────────────────────────────

function buildGoalsBlock(w) {
  const all = Array.isArray(w.goals) ? w.goals : [];
  const active = all
    .filter(g => g.status === 'active')
    .slice(0, 3)
    .map(g => ({ kind: String(g.kind), label: String(g.label || ''), targetRef: String(g.targetRef) }));
  const completedThisSession = all.reduce((n, g) => n + (g.status === 'completed' ? 1 : 0), 0);
  return { active, completedThisSession };
}

// ── Scene ─────────────────────────────────────────────────────────────────

function buildScene(w, outcome) {
  const nodeId = String(w.map?.currentNodeId ?? '');
  const currentNode = (w.map?.nodes ?? []).find(n => n.id === nodeId) ?? null;
  const placeName = String(currentNode?.name ?? 'Unknown');
  const nodeType = String(currentNode?.nodeType ?? 'wilderness');

  const allStructures = Object.values(w.structures?.byId ?? {});
  const structuresHere = allStructures
    .filter(s => s?.nodeId === nodeId || s?.anchors?.nodeId === nodeId)
    .map((s, i) => ({ index: i + 1, kind: String(s.kind ?? 'structure') }));

  const interior = (w.scene?.interior && typeof w.scene.interior === 'object')
    ? { structureKey: String(w.scene.interior.structureKey ?? ''), roomId: String(w.scene.interior.roomId ?? '') }
    : null;

  const toneWords = outcome?.pack?.toneWords ?? w._resolvedPack?.toneWords ?? null;
  const tone = deriveTone(toneWords, w.meta?.fate);

  // Exits from current node
  const edges = Array.isArray(w.map?.edges) ? w.map.edges : [];
  const exits = edges
    .filter(e => e.from === nodeId || e.to === nodeId)
    .map(e => {
      const targetId = e.from === nodeId ? e.to : e.from;
      const targetNode = (w.map?.nodes ?? []).find(n => n.id === targetId);
      return targetNode ? String(targetNode.name) : null;
    })
    .filter(Boolean);

  // Time of day from turn count (rough cycle)
  const turn = w.time?.turn ?? 0;
  const timeOfDay = ['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night'][turn % 6];

  // Settlement data
  const settlement = currentNode?.settlement ?? null;

  return {
    location: { name: placeName, type: nodeType, exits },
    interior,
    structuresHere,
    timeOfDay,
    activeThreat: pickActiveThreat(w),
    tone,
    settlementName: settlement?.decompressed ? placeName : null,
    settlementEconomy: settlement?.economy ?? null,
    settlementTensions: Array.isArray(settlement?.tensions) ? settlement.tensions.map(t => t.type) : []
  };
}

// ── NPCs Present ──────────────────────────────────────────────────────────

function buildNPCsPresent(w) {
  const nodeId = String(w.map?.currentNodeId ?? '');
  const currentNode = (w.map?.nodes ?? []).find(n => n.id === nodeId) ?? null;
  const settlement = currentNode?.settlement;
  if (!settlement?.npcs?.length) return [];

  const npcs = settlement.npcs;
  // First NPC gets full detail (~500 tokens), rest get summary (~200 each)
  return npcs.map((npc, i) => {
    const cs = npc.conversationState ?? {};
    const metPlayer = Boolean(cs.metPlayer);
    const topics = Array.isArray(cs.topicsDiscussed) ? cs.topicsDiscussed.slice(-5) : [];
    const gossipReceived = Array.isArray(npc.gossipReceived) ? npc.gossipReceived.slice(-3) : [];

    const base = {
      name: String(npc.name ?? `the ${npc.role}`),
      role: String(npc.role ?? 'townfolk'),
      factionId: npc.factionId || null,
      personality: npc.personality ?? null,
      disposition: npc.disposition ?? null,
      conversationState: {
        metPlayer,
        trustLevel: Number(cs.trustLevel ?? 5),
        topicsDiscussed: topics,
        lastInteraction: cs.lastInteraction ?? null
      }
    };

    // Returning NPC: include conversation summary so DM has memory of prior interactions.
    if (metPlayer && topics.length > 0) {
      base.conversationSummary = `Has met the player. Discussed: ${topics.join(', ')}.`;
    }

    // Include gossip the NPC received from other NPCs.
    if (gossipReceived.length > 0) {
      base.gossipHeard = gossipReceived;
    }

    if (i === 0) {
      // Full detail for primary NPC
      return {
        ...base,
        publicKnowledge: summarizeKnowledge(npc.knowledgeGraph, false),
        secrets: summarizeSecrets(npc),
        archetypeDesc: String(npc.archetypeDesc ?? '')
      };
    }

    // Summary for other NPCs
    return base;
  });
}

function summarizeKnowledge(knowledgeGraph, secretsOnly = false) {
  if (!Array.isArray(knowledgeGraph)) return [];
  return knowledgeGraph
    .filter(f => secretsOnly ? f.source === 'secret' : f.source !== 'secret')
    .slice(0, 8)
    .map(f => f.factId);
}

function summarizeSecrets(npc) {
  if (!Array.isArray(npc.secrets)) return [];
  return npc.secrets.slice(0, 4).map(s => ({
    factId: String(s),
    revealCondition: 'trust >= 7 or persuasion check'
  }));
}

// ── World Pressure ────────────────────────────────────────────────────────

function buildWorldPressure(w) {
  const inst = ensureInstrumentLayer(w.instrument);
  const factions = Array.isArray(w.factions) ? w.factions : [];

  // Faction summary
  const factionSummary = factions.map(f => {
    const attitude = f.hostility >= 80 ? 'hostile' : f.hostility >= 40 ? 'wary' : 'neutral';
    return `${f.id}: ${attitude}, pressure ${f.pressure}`;
  }).join('; ') || 'no factions';

  // Ecology summary
  const eco = w.ecology ?? {};
  const ecoNotes = [];
  if (eco.corruption >= 40) ecoNotes.push(`corruption ${eco.corruption}`);
  if (eco.scarcity >= 40) ecoNotes.push(`scarcity ${eco.scarcity}`);
  if (eco.instability >= 40) ecoNotes.push(`instability ${eco.instability}`);
  const ecologySummary = ecoNotes.length ? ecoNotes.join(', ') : 'ecology stable';

  // Active scars
  const scars = Array.isArray(w.scars) ? w.scars.map(s => s.description).slice(0, 3) : [];

  // Active threads
  const threads = inst.threads
    .filter(t => t.status !== 'resolved')
    .map(t => ({ label: t.label, tension: t.tension, status: t.status }))
    .slice(0, 4);

  return { factionSummary, ecologySummary, activeScars: scars, activeThreads: threads };
}

// ── Player ────────────────────────────────────────────────────────────────

function buildPlayer(w) {
  const actor = Array.isArray(w.party) && w.party.length ? w.party[0] : {};
  const inv = actor.inventory ?? {};
  const weapons = Array.isArray(inv.weapons) ? inv.weapons.map(g => String(g?.name ?? g)).slice(0, 3) : [];
  const armor = Array.isArray(inv.armor) ? inv.armor.map(g => String(g?.name ?? g)).slice(0, 2) : [];

  return {
    name: String(actor.name ?? 'Adventurer'),
    stats: actor.stats ?? {},
    weapons,
    armor,
    wounds: Number(actor.wounds ?? 0),
    stress: Number(actor.stress ?? 0),
    reputation: w.reputation?.factions ?? {}
  };
}

// ── Rules ─────────────────────────────────────────────────────────────────

function buildRules(w, pack) {
  const packName = String(pack?.name ?? w.pack?.primaryId ?? 'fantasy');
  const toneWords = pack?.toneWords ?? {};
  const band = fateBand(w.meta?.fate);
  const setting = Array.isArray(toneWords[band]) ? toneWords[band].join(', ') : packName;

  return {
    setting,
    packId: String(w.pack?.primaryId ?? 'fantasy'),
    whatCannotExist: Array.isArray(pack?.constraints) ? pack.constraints : [],
    diceSystem: 'd20, DC set by engine, report result to engine'
  };
}

// ── World Whisper (one offscreen change for DM to mention) ───────────────

function pickWorldWhisper(w) {
  const timeline = Array.isArray(w.timeline) ? w.timeline : [];
  // Find the most recent worldTick event
  for (let i = timeline.length - 1; i >= Math.max(0, timeline.length - 5); i--) {
    const e = timeline[i];
    if (e?.kind === 'worldTick' && e?.data?.text) {
      return String(e.data.text);
    }
  }
  return null;
}

// ── Active Threat ─────────────────────────────────────────────────────────

function pickActiveThreat(w) {
  const threats = Array.isArray(w.ledger?.threats) ? w.ledger.threats : [];
  if (!threats.length) return null;
  // Most recent high-level threat
  const sorted = [...threats].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
  const top = sorted[0];
  return typeof top === 'string' ? top : String(top?.text ?? top?.description ?? '');
}

// ── Speaker Context ──────────────────────────────────────────────────────────

/**
 * buildSpeakerContext(npc, facts) → SpeakerContext | null
 *
 * Builds a perspective-filtered speaker context for an NPC with depth.
 * Returns null for shallow NPCs (no personality).
 */
export function buildSpeakerContext(npc, facts) {
  if (!npc?.personality) return null;

  const allFacts = Array.isArray(facts) ? facts : [];
  const pr = npc.playerRelationship || { trust: 0.5, interactions: 0 };
  const { filteredFacts, emotionalColoring } = filterContext(npc, allFacts, pr);

  const omittedFacts = allFacts
    .filter(f => !filteredFacts.some(ff => ff.factId === f.factId))
    .map(f => f.factId || f.id || '');

  return {
    name: String(npc.name ?? npc.role ?? ''),
    role: String(npc.role ?? ''),
    personality: npc.personality,
    filteredFacts,
    omittedFacts,
    secrets: Array.isArray(npc.secrets) ? npc.secrets : [],
    emotionalColoring
  };
}

/**
 * Derive a single tone label from pack toneWords + fate.
 * Returns 'blood' | 'grim' | 'cooperative'
 */
function deriveTone(toneWords, fate) {
  const band = fateBand(Number(fate ?? 0.5));
  if (!toneWords || typeof toneWords !== 'object') return band;
  if (band === 'blood' && Array.isArray(toneWords.blood) && toneWords.blood.length) return 'blood';
  if (band === 'grim'  && Array.isArray(toneWords.grim)  && toneWords.grim.length)  return 'grim';
  return band;
}
