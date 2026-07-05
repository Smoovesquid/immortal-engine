import { newWorld } from '../engine/state.js';
try {
  const w = newWorld('tallow');
  const nodes = w.map?.nodes || [];
  const start = w.playerNode || w.player?.node || w.scene?.node;
  console.log('start node id =', start);
  const startNode = nodes.find(n => String(n.id) === String(start));
  console.log('start node name =', startNode?.name);
  console.log('start node edge fields =', JSON.stringify({edges:startNode?.edges, adj:startNode?.adj, neighbors:startNode?.neighbors, links:startNode?.links}));
  const named = nodes.filter(n => /Old Shrine|Sooted Bridge/i.test(n.name || '')).map(n => ({id:n.id,name:n.name}));
  console.log('nodes named Old Shrine / Sooted Bridge:', JSON.stringify(named));
  console.log('total nodes:', nodes.length);
  console.log('all node names:', nodes.map(n=>n.name).join(' · '));
} catch (e) { console.log('ERR', e.message, e.stack); }
