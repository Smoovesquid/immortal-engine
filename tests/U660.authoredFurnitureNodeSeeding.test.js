// U660 — FUNC-MINIS-1: placed furniture exists as REAL interactable node objects.
//
// Tim's acceptance bar #2/#5 (2026-07-09): placed pieces are "narratable/searchable/
// interactable as real objects" and "recognized as their actual object kinds, not
// generic props." The interaction truth in this engine is node.furniture (Model A):
// objectsHere() candidates, llmPhysics smash/search/burn targets, modifyFurniture/
// removeFurniture deltas. Today an authored hut's node.furniture is the GENERIC
// 9-template pick (wooden table, straw pallet…) — the drawn bed narrates as a straw
// pallet and the drawn barrel doesn't exist at all. RED against that.
//
// Boot path: the LOAD-1 demo seed ('loaderDemo') materializes loader_demo.house.js
// (one quarters hut, a drawn BED and a drawn BARREL) at the boot node and
// beginAdventure drops the player inside — the sanctioned authored-boot used by
// U513–U517.
//
// Siblings: U659 (plan/topology carriers), U515 (narration read stack — updated by
// this packet: authored pieces are now the MOST plausible furnishings).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { objectsHere, furnitureRoomAssignments } from '../engine/structures/roomObjects.js';

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

function bootDemo() {
  const w0 = newWorld({ seed: DEMO_SEED, fate: 0.2, campaignId: `campaign-${DEMO_SEED}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const { world } = beginAdventure(ensureWorld(w0), PACKS);
  return world;
}

function nodeFurniture(world) {
  const nid = String(world?.map?.currentNodeId ?? '');
  const node = (world?.map?.nodes || []).find(n => n && String(n.id) === nid);
  return Array.isArray(node?.furniture) ? node.furniture : [];
}

test('U660: the drawn bed and barrel exist in node.furniture with physics-ready fields and authored provenance', () => {
  const w = bootDemo();
  const furniture = nodeFurniture(w);
  const names = furniture.map(f => String(f.name).toLowerCase());

  const bed = furniture.find(f => /\bbed\b/.test(String(f.name).toLowerCase()));
  const barrel = furniture.find(f => /\bbarrel\b/.test(String(f.name).toLowerCase()));

  assert.ok(bed, `the drawn BED must exist as a node furniture piece (have: ${names.join(', ')})`);
  assert.ok(barrel, `the drawn BARREL must exist as a node furniture piece (have: ${names.join(', ')})`);

  for (const [label, piece] of [['bed', bed], ['barrel', barrel]]) {
    assert.ok(piece.authored === true, `${label} carries authored provenance`);
    assert.equal(String(piece.structureId), `authored:${String(w.map.currentNodeId)}`,
      `${label} knows which structure placed it`);
    assert.ok(String(piece.roomId || ''), `${label} knows its room`);
    assert.ok(typeof piece.material === 'string' && piece.material,
      `${label} carries an explicit material (physics must not fall back to name inference)`);
    assert.ok(Number.isFinite(piece.hardness), `${label} carries a hardness for smash DCs`);
    assert.ok(typeof piece.category === 'string' && piece.category, `${label} carries an interaction category`);
  }

  // Kind honesty: the barrel is wood (staves), the bed's FRAME is what a blow lands
  // on — wood too. Iron/stone would make them unsmashable lies.
  assert.equal(barrel.material, 'wood');
  assert.equal(bed.material, 'wood');
});

test('U660: objectsHere surfaces the authored pieces inside the hut — they are the narratable/searchable candidates', () => {
  const w = bootDemo();
  const here = objectsHere(w).map(({ piece }) => String(piece.name).toLowerCase());

  assert.ok(here.some(n => /\bbed\b/.test(n)),
    `the bed is present to narration/interaction where the player stands (have: ${here.join(', ')})`);
  assert.ok(here.some(n => /\bbarrel\b/.test(n)),
    `the barrel is present to narration/interaction where the player stands (have: ${here.join(', ')})`);
});

test('U660: room assignment places the authored pieces in the room they were drawn in', () => {
  const w = bootDemo();
  const nid = String(w.map.currentNodeId);
  const assignments = furnitureRoomAssignments(w, nid);
  const furniture = nodeFurniture(w);

  const authored = furniture.filter(f => f.authored === true);
  assert.ok(authored.length >= 2, 'both drawn pieces are authored-flagged');

  for (const piece of authored) {
    const a = assignments.get(String(piece.name));
    assert.ok(a, `authored piece "${piece.name}" is room-assigned`);
    assert.equal(String(a.structureId), String(piece.structureId),
      `"${piece.name}" is assigned to its own structure`);
    assert.equal(String(a.roomId), String(piece.roomId),
      `"${piece.name}" is assigned to the exact room it was drawn in, not an affinity guess`);
  }
});
