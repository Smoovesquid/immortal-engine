// NPC Depth System — personality axes, knowledge graphs, relationships, player tracking, secrets.
// Computed from decompression events. Deterministic. No LLM.

import { seedFromString, makeRng } from '../rng.js';
import { clamp01 } from '../util.js';

// ── Personality Axes ─────────────────────────────────────────────────────────
// 3 axes, each 0-1, seeded from NPC history events + faction + role.

const ROLE_PERSONALITY_BIAS = {
  representative: { honesty: 0.4, trustOfOutsiders: 0.5, selfPreservation: 0.6 },
  enforcer:       { honesty: 0.3, trustOfOutsiders: 0.2, selfPreservation: 0.7 },
  veteran:        { honesty: 0.6, trustOfOutsiders: 0.3, selfPreservation: 0.5 },
  mediator:       { honesty: 0.7, trustOfOutsiders: 0.7, selfPreservation: 0.3 },
  healer:         { honesty: 0.8, trustOfOutsiders: 0.6, selfPreservation: 0.2 },
  scavenger:      { honesty: 0.3, trustOfOutsiders: 0.2, selfPreservation: 0.8 },
  trader:         { honesty: 0.5, trustOfOutsiders: 0.6, selfPreservation: 0.5 },
  laborer:        { honesty: 0.6, trustOfOutsiders: 0.5, selfPreservation: 0.4 },
  elder:          { honesty: 0.7, trustOfOutsiders: 0.4, selfPreservation: 0.3 },
  artisan:        { honesty: 0.6, trustOfOutsiders: 0.5, selfPreservation: 0.4 },
  guard:          { honesty: 0.5, trustOfOutsiders: 0.2, selfPreservation: 0.6 },
  scholar:        { honesty: 0.8, trustOfOutsiders: 0.5, selfPreservation: 0.3 },
  innkeeper:      { honesty: 0.5, trustOfOutsiders: 0.7, selfPreservation: 0.5 }
};

const DEFAULT_BIAS = { honesty: 0.5, trustOfOutsiders: 0.5, selfPreservation: 0.5 };

function computePersonality(npc, npcIndex, history, seed, rng) {
  const bias = ROLE_PERSONALITY_BIAS[npc.role] || DEFAULT_BIAS;

  // Events that shift personality: war makes people guarded, peace makes them open
  const witnessedEvents = assignWitnessedEvents(npc, npcIndex, history, rng);
  let honestyShift = 0;
  let trustShift = 0;
  let selfPShift = 0;

  for (const event of witnessedEvents) {
    if (event.eventId === 'faction_war' || event.eventId === 'war_scar') {
      trustShift -= 0.15;
      selfPShift += 0.1;
    }
    if (event.eventId === 'peace_period' || event.eventId === 'trade_boom') {
      trustShift += 0.1;
      honestyShift += 0.05;
    }
    if (event.eventId === 'blight' || event.eventId === 'famine' || event.eventId === 'famine_scar') {
      selfPShift += 0.1;
      honestyShift -= 0.05;
    }
    if (event.eventId === 'corruption_scar') {
      honestyShift -= 0.15;
      selfPShift += 0.1;
    }
    if (event.eventId === 'unrest') {
      trustShift -= 0.1;
    }
  }

  // Add RNG jitter (+/- 0.1)
  const jitter = () => (rng.nextFloat() - 0.5) * 0.2;

  return {
    honesty: clamp01(bias.honesty + honestyShift + jitter()),
    trustOfOutsiders: clamp01(bias.trustOfOutsiders + trustShift + jitter()),
    selfPreservation: clamp01(bias.selfPreservation + selfPShift + jitter())
  };
}

// ── Knowledge Graph ──────────────────────────────────────────────────────────
// Each NPC is assigned as witness to events based on faction + role + era.

function assignWitnessedEvents(npc, npcIndex, history, rng) {
  if (!Array.isArray(history) || history.length === 0) return [];

  const witnessed = [];
  for (const event of history) {
    // Faction members witness faction events
    if (npc.factionId && (event.eventId === 'faction_tension' || event.eventId === 'faction_war' || event.eventId === 'faction_arrival')) {
      witnessed.push(event);
      continue;
    }
    // NPCs witness events from their era or later
    if (npc.originTick !== null && event.era < npc.originTick) continue;
    // Probabilistic witnessing: ~60% chance for each remaining event
    if (rng.nextFloat() < 0.6) {
      witnessed.push(event);
    }
  }
  return witnessed;
}

function buildKnowledgeGraph(witnessedEvents, secrets, rng) {
  const facts = [];

  for (const event of witnessedEvents) {
    facts.push({
      factId: `${event.eventId}_era${event.era}`,
      source: 'witnessed',
      confidence: 0.8 + rng.nextFloat() * 0.2,
      event
    });
  }

  // Secrets are known facts the NPC holds privately
  for (const secret of secrets) {
    facts.push({
      factId: `secret_${secret.type}_era${secret.connectedTo}`,
      source: 'secret',
      confidence: 1.0,
      event: { era: secret.connectedTo, eventId: `${secret.type}_scar`, worldState: null }
    });
  }

  return facts;
}

// ── Relationships ────────────────────────────────────────────────────────────
// NPCs who witnessed the same events develop bonds. Opposing factions = negative bonds.

function buildRelationships(npcIndex, allNpcs, allWitnessed, rng) {
  const relationships = {};
  const myEvents = new Set((allWitnessed[npcIndex] || []).map(e => `${e.eventId}_${e.era}`));

  for (let i = 0; i < allNpcs.length; i++) {
    if (i === npcIndex) continue;
    const other = allNpcs[i];
    const otherId = `npc_${i}`;
    const theirEvents = new Set((allWitnessed[i] || []).map(e => `${e.eventId}_${e.era}`));

    // Shared events create bonds
    let sharedCount = 0;
    for (const e of myEvents) {
      if (theirEvents.has(e)) sharedCount++;
    }

    // Baseline neighborly bond: NPCs in the same settlement know each other.
    // Without this, factionless NPCs would have no positive bonds and gossip
    // could never spread between them.
    let bond = 0.1;
    const history = ['neighbors'];

    if (sharedCount > 0) {
      bond += sharedCount * 0.15;
      history.push(`shared ${sharedCount} events`);
    }

    // Same faction = positive bond
    const me = allNpcs[npcIndex];
    if (me.factionId && other.factionId && me.factionId === other.factionId) {
      bond += 0.3;
      history.push('same faction');
    }

    // Different factions = negative bond (overrides neighborly baseline)
    if (me.factionId && other.factionId && me.factionId !== other.factionId) {
      bond -= 0.4;
      history.push('rival factions');
    }

    // Jitter
    bond += (rng.nextFloat() - 0.5) * 0.1;
    bond = Math.max(-1, Math.min(1, bond));

    if (bond !== 0 || history.length > 0) {
      relationships[otherId] = { targetId: otherId, bond, history };
    }
  }

  return relationships;
}

// ── Secrets ──────────────────────────────────────────────────────────────────
// Facts the NPC knows but would not reveal based on personality + relationship.

function computeSecrets(npc, knowledgeGraph, personality) {
  const secrets = [];

  for (const fact of knowledgeGraph) {
    if (fact.source === 'secret') {
      secrets.push(fact.factId);
      continue;
    }
    // Low honesty NPCs may also hide witnessed facts
    if (personality.honesty < 0.4 && fact.source === 'witnessed') {
      // Scar events and faction events are more likely to be hidden
      const isSensitive = fact.event?.eventId?.includes('scar') ||
                          fact.event?.eventId?.includes('war') ||
                          fact.event?.eventId?.includes('corruption');
      if (isSensitive) {
        secrets.push(fact.factId);
      }
    }
  }

  return secrets;
}

// ── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * computeNpcDepth(npcs, history, secrets, seed) → NpcDepth[]
 *
 * Computes depth for each NPC in a settlement. Pure, deterministic.
 *
 * @param {object[]} npcs — from extractPresent()
 * @param {object[]} history — decompression event history
 * @param {object[]} secrets — settlement-level secrets from extractPresent()
 * @param {string} seed — world seed for determinism
 * @returns {object[]} — enriched NPC array with depth fields
 */
export function computeNpcDepth(npcs, history, secrets, seed) {
  if (!Array.isArray(npcs) || npcs.length === 0) return [];

  const rng = makeRng(seedFromString(`${seed}|npcDepth`));
  const settlementSecrets = Array.isArray(secrets) ? secrets : [];

  // Phase 1: Assign witnessed events for all NPCs
  const allWitnessed = npcs.map((npc, i) =>
    assignWitnessedEvents(npc, i, history || [], makeRng(seedFromString(`${seed}|witness|${i}`)))
  );

  // Phase 2: Build depth for each NPC
  const enriched = npcs.map((npc, i) => {
    const npcRng = makeRng(seedFromString(`${seed}|npc|${i}`));

    const personality = computePersonality(npc, i, history || [], seed, npcRng);

    // Assign settlement secrets to specific NPCs. Distribution rules:
    // - Faction members are likelier to know war/rivalry secrets
    // - Low-honesty NPCs hoard any kind of secret
    // - The first NPC (highest faction-pressure rep) always gets at least one
    // - All NPCs get a chance at any remaining secret so depth isn't concentrated
    const npcSecrets = settlementSecrets.filter((s) => {
      if (npc.factionId && (s.type === 'war' || s.type === 'rivalry')) {
        return npcRng.nextFloat() < 0.6;
      }
      if (npc.factionId && s.type === 'corruption') return npcRng.nextFloat() < 0.4;
      if (personality.honesty < 0.5) return npcRng.nextFloat() < 0.5;
      if (i === 0) return true;
      return npcRng.nextFloat() < 0.25;
    });

    const knowledgeGraph = buildKnowledgeGraph(
      allWitnessed[i],
      npcSecrets,
      npcRng
    );

    const npcSecretIds = computeSecrets(npc, knowledgeGraph, personality);

    const relationships = buildRelationships(i, npcs, allWitnessed, npcRng);

    const playerRelationship = {
      trust: personality.trustOfOutsiders,
      interactions: 0
    };

    return {
      ...npc,
      id: `npc_${i}`,
      personality,
      knowledgeGraph,
      relationships,
      playerRelationship,
      secrets: npcSecretIds,
      witnessedEvents: allWitnessed[i]
    };
  });

  return enriched;
}

/**
 * updatePlayerRelationship(npc, action) → updated NPC
 *
 * Updates the player-NPC trust based on player actions.
 * @param {object} npc — enriched NPC with depth
 * @param {'help'|'ask'|'threaten'|'trade'|'betray'} action
 * @returns {object} — NPC with updated playerRelationship
 */
export function updatePlayerRelationship(npc, action) {
  if (!npc?.playerRelationship) return npc;

  const pr = { ...npc.playerRelationship };
  pr.interactions += 1;

  const trustDelta = {
    help: 0.15,
    ask: 0.05,
    trade: 0.1,
    threaten: -0.2,
    betray: -0.5
  };

  const delta = trustDelta[action] ?? 0;
  pr.trust = clamp01(pr.trust + delta);

  return { ...npc, playerRelationship: pr };
}

