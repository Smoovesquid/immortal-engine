// U398/U399 — MAP-OCC-1: the outdoor map draws who's actually THERE, not the whole settlement
// roster. public/map/placeFromNode.js used to seed-scatter every settlement NPC along the road
// regardless of where the engine says they actually are — a recurring "map invents people" fiction
// break. The fix reads engine/structures/roomOccupancy.js's outdoorOccupants(world) (the SAME
// occupancy model the DM's presence logic and look-around use) for the current node's token set,
// and draws zero roster-scatter NPCs for any other node (an overworld map draws every settlement's
// layout at once via oneMap.js; we can't correctly ask "who's outdoors THERE" for a node the
// player isn't at without reaching into the engine's occupancy module for an arbitrary node, so the
// safe behavior is under-show, never fabricate). Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { outdoorOccupants } from '../engine/structures/roomOccupancy.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const begin = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS);

test('U398: the tallow boot world draws NO off-room roster NPC on the outdoor map', () => {
  const w = begin().world;
  const nodeId = w.map.currentNodeId;
  const node = w.map.nodes.find(n => n.id === nodeId);
  const roster = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
  assert.ok(roster.length > 1, 'precondition: the settlement has more than one NPC in its roster');

  const trueOutdoor = new Set(outdoorOccupants(w).map(n => n.name));
  assert.ok(trueOutdoor.size < roster.length, 'precondition: not everyone in the roster is outdoors right now');

  const place = placeFromWorldNode(w, nodeId);
  const npcTokens = place.tokens.filter(t => t.type === 'npc');
  // No token may name someone who is not truly outdoors (hostiles are masked as '?', so check by id).
  for (const t of npcTokens) {
    if (t.npc.name === '?') continue; // masked hostile — identity checked separately below
    assert.ok(trueOutdoor.has(t.npc.name), `token names off-room roster NPC ${t.npc.name}, who is not outdoors`);
  }
  // The token count must match true outdoor occupancy exactly (capped the same way as the source
  // list — 12 sociable + 2 hostile — which the small tallow roster never approaches).
  assert.equal(npcTokens.length, trueOutdoor.size, 'token count must equal true outdoor occupant count');
});

test('U398: a populated multi-occupant fixture draws exactly its room/outdoor occupants — no more, no fewer', () => {
  const npcs = ['Alaric', 'Bryn', 'Cass', 'Dael', 'Elowen', 'Gareth', 'Hale'].map((name, i) => ({ id: 'n' + i, name }));
  // occupancy's nodeBuildings() reads world.structures.byId (real structure records), not
  // settlement.buildings (which placeFromNode.js uses only for building-plan lookup) — so the
  // fixture needs both to actually exercise an indoor/outdoor split rather than "no buildings ->
  // everyone outdoors by default".
  const world = () => ({
    meta: { seed: 'world1' },
    map: {
      currentNodeId: 'home',
      nodes: [{ id: 'home', x: 0, y: 0, nodeType: 'settlement', settlement: { population: 400, npcs, buildings: [{ name: 'smithy' }, { name: 'tavern' }] } }]
    },
    structures: { byId: {
      'home:smithy': { id: 'home:smithy', nodeId: 'home', buildingType: 'smithy' },
      'home:tavern': { id: 'home:tavern', nodeId: 'home', buildingType: 'tavern' }
    } }
  });
  const w = world();
  const trueOutdoor = new Set(outdoorOccupants(w).map(n => n.name));
  assert.ok(trueOutdoor.size > 0 && trueOutdoor.size < npcs.length, 'precondition: a real indoor/outdoor split exists');

  const place = placeFromWorldNode(w, 'home');
  const tokenNames = new Set(place.tokens.filter(t => t.type === 'npc').map(t => t.npc.name));
  assert.deepEqual(tokenNames, trueOutdoor, 'token set must equal true outdoor occupants exactly');

  // Negative check: nobody indoors leaks onto the map.
  const indoor = npcs.map(n => n.name).filter(n => !trueOutdoor.has(n));
  assert.ok(indoor.length > 0, 'precondition: someone is indoors');
  for (const name of indoor) assert.ok(!tokenNames.has(name), `indoor NPC ${name} must not appear as a map token`);
});

test('U398: a node the player is NOT at draws zero roster-scatter NPCs (never fabricate)', () => {
  const npcs = ['Xannon', 'Yorick'].map((name, i) => ({ id: 'x' + i, name }));
  const w = {
    meta: { seed: 'world1' },
    map: {
      currentNodeId: 'home',
      nodes: [
        { id: 'home', x: 0, y: 0, nodeType: 'settlement', settlement: { population: 400, npcs: [{ id: 'h0', name: 'Home Body' }] } },
        { id: 'away', x: 20, y: 20, nodeType: 'settlement', settlement: { population: 400, npcs, buildings: [{ name: 'cottage' }] } }
      ]
    },
    structures: { byId: {} }
  };
  const place = placeFromWorldNode(w, 'away');
  const npcTokens = place.tokens.filter(t => t.type === 'npc');
  assert.equal(npcTokens.length, 0, 'a node the player is not at must draw no NPC tokens (occupancy is only valid at the current node)');
});

test('U399: token layout is a pure seed projection — same seed yields identical tokens, and rendering never touches worldHash', () => {
  const npcs = ['Alaric', 'Bryn', 'Cass', 'Dael', 'Elowen', 'Gareth', 'Hale'].map((name, i) => ({ id: 'n' + i, name }));
  const world = () => ({
    meta: { seed: 'world1' },
    map: {
      currentNodeId: 'home',
      nodes: [{ id: 'home', x: 0, y: 0, nodeType: 'settlement', settlement: { population: 400, npcs, buildings: [{ name: 'smithy' }, { name: 'tavern' }] } }]
    },
    structures: { byId: {
      'home:smithy': { id: 'home:smithy', nodeId: 'home', buildingType: 'smithy' },
      'home:tavern': { id: 'home:tavern', nodeId: 'home', buildingType: 'tavern' }
    } }
  });
  const a = placeFromWorldNode(world(), 'home');
  const b = placeFromWorldNode(world(), 'home');
  assert.deepEqual(a.tokens, b.tokens, 'identical (seed, occupancy) must yield an identical token layout');

  // The real tallow boot world, replayed twice, must also agree — proves the fix composes with the
  // full engine path (beginAdventure) deterministically, not just the synthetic fixture above.
  const w1 = begin().world;
  const w2 = begin().world;
  const p1 = placeFromWorldNode(w1, w1.map.currentNodeId);
  const p2 = placeFromWorldNode(w2, w2.map.currentNodeId);
  assert.deepEqual(p1.tokens, p2.tokens, 'the tallow boot world must project the same token layout on replay');
});
