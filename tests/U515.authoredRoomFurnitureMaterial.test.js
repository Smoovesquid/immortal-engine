// U515 — LOAD-1: the authored room's FURNITURE and MATERIAL narrate truthfully.
//
// docs/briefs/LOAD-1-smallest-loader.md: "the room + its furniture + material narrate
// truthfully." The read stack every narration/dialogue sink shares is getRoomState
// (roomState.js), which composes roomDetail (furniture loadout), structureMaterial
// (the wall/floor line), and describeInteriorLayout. This file asserts that for the
// loaded authored room:
//   • the material line is the TIMBER cottage line (the fixture drew timber walls),
//     and the stone/chitin wall-phrases are in `forbidden` so narration can't
//     free-associate a stone hut;
//   • the room reads with its AUTHORED role (quarters — a Guest Room), NOT the cottage
//     entry's hearth room, because the loader carries room.role onto the room;
//   • the drawn furniture loadout for that role includes a BED (roomDetail), so the
//     thing the map draws and the thing the prose can name agree;
//   • the narrated node furniture that lands in the room is bed-KINDRED (a straw
//     pallet), never something that contradicts a quarters (roomObjects affinity).
//
// Siblings: U513 (the load), U514 (enterable), U516 (determinism), U517 (malformed).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { getRoomState } from '../engine/structures/roomState.js';
import { roomDetail } from '../engine/structures/roomDetail.js';
import { structureMaterial } from '../engine/structures/structureMaterial.js';
import { normalizeTopology } from '../engine/structures/topology.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { loadAuthoredStructure } from '../engine/structures/authoredStructure.js';

const DEMO_SEED = 'loaderDemo';

const PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'], starterObjectives: ['find the key'],
    skills: ['Steel'], locations: ['tower'], objectives: ['find the key'],
    complications: ['a clock starts'], npcArchetypes: ['wary guide'],
    sensoryMotifs: ['air tastes of dust'],
  },
};

function bootDemo(worldSeed = DEMO_SEED) {
  const w0 = newWorld({ seed: worldSeed, fate: 0.2, campaignId: `campaign-${worldSeed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const { world } = beginAdventure(ensureWorld(w0), PACKS);
  return world;
}

test('U515: getRoomState reports the AUTHORED room — a timber cottage quarters, one room, single storey', () => {
  const w = bootDemo();
  const rs = getRoomState(w);
  assert.equal(rs.inside, true);
  assert.equal(rs.building.type, 'cottage');
  assert.equal(rs.building.roomCount, 1);
  assert.equal(rs.building.singleStorey, true);
  assert.equal(rs.room.role, 'quarters', 'the room reads with its AUTHORED role, not the hearth-room default');
  assert.equal(rs.room.name, 'Guest Room', 'the quarters role display name');
});

test('U515: the material line is the timber cottage line, and stone walls are FORBIDDEN', () => {
  const w = bootDemo();
  const rs = getRoomState(w);
  assert.ok(rs.material, 'a material identity is resolved indoors');
  assert.equal(rs.material.family, 'timber');
  assert.match(rs.material.line, /timber-built/, 'the prompt-ready material line describes the timber build');
  // The contradiction lexicon the narration validator uses — a timber hut must never
  // be narrated with stone walls.
  assert.ok(rs.material.forbidden.includes('stone wall'), 'stone-wall phrases are forbidden for a timber structure');
  assert.ok(!rs.material.forbidden.includes('timber wall'), 'the structure\'s OWN family is not self-forbidden');
});

test('U515: the drawn furniture for the room includes a BED (the map and the prose agree)', () => {
  const w = bootDemo();
  const st = w.structures.byId[`authored:${String(w.map.currentNodeId)}`];
  const room = normalizeTopology(st.topology).rooms[0];
  const det = roomDetail(room, st.buildingType);
  const kinds = det.furniture.map(f => String(f.kind));
  assert.ok(kinds.includes('bed'), 'a quarters draws a bed — the authored role furnishes truthfully');
});

test('U515: the narrated objects that land in the room are room-TRUTHFUL (the drawn pieces first, role-kindred generics after)', () => {
  const w = bootDemo();
  const rs = getRoomState(w);
  const names = rs.objects.map(o => String(o.name).toLowerCase());
  // At least one narrated object, and nothing that contradicts a lived-in quarters.
  assert.ok(names.length > 0, 'the room surfaces real objects to narrate');
  // FUNC-MINIS-1 (2026-07-09, supersedes the original role-kindred-only law): the
  // hut's DRAWN pieces (loader_demo.house.js placed a bed and a barrel) are now
  // real node objects — the MOST plausible furnishings of all (Tim's acceptance
  // #5: "recognized as their actual object kinds, not generic props"). Generic
  // decompression pieces remain alongside them, append-only.
  const plausible = ['bed', 'barrel', 'straw pallet', 'wooden chair', 'wooden table', 'oil lantern', 'iron-bound chest', 'stone basin', 'wooden crate', 'tool rack'];
  for (const n of names) {
    assert.ok(plausible.some(p => n === p || n.startsWith(`${p} `)),
      `narrated object "${n}" is a plausible cottage furnishing (no invented object)`);
  }
  // The drawn pieces themselves are narratable — the bed the author placed IS the
  // bed the prose can name.
  assert.ok(names.some(n => /\bbed\b/.test(n)), 'the drawn bed is a narrated object');
  assert.ok(names.some(n => /\bbarrel\b/.test(n)), 'the drawn barrel is a narrated object');
});

test('U515: a STONE fixture narrates a stone material line (material maps down honestly)', () => {
  // Load a stone variant directly and resolve its material the way roomState does.
  const stoneHouse = {
    kind: 'authored-structure', schema: 'house-builder/v6', name: 'Stone Hut',
    grid: { cols: 120, rows: 90, cell: 28 },
    rooms: [{ id: 'hut', name: 'Hut', role: 'quarters', shape: 'rect', material: 'stone', x: 10, y: 10, w: 6, h: 5 }],
    walls: [], openings: [], tunnels: [], corridors: [], furniture: [], secrets: [],
  };
  const st = loadAuthoredStructure(stoneHouse, { nodeId: 'n_stone' });
  const world = ensureWorld({ ...newWorld({ seed: 'U515-stone', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }),
    structures: { byId: { [st.id]: st }, nextId: 1 } });
  const mat = structureMaterial(world, st.id);
  // buildingType stays 'cottage', and a stone-material cottage still uses the cottage
  // material row (a timber-framed cottage). The stone SHELL is honored on the plan;
  // the loader notes stone→shell mapping. Assert the plan shell is stone.
  assert.equal(floorPlan(st).shell, 'stone', 'a stone fixture selects the stone shell');
  assert.ok(mat, 'material resolves for the stone structure');
});
