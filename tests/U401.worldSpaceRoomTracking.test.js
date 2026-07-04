// U401 — WS-1 room tracking (docs/MAP_PATH.md Phase 1.1 "the player marker tracks
// the engine's current room and the inside<->outside transition"; the projection
// half of the old VG-F3 "marker doesn't track rooms" bug — WS-2 wires the LIVE
// marker to consume this). Drives a scripted interior move THROUGH THE REAL ENGINE
// (the deterministic rule-based interior-move classifier — no LLM/API key
// required; same driver U258.buildingTraversal.test.js already exercises) and
// asserts the projected {wx,wy} moves from room A's center to room B's center, and
// that an outside<->inside transition lands within the building's world rect.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import {
  placeFrame,
  buildingAnchorInPlace, interiorRoomToWu, structureWorldRect,
  resolveEntityWuFromWorld
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

// The same real, deterministic room-move driver U258.buildingTraversal.test.js
// uses — no LLM call is involved (inferInteriorAction classifies this text
// rule-based before it would ever reach the LLM narration layer).
const moveDeeper = (w) => playerMove(w, PACKS, 'I go through the doorway into the next room.').world;
const stepOut = (w) => playerMove(w, PACKS, 'I step out through the way to the open air.').world;

function projectPlayer(w) {
  const nodeId = String(w.map.currentNodeId);
  const node = w.map.nodes.find(n => String(n.id) === nodeId);
  const inside = Boolean(w.scene?.interior);
  const place = node.settlement ? placeFromWorldNode(w, nodeId) : null;
  const frame = place ? placeFrame(place) : null;
  if (!inside) {
    // Outdoors: resolveEntityWuFromWorld needs ux/uy, which the legacy walk-pos
    // system supplies elsewhere; for this test's outdoor check we only need the
    // node-center fallback (a bare nodeId, no interior, no ux/uy).
    return { p: resolveEntityWuFromWorld(w, place, frame, { nodeId }), inside, node, place, frame };
  }
  const structureKey = String(w.scene.interior.structureKey);
  const roomId = String(w.scene.interior.roomId);
  const p = resolveEntityWuFromWorld(w, place, frame, { nodeId, structureKey, roomId });
  return { p, inside, node, place, frame, structureKey, roomId };
}

test('U401-A: precondition — tallow boots indoors in a multi-room building', () => {
  const w = boot();
  assert.ok(w.scene?.interior, 'starts indoors');
  const st = w.structures.byId[String(w.scene.interior.structureKey)];
  assert.ok((st?.topology?.rooms?.length || 0) >= 2, 'multi-room precondition');
});

test('U401-B: a real engine room-to-room move changes the projected {wx,wy} from room A\'s center to room B\'s center', () => {
  const w0 = boot();
  const before = projectPlayer(w0);
  assert.equal(before.inside, true);

  const w1 = moveDeeper(w0);
  const after = projectPlayer(w1);
  assert.equal(after.inside, true, 'a room move stays inside (never an exit)');
  assert.notEqual(after.roomId, before.roomId, 'precondition: the engine actually changed rooms');

  // The projected position must equal the room's OWN center — not merely "moved
  // somewhere" — computed via the exact same anchor/plan the engine used.
  const plan = floorPlan(w1.structures.byId[after.structureKey]);
  const anchor = buildingAnchorInPlace(after.place, after.structureKey);
  const expectedBefore = interiorRoomToWu(before.node, before.frame, anchor, plan, before.roomId);
  const expectedAfter = interiorRoomToWu(after.node, after.frame, anchor, plan, after.roomId);

  assert.deepEqual(before.p, expectedBefore, 'the pre-move projection is room A\'s own center');
  assert.deepEqual(after.p, expectedAfter, 'the post-move projection is room B\'s own center');
  assert.notDeepEqual(after.p, before.p, 'the projected {wx,wy} actually moved');
});

test('U401-C: room-to-room move stays within the SAME building\'s world rect throughout', () => {
  const w0 = boot();
  const before = projectPlayer(w0);
  const w1 = moveDeeper(w0);
  const after = projectPlayer(w1);
  assert.equal(after.structureKey, before.structureKey, 'still the same building');

  const plan = floorPlan(w1.structures.byId[after.structureKey]);
  const anchor = buildingAnchorInPlace(after.place, after.structureKey);
  const rect = structureWorldRect(after.node, after.frame, anchor, plan);

  for (const p of [before.p, after.p]) {
    assert.ok(p.wx >= rect.minX && p.wx <= rect.maxX, `wx=${p.wx} within building rect [${rect.minX},${rect.maxX}]`);
    assert.ok(p.wy >= rect.minY && p.wy <= rect.maxY, `wy=${p.wy} within building rect [${rect.minY},${rect.maxY}]`);
  }
});

test('U401-D: an outside<->inside transition changes {wx,wy}, and the indoor side lands within the building rect', () => {
  const wIn = boot();
  const indoors = projectPlayer(wIn);
  assert.equal(indoors.inside, true);

  const wOut = stepOut(wIn);
  const outdoors = projectPlayer(wOut);
  assert.equal(outdoors.inside, false, 'precondition: the engine actually stepped outside');

  assert.notDeepEqual(outdoors.p, indoors.p, 'crossing the threshold changes the projected position');
  assert.ok(Number.isFinite(outdoors.p.wx) && Number.isFinite(outdoors.p.wy), 'outdoor position still resolves finite');

  // The indoor side of the transition is provably inside its building's rect.
  const plan = floorPlan(wIn.structures.byId[indoors.structureKey]);
  const anchor = buildingAnchorInPlace(indoors.place, indoors.structureKey);
  const rect = structureWorldRect(indoors.node, indoors.frame, anchor, plan);
  assert.ok(indoors.p.wx >= rect.minX && indoors.p.wx <= rect.maxX);
  assert.ok(indoors.p.wy >= rect.minY && indoors.p.wy <= rect.maxY);
});

test('U401-E: "go back the way I came" retraces to the ORIGINAL room\'s exact center', () => {
  const w0 = boot();
  const start = projectPlayer(w0);

  const deep = moveDeeper(w0);
  const back = playerMove(deep, PACKS, 'I go back the way I came.').world;
  const returned = projectPlayer(back);

  assert.equal(returned.roomId, start.roomId, 'precondition: the engine actually returned to the starting room');
  assert.deepEqual(returned.p, start.p, 'the projection for the same room is always the same address, round-trip');
});
