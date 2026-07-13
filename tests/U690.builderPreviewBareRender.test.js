// U690 — BUILDER-PREVIEW-1 (bare preview): the House Builder's "Preview 3D" draws
// ONLY the authored building, never the settlement that hosts it.
//
// The building has to borrow a settlement building slot to get a drawn position
// (MR-2c substitution — a free-floating structure is invisible to the sheet). But
// a settlement renders its WHOLE self: decorative town buildings, an outdoor NPC
// roster, and two hardcoded groves (~15 trees) + a well. Tim's report: the preview
// gave him "a saltmarket town with NPCs and trees." The fix is a renderer-only gate
// in placeFromWorldNode, opt-in via world.__builderPreview (the preview page sets it
// on its throwaway world). This locks it: with the flag, the place the renderer
// draws is the authored building ALONE.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';
import { registerBuilderPreviewHouse } from '../engine/structures/applyGeneratedStructuresForNode.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

const previewHouse = {
  kind: 'authored-structure', schema: 'house-builder/v10', name: 'Preview Cottage',
  grid: { cols: 120, rows: 90, cell: 28 },
  rooms: [
    { id: 'hall', name: 'Hall', role: 'greathall', shape: 'rect', material: 'timber', x: 10, y: 10, w: 8, h: 6 },
  ],
  walls: [],
  openings: [{ kind: 'door', x: 10, y: 13, angle: 90, orient: 'v', len: 1, room: 'hall', entrance: true }],
  tunnels: [], corridors: [],
  furniture: [
    { type: 'hearth', x: 13, y: 10, w: 2, h: 1, rot: 0, room: 'hall', ux: 0.5, uy: 0.0833 },
    { type: 'table',  x: 13, y: 12, w: 2, h: 2, rot: 0, room: 'hall', ux: 0.5, uy: 0.5 },
  ],
  secrets: [], traps: [],
};

function bootPreview() {
  return beginAdventure(
    newWorld({ seed: 'builderPreview', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }),
    PACKS,
  ).world;
}

test('U690: WITHOUT the flag the preview world still renders a full settlement (the control)', () => {
  try {
    registerBuilderPreviewHouse(previewHouse);
    const w = bootPreview();
    const place = placeFromWorldNode(w, String(w.map.currentNodeId));
    // The bug Tim saw: a whole town around the building.
    assert.ok(place.buildings.length > 1, 'un-gated, the settlement draws many buildings (the town)');
    const groves = place.terrain?.groves || [];
    assert.ok(groves.length > 0, 'un-gated, the settlement draws its hardcoded groves (the trees)');
  } finally {
    registerBuilderPreviewHouse(null);
  }
});

test('U690: WITH world.__builderPreview the renderer draws the authored building ALONE', () => {
  try {
    registerBuilderPreviewHouse(previewHouse);
    const w = bootPreview();
    w.__builderPreview = true;
    const place = placeFromWorldNode(w, String(w.map.currentNodeId));

    // Only the authored building — every drawn building resolves to an authored structure.
    assert.ok(place.buildings.length >= 1, 'the authored building still draws (keeps its scattered rect)');
    for (const b of place.buildings) {
      const st = w.structures?.byId?.[String(b.structureKey || '')];
      assert.ok(st?.authoredPlan, `every drawn building is the authored one (got '${b.structureKey}')`);
    }

    // No strangers.
    const npcTokens = (place.tokens || []).filter(t => t?.type === 'npc');
    assert.equal(npcTokens.length, 0, 'no outdoor NPC tokens — no strangers around the building');

    // No trees, no well.
    assert.deepEqual(place.terrain?.groves || [], [], 'no groves — no trees');
    assert.deepEqual(place.terrain?.props || [], [], 'no props — no well');

    // The player token still exists (you are there, inside).
    assert.ok((place.tokens || []).some(t => t?.type === 'player'), 'the player token survives');
  } finally {
    registerBuilderPreviewHouse(null);
  }
});

test('U690: the bare-preview gate is opt-in — a normal settlement world is untouched', () => {
  // A default-seed world never sets __builderPreview, so its place is byte-identical
  // whether or not the flag exists in the codebase.
  const w = beginAdventure(
    newWorld({ seed: 'tallow', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }),
    PACKS,
  ).world;
  assert.notEqual(w.__builderPreview, true, 'the real game never flags a bare preview');
  const place = placeFromWorldNode(w, String(w.map.currentNodeId));
  assert.ok(place, 'a normal settlement still renders');
});
