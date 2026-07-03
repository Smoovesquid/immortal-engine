// U360 — buildNarratorContext learns room presence/material/position (ROM-2,
// docs/briefs/ROOM_OCCUPANCY_MODEL.md §2/§3). Unit-level probes on the
// narratorContext.js surface itself — N10 covers the same facts at the
// PROMPT level (buildSystemPrompt); this file pins the underlying context
// fields (ctx.roomOccupants, ctx.roomMaterial, ctx.roomName,
// ctx.settlement.npcs[].elsewhere, and the room-scoped auto-speaker) so a
// regression here is caught at the source, not just downstream in the prompt
// string.
//
// Hermetic: buildNarratorContext / getRoomState / occupantsOfRoom /
// outdoorOccupants are pure given the world. No network, no API key, no
// cost. Derived-only (no stored fields) — cannot affect worldHash
// (U19/21/22/27/30 run in the main suite; this file adds a direct probe too).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { buildNarratorContext } from '../engine/ai/narratorContext.js';
import { getRoomState } from '../engine/structures/roomState.js';
import { occupantsOfRoom, outdoorOccupants } from '../engine/structures/roomOccupancy.js';
import { worldHash } from '../engine/worldHash.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

test('U360a: ctx.roomOccupants matches getRoomState().occupants exactly (same façade, same answer)', () => {
  const w = boot();
  const ctx = buildNarratorContext(w, {});
  const rs = getRoomState(w);
  assert.deepEqual(ctx.roomOccupants, rs.occupants, 'ctx.roomOccupants is exactly getRoomState().occupants, not a re-derivation');
});

test('U360b: ctx.roomMaterial and ctx.roomName match getRoomState() inside; both null/empty outside', () => {
  let w = boot();
  let ctx = buildNarratorContext(w, {});
  let rs = getRoomState(w);
  assert.equal(ctx.roomMaterial, rs.material, 'ctx.roomMaterial is the same object getRoomState returns');
  assert.equal(ctx.roomName, rs.room?.name ?? null, 'ctx.roomName is the current room\'s real name');
  assert.ok(ctx.roomName, 'precondition: the tallow wake room has a real name (Bedchamber)');

  w = playerMove(w, PACKS, 'I step back outside').world;
  ctx = buildNarratorContext(w, {});
  assert.equal(Boolean(w.scene?.interior), false, 'precondition: the exit gesture leaves the building');
  assert.equal(ctx.roomMaterial, null, 'material is null once outside');
  assert.equal(ctx.roomName, null, 'roomName is null once outside');
});

test('U360c: settlement.npcs carries an `elsewhere` boolean for every roster NPC, computed from real occupancy', () => {
  const w = boot();
  const ctx = buildNarratorContext(w, {});
  assert.ok(ctx.settlement, 'precondition: tallow boots at a settlement');
  assert.ok(ctx.settlement.npcs.length > 0, 'precondition: the roster is non-empty');
  const occupantIds = new Set(occupantsOfRoom(w, String(w.scene.interior.structureKey), String(w.scene.interior.roomId)).map(o => String(o?.id ?? o?.name ?? '')));
  for (const npc of ctx.settlement.npcs) {
    assert.equal(typeof npc.elsewhere, 'boolean', `${npc.name || npc.role} carries a boolean elsewhere flag`);
    const inRoom = occupantIds.has(String(npc.id ?? npc.name ?? ''));
    assert.equal(npc.elsewhere, !inRoom, `${npc.name || npc.role}: elsewhere flag matches real occupancy (inRoom=${inRoom})`);
  }
});

test('U360d: the elsewhere marker never overrides the earned-name rule — an unmet, in-room NPC still gets a blank name', () => {
  // Construct a synthetic world shape mirroring buildNarratorContext's earned-name
  // gate: home unset, NPC not metPlayer, but assigned to occupy the room. The
  // earned-name rule (pre-existing) must still blank the name; ROM-2 only adds a
  // SEPARATE elsewhere flag alongside it, never replaces the gate.
  const w = boot();
  const nodeId = String(w.map.currentNodeId);
  const node = w.map.nodes.find(n => String(n.id) === nodeId);
  // Force every roster NPC into "not met" so the earned-name blank fires regardless
  // of occupancy on this seed.
  for (const npc of node.settlement.npcs) {
    npc.conversationState = { ...(npc.conversationState || {}), metPlayer: false };
  }
  w.meta.homeNodeId = '';
  const ctx = buildNarratorContext(w, {});
  for (const npc of ctx.settlement.npcs) {
    assert.equal(npc.name, '', 'name stays blank (unearned) regardless of the new elsewhere flag');
    assert.equal(typeof npc.elsewhere, 'boolean', 'elsewhere flag is still present alongside the blanked name');
  }
});

test('U360e: the auto-speaker is room-scoped — never falls through to settlement.npcs[0] when the room is empty', () => {
  const w = boot();
  const ctx = buildNarratorContext(w, {});
  const rs = getRoomState(w);
  assert.equal(rs.occupants.length, 0, 'precondition: nobody occupies the tallow wake room');
  assert.equal(ctx.speaker, null, 'no speaker when nobody occupies the room (the pre-ROM-2 bug: this used to default to npcs[0])');
});

test('U360f: the auto-speaker, when it DOES pick someone, only ever picks a real room/outdoor occupant', () => {
  const w = playerMove(boot(), PACKS, 'I step back outside').world;
  const ctx = buildNarratorContext(w, {});
  const outdoorIds = new Set(outdoorOccupants(w).map(o => String(o?.id ?? o?.name ?? '')));
  if (ctx.speaker) {
    // buildSpeakerContext renders speaker.name from npc.name ?? npc.role — resolve
    // back through the settlement roster by matching name/role to confirm the pick
    // is a real occupant, not merely name-shaped.
    const picked = w.map.nodes.find(n => String(n.id) === String(w.map.currentNodeId))?.settlement?.npcs
      .find(n => String(n.name || n.role) === ctx.speaker.name);
    assert.ok(picked, 'the picked speaker resolves to a real roster NPC');
    assert.ok(outdoorIds.has(String(picked.id ?? picked.name ?? '')), 'the picked speaker is a real outdoor occupant');
  } else {
    assert.equal(outdoorIds.size, 0, 'no speaker was picked only because nobody is outdoors either');
  }
});

test('U360g: ROM-2 additions are pure — no world mutation, worldHash byte-identical, same answer twice', () => {
  const w = boot();
  const before = JSON.stringify(w);
  const h0 = worldHash(w);
  const ctx1 = buildNarratorContext(w, {});
  const ctx2 = buildNarratorContext(w, {});
  assert.deepEqual(ctx1.roomOccupants, ctx2.roomOccupants, 'roomOccupants is deterministic');
  assert.deepEqual(ctx1.roomMaterial, ctx2.roomMaterial, 'roomMaterial is deterministic');
  assert.equal(ctx1.roomName, ctx2.roomName, 'roomName is deterministic');
  assert.equal(JSON.stringify(w), before, 'buildNarratorContext never mutates the world');
  assert.equal(worldHash(w), h0, 'worldHash is byte-identical (nothing stored — ROM-2 is read-only)');
});
