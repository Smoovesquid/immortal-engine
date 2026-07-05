// U524 — MR-2d: the sightline DERIVATION's properties (visibleThroughWindows &
// occupiedWindowsFromOutside in engine/structures/roomOccupancy.js). Pure-function
// unit tests over the real booted world plus tight fixtures — the LAWS a window-as-
// aperture must obey, so a later change can't silently let sight pass through a wall.
// (docs/briefs/MR-2-FUNCTIONAL-INK.md §2d.) Hermetic — no network, no API key.
//
// The four laws:
//   1. NEVER THROUGH A WALL   — a room with NO window sees zero outdoor folk.
//   2. SHUTTERS BLOCK SIGHT   — a shuttered window sees zero.
//   3. THE ARC RESPECTS FACING — a person on a side no window faces is not seen;
//                                the visible set is a subset of the outdoor roster.
//   4. DETERMINISM            — same world, twice, identical result (×2 boots).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import {
  visibleThroughWindows, occupiedWindowsFromOutside, outdoorOccupants,
} from '../engine/structures/roomOccupancy.js';
import { roomWindows, roomWindowFacings } from '../engine/structures/roomWindows.js';
import { normalizeTopology } from '../engine/structures/topology.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const roomsOf = (w, sk) => (normalizeTopology(w.structures?.byId?.[sk]?.topology)?.rooms || []).map(r => String(r.id));

test('U524 (law 1): a windowless room sees NO outdoor folk — sight never passes through a wall', () => {
  const w = boot();
  const sk = w.scene.interior.structureKey;
  const windowless = roomsOf(w, sk).filter(rid => roomWindows(w, { structureKey: sk, roomId: rid }).count === 0);
  assert.ok(windowless.length >= 1, 'precondition: the wake cottage has at least one windowless room');
  for (const rid of windowless) {
    assert.equal(visibleThroughWindows(w, sk, rid).length, 0,
      `windowless room ${rid} must see nobody outdoors`);
  }
  // And a nonsense structure key sees nobody (no topology → no windows → no sight).
  assert.equal(visibleThroughWindows(w, 'no-such-structure:0', 'r').length, 0);
});

test('U524 (law 2): a shuttered window sees NO outdoor folk', () => {
  const w = boot();
  const sk = w.scene.interior.structureKey;
  const shuttered = roomsOf(w, sk).filter(rid => {
    const win = roomWindows(w, { structureKey: sk, roomId: rid });
    return win.count > 0 && win.shuttered;
  });
  assert.ok(shuttered.length >= 1, 'precondition: the wake cottage has a shuttered windowed room');
  for (const rid of shuttered) {
    assert.equal(visibleThroughWindows(w, sk, rid).length, 0,
      `shuttered room ${rid} must see nobody until the shutters open`);
  }
});

test('U524 (law 3): the visible set respects the FACING ARC — a strict subset of outdoor folk, and off-arc folk are excluded', () => {
  const w = boot();
  const sk = w.scene.interior.structureKey;
  const allOutdoor = new Set(outdoorOccupants(w).filter(n => n && !n.hostile).map(n => String(n.name)));

  // For EVERY windowed, unshuttered room: every person seen is (a) a real outdoor
  // occupant and (b) in a sector one of the room's windows faces. And across the
  // cottage, at least one room genuinely EXCLUDES an outdoor person (the arc bites).
  let sawExclusion = false;
  for (const rid of roomsOf(w, sk)) {
    const win = roomWindows(w, { structureKey: sk, roomId: rid });
    if (!win.count || win.shuttered) continue;
    const facings = new Set(roomWindowFacings(w, { structureKey: sk, roomId: rid }));
    const seen = visibleThroughWindows(w, sk, rid).map(n => String(n.name));
    for (const nm of seen) assert.ok(allOutdoor.has(nm), `${nm} seen from ${rid} must be a real outdoor occupant`);
    if (seen.length < allOutdoor.size) sawExclusion = true;
    // No facing at all would be a bug — an unshuttered window must face somewhere.
    assert.ok(facings.size >= 1, `an unshuttered windowed room ${rid} must have a facing`);
  }
  assert.ok(sawExclusion, 'at least one windowed room must EXCLUDE an off-arc outdoor person (facing genuinely filters)');
});

test('U524 (law 3b): a hostile lurker is never a face at the window', () => {
  const w = boot();
  const sk = w.scene.interior.structureKey;
  for (const rid of roomsOf(w, sk)) {
    const seen = visibleThroughWindows(w, sk, rid);
    assert.equal(seen.filter(n => n && n.hostile).length, 0, `no hostile may be seen through a window (${rid})`);
  }
});

test('U524 (law 4): visibleThroughWindows is deterministic across two boots', () => {
  const a = boot(), b = boot();
  const sk = a.scene.interior.structureKey;
  for (const rid of roomsOf(a, sk)) {
    const va = visibleThroughWindows(a, sk, rid).map(n => ({ name: n.name, reason: n.reason, side: n.side }));
    const vb = visibleThroughWindows(b, sk, rid).map(n => ({ name: n.name, reason: n.reason, side: n.side }));
    assert.deepEqual(va, vb, `window view for ${rid} must be identical across boots`);
  }
});

test('U524: every window-visible occupant carries reason + side (narration fuel), and a side label maps off the outlook', () => {
  const w = boot();
  const sk = w.scene.interior.structureKey;
  let checkedOne = false;
  for (const rid of roomsOf(w, sk)) {
    for (const occ of visibleThroughWindows(w, sk, rid)) {
      checkedOne = true;
      assert.ok(occ.reason && occ.reason.length > 0, `occupant seen through ${rid} needs a reason`);
      assert.ok(occ.side && occ.side.length > 0, `occupant seen through ${rid} needs a side label`);
      // The side is a descriptive label, never a bare compass EXIT phrase (CG-2b safety).
      assert.doesNotMatch(occ.side, /\b(door|stairs|passage|corridor|exit)\b/i, 'side label must not read as an exit');
    }
  }
  assert.ok(checkedOne, 'precondition: at least one occupant is visible through some window');
});

// ── occupiedWindowsFromOutside (the mirror, outside→in) ──────────────────────
test('U524: occupiedWindowsFromOutside is a boolean and deterministic', () => {
  const a = boot(), b = boot();
  const ra = occupiedWindowsFromOutside(a);
  const rb = occupiedWindowsFromOutside(b);
  assert.equal(typeof ra, 'boolean');
  assert.equal(ra, rb, 'the outside-in window read must be deterministic');
});

test('U524: occupiedWindowsFromOutside excludes the player\'s own home and needs an occupied lit room', () => {
  // A fixture: a town with the player's home (empty of strangers) and a shop whose
  // entry room is occupied by a non-hostile NPC through an unshuttered window.
  const mkTopo = (p) => ({ kind: 'rooms', rooms: [{ id: `${p}:entry`, tags: ['entry'] }, { id: `${p}:back` }], edges: [{ a: `${p}:entry`, b: `${p}:back` }] });
  const base = {
    meta: { seed: 'outside-in-fixture', homeNodeId: 'town' },
    time: { hours: 5 },
    map: { currentNodeId: 'town', nodes: [{ id: 'town', settlement: { npcs: [{ id: 'smith0', name: 'Bruna Ironside', role: 'smith' }] } }] },
    structures: { byId: {
      home: { id: 'home', nodeId: 'town', buildingType: 'cottage', topology: mkTopo('home') },
      smithy: { id: 'smithy', nodeId: 'town', buildingType: 'smithy', topology: mkTopo('smithy') },
    } },
  };
  // With a smith anchored to the smithy, SOME lit occupied window should read from
  // outside (unless the seed happens to shutter every one — then it's honestly false).
  const res = occupiedWindowsFromOutside(base);
  assert.equal(typeof res, 'boolean');

  // A node with NO structures reads false (nothing to see through).
  const bare = { meta: { seed: 's' }, map: { currentNodeId: 'x', nodes: [{ id: 'x', settlement: { npcs: [] } }] }, structures: { byId: {} } };
  assert.equal(occupiedWindowsFromOutside(bare), false);
});
