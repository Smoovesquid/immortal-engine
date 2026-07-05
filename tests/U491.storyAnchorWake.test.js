// U491 — OCC-STORY-1 baseline: nobody materializes in the sleeping player's cottage.
//
// Settlement NPC placement used to be a seeded hash-scatter over whatever buildings happened to be
// MATERIALIZED. At the dawn wake exactly one building is materialized — the player's own cottage — so
// every indoor NPC piled into it, including the seeded HOSTILE bandit: an armed robber standing in
// your entry room at first light, by accident, with no story attached. Tim's ruling (2026-07-05):
// folk show up in places explained by their personal story; "just having them materialize at random
// won't work." The test for every placement is — if the player asks "why is he here?", the answer
// already exists. This file locks the floor: the wake cottage holds only the player, and a hostile is
// NEVER assigned inside a building that isn't its own. Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { occupantsOfRoom } from '../engine/structures/roomOccupancy.js';
import { normalizeTopology } from '../engine/structures/topology.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();

// Boot the default world exactly as v1.html does: the tallow slice, escape mode, fantasy pack.
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const nodeNpcs = (w) => (w.map.nodes.find(n => n.id === w.map.currentNodeId)?.settlement?.npcs) || [];
const rooms = (w, sk) => (normalizeTopology(w.structures?.byId?.[sk]?.topology)?.rooms || []).map(r => r.id);

test('U491: the sleeping player wakes ALONE — no stranger stands in the wake cottage', () => {
  const w = boot();
  const wakeSK = w.scene.interior.structureKey; // the player's home cottage, the one materialized building at dawn
  const roster = nodeNpcs(w);
  assert.ok(roster.length > 0, 'precondition: the settlement has a roster');

  let strangersInside = [];
  for (const rid of rooms(w, wakeSK)) {
    strangersInside = strangersInside.concat(occupantsOfRoom(w, wakeSK, rid));
  }
  const names = strangersInside.map(n => n.name);
  assert.deepEqual(
    names, [],
    `the wake cottage must contain only the player at dawn, but strangers materialized inside: ${names.join(', ')}`
  );
});

test('U491: a hostile NPC is never assigned inside the wake cottage (it is not the bandit\'s place)', () => {
  const w = boot();
  const wakeSK = w.scene.interior.structureKey;
  let inside = [];
  for (const rid of rooms(w, wakeSK)) inside = inside.concat(occupantsOfRoom(w, wakeSK, rid));
  const hostilesInside = inside.filter(n => n && n.hostile).map(n => n.name);
  assert.deepEqual(
    hostilesInside, [],
    `an armed hostile must never materialize in the sleeping player's cottage, but found: ${hostilesInside.join(', ')}`
  );
});
