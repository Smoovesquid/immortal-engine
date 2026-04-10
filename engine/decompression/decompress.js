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

  // Step 5: Canonize on the node
  const canonized = {
    ...textured,
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

  // Merge genesis data (name, conversationState, disposition) onto depth NPCs
  const namedNpcs = deepNpcs.map((npc, i) => {
    const gen = genesisNpcs[i];
    if (!gen) return { ...npc, name: npc.name || `the ${npc.role}`, description: '', factualDetail: '' };
    return {
      ...npc,
      name: gen.name,
      conversationState: gen.conversationState,
      description: '',
      factualDetail: ''
    };
  });

  const offlineSettlement = {
    ...settlement,
    npcs: namedNpcs,
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
