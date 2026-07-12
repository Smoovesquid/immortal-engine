// U688 — BUILDER-PREVIEW-1: the Builder's one-click 3D preview boots a REAL,
// EPHEMERAL game world containing exactly the drawn house — and can never touch
// the default game.
//
// The seam under test mirrors LOAD-1/LOAD-2 (applyGeneratedStructuresForNode.js):
// a preview world exists only when BOTH hold — seed === 'builderPreview' AND a
// house was runtime-registered (the preview page registers the draft it reads
// from localStorage; nothing registers in normal play or on the server). This
// file locks:
//   1. registered + preview seed → beginAdventure boots the player INSIDE the
//      authored house (authored:< sorts before stgen:), placed furniture seeded
//      as real node objects;
//   2. preview seed WITHOUT registration → plain procgen boot, no crash;
//   3. determinism — same doc, same seed, byte-identical worldHash twice;
//   4. ISOLATION — a registered house changes NOTHING about a default-seed
//      world (worldHash equality against the unregistered baseline).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { registerBuilderPreviewHouse } from '../engine/structures/applyGeneratedStructuresForNode.js';
import { finalizeAuthoredExport } from '../engine/structures/authoredStructure.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

// A small two-room draft with GLB-wired kinds (hearth/table/rug/barrel) — the
// same shape house-builder.html's buildExportDoc() ships.
const previewHouse = {
  kind: 'authored-structure',
  schema: 'house-builder/v10',
  name: 'Preview Cottage',
  grid: { cols: 120, rows: 90, cell: 28 },
  rooms: [
    { id: 'hall', name: 'Hall', role: 'greathall', shape: 'rect', material: 'timber', x: 10, y: 10, w: 8, h: 6 },
    { id: 'snug', name: 'Snug', role: 'quarters', shape: 'rect', material: 'timber', x: 18, y: 10, w: 5, h: 6 },
  ],
  walls: [],
  openings: [
    { kind: 'door', x: 10, y: 13, angle: 90, orient: 'v', len: 1, room: 'hall', entrance: true },
    { kind: 'door', x: 18, y: 13, angle: 90, orient: 'v', len: 1 },
  ],
  tunnels: [],
  corridors: [],
  furniture: [
    { type: 'hearth', x: 13, y: 10, w: 2, h: 1, rot: 0, room: 'hall', ux: 0.5, uy: 0.0833 },
    { type: 'table',  x: 13, y: 12, w: 2, h: 2, rot: 0, room: 'hall', ux: 0.5, uy: 0.5 },
    { type: 'rug',    x: 12, y: 14, w: 3, h: 2, rot: 0, room: 'hall', ux: 0.4375, uy: 0.8333 },
    { type: 'barrel', x: 19, y: 14, w: 1, h: 1, rot: 0, room: 'snug', ux: 0.3, uy: 0.75 },
  ],
  secrets: [],
  traps: [],
};

const bootPreview = () => beginAdventure(
  newWorld({ seed: 'builderPreview', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }),
  PACKS,
).world;

test('U688: registered draft + preview seed boots INSIDE the drawn house with its objects real', () => {
  try {
    registerBuilderPreviewHouse(previewHouse);
    const w = bootPreview();

    // MR-2c substitution: the draft ADOPTS the node's first procgen candidate id
    // (so the settlement layout anchors it and the map draws it like any other
    // building). The entered structure is therefore recognized by its
    // authoredPlan, not an `authored:` id.
    const structKey = String(w?.scene?.interior?.structureKey || '');
    const entered = w?.structures?.byId?.[structKey];
    assert.ok(entered, `boot enters a structure (got '${structKey}')`);
    assert.ok(entered.authoredPlan, 'the entered structure IS the drawn house (carries the authored plan)');
    assert.deepEqual(
      (entered.authoredPlan.rooms || []).flatMap(r => (r.furniture || []).filter(f => f.authored === 1).map(f => f.kind)).sort(),
      ['barrel', 'hearth', 'rug', 'table'], 'the plan carries exactly the drawn pieces');

    const nid = String(w.map.currentNodeId);
    const node = w.map.nodes.find(n => String(n.id) === nid);
    const authored = (node.furniture || []).filter(p => p && p.authored === true);
    assert.deepEqual(authored.map(p => p.kind).sort(), ['barrel', 'hearth', 'rug', 'table'],
      'the four drawn pieces are real node objects — exactly those, no extras');
    assert.ok(authored.every(p => String(p.structureId) === structKey), 'pieces join the substituted structure by id');
  } finally {
    registerBuilderPreviewHouse(null);
  }
});

test('U688: the preview seed WITHOUT a registration boots plain procgen — no crash, no authored house', () => {
  registerBuilderPreviewHouse(null);
  const w = bootPreview();
  const authoredStructs = Object.values(w?.structures?.byId || {})
    .filter(s => s && (s.authoredPlan || String(s.id).startsWith('authored:')));
  assert.deepEqual(authoredStructs, [], 'no authored structure appears from thin air');
});

test('U688: preview worlds are deterministic — same draft, same seed, same hash', () => {
  try {
    registerBuilderPreviewHouse(previewHouse);
    const h1 = worldHash(bootPreview());
    const h2 = worldHash(bootPreview());
    assert.equal(h1, h2, 'byte-identical replay under the registered draft');
  } finally {
    registerBuilderPreviewHouse(null);
  }
});

test('U688: the FINALIZED payload — exactly what Preview 3D stores — boots the same house', () => {
  // The Builder stores finalizeAuthoredExport(buildExportDoc()) (provenance-
  // stamped, loads strict). Prove that artifact boots inside the house too.
  try {
    registerBuilderPreviewHouse(finalizeAuthoredExport(previewHouse));
    const w = bootPreview();
    const structKey = String(w?.scene?.interior?.structureKey || '');
    assert.ok(w?.structures?.byId?.[structKey]?.authoredPlan, 'finalized artifact boots inside the authored house');
    const nid = String(w.map.currentNodeId);
    const node = w.map.nodes.find(n => String(n.id) === nid);
    const kinds = (node.furniture || []).filter(p => p && p.authored === true).map(p => p.kind).sort();
    assert.deepEqual(kinds, ['barrel', 'hearth', 'rug', 'table'], 'same four objects under the strict finalized load');
  } finally {
    registerBuilderPreviewHouse(null);
  }
});

test('U688: ISOLATION — a registered draft changes nothing about a default-seed world', () => {
  const bootDefault = () => beginAdventure(
    newWorld({ seed: 'tallow', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }),
    PACKS,
  ).world;
  const baseline = worldHash(bootDefault());
  try {
    registerBuilderPreviewHouse(previewHouse);
    const withReg = worldHash(bootDefault());
    assert.equal(withReg, baseline,
      'the default game is byte-identical whether or not a preview draft is registered — preview can never leak into canon');
  } finally {
    registerBuilderPreviewHouse(null);
  }
});
