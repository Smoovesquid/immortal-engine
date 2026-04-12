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
 * gatherNpcKnowledge(npc, world) → { facts, rumors }
 *
 * Returns structured knowledge for the NPC brain context builder.
 * Facts come from the NPC's knowledgeGraph; rumors are resolved from
 * npc.rumorIds against world.rumors.
 *
 * @param {object} npc — enriched NPC with depth
 * @param {object} world — current world state
 * @returns {{ facts: object[], rumors: object[] }}
 */
export function gatherNpcKnowledge(npc, world, opts = {}) {
  const facts = (Array.isArray(npc?.knowledgeGraph) ? npc.knowledgeGraph : [])
    .map((f, idx) => ({
      id: String(f.factId || ''),
      text: String(f.factId || ''),
      source: String(f.source || ''),
      _index: idx
    }));

  const rumors = (Array.isArray(npc?.rumorIds) ? npc.rumorIds : [])
    .map(rid => (Array.isArray(world?.rumors) ? world.rumors : []).find(r => r.id === rid))
    .filter(Boolean)
    .map(r => ({
      id: String(r.id || ''),
      text: String(r.body || ''),
      tier: r.tier,
      tags: Array.isArray(r.tags) ? r.tags : []
    }));

  // When opts.topic is provided, add priority scoring
  if (opts.topic) {
    const topicWords = String(opts.topic).toLowerCase().split(/\s+/).filter(w => w.length >= 4);

    for (const f of facts) {
      const idLower = f.id.toLowerCase();
      if (topicWords.some(w => idLower.includes(w))) {
        f.priority = 3;
      } else if (f._index >= facts.length * 0.5) {
        f.priority = 2; // recent (later in array)
      } else {
        f.priority = 1; // old
      }
    }

    for (const r of rumors) {
      const rTags = r.tags.map(t => String(t).toLowerCase());
      if (topicWords.some(w => rTags.some(t => t.includes(w)))) {
        r.priority = 3;
      } else if (r.tier <= 1) {
        r.priority = 2; // high-tier
      } else {
        r.priority = 1; // low-tier
      }
    }
  }

  // Strip internal _index field
  for (const f of facts) { delete f._index; }

  return { facts, rumors };
}

/**
 * filterRumors(speaker, rumors, playerRelationship) → { surfacedRumors }
 *
 * Rules:
 * - NPC only surfaces rumors they carry (in their rumorIds).
 * - Trust < 4: only share tier 3+ rumors (vague).
 * - Trust 4-6: share tier 2+ rumors.
 * - Trust 7+: share all rumors including tier 0.
 * - Sophistication affects which rumors the NPC considers "interesting"
 *   enough to volunteer: low-sophistication NPCs skip tier 0-1 unless asked.
 *
 * @param {object} speaker — NPC with rumorIds[], sophistication
 * @param {object[]} rumors — world.rumors array
 * @param {object} playerRelationship — { trust: 0-10 }
 * @returns {{ surfacedRumors: object[] }}
 */
export function filterRumors(speaker, rumors, playerRelationship) {
  if (!speaker || !Array.isArray(rumors)) {
    return { surfacedRumors: [] };
  }

  const rumorIds = new Set(
    Array.isArray(speaker.rumorIds) ? speaker.rumorIds.map(String) : []
  );
  if (rumorIds.size === 0) return { surfacedRumors: [] };

  const trust = Number(playerRelationship?.trust ?? 5);
  const sophistication = Number(speaker.sophistication ?? 2);

  // Minimum tier the NPC will share based on trust
  let minTier;
  if (trust >= 7) {
    minTier = 0;
  } else if (trust >= 4) {
    minTier = 2;
  } else {
    minTier = 3;
  }

  const surfacedRumors = [];
  for (const rumor of rumors) {
    if (!rumor || typeof rumor !== 'object') continue;
    const id = String(rumor.id || '');
    if (!rumorIds.has(id)) continue;

    const tier = Number(rumor.tier ?? 0);
    if (tier < minTier) continue;

    // Low-sophistication NPCs (0-1) only volunteer tier 2+ (distorted/vague)
    // unless trust is very high. They don't consider precise info "interesting".
    if (sophistication <= 1 && tier < 2 && trust < 7) continue;

    surfacedRumors.push(rumor);
  }

  return { surfacedRumors };
}

/**
 * applyMoodOverlay(emotionalColoring, brainMood) → emotionalColoring[]
 *
 * Shifts emotional coloring intensities based on the NPC brain's mood decision.
 * Pure function — same inputs, same output.
 *
 * Mood effects:
 * - 'hostile': amplify 'guarded' and 'evasive' intensities by 1.5x, add hostile undertone
 * - 'fearful': amplify 'nervous' intensity by 1.5x, add fearful undertone
 * - 'warm': reduce all negative intensities by 0.7x, cap nervousness at 0.3
 * - 'amused': reduce 'guarded' intensity by 0.5x, add amused undertone
 * - 'wary': no change (default mood, baseline behavior)
 *
 * @param {object[]} emotionalColoring — existing coloring array
 * @param {string} brainMood — mood from NpcDecision
 * @returns {object[]} — new coloring array (never mutates input)
 */
export function applyMoodOverlay(emotionalColoring, brainMood) {
  const mood = String(brainMood || 'wary');
  const coloring = Array.isArray(emotionalColoring) ? emotionalColoring : [];

  if (mood === 'wary' || !coloring.length) {
    // Default mood or no coloring — return copy unchanged
    // But still add mood undertone if non-wary and empty
    if (mood !== 'wary' && !coloring.length) {
      return [{
        emotion: mood,
        intensity: mood === 'hostile' ? 0.7 : mood === 'fearful' ? 0.6 : 0.4,
        trigger: null
      }];
    }
    return coloring.map(c => ({ ...c }));
  }

  const result = coloring.map(c => {
    const next = { ...c };
    const intensity = Number(c.intensity ?? 0);

    switch (mood) {
      case 'hostile':
        if (c.emotion === 'guarded' || c.emotion === 'evasive') {
          next.intensity = Math.min(1, intensity * 1.5);
        }
        break;
      case 'fearful':
        if (c.emotion === 'nervous') {
          next.intensity = Math.min(1, intensity * 1.5);
        }
        break;
      case 'warm':
        next.intensity = Math.min(1, intensity * 0.7);
        if (c.emotion === 'nervous') {
          next.intensity = Math.min(0.3, next.intensity);
        }
        break;
      case 'amused':
        if (c.emotion === 'guarded') {
          next.intensity = Math.min(1, intensity * 0.5);
        }
        break;
    }

    return next;
  });

  // Add mood undertone if not wary
  if (mood !== 'wary') {
    result.push({
      emotion: mood,
      intensity: mood === 'hostile' ? 0.7 : mood === 'fearful' ? 0.6 : 0.4,
      trigger: null
    });
  }

  return result;
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
