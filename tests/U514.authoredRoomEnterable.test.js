// U514 — LOAD-1: the loaded authored room is ENTERABLE and EXITABLE through the real
// interiors.js seam, and the seed-gated demo attaches it at boot.
//
// docs/briefs/LOAD-1-smallest-loader.md: "from that node the player can ENTER, LOOK
// AROUND, and EXIT — with NO invented geography beyond the one room." This file walks
// that path for real: boot the 'loaderDemo' seed (the demo wire-in in
// applyGeneratedStructuresForNode attaches the authored hut at the start node), then
// enter / exit via enterStructureInterior / exitStructureInterior — the SAME
// primitives playloop.js calls — asserting occupancy and scene are sane at every step
// and invariants never throw.
//
// Siblings: U513 (the load), U515 (furniture + material narrate), U516 (determinism),
// U517 (malformed + default boot byte-identical).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import {
  enterStructureInterior,
  exitStructureInterior,
  getInteriorView,
  describeInteriorLayout,
} from '../engine/structures/interiors.js';
import { floorPlan } from '../engine/structures/floorPlan.js';

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
function demoIdFor(world) { return `authored:${String(world.map.currentNodeId)}`; }

test('U514: the demo seed attaches the authored one-room hut at the start node', () => {
  const w = bootDemo();
  const st = w.structures.byId[demoIdFor(w)];
  assert.ok(st, 'the authored hut materialized at the start node under the demo seed');
  assert.equal(st.buildingType, 'cottage');
  const plan = floorPlan(st);
  assert.equal(plan.rooms.length, 1, 'exactly the one authored room — no invented extra rooms');
});

test('U514: boot drops the player INSIDE the authored room (single room = the entry)', () => {
  const w = bootDemo();
  assert.ok(w.scene?.interior, 'the player is inside a structure at boot');
  assert.equal(String(w.scene.interior.structureKey), demoIdFor(w), 'inside the AUTHORED hut, not a procgen building');
  const st = w.structures.byId[demoIdFor(w)];
  const entry = floorPlan(st).rooms.find(r => r.isEntry);
  assert.equal(String(w.scene.interior.roomId), entry.id, 'in the authored entry room');
  assert.doesNotThrow(() => assertWorldInvariants(w));
});

test('U514: the interior has NO invented geography — one room, single storey, no phantom doorways', () => {
  const w = bootDemo();
  const layout = describeInteriorLayout(w);
  assert.ok(layout, 'inside a known structure');
  assert.equal(layout.buildingType, 'cottage');
  assert.equal(layout.roomCount, 1, 'the DM prompt sees exactly one room (the DM-invents-geography guard holds)');
  assert.equal(layout.atEntry, true);
  assert.deepEqual(layout.doorways, [], 'a single room offers no interior doorways to narrate');
});

test('U514: go OUTSIDE — exit clears the interior and lands the body in the region frame', () => {
  let w = bootDemo();
  w = exitStructureInterior(w);
  assert.equal(w.scene?.interior ?? null, null, 'exiting clears the interior');
  assert.equal(w.party[0].pos?.frame, 'region', 'the body lands outdoors through the authored front door');
  assert.doesNotThrow(() => assertWorldInvariants(w));
  // From outside, the authored hut is a structure you can see and re-enter.
  const view = getInteriorView(w);
  assert.ok(view.structures.some(s => s.id === demoIdFor(w)), 'the authored hut is visible from outside');
});

test('U514: go INSIDE again — re-entering drops the player back in the authored room', () => {
  let w = bootDemo();
  const demoId = demoIdFor(w);
  w = exitStructureInterior(w);
  w = enterStructureInterior(w, demoId);
  assert.ok(w.scene?.interior, 'inside again');
  assert.equal(String(w.scene.interior.structureKey), demoId, 're-entered the AUTHORED hut');
  const st = w.structures.byId[demoId];
  const entry = floorPlan(st).rooms.find(r => r.isEntry);
  assert.equal(String(w.scene.interior.roomId), entry.id, 'back in the authored entry room');
  assert.doesNotThrow(() => assertWorldInvariants(w));
});

test('U514: enter → exit → enter → exit is stable (no soft-lock, invariants clean throughout)', () => {
  let w = bootDemo();
  const demoId = demoIdFor(w);
  for (let i = 0; i < 2; i++) {
    w = exitStructureInterior(w);
    assert.equal(w.scene?.interior ?? null, null);
    assert.doesNotThrow(() => assertWorldInvariants(w));
    w = enterStructureInterior(w, demoId);
    assert.equal(String(w.scene?.interior?.structureKey || ''), demoId);
    assert.doesNotThrow(() => assertWorldInvariants(w));
  }
});
