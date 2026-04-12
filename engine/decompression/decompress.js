// Decompression orchestrator — the full pipeline from thin node to living settlement.
// settlementTicker → detectEvents → extractPresent → (optional) texturize → canonize

import { runSettlementHistory } from './settlementTicker.js';
import { extractPresent } from './extractPresent.js';
import { texturize } from './texturize.js';
import { seedFromString, makeRng } from '../rng.js';
import { computeNpcDepth } from '../npc/npcDepth.js';
import { generateSettlementNPCs } from '../npc/npcGenesis.js';
import { generateNodeFurniture } from './generateFurniture.js';

export async function decompressAndCanonize(world, nodeId, pack, llmOptions = {}) {
  const node = world.map.nodes.find(n => n.id === nodeId);
  if (!node) return world;
  if (node.settlement?.decompressed) return world;

  // Step 1: Run history simulation
  const { finalState, history, tickCount, tags } = runSettlementHistory(node, world, pack);

  // Step 2: Extract present-state entities
  const extractRng = makeRng(seedFromString(`${nodeId}|${world.meta.seed}|extract`));
  const settlement = extractPresent(history, finalState, tags, pack, extractRng);

  // Step 3: Compute NPC depth (personality, knowledge, relationships, secrets)
  const depthSeed = `${nodeId}|${world.meta.seed}|depth`;
  const deepNpcs = computeNpcDepth(settlement.npcs, history, settlement.secrets, depthSeed);
  const deepSettlement = { ...settlement, npcs: deepNpcs };

  // Step 4: Optional LLM texture
  const textured = await texturize(deepSettlement, history, pack, llmOptions);

  // Pass T2 — hostile NPC gap fix (async path).
  const texturedNpcs = ensureHostileNpc(textured.npcs || [], world, nodeId);
  const texturedWithHostile = { ...textured, npcs: texturedNpcs };

  // Step 5: Canonize on the node
  const canonized = {
    ...texturedWithHostile,
    decompressed: true,
    decompressedAt: world.time?.scene ?? 0,
    tickCount
  };

  const furniture = generateNodeFurniture(nodeId, world.meta.seed);

  const updatedNodes = world.map.nodes.map(n =>
    n.id === nodeId
      ? { ...n, settlement: canonized, furniture: (Array.isArray(n.furniture) && n.furniture.length ? n.furniture : furniture) }
      : n
  );

  return {
    ...world,
    map: { ...world.map, nodes: updatedNodes }
  };
}

// Synchronous version for offline/non-LLM mode
export function decompressAndCanonizeSync(world, nodeId, pack) {
  const node = world.map.nodes.find(n => n.id === nodeId);
  if (!node) return world;
  if (node.settlement?.decompressed) return world;

  const { finalState, history, tickCount, tags } = runSettlementHistory(node, world, pack);

  const extractRng = makeRng(seedFromString(`${nodeId}|${world.meta.seed}|extract`));
  const settlement = extractPresent(history, finalState, tags, pack, extractRng);

  // Compute NPC depth for offline mode too
  const depthSeed = `${nodeId}|${world.meta.seed}|depth`;
  const deepNpcs = computeNpcDepth(settlement.npcs, history, settlement.secrets, depthSeed);

  // Generate deterministic names and conversation state via npcGenesis
  const buildingTypes = settlement.buildings.map(b => String(b.name || '').split(' ').pop());
  const genesisNpcs = generateSettlementNPCs(
    nodeId, world.meta.seed, pack,
    world.factions, world.ecology,
    { buildings: buildingTypes }
  );

  // Merge genesis data (name, conversationState, disposition) onto depth NPCs.
  // Pass C1.1 — also merge genesis knowledgeGraph. Genesis seeds deterministic
  // public facts so fresh-world NPCs have shareable topics; without this merge
  // the seeds never reach askNpc and dialogue always deflects.
  const namedNpcs = deepNpcs.map((npc, i) => {
    const gen = genesisNpcs[i];
    if (!gen) return { ...npc, name: npc.name || `the ${npc.role}`, description: '', factualDetail: '' };
    const mergedKg = mergeKnowledgeGraphs(npc.knowledgeGraph, gen.knowledgeGraph);
    return {
      ...npc,
      name: gen.name,
      conversationState: gen.conversationState,
      knowledgeGraph: mergedKg,
      description: '',
      factualDetail: ''
    };
  });

  // Pass T2 — hostile NPC gap fix. If no hostile NPC exists in any
  // decompressed settlement in the world AND none in the current batch,
  // seed a hostile bandit. Deterministic: same seed+node → same bandit.
  const finalNpcs = ensureHostileNpc(namedNpcs, world, nodeId);

  const offlineSettlement = {
    ...settlement,
    npcs: finalNpcs,
    buildings: settlement.buildings.map(b => ({ ...b, description: '' })),
    sensory: '',
    textured: false,
    decompressed: true,
    decompressedAt: world.time?.scene ?? 0,
    tickCount
  };

  const furniture = generateNodeFurniture(nodeId, world.meta.seed);

  const updatedNodes = world.map.nodes.map(n =>
    n.id === nodeId
      ? { ...n, settlement: offlineSettlement, furniture: (Array.isArray(n.furniture) && n.furniture.length ? n.furniture : furniture) }
      : n
  );

  return {
    ...world,
    map: { ...world.map, nodes: updatedNodes }
  };
}

// Pass T2 — ensure at least one hostile NPC exists in the world.
// Scans all decompressed settlements for any hostile NPC. If none found
// and the current batch has none, appends a hostile bandit. Deterministic:
// bandit name is seeded from nodeId + world seed.
function ensureHostileNpc(npcs, world, nodeId) {
  // Check if any hostile already exists in decompressed settlements
  const nodes = Array.isArray(world.map?.nodes) ? world.map.nodes : [];
  for (const n of nodes) {
    const snpcs = n.settlement?.decompressed ? (n.settlement.npcs || []) : [];
    if (snpcs.some(npc => npc.hostile === true)) return npcs;
  }
  // Check if the current batch already has one
  if (npcs.some(npc => npc.hostile === true)) return npcs;

  // Seed a hostile bandit deterministically
  const banditRng = makeRng(seedFromString(`${nodeId}|${world.meta?.seed || ''}|hostile_bandit`));
  const BANDIT_NAMES = [
    'Greyhand', 'The Thorn', 'Ashblade', 'Rattleclaw',
    'Brokefang', 'Nighttooth', 'Scarvein', 'Duskfang'
  ];
  const name = BANDIT_NAMES[banditRng.int(0, BANDIT_NAMES.length - 1)];

  const bandit = {
    id: `npc_${nodeId}_hostile_0`,
    name,
    role: 'bandit',
    archetypeDesc: '',
    factionId: null,
    originTick: 0,
    disposition: {},
    hostile: true,
    combatProfile: { maxHp: 10, damage: 3, canParley: false },
    knowledgeGraph: [],
    conversationState: {
      metPlayer: false,
      topicsDiscussed: [],
      trustLevel: 0,
      lastInteraction: null
    },
    // Match npcDepth output shape so downstream consumers don't break.
    personality: { honesty: 0.3, trustOfOutsiders: 0.1, selfPreservation: 0.8 },
    witnessedEvents: [],
    secrets: [],
    playerRelationship: { trust: 0, meetings: 0, sharedFacts: [] },
    revealedSecrets: [],
    description: '',
    factualDetail: ''
  };

  return [...npcs, bandit];
}

// Pass C1.1 — dedupe-by-factId union of depth kg and genesis kg.
// Depth facts (from witnessed events) win over genesis seeds on collision,
// preserving canonical event-derived knowledge when history is non-empty.
function mergeKnowledgeGraphs(depthKg, genKg) {
  const out = [];
  const seen = new Set();
  const deep = Array.isArray(depthKg) ? depthKg : [];
  const gen = Array.isArray(genKg) ? genKg : [];
  for (const f of deep) {
    const id = String(f?.factId || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(f);
  }
  for (const f of gen) {
    const id = String(f?.factId || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(f);
  }
  return out;
}
