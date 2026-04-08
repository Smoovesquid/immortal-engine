// Decompression orchestrator — the full pipeline from thin node to living settlement.
// settlementTicker → detectEvents → extractPresent → (optional) texturize → canonize

import { runSettlementHistory } from './settlementTicker.js';
import { extractPresent } from './extractPresent.js';
import { texturize } from './texturize.js';
import { seedFromString, makeRng } from '../rng.js';
import { computeNpcDepth } from '../npc/npcDepth.js';

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

  const updatedNodes = world.map.nodes.map(n =>
    n.id === nodeId ? { ...n, settlement: canonized } : n
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

  // Offline: template-fill names
  const offlineSettlement = {
    ...settlement,
    npcs: deepNpcs.map(n => ({ ...n, name: n.name || `the ${n.role}`, description: '', factualDetail: '' })),
    buildings: settlement.buildings.map(b => ({ ...b, description: '' })),
    sensory: '',
    textured: false,
    decompressed: true,
    decompressedAt: world.time?.scene ?? 0,
    tickCount
  };

  const updatedNodes = world.map.nodes.map(n =>
    n.id === nodeId ? { ...n, settlement: offlineSettlement } : n
  );

  return {
    ...world,
    map: { ...world.map, nodes: updatedNodes }
  };
}
