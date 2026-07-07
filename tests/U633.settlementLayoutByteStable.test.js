// U633 — MAP-EGRESS-1: the extracted engine layout draws the SAME village, byte-for-byte.
//
// The P-81b organic scatter moved from the renderer (public/map/placeFromNode.js) into
// the engine (engine/world/settlementLayout.js) so the egress doorstep and the drawn
// map read ONE geometry. THE PRIME CONSTRAINT: no village may reshuffle — every
// building's placed ox/oy on every seed must be IDENTICAL to before, or drawn towns
// visibly move. This test is the byte-stability oracle:
//
//   (1) the engine layout's ox/oy EQUALS the renderer's placeFromWorldNode buildings,
//       for the boot settlement across several seeds (the two are now permanently
//       coupled — if either drifts, this fails);
//   (2) the engine's settlement FRAME equals worldSpace.placeFrame(place) (the anchor
//       both the renderer's marker and the egress doorstep project against);
//   (3) a hardcoded GOLDEN snapshot of the aldermere boot layout (so a change to BOTH
//       in lockstep — which (1) would miss — is still caught).
//
// LLM OFF, seeded. Siblings: U632 (the doorstep lands right), U634 (doorstep-adjacent).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { settlementLayout } from '../engine/world/settlementLayout.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';
import { placeFrame } from '../public/map/worldSpace.js';

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

function boot(seed) {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: `campaign-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const { world } = beginAdventure(ensureWorld(w0), PACKS);
  return world;
}

// The settlement node of a booted world (the one node with a real drawable layout).
function settlementNode(world) {
  for (const node of world.map.nodes) {
    const lay = settlementLayout(world, String(node.id));
    if (lay && lay.buildings.length) return String(node.id);
  }
  return null;
}

// (1) + (2): the engine layout matches the renderer, for the boot settlement, per seed.
for (const seed of ['aldermere', 'greywater', 'thornfield', 'seedB-test']) {
  test(`U633: engine settlementLayout == renderer placeFromWorldNode (ox/oy + frame) — seed ${seed}`, () => {
    const world = boot(seed);
    const nodeId = settlementNode(world);
    assert.ok(nodeId, `seed ${seed} has a settlement node`);

    const layout = settlementLayout(world, nodeId);
    const place = placeFromWorldNode(world, nodeId);
    assert.equal(layout.buildings.length, place.buildings.length,
      `same building count (engine ${layout.buildings.length} vs renderer ${place.buildings.length})`);

    for (let i = 0; i < layout.buildings.length; i++) {
      const eb = layout.buildings[i], rb = place.buildings[i];
      // ox/oy byte-identical (the placed position the map DRAWS).
      assert.equal(eb.ox, rb.ox, `building ${i} ox identical (${eb.ox} vs ${rb.ox})`);
      assert.equal(eb.oy, rb.oy, `building ${i} oy identical (${eb.oy} vs ${rb.oy})`);
      // and the same building identity in the same slot.
      assert.equal(String(eb.structureKey || ''), String(rb.structureKey || ''), `building ${i} key aligned`);
      assert.equal(String(eb.buildingName || ''), String(rb.buildingName || ''), `building ${i} name aligned`);
    }

    // The engine's own frame must equal the renderer's placeFrame(place) — the shared
    // anchor the egress doorstep and the marker both project against.
    assert.deepEqual(layout.frame, placeFrame(place), 'engine frame == renderer placeFrame(place)');
  });
}

// (3): a hardcoded GOLDEN — the aldermere boot layout, captured pre-extraction. Catches
// a lockstep drift of BOTH engine and renderer that (1) would not (they'd still agree).
test('U633: aldermere boot layout matches the pre-extraction GOLDEN (no lockstep drift)', () => {
  const world = boot('aldermere');
  const nodeId = settlementNode(world);
  const layout = settlementLayout(world, nodeId);
  const got = layout.buildings.map(b => ({
    key: b.structureKey || null,
    name: b.name || b.buildingName || null,
    ox: b.ox, oy: b.oy,
  }));
  // GOLDEN captured from placeFromWorldNode on HEAD a0676c2c, BEFORE the extraction.
  const GOLDEN = [
    { key: 'stgen:v27:n0_2935788122:0', name: 'cottage', ox: 9.419070697203278, oy: 4.889007860833596 },
    { key: null, name: 'storehouse', ox: 17.334453298896552, oy: 5.087793428907602 },
    { key: null, name: 'well', ox: 19.58028628118336, oy: 15.005403185341054 },
    { key: null, name: 'storehouse', ox: 21.811399415135384, oy: 4.838428831483497 },
    { key: null, name: 'storehouse', ox: 5.003278413787484, oy: 19.73542840008968 },
    { key: null, name: 'smithy', ox: 1.305721256136894, oy: 17.94585150621456 },
    { key: null, name: 'house', ox: 14.12106905952096, oy: 13.070676270757902 },
    { key: null, name: 'storehouse', ox: 19.980349737778305, oy: 17.91435152952426 },
    { key: null, name: 'house', ox: 5.167628765106201, oy: 16.270471318357114 },
  ]
  assert.deepEqual(got, GOLDEN, 'the aldermere boot village is byte-identical to the pre-extraction golden');
});
