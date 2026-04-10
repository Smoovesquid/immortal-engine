// D01: dialogue begin/end — scene.dialogue is created, metPlayer flips, and
// endDialogue clears the branch while persisting topicsDiscussed FIFO-capped.
import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { decompressAndCanonizeSync } from '../engine/decompression/decompress.js';
import { beginDialogue, askNpc, endDialogue } from '../engine/npc/dialogue.js';

function makeWorldWithSettlement(seed = 'd01-seed') {
  let w = newWorld({ seed, fate: 0.3, pack: { primaryId: 'fantasy', mixerId: null } });
  const settlements = w.map.nodes.filter(n => n.nodeType === 'settlement');
  if (!settlements.length) throw new Error('No settlements in test world');
  const nodeId = settlements[0].id;
  w = { ...w, map: { ...w.map, currentNodeId: nodeId } };
  const pack = { objectives: ['survive'], factionPool: [{ id: 'civic', type: 'civic' }] };
  w = decompressAndCanonizeSync(w, nodeId, pack);
  return { w, nodeId, pack };
}

function getNpcs(w, nodeId) {
  return w.map.nodes.find(n => n.id === nodeId).settlement.npcs;
}

test('D01: beginDialogue creates scene.dialogue and flips metPlayer', () => {
  const { w, nodeId } = makeWorldWithSettlement();
  const npc0 = getNpcs(w, nodeId)[0];
  assert.equal(npc0.conversationState.metPlayer, false);
  assert.equal(w.scene.dialogue, null);

  const { world: w1, outcome } = beginDialogue(w, npc0.id);
  assert.equal(outcome.ok, true);
  assert.equal(outcome.npcId, npc0.id);
  assert.ok(w1.scene.dialogue, 'scene.dialogue is populated');
  assert.equal(w1.scene.dialogue.npcId, npc0.id);
  assert.equal(w1.scene.dialogue.turnsInDialogue, 0);
  assert.deepEqual(w1.scene.dialogue.topicsOffered, []);
  assert.equal(w1.scene.dialogue.lastAnswer, null);

  const npc0After = getNpcs(w1, nodeId).find(n => n.id === npc0.id);
  assert.equal(npc0After.conversationState.metPlayer, true);
});

test('D01: beginDialogue with no-matching-ref returns ok:false and does not set scene.dialogue', () => {
  const { w } = makeWorldWithSettlement();
  const { world: w1, outcome } = beginDialogue(w, 'no-such-npc-xyz');
  assert.equal(outcome.ok, false);
  assert.equal(w1.scene.dialogue, null);
});

test('D01: endDialogue clears scene.dialogue and persists topicsDiscussed FIFO-capped', () => {
  const { w, nodeId } = makeWorldWithSettlement();
  const npc0 = getNpcs(w, nodeId)[0];
  // Seed 25 pre-existing topics, plus 3 new "offered" topics — cap is 20.
  const preExisting = [];
  for (let i = 0; i < 25; i++) preExisting.push(`pre_${i}`);
  const newTopics = ['new_a', 'new_b', 'new_c'];

  // Manually seed the NPC's topicsDiscussed and force-inject scene.dialogue
  // with topicsOffered. We go through newly-cloned state, not applyDeltas.
  const seededNpcs = getNpcs(w, nodeId).map(n => {
    if (n.id !== npc0.id) return n;
    return {
      ...n,
      conversationState: {
        ...n.conversationState,
        topicsDiscussed: preExisting.slice(),
        metPlayer: true
      }
    };
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
        npcId: npc0.id,
        startedAt: 0,
        turnsInDialogue: 1,
        topicsOffered: newTopics.slice(),
        lastAnswer: null
      }
    }
  };

  const { world: w1, outcome } = endDialogue(wSeeded);
  assert.equal(outcome.ok, true);
  assert.equal(w1.scene.dialogue, null);

  const npc0After = getNpcs(w1, nodeId).find(n => n.id === npc0.id);
  const td = npc0After.conversationState.topicsDiscussed;
  assert.equal(td.length, 20, 'topicsDiscussed capped at 20');
  // The newest topics (the 3 offered) must be present; the oldest pre_ ones dropped.
  assert.ok(td.includes('new_a'));
  assert.ok(td.includes('new_c'));
  assert.ok(!td.includes('pre_0'), 'oldest topic should be evicted');
});

test('D01: endDialogue before begin is a no-op (ok:false)', () => {
  const { w } = makeWorldWithSettlement();
  const { world: w1, outcome } = endDialogue(w);
  assert.equal(outcome.ok, false);
  assert.equal(w1.scene.dialogue, null);
});

test('D01: askNpc outside dialogue returns ok:false', () => {
  const { w } = makeWorldWithSettlement();
  const { outcome } = askNpc(w, 'anything');
  assert.equal(outcome.ok, false);
});
