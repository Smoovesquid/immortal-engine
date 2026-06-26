// U289 — each window has a compass FACING, so climbing out is per-window: with more than one window
// the DM asks WHICH, naming the sides; climbing out a named window exits (no roll) and records the
// chosen facing in canon (the interior-exit event), so the map can place you on that side. Naming a
// window that isn't there is declined. Deterministic. Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { roomWindowFacings } from '../engine/structures/roomWindows.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const ROLL_RE = /\[roll:/i;

test('U289: each window has a distinct compass facing (deterministic)', () => {
  const a = roomWindowFacings(boot(), boot().scene.interior);
  const b = roomWindowFacings(boot(), boot().scene.interior);
  assert.deepEqual(a, b, 'deterministic');
  assert.ok(a.length >= 1, 'precondition: the room has windows');
  assert.equal(new Set(a).size, a.length, 'facings are distinct');
  for (const f of a) assert.match(f, /^(north|east|south|west)$/);
});

test('U289: with >1 window, a bare climb-out asks WHICH one and keeps you inside', () => {
  const w = boot();
  const facings = roomWindowFacings(w, w.scene.interior);
  if (facings.length < 2) return; // single-window room — nothing to disambiguate
  const r = playerMove(w, PACKS, 'climb out the window');
  assert.match(r.output.mechanics || '', /\[window:exit\|which\]/, r.output.mechanics);
  assert.match(r.output.narration, /which/i, r.output.narration);
  for (const f of facings) assert.match(r.output.narration, new RegExp(f, 'i'), `the prompt lists the ${f} option`);
  assert.ok(r.world.scene?.interior, 'asking which one keeps you inside');
});

test('U289: climbing out a NAMED window exits, records the facing in canon, and never rolls', () => {
  const w = boot();
  const facing = roomWindowFacings(w, w.scene.interior)[0];
  const r = playerMove(w, PACKS, `climb out the ${facing} window`);
  assert.equal(r.world.scene?.interior, null, 'you exit the building');
  assert.match(r.output.mechanics || '', new RegExp(`\\[window:exit\\|${facing}\\]`), r.output.mechanics);
  assert.doesNotMatch(r.output.mechanics || '', ROLL_RE, 'climbing out an accessible window never rolls');
  const ev = (r.world.timeline || []).filter(e => e?.data?.updateKind === 'interior-exit').slice(-1)[0];
  assert.equal(ev?.data?.windowFacing, facing, 'the chosen facing is recorded in canon for the map');
});

test('U289: naming a window that is not there is declined honestly (you stay inside)', () => {
  const w = boot();
  const facings = roomWindowFacings(w, w.scene.interior);
  const absent = ['north', 'east', 'south', 'west'].find(d => !facings.includes(d));
  if (!absent) return; // all four sides faced — nothing absent to test
  const r = playerMove(w, PACKS, `climb out the ${absent} window`);
  assert.match(r.output.mechanics || '', /\[window:exit\|no-such\]/, r.output.mechanics);
  assert.ok(r.world.scene?.interior, 'no window faces that way — you stay inside');
});
