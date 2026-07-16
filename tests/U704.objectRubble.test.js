// U704 — OBJ-RUBBLE-1: destroyed furniture leaves RUBBLE, not a blank spot.
//
// THE LIE THIS CLOSES (DEATH-TRUTH-1 front 1; the honest next step after U703):
// INK-WRECK-1 stopped the map claiming a destroyed piece still stood intact — by
// drawing NOTHING. But nothing is its own small lie: the world's own invariant
// comment says "a destroyed object becomes debris, still present" (invariants.js,
// OBJ-STATE overlay law). Smash the authored barrel and the spot where it stood
// should show the wreck of it — one generic rubble treatment (Tim's 2026-07-16
// ruling), at the piece's real location, in BOTH live 2D projections.
//
// THE ONE AUTHORITY, unchanged: destroyedAuthoredPieceIds — the SAME Set cover
// and blocking subtract. The projections re-type the destroyed piece's entry to
// 'rubble' (same identity, same geometry source); no parallel destruction flag,
// no renderer-owned state, no new world shape.
//
// PROCGEN MEMORY (U704-D): a procgen piece destroyed through the salvage lane is
// REMOVED outright, and before this packet nothing anywhere remembered it had
// existed (evidence 2026-07-16: overlay empty, no event identity). The salvage
// timeline event — already the lane's canon record — now carries the piece's
// stable objectId, and destroyedObjectIdsAtNode() derives destruction memory
// from it (timeline = canon; no new ensureWorld field, no overlay tombstone —
// the overlay invariant forbids records for removed pieces, by design). A TAKEN
// piece (physics path, no salvage event) must never read as destroyed.
//
// Rubble is memory, not furniture: it supplies no cover, no blocking (already
// subtracted — U703 pinned), and is not offerable/takeable (it joins no
// node.furniture list; it exists only as projection re-typing).

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { PACKS } from '../scripts/convergence/fixtures.mjs';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { destroyedAuthoredPieceIds, isFurnitureDestroyed } from '../engine/structures/authoredFurniture.js';
import { authoredObjectId } from '../engine/objects/identity.js';
import { destroyedObjectIdsAtNode } from '../engine/objects/query.js';
import { buildAuthoredSceneFurniture, isFinalizedAuthored } from '../public/map/LocalMap.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';
import { worldHash } from '../engine/worldHash.js';

const SEED = 'loaderDemo'; // the U661/U703 barrel exemplar hut
const boot = () => beginAdventure(newWorld({ seed: SEED, fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

const nodeOf = (w) => (w.map.nodes || []).find(n => n && n.id === w.map.currentNodeId);
const stId = (w) => String((nodeOf(w).furnitureSeeded || [])[0] || '');
const st = (w) => w.structures?.byId?.[stId(w)];

const barrelTwin = (w) => (nodeOf(w).furniture || []).find(p => p && p.authored === true && /barrel/i.test(String(p.kind || '')));
const barrelPieceId = (w) => {
  for (const r of floorPlan(st(w)).rooms || []) {
    const f = (r.furniture || []).find(x => x && x.authored === 1 && /barrel/i.test(String(x.kind || '')));
    if (f) return String(f.id);
  }
  return null;
};

// The two live projections (U703's own probes).
const interiorInk = (w) => buildAuthoredSceneFurniture(floorPlan(st(w)), w, stId(w));
const liveSheet = (w) => {
  const place = placeFromWorldNode(w, String(w.map.currentNodeId));
  const b = (place?.buildings || []).find(x => String(x?.structureKey || '') === stId(w));
  return Array.isArray(b?.plan?.furniture) ? b.plan.furniture : [];
};

// Smash until destroyed, through the REAL player path (U703's technique).
function smashToWreck(world) {
  let w = world;
  for (let i = 0; i < 12; i++) {
    const p = barrelTwin(w);
    if (!p || isFurnitureDestroyed(p)) break;
    w = playerMove(w, PACKS, 'I smash the barrel.').world;
  }
  return w;
}

const procgenChair = (w) => (nodeOf(w).furniture || []).find(p => p && p.authored !== true && /chair/i.test(String(p.name || '')));

// ── U704-A interior ink: the destroyed barrel draws as RUBBLE at its own spot ──
test('U704-A interior ink — destroyed piece re-types to rubble, same identity, same geometry', () => {
  const w0 = boot();
  assert.equal(isFinalizedAuthored(st(w0)), true, 'setup: authored render branch');
  const oid = authoredObjectId(stId(w0), barrelPieceId(w0));
  const before = interiorInk(w0).find(e => String(e.id) === oid);
  assert.ok(before && before.type === 'barrel', 'setup: intact barrel inked as a barrel');

  const w = smashToWreck(w0);
  assert.ok(destroyedAuthoredPieceIds(w, st(w)).has(barrelPieceId(w0)), 'setup: the authority holds the pieceId');

  const after = interiorInk(w).find(e => String(e.id) === oid);
  assert.ok(after, 'the destroyed piece STILL has an entry — rubble, not a blank spot');
  assert.equal(after.type, 'rubble', 'and its type is rubble');
  assert.ok(after.uw > 0 && after.uh > 0, 'with real geometry');
  assert.equal(after.ux, before.ux, 'at the same spot (x) the intact piece stood');
  assert.equal(after.uy, before.uy, 'at the same spot (y) the intact piece stood');
  assert.equal(after.uw, before.uw, 'same footprint (w) — the wreck of THAT barrel');
  assert.equal(after.uh, before.uh, 'same footprint (h)');
});

// ── U704-B live player sheet: same truth on the sheet the player actually sees ──
test('U704-B live sheet — destroyed piece re-types to rubble on the walk map', () => {
  const w0 = boot();
  const oid = authoredObjectId(stId(w0), barrelPieceId(w0));
  const before = liveSheet(w0).find(e => String(e.objectId || '') === oid);
  assert.ok(before && before.type === 'barrel', 'setup: intact barrel on the live sheet');

  const w = smashToWreck(w0);
  const after = liveSheet(w).find(e => String(e.objectId || '') === oid);
  assert.ok(after, 'the destroyed piece STILL has a live-sheet entry');
  assert.equal(after.type, 'rubble', 'typed rubble');
  assert.equal(after.ux, before.ux, 'same spot (x)');
  assert.equal(after.uy, before.uy, 'same spot (y)');
  assert.equal(after.uw, before.uw, 'same footprint (w)');
  assert.equal(after.uh, before.uh, 'same footprint (h)');
});

// ── U704-C nothing destroyed ⇒ no rubble anywhere; projection deterministic ──
test('U704-C an untouched world draws zero rubble, byte-identically, twice', () => {
  const a = boot(), b = boot();
  assert.equal(interiorInk(a).filter(e => e.type === 'rubble').length, 0, 'no interior rubble');
  assert.equal(liveSheet(a).filter(e => e.type === 'rubble').length, 0, 'no sheet rubble');
  assert.deepEqual(interiorInk(a), interiorInk(b), 'interior ink deterministic across boots');
  assert.deepEqual(liveSheet(a), liveSheet(b), 'live sheet deterministic across boots');
});

// ── U704-D procgen destruction is REMEMBERED (salvage canon), takes are not ──
test('U704-D salvage-destroyed procgen piece joins destruction memory; a taken piece never does', () => {
  // destroyed via the REAL salvage gesture
  const w0 = boot();
  const chair = procgenChair(w0);
  assert.ok(chair && chair.objectId, 'setup: the procgen chair exists with a stable pg: id');
  const chairId = String(chair.objectId);
  const w1 = playerMove(w0, PACKS, 'I smash the wooden chair.').world;
  assert.ok(!procgenChair(w1), 'setup: the salvage lane removed the chair');
  const ev = (w1.timeline || []).filter(e => e && e.kind === 'salvage');
  assert.ok(ev.length >= 1, 'the salvage event exists (the lane already records canon)');
  assert.equal(String(ev[ev.length - 1].data?.objectId || ''), chairId, 'and now carries the stable objectId');
  const dead = destroyedObjectIdsAtNode(w1, String(w1.map.currentNodeId));
  assert.ok(dead.has(chairId), 'destruction memory: the derived set holds the pg: id');

  // taken via the REAL take gesture — different fate, never "destroyed"
  const t0 = boot();
  const t1 = playerMove(t0, PACKS, 'I take the wooden chair.').world;
  assert.ok(!procgenChair(t1), 'setup: the take removed the chair from the node');
  const deadT = destroyedObjectIdsAtNode(t1, String(t1.map.currentNodeId));
  assert.ok(!deadT.has(chairId), 'a taken piece is in a pack, not destroyed — memory stays clean');
});

// ── U704-E the derived set also sees wrecked-IN-PLACE pieces (durability lane) ──
test('U704-E destroyedObjectIdsAtNode unions salvage removals with live terminal twins', () => {
  const w = smashToWreck(boot());
  const nid = String(w.map.currentNodeId);
  const dead = destroyedObjectIdsAtNode(w, nid);
  const oid = authoredObjectId(stId(w), barrelPieceId(boot()));
  // The barrel died through the salvage/legacy path this seed takes — however it
  // fell, the node-scoped destruction memory must include it.
  assert.ok(dead.has(oid), `the authored barrel's objectId is in the node's destruction memory (${[...dead].join(', ')})`);
  // and any piece still standing with a terminal state would join too (contract
  // pinned structurally: the helper reads live twins' isFurnitureDestroyed).
  for (const p of (nodeOf(w).furniture || [])) {
    if (p && isFurnitureDestroyed(p)) assert.ok(dead.has(String(p.objectId)), 'terminal twin in memory');
  }
});

// ── U704-F determinism: the whole smash script replays to the same hash ──
test('U704-F worldHash equality across two fresh smash runs', () => {
  const h1 = worldHash(smashToWreck(boot()));
  const h2 = worldHash(smashToWreck(boot()));
  assert.equal(h1, h2, 'same seed, same script, same hash — rubble changed nothing about determinism');
});
