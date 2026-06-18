// U185 (H-9): continuity-challenge — when the player quotes the NPC back to
// themselves ("first you said X, now Y, which is it?"), the engine must resolve
// the contradiction (reaffirm the prior fact) or honestly admit uncertainty —
// it must NEVER fall through to mode=deflected (atmospheric avoidance).
import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { decompressAndCanonizeSync } from '../engine/decompression/decompress.js';
import { beginDialogue, askNpc } from '../engine/npc/dialogue.js';

function makeWorldInDialogue(seed = 'u185-seed') {
  let w = newWorld({ seed, fate: 0.3, pack: { primaryId: 'fantasy', mixerId: null } });
  const settlements = w.map.nodes.filter(n => n.nodeType === 'settlement');
  if (!settlements.length) throw new Error('No settlements in test world');
  const nodeId = settlements[0].id;
  w = { ...w, map: { ...w.map, currentNodeId: nodeId } };
  const pack = { objectives: ['survive'], factionPool: [{ id: 'civic', type: 'civic' }] };
  w = decompressAndCanonizeSync(w, nodeId, pack);
  const npc0 = w.map.nodes.find(n => n.id === nodeId).settlement.npcs[0];
  const { world: w1 } = beginDialogue(w, npc0.id);
  return { w: w1, nodeId, npcId: npc0.id };
}

test('U185: bare contradiction challenge admits uncertainty, never deflects', () => {
  const { w } = makeWorldInDialogue();
  const { outcome } = askNpc(w, 'First you said the bridge was safe, now you say it is broken — which is it?');
  assert.equal(outcome.ok, true);
  assert.notEqual(outcome.mode, 'deflected', 'must not deflect a contradiction challenge');
  assert.equal(outcome.mode, 'continuity');
  assert.equal(outcome.continuityResolved, false, 'no prior fact on record → admits uncertainty');
});

test('U185: challenge reaffirms the last fact the NPC actually shared', () => {
  const { w, nodeId, npcId } = makeWorldInDialogue();
  // Seed the NPC with a concrete known fact and mark it as the last answer.
  const seededNpcs = w.map.nodes.find(n => n.id === nodeId).settlement.npcs.map(n => {
    if (n.id !== npcId) return n;
    const kg = Array.isArray(n.knowledgeGraph) ? n.knowledgeGraph.slice() : [];
    kg.push({ factId: 'mill_fire_account', body: 'The mill burned the night the river rose.' });
    return { ...n, knowledgeGraph: kg };
  });
  const wSeeded = {
    ...w,
    map: {
      ...w.map,
      nodes: w.map.nodes.map(n =>
        n.id === nodeId ? { ...n, settlement: { ...n.settlement, npcs: seededNpcs } } : n
      )
    },
    scene: {
      ...w.scene,
      dialogue: {
        ...w.scene.dialogue,
        lastAnswer: { factId: 'mill_fire_account', mode: 'shared', trustAtTime: 5 }
      }
    }
  };

  const { outcome } = askNpc(wSeeded, "That's not what you said before — which is it?");
  assert.equal(outcome.mode, 'continuity');
  assert.notEqual(outcome.mode, 'deflected');
  assert.equal(outcome.continuityResolved, true);
  assert.equal(outcome.factId, 'mill_fire_account');
});

test('U185: an ordinary skeptical question does NOT misfire into continuity', () => {
  const { w } = makeWorldInDialogue();
  const { outcome } = askNpc(w, 'Are you sure about that? Really?');
  assert.notEqual(outcome.mode, 'continuity', 'plain skepticism is not a continuity challenge');
});
