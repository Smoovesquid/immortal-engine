// N10 — the DM prompt learns the room's real objects & occupants (IOM-P2).
//
// P1 made furniture room-scoped in the engine (objectsHere), but the DM narration prompt
// still got ZERO object facts, so it invented furniture the room doesn't have. This pins
// the new roomState.js façade and its wiring into both the DM prompt's interior fact line
// (object names) and the NPCs-present block (an in-room/not-in-room marker per NPC —
// the roster is never filtered, only annotated).
//
// Hermetic: getRoomState / buildDMContext / buildDMSystemPrompt are pure given the world.
// No network, no API key, no cost. Room state is DERIVED (not stored), so it cannot affect
// the worldHash determinism gates (U19/21/22/27/30) — those run in the main suite.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { buildDMContext, buildNarratorContext } from '../engine/ai/narratorContext.js';
import { buildDMSystemPrompt, buildSystemPrompt } from '../engine/llmAdapter.js';
import { getRoomState } from '../engine/structures/roomState.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

test('N10: getRoomState returns the real room objects (name+state) for the current room', () => {
  const w = boot();
  const rs = getRoomState(w);
  assert.equal(rs.inside, true, 'the tallow start is inside the cottage');
  assert.ok(Array.isArray(rs.objects) && rs.objects.length > 0, 'the room has real furniture');
  assert.ok(rs.objects.length <= 6, 'objects are capped at 6');
  for (const o of rs.objects) {
    assert.equal(typeof o.name, 'string');
    assert.ok(o.name.length > 0);
  }
  // Pure/derived: same seed, same world → same answer, no mutation.
  const again = getRoomState(w);
  assert.deepEqual(again.objects, rs.objects);
});

test('N10: buildScene attaches interior.objects, and the DM system prompt names the real objects', () => {
  const w = boot();
  const ctx = buildNarratorContext(w, {});
  assert.ok(Array.isArray(ctx.interior?.objects), 'buildScene interior carries objects');
  const objectNames = ctx.interior.objects.map(o => o.name);
  assert.ok(objectNames.length > 0);

  const sys = buildSystemPrompt(ctx);
  assert.match(sys, /In this room:/, 'the prompt states a room-object fact line');
  assert.match(sys, /do not invent others you expect the player to act on/i, 'the no-invention constraint is present');
  for (const name of objectNames) {
    assert.ok(sys.includes(name), `prompt names the real object "${name}"`);
  }

  // buildDMSystemPrompt (the conductor path) carries the same fact.
  const dmCtx = buildDMContext(w, {}, {});
  const dmSys = buildDMSystemPrompt(dmCtx);
  assert.match(dmSys, /In this room:/, 'the conductor prompt also states the room-object fact');
  for (const name of objectNames) {
    assert.ok(dmSys.includes(name), `conductor prompt names the real object "${name}"`);
  }
});

test('N10: buildNPCsPresent marks who is actually in the room, without filtering the roster', () => {
  const w = boot();
  const dmCtx = buildDMContext(w, {}, {});
  const npcs = dmCtx.npcsPresent;
  assert.ok(npcs.length > 0, 'the full settlement roster is still present');
  for (const npc of npcs) {
    assert.equal(typeof npc.inRoomWithPlayer, 'boolean', `${npc.name} carries an inRoomWithPlayer flag`);
  }
  const roomState = getRoomState(w);
  const inRoomIds = new Set(roomState.occupants.map(o => String(o?.id ?? o?.name ?? '')));
  // Nobody is assigned to the player's bedchamber on this seed — every roster NPC is
  // out of the room, and the prompt marks each one NOT in the room (never filters them).
  const outOfRoom = npcs.filter(n => !inRoomIds.has(String(n.name)));
  assert.ok(outOfRoom.length > 0, 'at least one NPC is out of the room on this seed');
  for (const n of outOfRoom) assert.equal(n.inRoomWithPlayer, false);

  const dmSys = buildDMSystemPrompt(dmCtx);
  for (const n of outOfRoom) {
    const line = dmSys.split('\n').find(l => l.includes(`- ${n.name} (`));
    assert.ok(line, `prompt has a line for ${n.name}`);
    assert.match(line, /not in this room/, `${n.name} is marked not in this room`);
  }
});

test('N10: existing N7 interior-layout gate stays green (geometry facts unchanged)', () => {
  const sys = buildSystemPrompt(buildNarratorContext(boot(), {}));
  assert.match(sys, /SINGLE-STOREY/i);
  assert.match(sys, /3 rooms/);
  assert.match(sys, /INTERIOR GEOMETRY IS FIXED/);
});
