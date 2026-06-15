// U139 — D1b: the populated crawl (docs/WORLD_AND_DUNGEONS.md Part B).
// Small dungeons hold encounters + treasure; entering a room with an un-cleared
// denizen starts a fight and tags the room cleared (no re-spawn); a room's hoard
// is taken once, then it's looted. All deterministic / replay-stable.

import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { generateDungeon } from '../engine/dungeon/generate.js';
import { biomeForNode } from '../engine/world/biome.js';
import { worldHash } from '../engine/worldHash.js';

const PACKS = { fantasy: { id: 'fantasy', toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] }, starterLocations: ['t'], starterObjectives: ['k'], skills: ['S'], locations: ['t'], objectives: ['k'], complications: ['c'], npcArchetypes: ['g'], sensoryMotifs: ['d'] } };

function atEntrance(seed) {
  let w = beginAdventure(newWorld({ seed, fate: 0.3, campaignId: `d1-${seed}`, pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  const ent = (w.map.nodes || []).find(n => n.nodeType === 'dungeon_entrance');
  w = ensureWorld({ ...w, map: { ...w.map, currentNodeId: ent.id }, scene: { ...w.scene, interior: null }, party: (w.party || []).map(p => ({ ...p, position: { ...(p.position || {}), nodeId: ent.id, interior: undefined } })) });
  return { w, ent, biome: biomeForNode(w.meta.seed, ent) };
}
// BFS path from entry to the first room matching pred, over the generated graph.
function pathTo(dn, pred) {
  const L = dn.levels[0];
  const target = Object.values(L.rooms).find(pred);
  if (!target) return null;
  const prev = new Map([['r:entry', null]]); const q = ['r:entry'];
  while (q.length) { const x = q.shift(); for (const nb of (L.rooms[x].exits || [])) if (!prev.has(nb)) { prev.set(nb, x); q.push(nb); } }
  const path = []; let c = target.id; while (c) { path.unshift(c); c = prev.get(c); }
  return { path, target };
}

test('U139-01: a small dungeon is populated with encounters and treasure', () => {
  const dn = generateDungeon('blackvale', 'nX', { biome: 'mountains' });
  const rms = Object.values(dn.levels[0].rooms);
  assert.ok(rms.some(r => r.contents.some(c => c.kind === 'encounter')), 'has encounters');
  assert.ok(rms.some(r => r.contents.some(c => c.kind === 'treasure')), 'has treasure');
  // the vault always holds both a feature and (per design) its guardian + hoard.
  const vault = rms.find(r => r.role === 'vault');
  assert.ok(vault.contents.some(c => c.kind === 'treasure'), 'the vault holds a hoard');
});

test('U139-02: entering an encounter room starts combat and clears the room', () => {
  const { w: w0, ent, biome } = atEntrance('blackvale');
  const dn = generateDungeon(w0.meta.seed, ent.id, { biome });
  const found = pathTo(dn, r => r.contents.some(c => c.kind === 'encounter'));
  assert.ok(found, 'an encounter room exists');
  let w = playerMove(w0, PACKS, 'descend').world;
  for (let i = 1; i < found.path.length && !w.combat?.active; i++) w = playerMove(w, PACKS, 'go ' + found.path[i]).world;
  assert.ok(w.combat?.active, 'combat begins on entering the denizen\'s room');
  assert.ok((w.combat.enemies || []).length >= 1, 'a real enemy is in the field');
  const sroom = w.structures.byId[`dungeon:${ent.id}`].topology.rooms.find(r => r.id === found.target.id);
  assert.ok((sroom.tags || []).includes('cleared'), 'the room is tagged cleared (no re-spawn)');
});

test('U139-03: a room\'s hoard is taken once, then it\'s looted', () => {
  const { w: w0, ent, biome } = atEntrance('blackvale');
  const dn = generateDungeon(w0.meta.seed, ent.id, { biome });
  const treRoom = Object.values(dn.levels[0].rooms).find(r => r.contents.some(c => c.kind === 'treasure'));
  let w = playerMove(w0, PACKS, 'descend').world;
  // drop the player into the treasure room (avoids fighting through to it).
  w = ensureWorld({ ...w, scene: { ...w.scene, interior: { ...w.scene.interior, roomId: treRoom.id } } });
  const before = w.party[0].purse?.gold || 0;
  const r1 = playerMove(w, PACKS, 'I take the treasure'); w = r1.world;
  assert.ok((w.party[0].purse?.gold || 0) > before, 'gold increased');
  assert.match(r1.output.narration, /gold from the hoard/);
  const sroom = w.structures.byId[`dungeon:${ent.id}`].topology.rooms.find(r => r.id === treRoom.id);
  assert.ok((sroom.tags || []).includes('looted'), 'the room is tagged looted');
  const goldAfter = w.party[0].purse?.gold || 0;
  const r2 = playerMove(w, PACKS, 'I take the treasure'); w = r2.world;
  assert.equal(w.party[0].purse?.gold || 0, goldAfter, 'no double-dipping');
  assert.match(r2.output.narration, /already cleaned/);
});

test('U139-04: the crawl is deterministic (descend + a move replays identically)', () => {
  const run = () => {
    const { w: w0, ent } = atEntrance('blackvale');
    const dn = generateDungeon(w0.meta.seed, ent.id, { biome: biomeForNode(w0.meta.seed, ent) });
    const exit = dn.levels[0].rooms['r:entry'].exits[0];
    let w = playerMove(w0, PACKS, 'descend').world;
    w = playerMove(w, PACKS, 'go ' + exit).world;
    return worldHash(w);
  };
  assert.equal(run(), run());
});
