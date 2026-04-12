// Rumor propagation — aging, spreading, and forgetting.
// Called from worldTick. Deterministic via seeded RNG.
// All rumor add/remove mutations go through applyDeltas.

import { applyDeltas } from '../effectsCore.js';
import { computeTier } from './tier.js';
import { deterministicBody } from './mint.js';
import { appendCanonEvent } from '../csl/canonLog.js';

/**
 * propagateRumors(world, rng, canonLog) -> { world, canonLog }
 *
 * 1. Age all rumors by 1.
 * 2. Propagation pass: rumors with age > 30 may spread to adjacent NPCs.
 * 3. Forgetting pass: rumors with age > 60 may be forgotten.
 */
export function propagateRumors(world, rng, canonLog) {
  let w = world;
  let log = canonLog && typeof canonLog === 'object' && Array.isArray(canonLog.events)
    ? canonLog
    : { events: [] };

  const rumors = Array.isArray(w.rumors) ? w.rumors : [];
  if (!rumors.length) return { world: w, canonLog: log };

  // Phase 1: Age all rumors by 1 (direct array rebuild, not a delta op).
  const agedRumors = rumors.map(r => ({ ...r, age: (r.age ?? 0) + 1 }));
  w = { ...w, rumors: agedRumors };

  // Build adjacency lookup and NPC-by-node index for propagation.
  const nodes = Array.isArray(w.map?.nodes) ? w.map.nodes : [];
  const edges = Array.isArray(w.map?.edges) ? w.map.edges : [];

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

  // Map NPC ID -> nodeId for quick lookup.
  const npcNodeMap = new Map();
  for (const node of nodes) {
    const npcs = node?.settlement?.npcs || [];
    for (const npc of npcs) {
      if (npc.id) npcNodeMap.set(String(npc.id), String(node.id));
    }
  }

  // Phase 2: Propagation pass (age > 30).
  // Snapshot the rumor list before propagation to avoid processing newly-minted rumors.
  const propagationSnapshot = [...w.rumors];
  for (const rumor of propagationSnapshot) {
    if (rumor.age <= 30) continue;
    if (rng.nextFloat() >= 0.3) continue;

    const carrierNodeId = npcNodeMap.get(String(rumor.carrierNpcId));
    if (!carrierNodeId) continue;

    const adjacentNodeIds = adj.get(carrierNodeId) || [];
    if (!adjacentNodeIds.length) continue;

    // Collect NPCs from adjacent nodes.
    const adjacentNpcs = [];
    for (const adjNodeId of adjacentNodeIds) {
      const adjNode = nodes.find(n => String(n.id) === adjNodeId);
      if (!adjNode?.settlement?.npcs) continue;
      for (const npc of adjNode.settlement.npcs) {
        if (npc.id) adjacentNpcs.push(npc);
      }
    }
    if (!adjacentNpcs.length) continue;

    const targetNpc = rng.pick(adjacentNpcs);
    if (!targetNpc) continue;
    const targetNpcId = String(targetNpc.id);

    // Skip if target already carries a rumor with the same sourceSeedId.
    const targetRumorIds = Array.isArray(targetNpc.rumorIds) ? targetNpc.rumorIds : [];
    const currentRumors = Array.isArray(w.rumors) ? w.rumors : [];
    const alreadyHas = currentRumors.some(r =>
      r.sourceSeedId === rumor.sourceSeedId && r.carrierNpcId === targetNpcId
    );
    if (alreadyHas) continue;

    // Build new rumor.
    const newHopCount = (rumor.hopCount ?? 0) + 1;
    const targetSophistication = Number(targetNpc.sophistication ?? 2);
    const newTier = computeTier(newHopCount, 0, targetSophistication);
    const turn = w.time?.turn ?? 0;
    const newRumorId = `rumor:${rumor.sourceSeedId}:${targetNpcId}:${turn}`;

    // Build a minimal seed object for deterministicBody.
    const seed = { id: rumor.sourceSeedId, tags: rumor.tags || [] };
    const newBody = deterministicBody(seed, newTier);

    const newRumor = {
      id: newRumorId,
      sourceSeedId: rumor.sourceSeedId,
      carrierNpcId: targetNpcId,
      hopCount: newHopCount,
      tier: newTier,
      age: 0,
      mintedAt: turn,
      body: newBody,
      tags: Array.isArray(rumor.tags) ? [...rumor.tags] : []
    };

    // Temporarily set currentNodeId to the target NPC's node so mutateNpc works.
    const targetNodeId = npcNodeMap.get(targetNpcId);
    const savedCurrentNodeId = w.map.currentNodeId;
    if (targetNodeId) {
      w = { ...w, map: { ...w.map, currentNodeId: targetNodeId } };
    }
    w = applyDeltas(w, [{ op: 'mintRumor', rumor: newRumor }]);
    // Restore currentNodeId.
    w = { ...w, map: { ...w.map, currentNodeId: savedCurrentNodeId } };

    log = appendCanonEvent(log, {
      id: `canon:propagate:${newRumorId}`,
      type: 'rumor.propagated',
      targetId: newRumorId,
      rumorId: rumor.id,
      fromNpcId: rumor.carrierNpcId,
      toNpcId: targetNpcId,
      newTier,
      turn
    });
  }

  // Phase 3: Forgetting pass (age > 60).
  const forgetSnapshot = [...(Array.isArray(w.rumors) ? w.rumors : [])];
  for (const rumor of forgetSnapshot) {
    if (rumor.age <= 60) continue;
    if (rng.nextFloat() >= 0.2) continue;

    // Temporarily set currentNodeId to the carrier NPC's node.
    const carrierNodeId = npcNodeMap.get(String(rumor.carrierNpcId));
    const savedCurrentNodeId = w.map.currentNodeId;
    if (carrierNodeId) {
      w = { ...w, map: { ...w.map, currentNodeId: carrierNodeId } };
    }
    w = applyDeltas(w, [{ op: 'forgetRumor', rumorId: rumor.id }]);
    // Restore currentNodeId.
    w = { ...w, map: { ...w.map, currentNodeId: savedCurrentNodeId } };

    log = appendCanonEvent(log, {
      id: `canon:forget:${rumor.id}`,
      type: 'rumor.forgotten',
      targetId: rumor.id,
      rumorId: rumor.id,
      carrierId: rumor.carrierNpcId,
      turn: w.time?.turn ?? 0
    });
  }

  return { world: w, canonLog: log };
}
