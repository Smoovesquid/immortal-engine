// N7 — the DM prompt is GROUNDED in the real interior topology (WB-Q1).
//
// The live narrator was inventing navigable geography the topology lacks — a staircase,
// an upper floor, extra rooms — so the player navigated a fiction the engine couldn't
// honor and soft-locked. The fix feeds the REAL room graph (building type, room count,
// single storey, the doorways out of this room) into BOTH DM system prompts and forbids
// inventing space. This test pins that the prompt now carries the layout + the constraint.
//
// Hermetic: buildSystemPrompt / buildDMSystemPrompt are pure given their context, and
// describeInteriorLayout is a pure read over the world. No network, no API key, no cost.
// The layout is ephemeral NARRATION context (not world state), so it cannot affect the
// worldHash determinism gates (U19/21/22/27/30) — those run in the main suite.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { buildNarratorContext, buildDMContext } from '../engine/ai/narratorContext.js';
import { buildSystemPrompt, buildDMSystemPrompt } from '../engine/llmAdapter.js';
import { describeInteriorLayout } from '../engine/structures/interiors.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

test('N7: describeInteriorLayout returns the real room graph for the tallow cottage', () => {
  const lay = describeInteriorLayout(boot());
  assert.ok(lay, 'a layout is produced inside the structure');
  assert.equal(lay.buildingType, 'cottage');
  assert.equal(lay.roomCount, 3, 'the cottage has exactly 3 rooms — no invented upstairs');
  assert.ok(lay.doorways.length >= 1, 'this room names its doorways');
});

test('N7: layout is null outside a structure (no-throw, falls back cleanly)', () => {
  const w = boot();
  // After exiting the building, there is no interior layout.
  const outside = playerMove(w, PACKS, 'I step outside.').world;
  assert.equal(Boolean(outside.scene?.interior), false, 'precondition: now outdoors');
  assert.equal(describeInteriorLayout(outside), null, 'no layout outdoors');
});

test('N7: buildSystemPrompt states the single-storey room count + forbids invented geometry', () => {
  const sys = buildSystemPrompt(buildNarratorContext(boot(), {}));
  assert.match(sys, /SINGLE-STOREY/i, 'declares a single storey');
  assert.match(sys, /3 rooms/, 'states the real room count');
  assert.match(sys, /no upstairs/i, 'explicitly no upstairs');
  assert.match(sys, /INTERIOR GEOMETRY IS FIXED/, 'carries the constraint rule');
  assert.match(sys, /staircase/i, 'forbids the staircase the DM kept inventing');
  assert.match(sys, /keeps the player INSIDE/i, 'a room-to-room move does not narrate going outdoors');
  // IT-4: pin the building label to its TYPE (cottage), not the trade of whoever's inside
  // (the DM kept calling the cottage "the inn" because Dalla is an innkeeper).
  assert.match(sys, /Call this building a cottage/i, 'names the real building type');
  assert.match(sys, /do not rename it for the trade/i, 'forbids the role-implied label');
  // The old bare line ("inside a structure (room: …)") is gone.
  assert.doesNotMatch(sys, /inside a structure \(room:/);
});

test('N7: buildDMSystemPrompt (the conductor path) is grounded the same way', () => {
  const dm = buildDMSystemPrompt(buildDMContext(boot(), {}, {}));
  assert.match(dm, /SINGLE-STOREY/i);
  assert.match(dm, /INTERIOR GEOMETRY IS FIXED/);
  assert.match(dm, /staircase/i, 'forbids invented staircase/floor');
});

test('N7: a context with no layout degrades to the bare room line (no throw)', () => {
  // Older/!enriched context shape — interiorLayoutFact must fall back, never crash.
  const minimal = { placeName: 'Nowhere', nodeType: 'wilderness', tone: 'grim', structuresHere: [], interior: { roomId: 'room-x' } };
  const sys = buildSystemPrompt(minimal);
  assert.match(sys, /room-x/, 'falls back to the bare room line when no layout is attached');
});
