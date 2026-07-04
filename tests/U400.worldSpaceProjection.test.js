// U400 — WS-1 world-space projection (docs/MAP_PATH.md Phase 1.1, docs/ONE_MAP.md
// coordinate model, docs/TABLETOP_MAP.md contract table).
//
// The one-continuous-zoom map needs every drawable thing to resolve to ONE
// coordinate system before the camera/LOD/3D-tilt work can unify. worldSpace.js
// already carries the node + village embedding (M1/M2/M6/M7-S); this locks the
// missing rung — interiors fit to their building's footprint, and any entity
// (player/NPC) resolving through its engine location (node -> place -> room) —
// on the real `tallow` boot world. Pure + seeded: no engine writes, worldHash
// unchanged by the projection calls (client-side view only).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import {
  NODE_WU, PLACE_WU,
  nodeToWu, placeFrame,
  buildingAnchorInPlace, interiorRoomToWu, structureWorldRect,
  resolveEntityWu, resolveEntityWuFromWorld
} from '../public/map/worldSpace.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

test('U400-A: every node resolves to exactly one finite {wx,wy}, at NODE_WU spacing', () => {
  const w = boot();
  const nodes = w.map.nodes || [];
  assert.ok(nodes.length > 0, 'precondition: the tallow world has nodes');
  for (const n of nodes) {
    const p = nodeToWu(n);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `node ${n.id} must resolve finite`);
    assert.equal(p.x, n.x * NODE_WU);
    assert.equal(p.y, n.y * NODE_WU);
  }
});

test('U400-B: the starting structure and every one of its rooms resolve to a finite {wx,wy}', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const node = nodes(w).find(n => n.id === nodeId);
  const structureKey = String(w.scene.interior.structureKey);
  const st = w.structures.byId[structureKey];
  assert.ok(st, 'precondition: tallow boots inside a real generated structure');
  const plan = floorPlan(st);
  assert.ok(Array.isArray(plan.rooms) && plan.rooms.length > 1, 'precondition: multi-room building');

  const place = node.settlement ? placeFromWorldNode(w, nodeId) : null;
  const frame = place ? placeFrame(place) : null;
  const anchor = buildingAnchorInPlace(place, structureKey);
  assert.ok(anchor, 'the booted structure must be findable in its own village layout');

  for (const room of plan.rooms) {
    const p = interiorRoomToWu(node, frame, anchor, plan, room.id);
    assert.ok(p, `room ${room.id} must resolve`);
    assert.ok(Number.isFinite(p.wx) && Number.isFinite(p.wy), `room ${room.id} must be finite`);
  }
});

test('U400-C: every resolved room lands INSIDE its building\'s world rect', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const node = nodes(w).find(n => n.id === nodeId);
  const structureKey = String(w.scene.interior.structureKey);
  const st = w.structures.byId[structureKey];
  const plan = floorPlan(st);
  const place = node.settlement ? placeFromWorldNode(w, nodeId) : null;
  const frame = place ? placeFrame(place) : null;
  const anchor = buildingAnchorInPlace(place, structureKey);

  const rect = structureWorldRect(node, frame, anchor, plan);
  assert.ok(rect.maxX > rect.minX && rect.maxY > rect.minY, 'the building rect must have positive extent');

  for (const room of plan.rooms) {
    const p = interiorRoomToWu(node, frame, anchor, plan, room.id);
    assert.ok(p.wx >= rect.minX && p.wx <= rect.maxX, `room ${room.id} wx=${p.wx} must be within [${rect.minX},${rect.maxX}]`);
    assert.ok(p.wy >= rect.minY && p.wy <= rect.maxY, `room ${room.id} wy=${p.wy} must be within [${rect.minY},${rect.maxY}]`);
  }
});

test('U400-D: the present player entity resolves through node -> place -> room (resolveEntityWuFromWorld)', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const node = nodes(w).find(n => n.id === nodeId);
  const place = node.settlement ? placeFromWorldNode(w, nodeId) : null;
  const frame = place ? placeFrame(place) : null;

  const loc = { nodeId, structureKey: w.scene.interior.structureKey, roomId: w.scene.interior.roomId };
  const p = resolveEntityWuFromWorld(w, place, frame, loc);
  assert.ok(p, 'the player, currently indoors, must resolve to a world address');
  assert.ok(Number.isFinite(p.wx) && Number.isFinite(p.wy));

  // Cross-check against the direct interiorRoomToWu call — same answer, one truth.
  const anchor = buildingAnchorInPlace(place, loc.structureKey);
  const plan = floorPlan(w.structures.byId[loc.structureKey]);
  const direct = interiorRoomToWu(node, frame, anchor, plan, loc.roomId);
  assert.deepEqual(p, direct, 'resolveEntityWuFromWorld must agree with the direct room projection');
});

test('U400-E: an outdoor entity (no structure) resolves via the village walk-position, not the room path', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const node = nodes(w).find(n => n.id === nodeId);
  const place = placeFromWorldNode(w, nodeId);
  const frame = placeFrame(place);
  const outdoorLoc = { nodeId, ux: frame.cx + 2, uy: frame.cy };
  const p = resolveEntityWu({ node, place, frame }, outdoorLoc);
  assert.ok(p && Number.isFinite(p.wx) && Number.isFinite(p.wy), 'outdoor entity resolves via placeUnitToWu, same {wx,wy} shape as indoors');
});

test('U400-F: a lone structure with no settlement layout degrades to node-center anchoring (no place)', () => {
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const node = nodes(w).find(n => n.id === nodeId);
  const structureKey = String(w.scene.interior.structureKey);
  const st = w.structures.byId[structureKey];
  const plan = floorPlan(st);
  // Simulate the no-place fallback: place=null, frame=null, anchor=null.
  const rect = structureWorldRect(node, null, null, plan);
  const center = nodeToWu(node);
  assert.ok(Math.abs((rect.minX + rect.maxX) / 2 - center.x) < 1e-6, 'degenerate anchor centers on the node');
  assert.ok(Math.abs((rect.minY + rect.maxY) / 2 - center.y) < 1e-6);
  for (const room of plan.rooms) {
    const p = interiorRoomToWu(node, null, null, plan, room.id);
    assert.ok(Number.isFinite(p.wx) && Number.isFinite(p.wy), `room ${room.id} still resolves without a place`);
  }
});

test('U400-G: two independent builds of the same seed produce IDENTICAL world-space coordinates', () => {
  const project = () => {
    const w = boot();
    const nodeId = String(w.map.currentNodeId);
    const node = nodes(w).find(n => n.id === nodeId);
    const structureKey = String(w.scene.interior.structureKey);
    const plan = floorPlan(w.structures.byId[structureKey]);
    const place = node.settlement ? placeFromWorldNode(w, nodeId) : null;
    const frame = place ? placeFrame(place) : null;
    const anchor = buildingAnchorInPlace(place, structureKey);
    return {
      nodes: (w.map.nodes || []).map(n => nodeToWu(n)),
      rooms: plan.rooms.map(r => interiorRoomToWu(node, frame, anchor, plan, r.id))
    };
  };
  const a = project();
  const b = project();
  assert.deepEqual(a, b, 'the same seed must project to identical world-space coordinates, every build');
});

test('U400-H: worldHash is UNCHANGED by any projection call (read-only proof)', () => {
  const w = boot();
  const h0 = worldHash(w);

  const nodeId = String(w.map.currentNodeId);
  const node = nodes(w).find(n => n.id === nodeId);
  const structureKey = String(w.scene.interior.structureKey);
  const st = w.structures.byId[structureKey];
  const plan = floorPlan(st);
  const place = node.settlement ? placeFromWorldNode(w, nodeId) : null;
  const frame = place ? placeFrame(place) : null;
  const anchor = buildingAnchorInPlace(place, structureKey);

  // Exercise every projection surface.
  for (const n of w.map.nodes) nodeToWu(n);
  for (const room of plan.rooms) interiorRoomToWu(node, frame, anchor, plan, room.id);
  structureWorldRect(node, frame, anchor, plan);
  resolveEntityWuFromWorld(w, place, frame, { nodeId, structureKey, roomId: w.scene.interior.roomId });

  const h1 = worldHash(w);
  assert.equal(h1, h0, 'projecting to world-space must never mutate anything worldHash covers');
});

function nodes(w) {
  return (w.map.nodes || []).map(n => ({ id: String(n.id), x: n.x, y: n.y, settlement: n.settlement }));
}
