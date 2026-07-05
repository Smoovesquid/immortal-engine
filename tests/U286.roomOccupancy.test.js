// U286 — per-room occupancy. NPCs are placed per BUILDING ROOM (derived, deterministic), not
// treated as "the whole settlement is here". Folk gather in the common/entry room; a private back
// room is usually empty — so "look around" names only who is in YOUR room (no roster dump in a
// bedroom), the outside peek names who is in the room it sees into, and climb-in stealth runs
// against the people who'd actually see you. A structure with no interior topology falls back to
// "everyone here" (backward compatible). Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { occupantsOfRoom, outdoorOccupants } from '../engine/structures/roomOccupancy.js';
import { placementFor, drawnBuildings } from '../engine/structures/storyAnchors.js';
import { normalizeTopology } from '../engine/structures/topology.js';
import { buildLocationSurvey } from '../engine/grace/gracefulAdjudication.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const nodeNpcs = (w) => (w.map.nodes.find(n => n.id === w.map.currentNodeId)?.settlement?.npcs) || [];
const rooms = (w, sk) => (normalizeTopology(w.structures?.byId?.[sk]?.topology)?.rooms || []).map(r => r.id);

test('U286: occupancy partitions the roster — every NPC is in exactly one place (a building or outdoors)', () => {
  // OCC-STORY-1: the partition is now over {outdoors} ∪ {ALL drawn buildings} — an NPC's STORY ANCHOR
  // may put them in a building the player can't be inside (a decorative smithy/well), so the old
  // "outdoors + the wake cottage's rooms == everyone" no longer holds (the wake cottage is now empty
  // of strangers by design). We assert the true partition via placementFor: every NPC lands in
  // exactly one place, either outdoors or exactly one drawn building.
  const w = boot();
  const nodeId = w.map.currentNodeId;
  const wakeKey = w.scene.interior.structureKey;
  const npcs = nodeNpcs(w);
  const buildingKeys = new Set(drawnBuildings(w, nodeId).map(b => b.key));
  let placedOnce = 0;
  for (const npc of npcs) {
    const p = placementFor(w, npc, { nodeId, seed: w.meta.seed, wakeKey });
    const outdoors = p.where === 'outdoors';
    const inBuilding = p.where === 'building' && buildingKeys.has(String(p.key));
    assert.ok(outdoors !== inBuilding, `NPC ${npc.name} must be in exactly one place, got ${JSON.stringify(p)}`);
    if (outdoors || inBuilding) placedOnce++;
  }
  assert.equal(placedOnce, npcs.length, 'each NPC is placed in exactly one place (a drawn building or outdoors)');
});

test('U286: occupancy is deterministic', () => {
  const a = boot(), b = boot();
  const sk = a.scene.interior.structureKey;
  for (const rid of rooms(a, sk)) {
    assert.deepEqual(occupantsOfRoom(a, sk, rid).map(n => n.name), occupantsOfRoom(b, sk, rid).map(n => n.name));
  }
});

test('U286: a private (empty) room lists no people; an occupied room names its own', () => {
  // OCC-STORY-1: the tallow wake cottage is now EMPTY of strangers by design (no one is anchored to
  // the player's home), so the empty-room case is verified against it directly. For the occupied-room
  // case we build a fixture where an NPC's anchor IS the building the player stands in — the tallow
  // node has no other enterable populated interior (its non-home buildings are decorative). The
  // through-a-window sight of outdoor folk is a separate line-of-sight path (see U286 window test).
  const w = boot();
  const sk = w.scene.interior.structureKey;
  const names = nodeNpcs(w).filter(n => !n.hostile).map(n => n.name);
  const surveyIn = (world, rid) => buildLocationSurvey({ ...world, scene: { ...world.scene, interior: { ...world.scene.interior, roomId: rid } } });

  // Empty case: the wake cottage's rooms hold no strangers. Naming is line-of-sight — a room with no
  // occupants and no window onto outdoor folk names nobody. (Window-visible outdoor folk are allowed;
  // the innermost cottage room has no window, so we survey there.)
  const innerRid = rooms(w, sk).find(rid => occupantsOfRoom(w, sk, rid).filter(n => !n.hostile).length === 0
    && !/window/i.test(surveyIn(w, rid)));
  if (innerRid) {
    const s = surveyIn(w, innerRid);
    for (const nm of names) assert.ok(!s.includes(nm), `an empty inner room must not name ${nm}: ${s}`);
  }

  // Occupied case: a single-building fixture where the sole roster NPC is anchored to this building.
  // (No wakeKey → nothing excluded; a smithy building + a smith NPC → kind-matched anchor here.)
  const topo = { kind: 'rooms', rooms: [{ id: 'r:entry', tags: ['entry'] }, { id: 'r:back' }], edges: [{ a: 'r:entry', b: 'r:back' }] };
  const fx = {
    meta: { seed: 'occ-fixture' },
    time: { hours: 5 }, // daytime → the smith is at their post
    scene: { interior: { structureKey: 'smithy1', roomId: 'r:entry' } },
    map: { currentNodeId: 'town', nodes: [{ id: 'town', settlement: { npcs: [{ id: 'smith0', name: 'Bruna Ironside', role: 'smith' }] } }] },
    structures: { byId: { smithy1: { id: 'smithy1', nodeId: 'town', buildingType: 'smithy', topology: topo } } }
  };
  const occ = [...occupantsOfRoom(fx, 'smithy1', 'r:entry'), ...occupantsOfRoom(fx, 'smithy1', 'r:back')];
  assert.ok(occ.some(n => n.name === 'Bruna Ironside'), `the smith should be anchored to the smithy: ${JSON.stringify(occ.map(n => n.name))}`);
  const occRoom = occupantsOfRoom(fx, 'smithy1', 'r:entry').length ? 'r:entry' : 'r:back';
  const s = surveyIn(fx, occRoom);
  // An un-met NPC is named by role in line-of-sight prose ("a smith is here"), not by proper name.
  assert.ok(/\bsmith\b/i.test(s), `an occupied room should name its occupant (by role): ${s}`);
});

test('U286: a multi-building node splits its roster BETWEEN buildings (partition holds)', () => {
  const mkTopo = (p) => ({ kind: 'rooms', rooms: [{ id: `${p}:entry`, tags: ['entry'] }, { id: `${p}:back` }], edges: [{ a: `${p}:entry`, b: `${p}:back` }] });
  const npcs = Array.from({ length: 8 }, (_, i) => ({ id: `npc${i}`, name: `NPC${i}` }));
  const w = {
    meta: { seed: 'multi' },
    map: { currentNodeId: 'town', nodes: [{ id: 'town', settlement: { npcs } }] },
    structures: { byId: {
      b1: { id: 'b1', nodeId: 'town', topology: mkTopo('b1') },
      b2: { id: 'b2', nodeId: 'town', topology: mkTopo('b2') }
    } }
  };
  const roomsOf = (b) => [`${b}:entry`, `${b}:back`];
  const seen = new Set();
  const tally = (arr) => { arr.forEach(n => seen.add(n.name)); return arr.length; };
  const buckets = [
    tally(outdoorOccupants(w)),
    roomsOf('b1').reduce((a, r) => a + tally(occupantsOfRoom(w, 'b1', r)), 0),
    roomsOf('b2').reduce((a, r) => a + tally(occupantsOfRoom(w, 'b2', r)), 0)
  ];
  assert.equal(buckets.reduce((a, b) => a + b, 0), 8, 'partition: every NPC placed exactly once across outdoors + both buildings');
  assert.equal(seen.size, 8, 'no NPC is duplicated across places');
  assert.ok(buckets.filter(n => n > 0).length >= 2, 'the roster is genuinely distributed, not all dumped in one place');
});

test('U286: a structure with no interior topology puts everyone "here" (backward compatible)', () => {
  const w = boot();
  const occ = occupantsOfRoom(w, 'no-such-structure:0', 'r'); // unresolved → single-space fallback
  assert.equal(occ.length, nodeNpcs(w).length, 'no topology → everyone is here');
});

test('U286: the outside peek reports real room occupancy (not the old "cannot tell" hedge)', () => {
  const w = playerMove(boot(), PACKS, 'I step outside').world;
  const r = playerMove(w, PACKS, 'look in the window');
  if (!/\[window:peek\]/.test(r.output.mechanics || '')) return; // not at a windowed building — skip
  assert.doesNotMatch(r.output.narration, /cannot tell from here/i, 'peek now reports who is actually within');
  assert.match(r.output.narration, /within|still and empty|keeps to the shadows/i, r.output.narration);
});
