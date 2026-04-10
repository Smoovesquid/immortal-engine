// Perspective Filter — deterministic filter that controls what each NPC reveals.
// Same speaker + same facts + same player relationship = same filter output.
// The LLM narrator is non-deterministic, but this layer is pure.

/**
 * filterContext(speaker, facts, playerRelationship) → { filteredFacts, emotionalColoring }
 *
 * Rules:
 * 1. Remove facts the speaker doesn't know (not in their knowledgeGraph).
 * 2. Distort facts the speaker would spin (based on personality axes).
 * 3. Omit secrets unless player trust exceeds (1 - speaker.honesty) threshold.
 * 4. Add emotional coloring metadata based on what's being hidden.
 *
 * @param {object} speaker — enriched NPC with depth (personality, knowledgeGraph, secrets)
 * @param {object[]} facts — all settlement facts to filter
 * @param {object} playerRelationship — { trust: 0-1, interactions: number }
 * @returns {{ filteredFacts: object[], emotionalColoring: object[] }}
 */
export function filterContext(speaker, facts, playerRelationship) {
  if (!speaker || !Array.isArray(facts)) {
    return { filteredFacts: [], emotionalColoring: [] };
  }

  const personality = speaker.personality || { honesty: 0.5, trustOfOutsiders: 0.5, selfPreservation: 0.5 };
  const knowledgeGraph = Array.isArray(speaker.knowledgeGraph) ? speaker.knowledgeGraph : [];
  const secrets = new Set(Array.isArray(speaker.secrets) ? speaker.secrets : []);
  const pr = playerRelationship || speaker.playerRelationship || { trust: 0.5, interactions: 0 };

  const knownFactIds = new Set(knowledgeGraph.map(f => f.factId));
  const secretThreshold = 1 - personality.honesty;

  const filteredFacts = [];
  const emotionalColoring = [];

  for (const fact of facts) {
    const factId = fact.factId || fact.id || '';

    // Rule 1: Remove facts the speaker doesn't know
    if (!knownFactIds.has(factId)) {
      continue;
    }

    // Rule 3: Omit secrets unless trust exceeds threshold
    if (secrets.has(factId)) {
      if (pr.trust < secretThreshold) {
        // Hiding a secret — add emotional coloring
        const intensity = computeSecretHidingIntensity(personality, fact);
        emotionalColoring.push({
          emotion: pickHidingEmotion(personality, intensity),
          intensity,
          trigger: factId
        });
        continue; // omit the secret
      }
      // Trust high enough — reveal the secret but mark nervousness
      emotionalColoring.push({
        emotion: 'nervous',
        intensity: 0.4 + (1 - personality.honesty) * 0.3,
        trigger: factId
      });
    }

    // Rule 2: Distort facts the speaker would spin
    const distorted = distortFact(fact, personality, pr);
    filteredFacts.push(distorted);
  }

  // Add ambient emotional coloring if hiding multiple things
  const hiddenCount = facts.length - filteredFacts.length;
  if (hiddenCount > 0 && personality.honesty < 0.5) {
    const ambientIntensity = Math.min(1, hiddenCount * 0.2 * (1 - personality.honesty));
    if (ambientIntensity > 0.1) {
      emotionalColoring.push({
        emotion: 'guarded',
        intensity: ambientIntensity,
        trigger: null
      });
    }
  }

  return { filteredFacts, emotionalColoring };
}

/**
 * Compute how intensely the NPC feels about hiding a particular secret.
 */
function computeSecretHidingIntensity(personality, fact) {
  const base = 0.3;
  const honestyPenalty = (1 - personality.honesty) * 0.4; // dishonest NPCs are calmer hiding things
  const selfPreservBonus = personality.selfPreservation * 0.3; // self-preserving NPCs feel more about secrets
  return Math.min(1, base + selfPreservBonus - honestyPenalty);
}

/**
 * Pick an emotion based on personality when hiding something.
 */
function pickHidingEmotion(personality, intensity) {
  if (personality.selfPreservation > 0.7) return 'evasive';
  if (personality.honesty < 0.3) return 'guarded'; // practiced liar
  if (intensity > 0.7) return 'nervous';
  return 'evasive';
}

/**
 * Distort a fact based on the speaker's personality.
 * Low honesty = downplay severity. High self-preservation = omit self-involvement.
 */
function distortFact(fact, personality, playerRelationship) {
  const distorted = { ...fact };

  // Low honesty: add spin
  if (personality.honesty < 0.4) {
    distorted.spin = 'downplayed';
    if (fact.event?.eventId?.includes('war') || fact.event?.eventId?.includes('corruption')) {
      distorted.spin = 'deflected';
    }
  }

  // Very high honesty: add forthcoming flag
  if (personality.honesty > 0.7) {
    distorted.spin = 'forthcoming';
  }

  // Low trust of outsiders + low player trust: add reluctance
  if (personality.trustOfOutsiders < 0.4 && playerRelationship.trust < 0.5) {
    distorted.reluctant = true;
  }

  return distorted;
}

/**
 * detectContradictions(npcA, npcB, factsA, factsB) → contradiction events
 *
 * When NPC A's filteredFacts include a fact that appears in NPC B's secrets,
 * emit a contradiction_exposed event.
 *
 * @param {object} npcA — enriched NPC
 * @param {object} npcB — enriched NPC
 * @param {object[]} filteredFactsA — A's filtered output
 * @param {object[]} filteredFactsB — B's filtered output
 * @returns {object[]} — contradiction events
 */
export function detectContradictions(npcA, npcB, filteredFactsA, filteredFactsB) {
  const contradictions = [];
  const secretsB = new Set(Array.isArray(npcB.secrets) ? npcB.secrets : []);
  const secretsA = new Set(Array.isArray(npcA.secrets) ? npcA.secrets : []);

  // Check if A reveals something B is hiding
  for (const fact of filteredFactsA) {
    const factId = fact.factId || fact.id || '';
    if (secretsB.has(factId)) {
      contradictions.push({
        type: 'contradiction_exposed',
        factId,
        revealer: npcA.id,
        holder: npcB.id
      });
    }
  }

  // Check if B reveals something A is hiding
  for (const fact of filteredFactsB) {
    const factId = fact.factId || fact.id || '';
    if (secretsA.has(factId)) {
      contradictions.push({
        type: 'contradiction_exposed',
        factId,
        revealer: npcB.id,
        holder: npcA.id
      });
    }
  }

  return contradictions;
}

/**
 * applyContradictionEffects(holder, contradiction) → updated NPC
 *
 * When a contradiction is exposed, shift the holder's emotional state.
 */
export function applyContradictionEffects(holder, contradiction) {
  if (!holder || !contradiction) return holder;

  // Remove the exposed secret (it's no longer hidden)
  const newSecrets = (holder.secrets || []).filter(s => s !== contradiction.factId);

  return {
    ...holder,
    secrets: newSecrets,
    lastContradiction: {
      factId: contradiction.factId,
      revealedBy: contradiction.revealer
    }
  };
}
