// Rumor minting engine — lazy minting at dialogue surface with LLM + deterministic fallback.
// LLM layer never throws. Deterministic fallback body is canonical once minted.
// All state mutations via applyDeltas.

import { ensureWorld } from '../state.js';
import { applyDeltas } from '../effectsCore.js';
import { computeTier } from './tier.js';
import { buildRumorPrompt } from './prompt.js';
import { garbleRumor } from './garble.js';
import { appendCanonEvent } from '../csl/canonLog.js';

// ── Hop count via BFS ──────────────────────────────────────────────────────

function computeHopCount(map, fromNodeId, toNodeId) {
  const from = String(fromNodeId || '');
  const to = String(toNodeId || '');
  if (!from || !to || from === to) return 0;

  const nodes = Array.isArray(map?.nodes) ? map.nodes : [];
  const edges = Array.isArray(map?.edges) ? map.edges : [];
  if (!nodes.length || !edges.length) return 1;

  // Build adjacency
  const adj = new Map();
  for (const e of edges) {
    const a = String(e.a || '');
    const b = String(e.b || '');
    if (!a || !b) continue;
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b);
    adj.get(b).push(a);
  }

  // BFS
  const visited = new Set([from]);
  let frontier = [from];
  let depth = 0;
  while (frontier.length > 0) {
    depth++;
    const next = [];
    for (const node of frontier) {
      for (const nb of (adj.get(node) || [])) {
        if (nb === to) return depth;
        if (!visited.has(nb)) {
          visited.add(nb);
          next.push(nb);
        }
      }
    }
    frontier = next;
  }

  // Not reachable — default to 2 (mild distortion)
  return 2;
}

// ── Deterministic placeholder synthesis ────────────────────────────────────

function deterministicBody(seed, tier) {
  const name = String(seed?.primaryName || seed?.id || 'something');
  const dir = String(seed?.direction || 'somewhere');
  const tag = Array.isArray(seed?.tags) && seed.tags.length > 0
    ? String(seed.tags[0])
    : 'strange';

  if (tier <= 1) {
    return `${name} — ${tag} near ${dir}.`;
  }
  if (tier === 2) {
    return `Something about ${name}... over in ${dir}.`;
  }
  if (tier === 3) {
    return `They say there's ${tag} business to the ${dir}.`;
  }
  // tier 4
  return `Bad news from the ${dir}.`;
}

// ── LLM minting (local then cloud, silent fallback) ───────────────────────

async function tryLlmMint(prompt, { queryLocalFn, cloudFetchFn }) {
  // 1. Try local LLM
  if (typeof queryLocalFn === 'function') {
    try {
      const result = await queryLocalFn({
        prompt,
        schema: { type: 'object', properties: { body: { type: 'string' } }, required: ['body'] },
        timeout: 3000
      });
      if (result?.ok && result.result?.body && typeof result.result.body === 'string') {
        const body = result.result.body.trim();
        if (body.length > 0 && body.length <= 200) return body;
      }
    } catch {
      // silent — fall through to cloud
    }
  }

  // 2. Try cloud LLM (Anthropic Messages API)
  if (typeof cloudFetchFn === 'function') {
    try {
      const result = await cloudFetchFn(prompt);
      if (result?.ok && result.body && typeof result.body === 'string') {
        const body = result.body.trim();
        if (body.length > 0 && body.length <= 200) return body;
      }
    } catch {
      // silent — fall through to deterministic
    }
  }

  return null; // both failed
}

// ── NPC finder ─────────────────────────────────────────────────────────────

function findNpcInWorld(world, npcId) {
  const id = String(npcId || '');
  if (!id) return null;
  const nodes = Array.isArray(world?.map?.nodes) ? world.map.nodes : [];
  for (const node of nodes) {
    const npcs = node?.settlement?.npcs || [];
    const npc = npcs.find(n => String(n.id) === id);
    if (npc) return { npc, nodeId: String(node.id) };
  }
  return null;
}

// ── Main minting function ──────────────────────────────────────────────────

/**
 * mintRumorForNpc(world, { npcId, seedId, seed, canonLog, queryLocalFn, cloudFetchFn, tone })
 *   -> { world, rumor, canonLog }
 *
 * seed: { id, primaryName, direction, tags[], truthBody, originNodeId }
 * canonLog: from createCanonLog()
 * queryLocalFn: optional, from localLlmProvider.queryLocal
 * cloudFetchFn: optional, async (prompt) -> { ok, body }
 * tone: optional string
 * carrierTraits: optional { honesty, trustOfOutsiders, selfPreservation } for garbling
 *
 * Idempotent: if rumor with same ID exists, returns existing without minting.
 */
export async function mintRumorForNpc(world, {
  npcId,
  seedId,
  seed,
  canonLog,
  queryLocalFn,
  cloudFetchFn,
  tone,
  carrierTraits
} = {}) {
  const w = ensureWorld(world);
  const log = canonLog && typeof canonLog === 'object' && Array.isArray(canonLog.events)
    ? canonLog
    : { events: [] };
  const turn = Number(w.time?.turn ?? 0);

  // Construct deterministic rumor ID
  const rumorId = `rumor:${String(seedId || seed?.id || '')}:${String(npcId || '')}:${turn}`;

  // Idempotency check
  const existing = (Array.isArray(w.rumors) ? w.rumors : []).find(r => r.id === rumorId);
  if (existing) {
    return { world: w, rumor: existing, canonLog: log };
  }

  // Look up NPC
  const found = findNpcInWorld(w, npcId);
  if (!found) {
    return { world: w, rumor: null, canonLog: log };
  }
  const { npc, nodeId: npcNodeId } = found;
  const sophistication = Number(npc.sophistication ?? 2);

  // Resolve seed
  const s = seed && typeof seed === 'object' ? seed : null;
  if (!s) {
    return { world: w, rumor: null, canonLog: log };
  }
  const resolvedSeedId = String(seedId || s.id || '');
  if (!resolvedSeedId) {
    return { world: w, rumor: null, canonLog: log };
  }

  // Compute hop count (origin -> NPC node)
  const originNodeId = String(s.originNodeId || '');
  const hopCount = computeHopCount(w.map, originNodeId, npcNodeId);

  // Compute tier
  const tier = computeTier(hopCount, 0, sophistication);

  // Build prompt
  const carrier = {
    name: String(npc.name || ''),
    archetype: String(npc.role || npc.archetype || ''),
    sophistication,
    traits: npc.personality || {}
  };
  const prompt = buildRumorPrompt({ seed: s, tier, carrier, tone: tone || '' });

  // Try LLM, fall back to deterministic (with garbling for tier >= 2)
  const llmBody = await tryLlmMint(prompt, {
    queryLocalFn: queryLocalFn || null,
    cloudFetchFn: cloudFetchFn || null
  });
  let body;
  if (llmBody) {
    body = llmBody;
  } else {
    // For tier >= 2 with a truth body, garble the original truth instead of
    // using the generic deterministicBody template
    const truthSummary = String(s.truthBody || s.primaryName || '').trim();
    const traits = carrierTraits || npc.personality || {};
    if (tier >= 2 && truthSummary) {
      const garbled = garbleRumor(truthSummary, tier, traits);
      body = garbled || deterministicBody(s, tier);
    } else {
      body = deterministicBody(s, tier);
    }
  }

  // Construct rumor object
  const rumor = {
    id: rumorId,
    sourceSeedId: resolvedSeedId,
    carrierNpcId: String(npcId || ''),
    hopCount,
    tier,
    age: 0,
    mintedAt: turn,
    body,
    tags: Array.isArray(s.tags) ? s.tags.map(String).slice(0, 8) : []
  };

  // Apply via delta op
  const w2 = applyDeltas(w, [{ op: 'mintRumor', rumor }]);

  // Log to Canon Log
  const nextLog = appendCanonEvent(log, {
    id: `canon:${rumorId}`,
    type: 'rumor.minted',
    targetId: rumorId,
    seedId: resolvedSeedId,
    npcId: String(npcId || ''),
    tier,
    turn
  });

  return { world: w2, rumor, canonLog: nextLog };
}

export { computeHopCount, deterministicBody };
