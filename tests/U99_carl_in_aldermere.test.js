import { test } from 'node:test';
import assert from 'node:assert';
import { newWorld } from '../engine/state.js';
import { decompressAndCanonizeSync } from '../engine/decompression/decompress.js';

test('U99 — Carl appears in Aldermere on slice seed', async () => {
  const world = newWorld({ seed: 'aldermere' });
  
  const nodes = world.map.nodes;
  console.log('Nodes in world:', nodes.map(n => `${n.name} (${n.nodeType})`).join(', '));
  
  // Find Aldermere (should be a settlement)
  const aldermereNode = nodes.find(n => n.name === 'Aldermere');
  assert(aldermereNode, `Aldermere found (nodes: ${nodes.map(n => n.name).join(', ')})`);
  assert.equal(aldermereNode.nodeType, 'settlement', 'Aldermere is a settlement');
  
  // Decompress to trigger NPC generation and figure injection
  const decompressed = decompressAndCanonizeSync(world, aldermereNode.id, world.pack);
  const aldermereDecomp = decompressed.map.nodes.find(n => n.id === aldermereNode.id);
  assert(aldermereDecomp.settlement, 'Aldermere has settlement');
  
  const npcs = aldermereDecomp.settlement.npcs;
  console.log('NPCs:', npcs.map(n => `${n.name} (${n.voiceCorpusId})`).join(', '));
  
  // Check for Carl
  const carl = npcs.find(n => n.name === 'Carl');
  assert(carl, `Carl found in NPCs. Roster: ${npcs.map(n => n.name).join(', ')}`);
  assert.equal(carl.id, 'figure_carl');
  assert.equal(carl.voiceCorpusId, 'carl_manifesto');
  assert.equal(carl.role, 'failed sculptor; avian theorist');
});
