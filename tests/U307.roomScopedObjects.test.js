// U307 — room-scoped objects (INTERIOR_OBJECT_MODEL P1; WB-Q5).
//
// Furniture is generated per NODE, so every room of a multi-room interior used to
// list (and act on) the SAME chest/pallet/lantern. engine/structures/roomObjects.js
// now assigns each piece to exactly ONE room — derived (seed + node + piece name),
// never stored, so worldHash is untouched and old saves need no migration. This
// suite locks the contract:
//   • deterministic, partition-complete, splice-stable (removeFurniture splices)
//   • the survey and the interaction gates see only THIS room's pieces
//   • affinity: a piece prefers rooms whose roomDetail loadout draws a kindred kind
//   • fallbacks (outdoors / no topology / single room) preserve the full node list

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { furnitureRoomAssignments, objectsHere } from '../engine/structures/roomObjects.js';
import { normalizeTopology } from '../engine/structures/topology.js';
import { roomDetail } from '../engine/structures/roomDetail.js';
import { moveWithinInterior } from '../engine/structures/interiors.js';
import { buildLocationSurvey } from '../engine/grace/gracefulAdjudication.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldHash } from '../engine/worldHash.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

const nodeOf = (w) => (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId) || null;
const structOf = (w) => w.structures?.byId?.[String(w.scene?.interior?.structureKey || '')] || null;
const inRoom = (w, roomId) => ({ ...w, scene: { ...w.scene, interior: { ...w.scene.interior, roomId: String(roomId) } } });
const names = (list) => list.map(o => String(o.piece?.name || ''));

test('U307: precondition — tallow boots inside a multi-room structure with node furniture', () => {
  const w = boot();
  assert.ok(w.scene?.interior, 'starts indoors');
  const topo = normalizeTopology(structOf(w)?.topology);
  assert.ok((topo?.rooms?.length || 0) >= 2, 'multi-room interior');
  assert.ok((nodeOf(w)?.furniture?.length || 0) >= 2, 'node has furniture to partition');
});

test('U307-A: assignment is deterministic and partition-complete', () => {
  const w = boot();
  const nid = w.map.currentNodeId;
  const a1 = furnitureRoomAssignments(w, nid);
  const a2 = furnitureRoomAssignments(structuredClone(w), nid);
  assert.deepEqual([...a1.entries()], [...a2.entries()], 'same world → same assignment');

  const topo = normalizeTopology(structOf(w).topology);
  const roomIds = new Set(topo.rooms.map(r => String(r.id)));
  for (const f of nodeOf(w).furniture) {
    const a = a1.get(String(f.name));
    assert.ok(a, `every piece is assigned: ${f.name}`);
    assert.ok(roomIds.has(a.roomId), `assigned to a real room: ${f.name} → ${a.roomId}`);
  }
});

test('U307-B: per-room object sets are disjoint and their union is the node list', () => {
  const w = boot();
  const topo = normalizeTopology(structOf(w).topology);
  const seen = new Map(); // pieceName -> roomId it appeared in
  for (const r of topo.rooms) {
    for (const nm of names(objectsHere(inRoom(w, r.id)))) {
      assert.ok(!seen.has(nm), `${nm} appears in one room only (was in ${seen.get(nm)}, again in ${r.id})`);
      seen.set(nm, String(r.id));
    }
  }
  const all = nodeOf(w).furniture.map(f => String(f.name)).sort();
  assert.deepEqual([...seen.keys()].sort(), all, 'union over rooms covers every node piece');
});

test('U307-C: splice stability — removing one piece does not re-room the survivors', () => {
  const w = boot();
  const nid = w.map.currentNodeId;
  const before = furnitureRoomAssignments(w, nid);
  const w2 = applyDeltas(w, [{ op: 'removeFurniture', nodeId: nid, furnitureId: 0 }]);
  const after = furnitureRoomAssignments(w2, nid);
  for (const f of nodeOf(w2).furniture) {
    assert.deepEqual(after.get(String(f.name)), before.get(String(f.name)), `${f.name} kept its room after a splice`);
  }
});

test('U307-D: affinity — a piece with kindred kinds lands in a room that draws them', () => {
  const w = boot();
  const st = structOf(w);
  const topo = normalizeTopology(st.topology);
  const kindsOf = (room) => new Set(roomDetail(room, st.buildingType || null).furniture.map(f => String(f.kind)));
  const AFFINITY = {
    'wooden table': ['table', 'longtable'], 'wooden chair': ['chair', 'bench'],
    'iron-bound chest': ['chest'], 'oil lantern': ['lantern', 'candles'],
    'stone basin': ['basin', 'font'], 'wooden crate': ['crate', 'barrel'],
    'iron brazier': ['brazier', 'firepit', 'hearth'], 'straw pallet': ['bedding', 'bed'],
    'tool rack': ['rack', 'shelf'],
  };
  const assigned = furnitureRoomAssignments(w, w.map.currentNodeId);
  for (const f of nodeOf(w).furniture) {
    const kindred = AFFINITY[String(f.name).toLowerCase()] || [];
    const wanting = topo.rooms.filter(r => kindred.some(k => kindsOf(r).has(k))).map(r => String(r.id));
    if (!wanting.length) continue; // no room draws a kindred thing → any room is fair
    assert.ok(wanting.includes(assigned.get(String(f.name)).roomId),
      `${f.name} should land in a room that draws ${kindred.join('/')} (got ${assigned.get(String(f.name)).roomId}, wanted one of ${wanting.join(', ')})`);
  }
});

test('U307-E: the survey lists only THIS room\'s pieces', () => {
  const w = boot();
  const topo = normalizeTopology(structOf(w).topology);
  const assigned = furnitureRoomAssignments(w, w.map.currentNodeId);
  // EVOLVED 2026-07-16 (FURN-PARITY-1): two adjustments, claim unchanged
  // ("only THIS room's pieces"). (1) Plan-sourced pieces uniquify by ROM-4
  // ordinal suffixes ('web mass', 'web mass 3'), so a raw substring check
  // false-positives — skip names that are strict prefixes of another piece's
  // name. (2) A room can now hold more pieces than the survey's DM cap lists,
  // so the MUST-LIST direction becomes "at least one of the room's pieces";
  // the MUST-NOT-LIST direction (the scoping law itself) stays exhaustive.
  const allNames = (nodeOf(w).furniture || []).map(f => String(f.name));
  const prefixAmbiguous = (n) => allNames.some(o => o !== n && o.startsWith(n));
  for (const r of topo.rooms) {
    const survey = buildLocationSurvey(inRoom(w, r.id));
    let roomHasUnambiguous = false;
    let listedOne = false;
    for (const f of nodeOf(w).furniture) {
      const name = String(f.name);
      if (prefixAmbiguous(name)) continue;
      const here = assigned.get(name).roomId === String(r.id);
      if (here) { roomHasUnambiguous = true; if (survey.includes(name)) listedOne = true; continue; }
      assert.equal(survey.includes(name), false,
        `[room ${r.id}] survey must NOT list ${name}: ${survey}`);
    }
    if (roomHasUnambiguous) {
      assert.ok(listedOne, `[room ${r.id}] survey lists at least one of the room's own pieces: ${survey}`);
    }
  }
});

test('U307-F: fallbacks — outdoors and topology-less interiors keep the full node list', () => {
  const w = boot();
  const all = nodeOf(w).furniture.length;
  const outdoors = { ...w, scene: { ...w.scene, interior: null } };
  assert.equal(objectsHere(outdoors).length, all, 'outdoors sees the full node list');

  const bare = {
    meta: { seed: 's' },
    map: { currentNodeId: 'n1', nodes: [{ id: 'n1', furniture: [{ name: 'wooden crate', category: 'container', state: 'intact' }] }] },
    structures: { byId: {} },
    scene: { interior: { structureKey: 'ghost', roomId: 'r1' } }
  };
  assert.equal(objectsHere(bare).length, 1, 'no known structure/topology → full list (bare-fixture fallback)');
});

test('U307-G: derivation is read-only — worldHash is untouched', () => {
  const w = boot();
  const before = worldHash(w);
  furnitureRoomAssignments(w, w.map.currentNodeId);
  objectsHere(w);
  objectsHere({ ...w, scene: { ...w.scene, interior: null } });
  assert.equal(worldHash(w), before, 'no mutation from the deriver');
});

test('U307-H: the free container path still fires — in the room that holds the container', () => {
  const w = boot();
  const assigned = furnitureRoomAssignments(w, w.map.currentNodeId);
  const container = (nodeOf(w).furniture || []).find(f => ['container', 'storage'].includes(String(f.category || '')));
  if (!container) return; // seed has no container piece — nothing to lock here
  const target = assigned.get(String(container.name));

  // Walk to the container's room (tallow is a small graph; BFS via moveWithinInterior).
  let cur = w;
  const topo = normalizeTopology(structOf(w).topology);
  const parent = new Map([[String(cur.scene.interior.roomId), null]]);
  const q = [String(cur.scene.interior.roomId)];
  while (q.length) {
    const at = q.shift();
    for (const e of topo.edges) {
      for (const nb of [e.a === at ? e.b : null, e.b === at ? e.a : null]) {
        if (nb && !parent.has(nb)) { parent.set(nb, at); q.push(nb); }
      }
    }
  }
  const hops = [];
  for (let r = target.roomId; r && r !== String(w.scene.interior.roomId); r = parent.get(r)) hops.unshift(r);
  for (const hop of hops) cur = moveWithinInterior(cur, hop);
  assert.equal(String(cur.scene.interior.roomId), target.roomId, 'reached the container\'s room');

  const r = playerMove(cur, PACKS, `I look inside the ${container.name} to see what's in it.`);
  assert.match(String(r.output.mechanics || ''), /container/i, `free container path fired: ${r.output.mechanics}`);
  assert.doesNotMatch(String(r.output.mechanics || ''), /roll:\s*\d+\s*vs\s*DC/i, 'no d20 for opening a present container');
});
