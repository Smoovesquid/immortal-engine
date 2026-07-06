// U589 — WIN-EGRESS-1 regression fence. The multi-window fix (U588) changes ONLY the selection on a
// room with >1 window; everything else the window/door egress family did before must be byte-for-byte
// intact:
//   • single-window interior — resolves out the one window (it never asked; still doesn't);
//   • no-window interior — the honest "no window, only wall", you stay inside;
//   • a NAMED window side the room lacks — the honest "no window faces that way" decline (unchanged);
//   • door egress ("step outside") — still leaves via the door, untouched by the window path;
//   • the AG-arc answerability egress (docs U319) — a genuine question is still ANSWERED, never
//     hijacked into a window egress just because the word "window" appears.
// Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { roomWindowFacings, roomWindows } from '../engine/structures/roomWindows.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const bootSeed = (seed) => beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const ROLL_RE = /\[roll:/i;

test('U589: single-window interior resolves out the one window (never asks, never rolls)', () => {
  // seed 'ashfen-reach' boots into a one-window interior (facing south).
  const w = bootSeed('ashfen-reach');
  const facings = roomWindowFacings(w, w.scene.interior);
  assert.equal(facings.length, 1, `precondition: exactly one window; got ${JSON.stringify(facings)}`);
  const r = playerMove(w, PACKS, 'climb out the window');
  assert.equal(r.world.scene?.interior, null, 'you exit');
  assert.match(r.output.mechanics || '', new RegExp(`\\[window:exit\\|${facings[0]}\\]`), r.output.mechanics);
  assert.doesNotMatch(r.output.mechanics || '', /\|which\]/, 'a single window is never a which-menu');
  assert.doesNotMatch(r.output.mechanics || '', ROLL_RE, 'window egress never rolls');
});

test('U589: no-window interior stays honest — "only solid wall", you stay inside', () => {
  // A room with no derivable windows (no topology) → count 0. This branch is above the
  // multi-window selection and is untouched by the fix.
  const base = bootSeed('tallow');
  const w = { ...base, scene: { ...base.scene, interior: { structureKey: 'no-such-structure-xyz', roomId: 'r0' } } };
  assert.equal(roomWindows(w, w.scene.interior).count, 0, 'precondition: a windowless interior');
  const r = playerMove(w, PACKS, 'climb out the window');
  assert.equal(r.world.scene?.interior?.structureKey, 'no-such-structure-xyz', 'no window — you stay inside');
  assert.match(r.output.narration, /no window in this room|only solid wall/i, r.output.narration);
  assert.doesNotMatch(r.output.mechanics || '', /\[window:exit/, 'no window-exit is recorded');
});

test('U589: naming a window side the room lacks is still declined honestly (you stay inside)', () => {
  // tallow faces east + north; 'south'/'west' are absent — a NAMED absent side must still decline.
  const w = bootSeed('tallow');
  const facings = roomWindowFacings(w, w.scene.interior);
  const absent = ['north', 'east', 'south', 'west'].find(d => !facings.includes(d));
  assert.ok(absent, 'precondition: some side is absent');
  const r = playerMove(w, PACKS, `climb out the ${absent} window`);
  assert.match(r.output.mechanics || '', /\[window:exit\|no-such\]/, r.output.mechanics);
  assert.match(r.output.narration, new RegExp(`no window faces ${absent}`, 'i'), r.output.narration);
  assert.ok(r.world.scene?.interior, 'you stay inside');
});

test('U589: a bare GOAL direction that no window faces does NOT falsely decline — it just resolves', () => {
  // "sprint south" is a heading, not a window side. tallow has no south window, but this must NOT
  // trip the no-such decline (that is reserved for a NAMED window side) — it resolves out a real window.
  const w = bootSeed('tallow');
  const r = playerMove(w, PACKS, 'I sprint south and climb out the window');
  assert.doesNotMatch(r.output.mechanics || '', /\|no-such\]/, 'a bare heading is not a window-side decline');
  assert.match(r.output.mechanics || '', /\[window:exit\|(north|east)\]/, 'resolves out one of the real windows');
  assert.equal(r.world.scene?.interior, null, 'you exit');
});

test('U589: door egress is untouched — "step back outside" still leaves via the door, no window tag', () => {
  const w = bootSeed('tallow');
  const r = playerMove(w, PACKS, 'I step back outside');
  assert.equal(r.world.scene?.interior, null, 'you leave the building');
  assert.doesNotMatch(r.output.mechanics || '', /\[window:exit/, 'leaving via the door is not a window egress');
});

test('U589: the AG-arc answerability egress is not hijacked — a question near a window is ANSWERED', () => {
  // The word "window" in a QUESTION must not route into the window-egress action. The player asks;
  // the DM answers (or honestly declines) — the interior is not cleared, no window-exit is recorded.
  const w = bootSeed('tallow');
  const r = playerMove(w, PACKS, 'What can I see through the window?');
  assert.ok(r.world.scene?.interior, 'a question does not walk you out of the building');
  assert.doesNotMatch(r.output.mechanics || '', /\[window:exit\|(north|east|south|west)\]/, 'a question is not a window egress');
});
