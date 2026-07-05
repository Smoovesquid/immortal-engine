// U502 — MR-1b: the renderer's player TOKEN reads engine position truth.
//
// MR-ORACLE's layer diagnosis (scripts/positionProbe.mjs, docs/PACKETS.md):
// after MR-1a fixed the ENGINE side (the doorstep pos), the probe's own
// diagnoseLayers() reported the VIEW-MODEL still lies — placeFromWorldNode's
// player token is a fixed lane-entry seed (public/map/placeFromNode.js's old
// `tokens.push({ type:'player', ux: x0+1.5, uy: roadY(x0+1.5) })`), independent
// of party[0].pos. This is the reproduce-first case for that finding: it drives
// the REAL slice boot through the REAL player gesture (playerMove, LLM off —
// deterministic parseIntent floor), builds the token model exactly as the live
// renderer would (placeFromWorldNode(world, nodeId).tokens), and asserts the
// token sits at the projection of the engine's canonical pos.
//
// Wake:   pos is a struct-frame cell inside the wake room -> the token must
//         land inside that SAME room's place-unit rect (not the lane entry).
// Re-enter: pos moves to a DIFFERENT room (the entry room) -> the token must
//         track it (not remain pinned wherever it first resolved).
//
// This is genuinely the SAME assertion scripts/positionProbe.mjs's
// diagnoseLayers hardcodes as always-true (`rendererLies = true`) — this test
// proves it is no longer true after MR-1b's fix (playerTokenPlaceUnit, wired
// into the token push). A future regression that re-severs the token from pos
// fails HERE, in the committed suite, not just in the optional probe script.
//
// LLM OFF (deterministic parseIntent floor) — no network, no API key.
// Siblings: U499 (the engine-side doorstep fix), U501 (the frame-transform
// unit tests), scripts/positionProbe.mjs (the original diagnosis + its
// non-`npm run check` playtest:position mode).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { roomOfStructCell } from '../engine/map/spatial/tacticalPos.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';

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

function bootSlice(seed = SLICE_SEED) {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: `campaign-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const { world } = beginAdventure(ensureWorld(w0), PACKS);
  return world;
}

// The player token from the place model, or null. Exactly what a live mount reads.
function playerToken(world, nodeId) {
  const place = placeFromWorldNode(world, nodeId);
  if (!place) return null;
  return (place.tokens || []).find(t => t && t.type === 'player') || null;
}

// A room's place-unit rect (footprint-centered at its building's anchor) — the
// SAME convention structCellToPlaceUnit/interiorRoomToPlaceUnit use. Independent
// derivation (straight from the plan + the drawn building's ox/oy), so this is a
// real geometric cross-check, not a tautology against the code under test.
function roomPlaceUnitRect(world, place, structId, roomId) {
  const bld = (place.buildings || []).find(b => String(b.structureKey || '') === structId);
  const plan = floorPlan(world.structures.byId[structId]);
  const room = plan.rooms.find(r => String(r.id) === String(roomId));
  const rw = (room.w || (room.r || 0) * 2) / 2, rh = (room.h || (room.r || 0) * 2) / 2;
  const fw = plan.footprint.w, fh = plan.footprint.h;
  const cx = bld.ox + (room.cx - fw / 2), cy = bld.oy + (room.cy - fh / 2);
  return { minX: cx - rw, maxX: cx + rw, minY: cy - rh, maxY: cy + rh };
}

test('U502: at wake, the renderer player token sits inside the wake room (not a fixed lane-entry seed)', () => {
  const world = bootSlice();
  const nodeId = world.map.currentNodeId;
  const interior = world.scene.interior;
  assert.ok(interior && interior.structureKey && interior.roomId, 'boots indoors (the wake room)');

  const pos = world.party[0].pos;
  assert.equal(pos.frame, `struct:${interior.structureKey}`, 'pos is inside the wake structure');
  assert.equal(roomOfStructCell(floorPlan(world.structures.byId[interior.structureKey]), pos.gx, pos.gy),
    interior.roomId, 'pos cell resolves to the wake room (sanity on the fixture, not the code under test)');

  const place = placeFromWorldNode(world, nodeId);
  const tok = playerToken(world, nodeId);
  assert.ok(tok && Number.isFinite(tok.ux) && Number.isFinite(tok.uy), 'a player token exists with finite place-units');

  const rect = roomPlaceUnitRect(world, place, interior.structureKey, interior.roomId);
  assert.ok(tok.ux >= rect.minX - 1e-9 && tok.ux <= rect.maxX + 1e-9,
    `token ux ${tok.ux.toFixed(3)} falls inside the wake room's place-unit X range [${rect.minX.toFixed(3)}, ${rect.maxX.toFixed(3)}]`);
  assert.ok(tok.uy >= rect.minY - 1e-9 && tok.uy <= rect.maxY + 1e-9,
    `token uy ${tok.uy.toFixed(3)} falls inside the wake room's place-unit Y range [${rect.minY.toFixed(3)}, ${rect.maxY.toFixed(3)}]`);
});

test('U502: after re-entering by a different door, the token tracks the NEW room (not stuck at the first-resolved spot)', () => {
  let world = bootSlice();
  const nodeId = world.map.currentNodeId;
  const wakeRoomId = world.scene.interior.roomId;
  const structId = world.scene.interior.structureKey;

  // go-outside then back-inside: re-entry (per the live egress path) drops the
  // player at the ENTRY room, which the fixture-independent slice boot may or may
  // not be the same room as the wake room — assert the token follows wherever
  // canon actually put it, not a stale first-resolved token.
  let r = playerMove(world, PACKS, 'go outside');
  world = r.world;
  assert.equal(world.party[0].pos.frame, 'region', 'go-outside returns to the region frame');

  r = playerMove(world, PACKS, 'go back inside');
  world = r.world;
  const interior2 = world.scene.interior;
  assert.ok(interior2 && interior2.roomId, 're-enter resolves an interior');

  const place2 = placeFromWorldNode(world, nodeId);
  const tok2 = playerToken(world, nodeId);
  assert.ok(tok2 && Number.isFinite(tok2.ux) && Number.isFinite(tok2.uy));

  const rect2 = roomPlaceUnitRect(world, place2, structId, interior2.roomId);
  assert.ok(tok2.ux >= rect2.minX - 1e-9 && tok2.ux <= rect2.maxX + 1e-9,
    `post-re-enter token ux ${tok2.ux.toFixed(3)} falls inside room ${interior2.roomId}'s X range [${rect2.minX.toFixed(3)}, ${rect2.maxX.toFixed(3)}]`);
  assert.ok(tok2.uy >= rect2.minY - 1e-9 && tok2.uy <= rect2.maxY + 1e-9,
    `post-re-enter token uy ${tok2.uy.toFixed(3)} falls inside room ${interior2.roomId}'s Y range [${rect2.minY.toFixed(3)}, ${rect2.maxY.toFixed(3)}]`);

  // Sanity: the room actually changed vs. wake (proves this test exercises a
  // real move, not a no-op — the entry room differs from the wake room in the
  // default slice fixture at SLICE_SEED).
  assert.notEqual(interior2.roomId, wakeRoomId, 'sanity: re-entry actually resolved a different room than wake');
});

test('U502: go-outside falls back to the documented legacy lane-entry seed (region frame has no place-unit projection here) — never crashes, never stale-crashes the render', () => {
  let world = bootSlice();
  const nodeId = world.map.currentNodeId;
  const r = playerMove(world, PACKS, 'go outside');
  world = r.world;
  assert.equal(world.party[0].pos.frame, 'region');

  // Must not throw, must still produce a token with finite place-units (the
  // documented fallback, not an accidental undefined/NaN leaking onto the canvas).
  const tok = playerToken(world, nodeId);
  assert.ok(tok, 'a player token still exists after going outside');
  assert.ok(Number.isFinite(tok.ux) && Number.isFinite(tok.uy), 'fallback token still has finite place-units');
});
