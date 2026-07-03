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
import { buildDMSystemPrompt, buildSystemPrompt, validateNarrationCandidate } from '../engine/llmAdapter.js';
import { getRoomState } from '../engine/structures/roomState.js';
import { buildNpcVoicePrompt } from '../server/npcVoicePrompt.js';

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

// ── ROM-2 (docs/briefs/ROOM_OCCUPANCY_MODEL.md §2/§3) — the prompt + validator
// bind presence/material/position.
//
// THE DARK-PROMPT LESSON (brief §0): the prior presence flag (IOM-P2's
// inRoomWithPlayer) was pinned ONLY against buildDMContext/buildDMSystemPrompt
// — the conductor path, which callDM alone consumes, and callDM has ZERO live
// callers (only tests/U91 and llmModelRules.js reference it). The turn the
// game actually runs is playerMove → augmentNarration → buildNarratorContext →
// buildSystemPrompt (server.js's /api/narrate route; scripts/dm-playtest.mjs
// documents this exact path). N10's tests above already assert objects/N7
// geometry against the LIVE prompt; everything below asserts presence,
// material, and position against that SAME live prompt — never
// buildDMContext/buildDMSystemPrompt, so a green test here cannot be true
// while the feature is dark.

test('N10-ROM2a: the LIVE prompt (buildSystemPrompt) states room name, PEOPLE HERE, and material as law', () => {
  const w = boot();
  const ctx = buildNarratorContext(w, {});
  // Precondition, pinned to the same live seed N10 already uses: the tallow
  // wake room is occupancy-EMPTY (roomOccupancy.js's seeded placement puts no
  // roster NPC in the player's bedchamber) — the exact live scenario the
  // brief's §1a.5 cites (Elske materializing to answer in an empty room).
  const rs = getRoomState(w);
  assert.equal(rs.occupants.length, 0, 'precondition: the tallow wake room has no assigned occupants');
  assert.equal(ctx.roomOccupants.length, 0, 'ctx carries the same empty occupancy answer');
  assert.equal(ctx.roomName, rs.room?.name, 'ctx.roomName is the real room name (Bedchamber)');
  assert.ok(ctx.roomMaterial?.line, 'ctx.roomMaterial carries the prompt-ready material line');

  const sys = buildSystemPrompt(ctx);
  assert.match(sys, new RegExp(`You are in the ${ctx.roomName}\\.`), 'the LIVE prompt states the room name as law');
  assert.match(sys, /PEOPLE HERE: no one\./, 'the LIVE prompt states the room is occupancy-empty');
  assert.ok(sys.includes(ctx.roomMaterial.line), 'the LIVE prompt states the real build material as a fact line');
  assert.match(sys, /Anyone else at this settlement is elsewhere/, 'the LIVE prompt states the presence/material law line');
  // SETTLEMENT DATA stays (continuity) but every roster NPC is marked elsewhere,
  // since none is assigned to this room (brief §2: "each NPC not in the room is
  // marked — elsewhere").
  const npcLines = sys.split('\n').filter(l => l.startsWith('- NPC:'));
  assert.ok(npcLines.length > 0, 'the roster still appears (continuity memory, never presence)');
  for (const line of npcLines) assert.match(line, /— elsewhere$/, `roster line carries the elsewhere marker: "${line}"`);
});

test('N10-ROM2b: LIVE probe — a candidate voicing an out-of-room roster NPC falls back to base (validateNarrationCandidate)', () => {
  const w = boot();
  const ctx = buildNarratorContext(w, {});
  const absentName = ctx.settlement.npcs.find(n => n.elsewhere === true && n.name)?.name;
  assert.ok(absentName, 'precondition: at least one roster NPC is marked elsewhere on this seed');

  const baseNarration = `You are in the ${ctx.roomName}, ${ctx.placeName}.`;
  // The exact gate-evidence shape (brief §1a.4-5): the egress door / a
  // generic-ref fallback voices a roster NPC who is nowhere near the room.
  const ghostVoice = `${ctx.placeName} holds still as ${absentName} shrugs. "Can't say, no record I've ever seen."`;
  const ghostPlacement = `${absentName} stands in the doorway of ${ctx.placeName}, watching you.`;
  assert.equal(validateNarrationCandidate(w, ghostVoice, { ctx, baseNarration }), false,
    'a candidate voicing an absent roster NPC is rejected — falls back to the grounded base');
  assert.equal(validateNarrationCandidate(w, ghostPlacement, { ctx, baseNarration }), false,
    'a candidate physically placing an absent roster NPC is rejected — falls back to the grounded base');

  // The mirror case — a TRUTHFUL absence statement about that same NPC must be
  // ACCEPTED (Rule 4f's occupancy-set fix, §2's "truthful absence is accepted").
  const truthfulAbsence = `${absentName} is not here at ${ctx.placeName}; the ${ctx.roomName} stands empty.`;
  assert.equal(validateNarrationCandidate(w, truthfulAbsence, { ctx, baseNarration }), true,
    'a truthful absence statement about the same NPC is accepted, not rejected');
});

test('N10-ROM2c: LIVE probe — material contradiction and wrong-room-name position claims fall back to base', () => {
  const w = boot();
  const ctx = buildNarratorContext(w, {});
  assert.equal(ctx.roomMaterial.family, 'timber', 'precondition: the tallow cottage is timber-built (ROM-0)');
  const baseNarration = `You are in the ${ctx.roomName}, ${ctx.placeName}.`;

  // (iii) — the C2 "wooden wall" -> "stone wall" drift, now rejected pre-ship.
  const stoneWall = `${ctx.placeName}: cold stone walls close in around you.`;
  assert.equal(validateNarrationCandidate(w, stoneWall, { ctx, baseNarration }), false,
    'a stone-wall claim inside the timber cottage is rejected');
  // the building's own family stays narratable (material rule must not overreach).
  const timberWall = `${ctx.placeName}: the timber walls creak around you.`;
  assert.notEqual(validateNarrationCandidate(w, timberWall, { ctx, baseNarration }), false,
    'the timber cottage\'s OWN material is never rejected by the material rule');

  // (iv) — the C4 "here in the back room of the cottage" invention, now rejected.
  const wrongRoom = `${ctx.placeName}: you are standing in the Kitchen, pots hanging low overhead.`;
  assert.equal(validateNarrationCandidate(w, wrongRoom, { ctx, baseNarration }), false,
    'naming a real room OTHER than ctx.roomName as the player\'s position is rejected');
  // naming the REAL current room must never be rejected by this rule.
  const rightRoom = `${ctx.placeName}: you are standing in the ${ctx.roomName}, dust hanging in the air.`;
  assert.notEqual(validateNarrationCandidate(w, rightRoom, { ctx, baseNarration }), false,
    'naming the actual current room is never rejected by the position rule');
});

test('N10-ROM2d: the auto-speaker (narratorContext.js buildNarratorContext) is room-scoped, never settlement.npcs[0]', () => {
  const w = boot();
  const ctx = buildNarratorContext(w, {});
  // The tallow wake room is occupancy-empty (same precondition as N10-ROM2a) —
  // before ROM-2, the auto-speaker defaulted to settlement.npcs[0] regardless
  // (the C1.5 bug, brief §1a.5). Now it must find no one to speak.
  assert.equal(ctx.roomOccupants.length, 0, 'precondition: no one occupies the wake room');
  assert.equal(ctx.speaker, null, 'no speaker is auto-selected when the room is occupancy-empty');
});

test('N10-ROM2e: the npc-voice prompt (server/npcVoicePrompt.js) renders the same PEOPLE HERE law when sceneFacts carries peopleHere', () => {
  // sceneFacts.peopleHere is engine-populated data (would come from ctx.roomOccupants /
  // getRoomState().occupants names, same source N10-ROM2a pins on the narration side) —
  // this test exercises the RENDERING contract at buildNpcVoicePrompt directly (the same
  // hand-built-sceneFacts idiom N11 already uses), so a voiced NPC in an occupied room
  // states who else is really there, and a voiced NPC alone in a room says so.
  const w = boot();
  const ctx = buildNarratorContext(w, {});
  const rs = getRoomState(w);
  assert.equal(rs.occupants.length, 0, 'precondition: the tallow wake room is occupancy-empty (same seed as N10-ROM2a)');

  const emptyRoom = buildNpcVoicePrompt({
    npcName: 'Wren', role: 'tallow-maker', manner: 'even', mode: 'shared', factPhrase: 'the well',
    playerLine: 'who else is with you?',
    sceneFacts: {
      inside: true, buildingType: ctx.interior.layout.buildingType, roomCount: ctx.interior.layout.roomCount,
      singleStorey: true, roomName: ctx.roomName, doorways: ctx.interior.layout.doorways,
      objects: ctx.interior.objects.map(o => o.name), peopleHere: ctx.roomOccupants.map(o => o.name)
    }
  });
  assert.match(emptyRoom, /PEOPLE HERE with you: no one else\./, 'an occupancy-empty room states no one else is present');
  assert.match(emptyRoom, /Anyone else at this settlement is elsewhere/, 'the voice prompt states the same presence law the narration prompt states');

  const populated = buildNpcVoicePrompt({
    npcName: 'Wren', role: 'tallow-maker', manner: 'even', mode: 'shared', factPhrase: 'the well',
    playerLine: 'who else is with you?',
    sceneFacts: { inside: true, buildingType: 'cottage', roomCount: 1, singleStorey: true, roomName: 'main room', doorways: [], objects: [], peopleHere: ['Wren', 'a stranger'] }
  });
  assert.match(populated, /PEOPLE HERE with you: Wren, a stranger\./, 'a populated room names who is really there');

  // Backward compatibility: sceneFacts without peopleHere renders exactly as it did
  // before this addition (the field is optional, same pattern as every other fact here).
  const noField = buildNpcVoicePrompt({
    npcName: 'Wren', role: 'tallow-maker', manner: 'even', mode: 'shared', factPhrase: 'the well',
    playerLine: 'any news?',
    sceneFacts: { inside: true, buildingType: 'cottage', roomCount: 1, singleStorey: true, roomName: 'main room', doorways: [], objects: ['hearth'] }
  });
  assert.ok(!/PEOPLE HERE/.test(noField), 'no peopleHere line when the field is absent — backward compatible');
});
