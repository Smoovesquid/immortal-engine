// U522 — MR-2d: composition END-TO-END, LLM-off. The window view reaches the two
// player-facing surfaces honestly — the deterministic look-around survey (inside-out and
// outside-in) and the DM plan-facts bundle — and does NOT trip the coherence gate or the
// dialogue rule. (docs/briefs/MR-2-FUNCTIONAL-INK.md §2d.) Hermetic — no network, no API.
//
// What it locks:
//   • inside-out: the survey names the in-arc person WITH their story reason, marked as
//     seen THROUGH the window (line of sight), and does not dump off-arc folk.
//   • outside-in: the outdoor survey contributes ONE capped texture line (no roster).
//   • planFacts: the DM prompt's window fact states the real aperture + the through-window
//     folk (line-of-sight-not-presence), and is HIDE-THE-MATH (no bare count/enum recited).
//   • dialogue gating UNCHANGED: someone seen through the glass is NOT at the player's
//     node-room, so they cannot be addressed as if present (seeing != standing beside).
//   • CG-ARCH does not flag a legitimate window line (run the detector over the output).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { buildLocationSurvey } from '../engine/grace/gracefulAdjudication.js';
import { buildNarratorContext } from '../engine/ai/narratorContext.js';
import { buildSystemPrompt } from '../engine/llmAdapter.js';
import { visibleThroughWindows, outdoorOccupants, occupantsOfRoom } from '../engine/structures/roomOccupancy.js';
import { roomWindowFacings } from '../engine/structures/roomWindows.js';
import { detectArchitectureDesync, detectPresenceDesync, runDetectors, SINGLE_TURN_DETECTORS } from '../engine/coherence/checks.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

const inRoom = (w, roomId) => ({ ...w, scene: { ...w.scene, interior: { ...w.scene.interior, roomId } } });
function windowedRoomWithView(w) {
  const sk = w.scene.interior.structureKey;
  for (const rid of ['room:stgen:v27:n3_1515674724:0:1', 'room:stgen:v27:n3_1515674724:0:2', 'room:stgen:v27:n3_1515674724:0:3']) {
    if (roomWindowFacings(w, { structureKey: sk, roomId: rid }).length && visibleThroughWindows(w, sk, rid).length) return rid;
  }
  return null;
}

test('U522 (inside-out): the look-around survey names the in-arc person with reason, through the window, and omits off-arc folk', () => {
  const w = boot();
  const sk = w.scene.interior.structureKey;
  const rid = windowedRoomWithView(w);
  assert.ok(rid, 'precondition: a windowed room with a view exists');

  const seen = visibleThroughWindows(w, sk, rid);
  const inArc = seen.map(n => String(n.name));
  const offArc = outdoorOccupants(w).filter(n => n && !n.hostile).map(n => String(n.name)).filter(nm => !inArc.includes(nm));

  const survey = buildLocationSurvey(inRoom(w, rid));
  assert.match(survey, /through the (?:window|shutter|glass)/i, `must mark the view as through the glass: ${survey}`);
  for (const nm of inArc) assert.ok(survey.includes(nm), `in-arc ${nm} must be named: ${survey}`);
  // The reason rides along in the prose (the first in-arc person's reason appears).
  assert.ok(survey.includes(seen[0].reason), `the story reason must ride along: "${seen[0].reason}" not in: ${survey}`);
  for (const nm of offArc) assert.ok(!survey.includes(nm), `off-arc ${nm} must NOT be seen through this window: ${survey}`);
});

test('U522 (outside-in): the outdoor survey adds ONE capped window texture line, never a roster', () => {
  // Step outside the cottage, then survey. If a lit occupied window reads, exactly one
  // texture line appears — and it names NOBODY (line of sight from the street).
  const w = boot();
  // Compose the OUTDOOR survey directly (no interior) at the same node.
  const outdoorWorld = { ...w, scene: { ...w.scene, interior: null } };
  const survey = buildLocationSurvey(outdoorWorld);
  const windowLines = survey.split(/(?<=[.!?])\s+/).filter(s => /window/i.test(s));
  assert.ok(windowLines.length <= 1, `at most ONE window texture line outdoors (no roster dump): ${JSON.stringify(windowLines)}`);
  // Whatever outdoor folk exist are NOT attributed to a window (no names on the window line).
  if (windowLines.length === 1) {
    for (const n of outdoorOccupants(w)) {
      if (n && n.name) assert.ok(!windowLines[0].includes(n.name), `the outside-in window line must name no one: ${windowLines[0]}`);
    }
  }
});

test('U522 (planFacts): the DM prompt states the real window aperture + through-window folk, line-of-sight-not-presence, hide-the-math', () => {
  const w = boot();
  const rid = windowedRoomWithView(w);
  assert.ok(rid, 'precondition');
  const ctx = buildNarratorContext(inRoom(w, rid), {});
  const win = ctx.interior?.planFacts?.windows;
  assert.ok(win && win.count > 0, 'planFacts carries the room windows');
  assert.ok(Array.isArray(win.facings) && win.facings.length >= 1, 'window facings are present');
  assert.ok(Array.isArray(win.through) && win.through.length >= 1, 'the through-window folk are present');
  for (const p of win.through) assert.ok(p.reason && p.side, 'each through-window person carries reason + side');

  const prompt = buildSystemPrompt(ctx);
  const windowLine = prompt.split('\n').find(l => /WINDOW \(canon/i.test(l)) || '';
  assert.ok(windowLine, `the prompt must carry a WINDOW canon line: ${prompt.slice(0, 400)}`);
  // Line of sight, NOT presence — the DM is told they are outside / through the glass.
  assert.match(windowLine, /line of sight|through the window|glimpsed/i, windowLine);
  assert.match(windowLine, /never .*(?:standing in this room|addressable|as if present)/i, windowLine);
  // HIDE-THE-MATH: the raw count "2 windows" is not recited as a number-of-windows stat.
  assert.doesNotMatch(windowLine, /\b2 windows\b|\bcount\b|\bfacings?\s*[:=]/i, windowLine);
});

test('U522 (dialogue gating unchanged): a person seen through the window is NOT in the room and cannot be addressed as present', () => {
  const w = boot();
  const sk = w.scene.interior.structureKey;
  const rid = windowedRoomWithView(w);
  assert.ok(rid, 'precondition');
  const seenNames = new Set(visibleThroughWindows(w, sk, rid).map(n => String(n.name)));
  const roomNames = new Set(occupantsOfRoom(w, sk, rid).map(n => String(n.name)));
  // The people seen through the glass are, by construction, OUT of this room — none of
  // them appears in the room's occupancy (the NPC-at-node dialogue rule is unchanged).
  for (const nm of seenNames) {
    assert.ok(!roomNames.has(nm), `${nm} seen through the window must NOT be in the room's occupancy`);
  }
});

test('U522 (CG-ARCH): the coherence gate does NOT flag a legitimate window line', () => {
  const w = boot();
  const sk = w.scene.interior.structureKey;
  const rid = windowedRoomWithView(w);
  assert.ok(rid, 'precondition');
  const dm = buildLocationSurvey(inRoom(w, rid)); // the real composed window survey

  // Build a realistic single-turn coherence fixture: inside the wake cottage, with the
  // structure's real roomPlan (single-storey, its actual rooms) and the room's occupancy.
  const roomOcc = occupantsOfRoom(w, sk, rid).map(n => ({ name: String(n.name || '') }));
  const turn = {
    type: 'turn', seed: 'tallow', persona: 'newbie', i: 5,
    player: 'I look around the room.', dm, mechanics: 'observe only',
    canon: {
      interior: { roomId: rid, roomName: 'Hearth Room' },
      roomPlan: { rooms: ['Hearth Room', 'Bedchamber', 'Pantry'], singleStorey: true },
      roomExits: { east: 'Pantry' },
      roomOccupants: roomOcc,
      npcsPresent: [],
    },
    judgeError: false, v1: null, v2: null,
  };

  // The dedicated architecture detector must stay silent on the window prose.
  assert.equal(detectArchitectureDesync([turn]).length, 0,
    `CG-ARCH must not flag a legit window line: ${dm}`);
  // The presence detector must not read a through-the-window person as a ghost-voice
  // in-room (the "through the window" carve-out). The window folk are outdoor, not in
  // roomOccupants — this is exactly the case the carve-out protects.
  assert.equal(detectPresenceDesync([turn]).length, 0,
    `CG-1b must not flag a window-seen person as in-room: ${dm}`);
  // And the WHOLE single-turn bank stays clean on this legitimate composed output.
  assert.equal(runDetectors([turn], SINGLE_TURN_DETECTORS).length, 0,
    `no coherence detector may flag the composed window survey: ${dm}`);
});

test('U522: the window survey line is deterministic (byte-identical across two boots)', () => {
  const a = boot(), b = boot();
  const sk = a.scene.interior.structureKey;
  const rid = windowedRoomWithView(a);
  assert.ok(rid, 'precondition');
  assert.equal(buildLocationSurvey(inRoom(a, rid)), buildLocationSurvey(inRoom(b, rid)),
    'the composed window survey must be identical across boots');
});
