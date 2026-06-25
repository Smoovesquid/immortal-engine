// U285 — shutters are a TOGGLEABLE, persistent window state, with no schema change. A window's
// default shuttered-ness is seed-derived (roomWindows); closing/opening it records a canon
// 'window-shutter' timeline event, and roomWindows reads the latest one back — so the state is a
// pure, replayable function of the world (no field, no WORLD_VERSION bump, worldHash stable). The
// toggle gates what already reads roomWindows: the survey, looking out, and the outside peek (a
// closed shutter is cover/concealment). Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { roomWindows } from '../engine/structures/roomWindows.js';
import { enterStructureInterior } from '../engine/structures/interiors.js';
import { buildLocationSurvey } from '../engine/grace/gracefulAdjudication.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const inside = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const shut = (w) => roomWindows(w, w.scene.interior).shuttered;

test('U285: closing the shutters persists — the deriver reads the canon toggle', () => {
  const w = playerMove(inside(), PACKS, 'open the shutters').world; // known-open baseline
  assert.equal(shut(w), false, 'baseline open');
  const r = playerMove(w, PACKS, 'close the shutters');
  assert.match(r.output.mechanics || '', /\[window:shutter-close\]/, r.output.mechanics);
  assert.equal(shut(r.world), true, 'closed, and the change persisted');
});

test('U285: the toggle survives an unrelated turn (canon, not transient)', () => {
  let w = playerMove(inside(), PACKS, 'open the shutters').world;
  w = playerMove(w, PACKS, 'close the shutters').world;
  w = playerMove(w, PACKS, 'wait a moment').world;
  assert.equal(shut(w), true, 'still closed a turn later');
});

test('U285: opening reverts; an already-closed shutter declines honestly', () => {
  let w = playerMove(inside(), PACKS, 'close the shutters').world; // closed (toggled or already)
  assert.equal(shut(w), true);
  const again = playerMove(w, PACKS, 'close the shutters');
  assert.match(again.output.narration, /already closed/i, again.output.narration);
  const open = playerMove(w, PACKS, 'open the shutters');
  assert.equal(shut(open.world), false, 'opening reverts the state');
});

test('U285: the survey and looking out reflect the shutter state', () => {
  const closed = playerMove(inside(), PACKS, 'close the shutters').world;
  assert.match(buildLocationSurvey(closed), /shuttered/i, 'survey names the shutters when closed');
  assert.match(playerMove(closed, PACKS, 'look out the window').output.narration, /shutters are closed/i, 'cannot see out a closed shutter');
  const open = playerMove(closed, PACKS, 'open the shutters').world;
  assert.match(playerMove(open, PACKS, 'look out the window').output.narration, /through the window/i, 'open → the outlook reads');
});

test('U285: a shuttered window blocks the outside peek (cover / concealment)', () => {
  let w = playerMove(inside(), PACKS, 'I step outside').world;
  const probe = enterStructureInterior(w, '');
  if (!probe.scene?.interior) return; // no building here — skip
  // Close the very room the outside-peek looks into, via a canon event.
  w = { ...w, timeline: [...w.timeline, { id: `t${w.timeline.length}`, t: w.timeline.length, kind: 'resolution', data: { updateKind: 'window-shutter', structureKey: probe.scene.interior.structureKey, roomId: probe.scene.interior.roomId, closed: true } }] };
  const r = playerMove(w, PACKS, 'look in the window');
  assert.match(r.output.mechanics || '', /\[window:peek\|shuttered\]/, r.output.mechanics);
});

test('U285: roomWindows is deterministic with a shutter event (latest wins)', () => {
  const w = inside();
  const mk = (closed) => ({ id: 'e', t: w.timeline.length, kind: 'resolution', data: { updateKind: 'window-shutter', structureKey: w.scene.interior.structureKey, roomId: w.scene.interior.roomId, closed } });
  const a = { ...w, timeline: [...w.timeline, mk(true)] };
  const b = { ...w, timeline: [...w.timeline, mk(true)] };
  assert.deepEqual(roomWindows(a, a.scene.interior), roomWindows(b, b.scene.interior));
  // latest toggle wins: open after close → open
  const c = { ...w, timeline: [...w.timeline, mk(true), mk(false)] };
  assert.equal(roomWindows(c, c.scene.interior).shuttered, false);
});
