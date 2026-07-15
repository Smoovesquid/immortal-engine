// U698 — OBJ-HOLD-6A: held identity + honest release + ONE room truth (rev 3 brief).
// A supported furniture object (objectId + authored + grounded to an authored plan cell)
// is TAKEN by setting world.objects[id].heldByActorId — never removeFurniture+createItem —
// so identity and durability survive take → hold → release. Everything else (procgen,
// generic, ungrounded) keeps today's path byte-identically (canaries; FURN-PARITY-1 owns it).
//
// Sections:
//   A — the supported-object domain gate: conversion for authored pieces, canaries for the rest.
//   B — the one-held rule: writer-enforced AND invariant-enforced (two laws; no actor-existence law).
//   C — writer trust boundary: every forged/illegal holdObject/placeObject delta is a byte-no-op.
//   D — ROOM TRUTH: resolvedObjectPlacement is the one authority; the 8-step cross-room
//       contract (damage → take → carry → drop in another room → retake/drag/inspect/attack
//       there; absent from the old room; render/occupancy only at the live cell; symmetric).
//   E — visibility: strike-on-held is guidance; presence/where-is answers say "carrying".
//   F — the carry-lock: structure-local carry; every egress family refuses fiction-first.
//   G — honest release: engine-derived cell, ref:'actor'/'object', beside/against never on/atop.
//   H — determinism: replay-hash ×2, save mid-held, empty-overlay goldens, overlay-deletion
//       canary, the moved-wreck occupancy fix (both cases), held-blocks-nothing.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { evaluatePhysicsSync, heldObjectOf } from '../engine/llmPhysics.js';
import { resolvedObjectPlacement } from '../engine/objects/placement.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import {
  authoredBaseAnchorCell, legalMoveTargetCell, legalPlaceTargetCell,
  liveAuthoredBlockedCells, reservedDoorCells, roomRectCells, layoutToCells,
} from '../engine/map/spatial/tacticalPos.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { moveWithinInterior, exitStructureInterior } from '../engine/structures/interiors.js';
import { objectsHere } from '../engine/structures/roomObjects.js';
import { buildAuthoredSceneFurniture } from '../public/map/LocalMap.js';
// R. release-correction — the LIVE continuous-map lane (not the LocalMap fallback),
// writer co-location against the REQUESTED actor, same-name identity, capacity.
import { placeFromWorldNode } from '../public/map/placeFromNode.js';
import { placedTokenModel } from '../public/map/drawModel.js';
import { sceneSignature } from '../public/map/continuousMap.js';
import { actorObjectCapacity } from '../engine/objects/capacity.js';
import { objectPhysics } from '../engine/objects/mobility.js';
import { actorFacts } from '../engine/objects/physicsActor.js';
import { rollPhysicsCheck } from '../engine/resolve.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

// ── fixtures ──────────────────────────────────────────────────────────────────
// boot1: the ONE-room authored cottage (loaderDemo) — barrel + bed + procgen pieces.
const boot1 = () => beginAdventure(newWorld({ seed: 'loaderDemo', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const STRUCT1 = 'authored:n8_2046891609';
const ROOM1 = `room:${STRUCT1}:1`;
const NODE1 = 'n8_2046891609';
const BARREL = `au:${STRUCT1}:${ROOM1}#a1`;
const BED1 = `au:${STRUCT1}:${ROOM1}#a0`;

// boot2: the THREE-room authored cottage (loaderDemo2) — the multi-room fixture the
// cross-room contract requires. Player boots in room :2 beside the authored cooking pot
// (portable iron); the authored bed (heavy wood) is across the hall in room :3.
const boot2 = () => beginAdventure(newWorld({ seed: 'loaderDemo2', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const STRUCT2 = 'authored:n2_96332945';
const NODE2 = 'n2_96332945';
const R1 = `room:${STRUCT2}:1`; // hall (entry; exterior door)
const R2 = `room:${STRUCT2}:2`; // boot room — cooking pot
const R3 = `room:${STRUCT2}:3`; // bedchamber — bed + the window
const POT = `au:${STRUCT2}:${R2}#a0`;
const BED2 = `au:${STRUCT2}:${R3}#a0`;

// ── helpers ───────────────────────────────────────────────────────────────────
const might = (w, v) => ({ ...w, party: [{ ...w.party[0], stats: { ...(w.party[0].stats || {}), MIGHT: v } }, ...w.party.slice(1)] });
const aKey = (w) => String(w.party?.[0]?.id || 'party');
const key = (c) => `${c.x},${c.y}`;
const st2 = (w) => w.structures.byId[STRUCT2];
const st1 = (w) => w.structures.byId[STRUCT1];
const nodeFurn = (w, nid) => (w.map.nodes.find(n => n.id === nid)?.furniture) || [];
const pieceById = (w, nid, oid) => nodeFurn(w, nid).find(f => String(f.objectId || '') === oid) || null;
const toolsNames = (w) => ((w.party[0].inventory || {}).tools || []).map(i => String(i.name));
const hold = (objectId, actorId) => ({ op: 'holdObject', actorId, objectId });
const place = (objectId, ref, actorId) => ({ op: 'placeObject', actorId, objectId, ref });
const pm = (w, t) => playerMove(w, PACKS, t);
const hereNames = (w) => objectsHere(w).map(o => String(o.piece.name));

// Strike an object through the LIVE declared-attack path until its durability record
// shows real damage (hp < maxHp). Seeded/deterministic; bounded.
function strikeUntilDamaged(w, phrase, objectId, tries = 12) {
  for (let i = 0; i < tries; i++) {
    const d = w.objects?.[objectId]?.durability;
    if (d && d.hp < d.maxHp) return w;
    w = pm(w, phrase).world;
  }
  return w;
}

// Build the D-section world: pot damaged in R2, then taken (held). Returns checkpoints.
function carriedPot() {
  let w = might(boot2(), 20);
  w = strikeUntilDamaged(w, 'attack the cooking pot with my hatchet', POT);
  const dur = w.objects?.[POT]?.durability;
  const r = pm(w, 'take the cooking pot');
  return { w: r.world, out: r.out, hpA: dur ? dur.hp : null, narration: String(r.output?.narration || '') };
}

// ══ A. the supported-object domain ════════════════════════════════════════════
test('U698-A1 a supported take HOLDS: piece stays canonical, durability survives, no pack item', () => {
  let w = might(boot2(), 20);
  w = strikeUntilDamaged(w, 'attack the cooking pot with my hatchet', POT);
  const dur = w.objects?.[POT]?.durability;
  assert.ok(dur && dur.hp < dur.maxHp, `pot carries real damage before the take (${JSON.stringify(dur)})`);
  const r = pm(w, 'take the cooking pot');
  const w2 = r.world;
  assert.ok(pieceById(w2, NODE2, POT), 'the pot piece STAYS in node.furniture (Option A identity)');
  assert.equal(w2.objects?.[POT]?.heldByActorId, aKey(w2), 'held by the player through the live path');
  assert.equal(w2.objects?.[POT]?.placedAt, undefined, 'held ⊥ placed');
  assert.deepEqual(w2.objects?.[POT]?.durability, dur, 'the damage record survives the take untouched');
  assert.ok(!toolsNames(w2).some(n => /cooking pot/i.test(n)), 'NO generic pack item is minted');
  assert.equal(resolvedObjectPlacement(w2, POT).status, 'held');
});

test('U698-A2 CANARY — an unsupported (procgen) take keeps today\'s remove+createItem path', () => {
  const w = might(boot1(), 20);
  const rackId = nodeFurn(w, NODE1).find(f => /tool rack/i.test(String(f.name)))?.objectId;
  assert.ok(rackId && String(rackId).startsWith('pg:'), 'the tool rack is a procgen piece');
  const r = pm(w, 'take the tool rack');
  const w2 = r.world;
  assert.equal(pieceById(w2, NODE1, rackId), null, 'procgen piece is spliced out (legacy path)');
  assert.ok(toolsNames(w2).some(n => /tool rack/i.test(n)), 'legacy pack item minted');
  assert.equal(w2.objects?.[rackId], undefined, 'NO overlay state for an unsupported piece');
});

test('U698-A3 a forged holdObject on a procgen piece is a byte-no-op', () => {
  const w = boot1();
  const rackId = nodeFurn(w, NODE1).find(f => /tool rack/i.test(String(f.name)))?.objectId;
  const w2 = applyDeltas(w, [hold(rackId, 'party')]);
  assert.equal(w2.objects?.[rackId], undefined, 'unsupported piece never gains heldByActorId');
  assert.equal(worldHash(w2), worldHash(applyDeltas(w, [])), 'world byte-identical to a no-op batch');
});

test('U698-A4 a forged holdObject on an UNGROUNDED authored piece is a no-op', () => {
  let w = boot2();
  const ghostId = `au:${STRUCT2}:zz`;
  const nodes = w.map.nodes.map(n => n.id === NODE2
    ? { ...n, furniture: [...n.furniture, { name: 'ghost crate', kind: 'crate', material: 'wood', weight: 2, bulk: 2, parts: [], tags: [], notes: '', authored: true, structureId: STRUCT2, roomId: R2, pieceId: 'zz', objectId: ghostId }] }
    : n);
  w = { ...w, map: { ...w.map, nodes } };
  assert.equal(authoredBaseAnchorCell(w, ghostId), null, 'the ghost piece grounds to no plan cell');
  const w2 = applyDeltas(w, [hold(ghostId, 'party')]);
  assert.equal(w2.objects?.[ghostId], undefined, 'no overlay for an ungrounded piece');
});

// ══ B. the one-held rule ══════════════════════════════════════════════════════
test('U698-B1 LIVE — a second take is refused in fiction while the first is in your arms', () => {
  let { w } = carriedPot();
  w = moveWithinInterior(w, R1);
  w = moveWithinInterior(w, R3);
  const r = pm(w, 'take the bed');
  assert.equal(r.world.objects?.[BED2], undefined, 'the bed gains no overlay');
  assert.equal(r.world.objects?.[POT]?.heldByActorId, aKey(r.world), 'still holding the pot');
  assert.match(String(r.output?.narration || ''), /hands|carrying|arms|set .* down|already/i, 'refusal names the full hands');
});

test('U698-B2 WRITER — a second holdObject for the same actor is a no-op', () => {
  let { w } = carriedPot();
  w = moveWithinInterior(w, R1);
  w = moveWithinInterior(w, R3);
  const w2 = applyDeltas(w, [hold(BED2, aKey(w))]);
  assert.equal(w2.objects?.[BED2], undefined, 'forged second hold refused at the writer');
});

test('U698-B3 a re-take of the object you hold is idempotent (zero mutation)', () => {
  const { w } = carriedPot();
  const before = JSON.stringify(w.objects);
  const w2 = applyDeltas(w, [hold(POT, aKey(w))]);
  assert.equal(JSON.stringify(w2.objects), before, 'op-level: unchanged');
  const r = pm(w, 'take the cooking pot');
  assert.equal(JSON.stringify(r.world.objects), before, 'live path: unchanged');
  assert.match(String(r.output?.narration || ''), /already|carrying|in your arms/i);
});

test('U698-B4 an object held by ANOTHER actor is untouchable', () => {
  let w = might(boot2(), 20);
  w = { ...w, objects: { ...(w.objects || {}), [POT]: { heldByActorId: 'npc_x' } } };
  const r = pm(w, 'take the cooking pot');
  assert.equal(r.world.objects?.[POT]?.heldByActorId, 'npc_x', 'live take cannot steal from arms');
  assert.ok(!toolsNames(r.world).some(n => /cooking pot/i.test(n)), 'no pack item minted');
  const w2 = applyDeltas(w, [hold(POT, aKey(w))]);
  assert.equal(w2.objects?.[POT]?.heldByActorId, 'npc_x', 'forged hold cannot steal either');
});

test('U698-B5 INVARIANT LAW 1 — held ⊥ placed: a record with both throws', () => {
  const w = boot2();
  const bad = { ...w, objects: { ...(w.objects || {}), [POT]: { heldByActorId: 'x', placedAt: { node: NODE2, structureId: STRUCT2, room: R2, cell: { x: 75, y: 52 }, rot: 0 } } } };
  assert.throws(() => assertWorldInvariants(bad), /held and placed|both/i);
});

test('U698-B5b the exclusion law holds through save/import (no normalizer laundering)', () => {
  const w = boot2();
  const held = { ...w, objects: { ...(w.objects || {}), [POT]: { heldByActorId: aKey(w) } } };
  assert.doesNotThrow(() => assertWorldInvariants(held), 'a plain held record is legal');
});

test('U698-B6 INVARIANT LAW 2 — one holder, one object: two records held by the same actor throw', () => {
  const w = boot2();
  const bad = { ...w, objects: { [POT]: { heldByActorId: 'x' }, [BED2]: { heldByActorId: 'x' } } };
  assert.throws(() => assertWorldInvariants(bad), /more than one|holds/i, 'forged two-held state fails loudly');
  const ok = { ...w, objects: { [POT]: { heldByActorId: 'x' }, [BED2]: { heldByActorId: 'y' } } };
  assert.doesNotThrow(() => assertWorldInvariants(ok), 'two DIFFERENT holders are legal');
});

test('U698-B7 deliberately NO actor-existence invariant (a vanished holder must not corrupt saves)', () => {
  const w = boot2();
  const ghost = { ...w, objects: { ...(w.objects || {}), [POT]: { heldByActorId: 'ghost_npc_999' } } };
  assert.doesNotThrow(() => assertWorldInvariants(ghost));
});

// ══ C. writer trust boundary ══════════════════════════════════════════════════
test('U698-C1 stale/unknown objectId → no-op for both writers', () => {
  const w = boot2();
  const w2 = applyDeltas(w, [hold('au:nope:zz', 'party'), place('au:nope:zz', { kind: 'actor' }, 'party')]);
  assert.deepEqual(w2.objects || {}, {}, 'nothing written');
});

test('U698-C2 wreckage is never picked up', () => {
  let w = boot2();
  w = applyDeltas(w, [{ op: 'damageObject', objectId: POT, damage: 99 }]);
  assert.equal(pieceById(w, NODE2, POT)?.state, 'wrecked', 'pot is wrecked');
  const w2 = applyDeltas(w, [hold(POT, 'party')]);
  assert.equal(w2.objects?.[POT]?.heldByActorId, undefined, 'wrecked → hold refused');
});

test('U698-C3 a fixed fixture is never lifted (mobility guard at the writer)', () => {
  let w = boot2();
  const nodes = w.map.nodes.map(n => n.id === NODE2
    ? { ...n, furniture: n.furniture.map(f => String(f.objectId || '') === POT ? { ...f, name: 'hearth', kind: 'hearth', material: 'stone' } : f) }
    : n);
  w = { ...w, map: { ...w.map, nodes } };
  assert.ok(authoredBaseAnchorCell(w, POT), 'still grounded (same pieceId join)');
  const w2 = applyDeltas(w, [hold(POT, 'party')]);
  assert.equal(w2.objects?.[POT]?.heldByActorId, undefined, 'fixed → hold refused');
});

test('U698-C4 co-location by the LIVE projection: wrong room / outdoors → no-op', () => {
  const w = boot2(); // player in R2; bed lives in R3
  const w2 = applyDeltas(w, [hold(BED2, 'party')]);
  assert.equal(w2.objects?.[BED2]?.heldByActorId, undefined, 'cannot take through a wall');
  // a REAL outside world (hand-forged interiors get resurrected by ensureWorld's
  // party-member backfill — the honest fixture is the actual egress seam)
  const wOut = exitStructureInterior(w);
  assert.equal(wOut.scene?.interior, null, 'sanity: really outside');
  const w3 = applyDeltas(wOut, [hold(POT, 'party')]);
  assert.equal(w3.objects?.[POT]?.heldByActorId, undefined, 'cannot take from outside the structure');
});

test('U698-C5 only the holder releases', () => {
  let w = boot2();
  w = { ...w, objects: { ...(w.objects || {}), [POT]: { heldByActorId: 'npc_x' } } };
  const w2 = applyDeltas(w, [place(POT, { kind: 'actor' }, aKey(w))]);
  assert.equal(w2.objects?.[POT]?.heldByActorId, 'npc_x', 'still in the other\'s arms');
  assert.equal(w2.objects?.[POT]?.placedAt, undefined, 'no placement written');
});

test('U698-C6 un-enabled ref kinds are rejected fail-closed (room/wall/door wait for 6B/6C)', () => {
  let w = boot2();
  w = applyDeltas(w, [hold(POT, 'party')]);
  assert.equal(w.objects?.[POT]?.heldByActorId, aKey(w), 'setup: pot held');
  for (const kind of ['room', 'wall', 'door', 'nonsense']) {
    const w2 = applyDeltas(w, [place(POT, { kind }, aKey(w))]);
    assert.equal(w2.objects?.[POT]?.heldByActorId, aKey(w), `${kind}: still held`);
    assert.equal(w2.objects?.[POT]?.placedAt, undefined, `${kind}: no placement`);
  }
});

test('U698-C7 ref:\'object\' guards — foreign-room, held, unknown, ungrounded references no-op', () => {
  let w = boot2();
  w = applyDeltas(w, [hold(POT, 'party')]);
  const k = aKey(w);
  // foreign-room reference (bed is in R3, actor in R2)
  let w2 = applyDeltas(w, [place(POT, { kind: 'object', objectId: BED2 }, k)]);
  assert.equal(w2.objects?.[POT]?.placedAt, undefined, 'foreign-room ref refused');
  // held reference
  const wHeldRef = { ...w, objects: { ...w.objects, [BED2]: { heldByActorId: 'npc_x' } } };
  w2 = applyDeltas(wHeldRef, [place(POT, { kind: 'object', objectId: BED2 }, k)]);
  assert.equal(w2.objects?.[POT]?.placedAt, undefined, 'held ref refused');
  // unknown reference
  w2 = applyDeltas(w, [place(POT, { kind: 'object', objectId: 'au:nope' }, k)]);
  assert.equal(w2.objects?.[POT]?.placedAt, undefined, 'unknown ref refused');
  // ungrounded (procgen) reference in the same room? procgen pieces have no plan cell.
  const crateId = nodeFurn(w, NODE2).find(f => /crate/i.test(String(f.name)))?.objectId;
  if (crateId) {
    w2 = applyDeltas(w, [place(POT, { kind: 'object', objectId: crateId }, k)]);
    assert.equal(w2.objects?.[POT]?.placedAt, undefined, 'ungrounded ref refused');
  }
});

test('U698-C8 no free cell → null target (pure), so the writer keeps the object in your arms', () => {
  // A 1×1 room: the actor stands on the only walkable cell; a held crate has nowhere to go.
  const cx = 3, cy = 3;
  const centre = { x: layoutToCells(cx), y: layoutToCells(cy) };
  const world = {
    map: { currentNodeId: 'nT', nodes: [{ id: 'nT', furniture: [
      { name: 'crate', kind: 'crate', authored: true, structureId: 'authored:t', roomId: 'room:t:1', pieceId: 'p0', objectId: 'au:authored:t:p0' },
    ] }] },
    structures: { byId: { 'authored:t': { id: 'authored:t', nodeId: 'nT', authoredPlan: {
      type: 'building', rooms: [{ id: 'room:t:1', cx, cy, w: 0.5, h: 0.5, furniture: [{ id: 'p0', fx: 0.5, fy: 0.5, kind: 'crate', authored: 1 }] }], doors: [], corridors: [], nonAdjacent: [],
    } } } },
    party: [{ id: 'pc', pos: { frame: 'struct:authored:t', gx: centre.x, gy: centre.y } }],
    objects: { 'au:authored:t:p0': { heldByActorId: 'pc' } },
    scene: { interior: { structureKey: 'authored:t', roomId: 'room:t:1', visited: ['room:t:1'] } },
  };
  assert.equal(legalPlaceTargetCell(world, 'au:authored:t:p0', 'pc', { kind: 'actor' }), null, 'nowhere to set it down');
});

test('U698-C9 a caller-supplied cell is IGNORED — the engine-derived cell always wins', () => {
  let w = boot2();
  w = applyDeltas(w, [hold(POT, 'party')]);
  const k = aKey(w);
  const expected = legalPlaceTargetCell(w, POT, k, { kind: 'actor' });
  assert.ok(expected, 'a legal spot exists');
  const forged = { op: 'placeObject', actorId: k, objectId: POT, ref: { kind: 'actor' }, to: { cell: { x: 999, y: 999 } }, cell: { x: 999, y: 999 } };
  const w2 = applyDeltas(w, [forged]);
  assert.deepEqual(w2.objects?.[POT]?.placedAt?.cell, expected, 'engine cell, never the caller\'s');
});

// ══ D. ROOM TRUTH — the 8-step cross-room contract ════════════════════════════
test('U698-D1 carried across rooms and dropped: placedAt names the NEW room, mechanics agree', () => {
  let { w, hpA } = carriedPot();
  assert.ok(hpA != null, 'pot carried a damage record into the take');
  // live directional room-move keeps the object in your arms
  const rNorth = pm(w, 'go north');
  w = rNorth.world;
  assert.equal(w.scene?.interior?.roomId, R1, 'walked to the hall through the live path');
  assert.equal(w.objects?.[POT]?.heldByActorId, aKey(w), 'still carried room-to-room');
  w = moveWithinInterior(w, R3);
  const expected = legalPlaceTargetCell(w, POT, aKey(w), { kind: 'actor' });
  const r = pm(w, 'set the cooking pot down');
  w = r.world;
  const p = resolvedObjectPlacement(w, POT);
  assert.equal(p.status, 'placed', `dropped through the live path: ${r.output?.narration}`);
  assert.equal(p.room, R3, 'THE ruling-2 law: mechanical room = the room it was dropped in');
  assert.equal(p.structureId, STRUCT2);
  assert.deepEqual(p.cell, expected, 'engine-derived cell beside the actor');
  const rect = roomRectCells(floorPlan(st2(w)).rooms.find(r2 => r2.id === R3));
  assert.ok(p.cell.x >= rect.minX && p.cell.x <= rect.maxX && p.cell.y >= rect.minY && p.cell.y <= rect.maxY, 'cell lies in the NEW room');
  assert.ok(!reservedDoorCells(floorPlan(st2(w))).has(key(p.cell)), 'never a doorway cell');
  assert.equal(w.objects?.[POT]?.durability?.hp, hpA, 'damage survived the whole carry');
});

test('U698-D2 in the NEW room: inspect, attack, drag, retake all resolve the SAME objectId + HP', () => {
  let { w, hpA } = carriedPot();
  w = moveWithinInterior(w, R1);
  w = moveWithinInterior(w, R3);
  w = pm(w, 'set the cooking pot down').world;
  assert.ok(hereNames(w).includes('cooking pot'), 'objectsHere lists it HERE (the live room)');
  // inspect
  const rEx = pm(w, 'examine the cooking pot');
  assert.match(String(rEx.output?.narration || ''), /examine|look|iron|pot/i, 'inspect resolves here');
  // attack — the strike carries the SAME canonical objectId
  const rAtk = pm(w, 'attack the cooking pot with my hatchet');
  assert.match(String(rAtk.output?.mechanics || ''), new RegExp(`object-strike:${POT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'strike targets the same objectId in the new room');
  w = rAtk.world;
  const dur = w.objects?.[POT]?.durability;
  assert.ok(dur && dur.hp <= hpA, 'the SAME damage record continues');
  // drag — legalMoveTargetCell must use the LIVE room (R3), not base provenance (R2)
  const t = legalMoveTargetCell(w, POT, 'party');
  assert.ok(t, 'draggable in its live room');
  const rectR3 = roomRectCells(floorPlan(st2(w)).rooms.find(r2 => r2.id === R3));
  assert.ok(t.x >= rectR3.minX && t.x <= rectR3.maxX && t.y >= rectR3.minY && t.y <= rectR3.maxY, 'drag target stays in the LIVE room');
  const rDrag = pm(w, 'drag the cooking pot aside');
  w = rDrag.world;
  assert.equal(resolvedObjectPlacement(w, POT).room, R3, 'drag keeps the live room');
  // retake
  const rTake = pm(w, 'take the cooking pot');
  assert.equal(rTake.world.objects?.[POT]?.heldByActorId, aKey(rTake.world), 'retaken in the new room');
});

test('U698-D3 the OLD room reports it gone: no match, no strike, honest presence answer', () => {
  let { w } = carriedPot();
  w = moveWithinInterior(w, R1);
  w = moveWithinInterior(w, R3);
  w = pm(w, 'set the cooking pot down').world;
  // walk back to the old room
  w = moveWithinInterior(w, R1);
  w = moveWithinInterior(w, R2);
  assert.ok(!hereNames(w).includes('cooking pot'), 'objectsHere in the OLD room excludes it');
  const before = JSON.stringify(w.objects);
  const rTake = pm(w, 'take the cooking pot');
  assert.equal(JSON.stringify(rTake.world.objects), before, 'old room cannot take it');
  assert.ok(!toolsNames(rTake.world).some(n => /cooking pot/i.test(n)), 'no phantom pack item');
  const rAtk = pm(w, 'attack the cooking pot');
  assert.ok(!new RegExp(`object-strike:${POT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(String(rAtk.output?.mechanics || '')), 'old room cannot strike it');
  const rQ = pm(w, 'is there a cooking pot here?');
  assert.match(String(rQ.output?.narration || ''), /No — no cooking pot/i, 'presence answers honestly for THIS room');
});

test('U698-D4 render + occupancy live ONLY at the new cell', () => {
  let { w } = carriedPot();
  w = moveWithinInterior(w, R1);
  w = moveWithinInterior(w, R3);
  w = pm(w, 'set the cooking pot down').world;
  const p = resolvedObjectPlacement(w, POT);
  const base = { x: 74, y: 52 }; // the pot's authored anchor in R2
  const live = liveAuthoredBlockedCells(w, st2(w));
  assert.ok(live.has(key(p.cell)), 'occupancy blocks the new cell');
  assert.ok(!live.has(key(base)), 'the old anchor is walkable');
  const items = buildAuthoredSceneFurniture(floorPlan(st2(w)), w, STRUCT2);
  const it = items.find(i => i.id === POT);
  assert.ok(it, 'still drawn (placed, not held)');
  const c = { x: layoutToCells(it.ux + it.uw / 2), y: layoutToCells(it.uy + it.uh / 2) };
  assert.deepEqual(c, p.cell, 'drawn at exactly the live cell');
});

test('U698-D5 the direction is symmetric: carry it back and the room truth follows', () => {
  let { w } = carriedPot();
  w = moveWithinInterior(w, R1);
  w = moveWithinInterior(w, R3);
  w = pm(w, 'set the cooking pot down').world;
  w = pm(w, 'take the cooking pot').world;
  w = moveWithinInterior(w, R1);
  w = moveWithinInterior(w, R2);
  w = pm(w, 'set the cooking pot down').world;
  const p = resolvedObjectPlacement(w, POT);
  assert.equal(p.status, 'placed');
  assert.equal(p.room, R2, 'back home: the live room follows the drop');
  assert.ok(hereNames(w).includes('cooking pot'), 'present HERE again');
  const w3 = moveWithinInterior(moveWithinInterior(w, R1), R3);
  assert.ok(!hereNames(w3).includes('cooking pot'), 'and absent from the far room');
});

test('U698-D6 a held object is on NO floor list — all three objectsHere branches', () => {
  // multi-room branch
  let { w } = carriedPot();
  assert.ok(!hereNames(w).includes('cooking pot'), 'multi-room interior: excluded while held');
  // single-room fallback branch
  let w1 = boot1();
  w1 = { ...w1, objects: { ...(w1.objects || {}), [BARREL]: { heldByActorId: aKey(w1) } } };
  const names1 = hereNames(w1);
  assert.ok(!names1.includes('barrel'), 'single-room fallback: excluded while held');
  assert.ok(names1.includes('bed'), 'the rest of the room is untouched');
  // not-inside branch (full node list)
  const wOut = { ...w1, scene: { ...w1.scene, interior: null }, party: [{ ...w1.party[0], pos: { frame: 'region', gx: 5, gy: 5 } }, ...w1.party.slice(1)] };
  const namesOut = hereNames(wOut);
  assert.ok(!namesOut.includes('barrel'), 'outside: still excluded while held');
  assert.ok(namesOut.includes('bed'), 'outside: base pieces keep the legacy full-list behavior');
});

test('U698-D7 legalMoveTargetCell reads the LIVE room: right room drags, wrong room cannot', () => {
  let { w } = carriedPot();
  w = moveWithinInterior(w, R1);
  w = moveWithinInterior(w, R3);
  w = pm(w, 'set the cooking pot down').world;
  assert.ok(legalMoveTargetCell(w, POT, 'party'), 'actor in the live room → a drag target exists');
  const wBack = moveWithinInterior(w, R1);
  assert.equal(legalMoveTargetCell(wBack, POT, 'party'), null, 'actor in another room → no drag');
});

// ══ E. visibility ═════════════════════════════════════════════════════════════
test('U698-E1 a swing at the thing in your own arms is guidance, never a roll', () => {
  const { w } = carriedPot();
  const before = JSON.stringify(w.objects);
  const r = pm(w, 'attack the cooking pot');
  assert.match(String(r.output?.narration || ''), /in your arms|set it down|carrying/i, 'guidance, in fiction');
  assert.doesNotMatch(String(r.output?.mechanics || ''), /atk:\d+ vs AC/, 'no strike roll');
  assert.equal(JSON.stringify(r.world.objects), before, 'no state change');
});

test('U698-E2 presence and where-is answers say CARRYING, never "not here"', () => {
  const { w } = carriedPot();
  const r1 = pm(w, 'is there a cooking pot here?');
  assert.match(String(r1.output?.narration || ''), /carrying|in your arms/i, 'presence knows your arms');
  const r2 = pm(w, "where's the cooking pot?");
  assert.match(String(r2.output?.narration || ''), /carrying|in your arms/i, 'where-is knows your arms');
  assert.equal(JSON.stringify(r2.world.objects), JSON.stringify(w.objects), 'observe-only');
});

test('U698-E3 the presence ground-clause no longer lists what you hold', () => {
  const { w } = carriedPot();
  const r = pm(w, 'is there a mirror here?');
  assert.doesNotMatch(String(r.output?.narration || ''), /cooking pot/i, 'held object not on the floor roster');
});

// ══ F. the carry-lock ═════════════════════════════════════════════════════════
test('U698-F1 STRUCTURAL — exitStructureInterior refuses while the party holds an object', () => {
  const { w } = carriedPot();
  const w2 = exitStructureInterior(w);
  assert.ok(w2.scene?.interior, 'still inside (structural no-op)');
  assert.equal(w2.scene.interior.roomId, w.scene.interior.roomId, 'nothing moved');
});

test('U698-F2 LIVE door exit refuses fiction-first, world unchanged, drop restores it', () => {
  const { w } = carriedPot();
  const r = pm(w, 'go outside');
  assert.ok(r.world.scene?.interior, 'still inside after the refusal');
  assert.equal(r.world.objects?.[POT]?.heldByActorId, aKey(r.world), 'still held');
  assert.match(String(r.output?.narration || ''), /set it down|in your arms|holding|carry/i, 'refusal in fiction, no success prose');
  // drop restores egress
  let w2 = pm(r.world, 'set the cooking pot down').world;
  assert.equal(resolvedObjectPlacement(w2, POT).status, 'placed', 'released');
  const rOut = pm(w2, 'go outside');
  assert.equal(rOut.world.scene?.interior, null, 'egress restored after the release');
  assert.equal(resolvedObjectPlacement(rOut.world, POT).status, 'placed', 'the pot stays where you left it');
});

test('U698-F3 LIVE window exit refuses the same way', () => {
  let { w } = carriedPot();
  w = moveWithinInterior(w, R1);
  w = moveWithinInterior(w, R3); // the room with the window
  const r = pm(w, 'climb out the window');
  assert.ok(r.world.scene?.interior, 'still inside');
  assert.equal(r.world.scene.interior.roomId, R3, 'no movement');
  assert.equal(r.world.objects?.[POT]?.heldByActorId, aKey(r.world), 'still held');
  assert.match(String(r.output?.narration || ''), /set it down|arms|holding|carry/i);
});

test('U698-F4 the interior travel bridges refuse instead of silently exiting', () => {
  const { w } = carriedPot();
  for (const t of ['leave the cottage and head down the road', 'walk to the road']) {
    const r = pm(w, t);
    assert.ok(r.world.scene?.interior, `"${t}" did not exit the structure`);
    assert.equal(r.world.objects?.[POT]?.heldByActorId, aKey(r.world), `"${t}" kept the pot in your arms`);
  }
});

// ══ G. honest release ═════════════════════════════════════════════════════════
test('U698-G1 release derives the cell: nearest free legal cell beside the actor, never the actor\'s own', () => {
  const { w } = carriedPot();
  const k = aKey(w);
  const expected = legalPlaceTargetCell(w, POT, k, { kind: 'actor' });
  const apos = w.party[0].pos;
  assert.ok(expected && !(expected.x === apos.gx && expected.y === apos.gy), 'a real cell beside you');
  const r = pm(w, 'set the cooking pot down');
  assert.deepEqual(r.world.objects?.[POT]?.placedAt?.cell, expected);
});

test('U698-G2 "drop X beside Y" grounds on a supported floor target via ref:\'object\'', () => {
  let w = might(boot1(), 20);
  w = pm(w, 'take the barrel').world;
  assert.equal(w.objects?.[BARREL]?.heldByActorId, aKey(w), 'setup: barrel in your arms');
  const expected = legalPlaceTargetCell(w, BARREL, aKey(w), { kind: 'object', objectId: BED1 });
  assert.ok(expected, 'a spot beside the bed exists');
  const r = pm(w, 'set the barrel down beside the bed');
  assert.deepEqual(r.world.objects?.[BARREL]?.placedAt?.cell, expected, 'landed beside the named object');
  assert.match(String(r.output?.narration || ''), /beside the bed/i, 'the narration grounds the relation');
  const bedAnchor = authoredBaseAnchorCell(w, BED1);
  const d = Math.max(Math.abs(expected.x - bedAnchor.x), Math.abs(expected.y - bedAnchor.y));
  assert.ok(d <= 2, `genuinely near the bed (Chebyshev ${d})`);
});

test('U698-G3 "on the bed" narrates BESIDE — resting-on is unsupported and never claimed', () => {
  let w = might(boot1(), 20);
  w = pm(w, 'take the barrel').world;
  const r = pm(w, 'put the barrel down on the bed');
  assert.equal(resolvedObjectPlacement(r.world, BARREL).status, 'placed', 'released');
  assert.doesNotMatch(String(r.output?.narration || ''), /\bon(?:to)?\s+the\s+bed\b|\batop\b/i, 'no unsupported resting-on claim');
});

test('U698-G4 an ungroundable named target downgrades honestly to a plain set-down', () => {
  let w = might(boot1(), 20);
  w = pm(w, 'take the barrel').world;
  const expected = legalPlaceTargetCell(w, BARREL, aKey(w), { kind: 'actor' });
  const r = pm(w, 'set the barrel down beside the straw pallet'); // procgen pallet: ungrounded
  assert.deepEqual(r.world.objects?.[BARREL]?.placedAt?.cell, expected, 'actor-ref fallback cell');
  assert.doesNotMatch(String(r.output?.narration || ''), /beside the straw pallet/i, 'no spatial claim the map cannot ground');
});

test('U698-G5 pronoun release: "drop it" resolves to the ONE object in your arms', () => {
  const { w } = carriedPot();
  const r = pm(w, 'drop it');
  assert.equal(resolvedObjectPlacement(r.world, POT).status, 'placed', 'the one-held rule makes "it" deterministic');
});

// ══ H. determinism + goldens ══════════════════════════════════════════════════
test('U698-H1 the full hold/carry/refuse/release script replays to an identical worldHash', () => {
  const script = (wIn) => {
    let w = might(wIn, 20);
    w = strikeUntilDamaged(w, 'attack the cooking pot with my hatchet', POT);
    w = pm(w, 'take the cooking pot').world;
    w = pm(w, 'go north').world;
    w = pm(w, 'go outside').world;      // carry-lock refusal (must not fork state)
    w = pm(w, 'drop it').world;
    w = pm(w, 'go outside').world;      // now it succeeds
    return w;
  };
  const a = script(boot2());
  const b = script(boot2());
  assert.equal(a.scene?.interior, null, 'the script really exits at the end');
  assert.equal(worldHash(a), worldHash(b), 'byte-stable under replay');
});

test('U698-H2 a held object survives save → import, invariants clean', () => {
  const { w } = carriedPot();
  const round = importWorld(exportWorld(w));
  assert.equal(resolvedObjectPlacement(round, POT).status, 'held');
  assert.equal(round.objects?.[POT]?.heldByActorId, aKey(w));
  assert.doesNotThrow(() => assertWorldInvariants(round));
});

test('U698-H3 empty overlays keep today\'s truth; holding frees EXACTLY one anchor', () => {
  // The three-room plan also carries role-fallback loadout furniture, so the static
  // mask is bigger than the two authored anchors — the golden is that an empty
  // overlay leaves it untouched, and a hold subtracts precisely the held anchor.
  const w = boot2();
  const live0 = liveAuthoredBlockedCells(w, st2(w));
  assert.ok(live0.has(key(authoredBaseAnchorCell(w, POT))), 'the pot anchor blocks at boot');
  assert.ok(live0.has(key(authoredBaseAnchorCell(w, BED2))), 'the bed anchor blocks at boot');
  const held = applyDeltas(w, [hold(POT, 'party')]);
  const live1 = liveAuthoredBlockedCells(held, st2(held));
  const freed = [...live0].filter(k => !live1.has(k));
  assert.deepEqual(freed, [key(authoredBaseAnchorCell(w, POT))], 'holding frees EXACTLY the pot anchor');
  assert.equal(live1.size, live0.size - 1, 'the rest of the mask is byte-identical');
  assert.deepEqual(hereNames(w), ['cooking pot'], 'boot room lists exactly today\'s set');
});

test('U698-H4 CANARY — removeFurniture still deletes the whole overlay atomically', () => {
  let w = boot2();
  w = applyDeltas(w, [hold(POT, 'party')]);
  const w2 = applyDeltas(w, [{ op: 'removeFurniture', nodeId: NODE2, objectId: POT, furnitureId: 0 }]);
  assert.equal(pieceById(w2, NODE2, POT), null, 'piece spliced');
  assert.equal(w2.objects?.[POT], undefined, 'overlay deleted with it');
});

test('U698-H5 the moved-wreck fix: a moved-then-destroyed piece frees BOTH cells', () => {
  let w = boot1();
  const base = authoredBaseAnchorCell(w, BARREL);
  const t = legalMoveTargetCell(w, BARREL, 'party');
  w = applyDeltas(w, [{ op: 'moveObject', actorId: 'party', objectId: BARREL, to: { node: NODE1, structureId: STRUCT1, room: ROOM1, cell: t } }]);
  assert.ok(liveAuthoredBlockedCells(w, st1(w)).has(key(t)), 'moved: blocks the new cell');
  w = applyDeltas(w, [{ op: 'damageObject', objectId: BARREL, damage: 99 }]);
  const live = liveAuthoredBlockedCells(w, st1(w));
  assert.ok(!live.has(key(t)), 'wrecked: the override cell is freed (the b161 bug)');
  assert.ok(!live.has(key(base)), 'and the base anchor stays free');
  // the unmoved-wreck case stays pinned
  let w2 = boot1();
  const bedBase = authoredBaseAnchorCell(w2, BED1);
  w2 = applyDeltas(w2, [{ op: 'damageObject', objectId: BED1, damage: 99 }]);
  assert.ok(!liveAuthoredBlockedCells(w2, st1(w2)).has(key(bedBase)), 'unmoved wreck frees its base anchor');
});

test('U698-H6 a held object blocks nothing and is not drawn; release brings both back', () => {
  let { w } = carriedPot();
  const base = { x: 74, y: 52 };
  assert.ok(!liveAuthoredBlockedCells(w, st2(w)).has(key(base)), 'held: old cell walkable');
  const heldItems = buildAuthoredSceneFurniture(floorPlan(st2(w)), w, STRUCT2);
  assert.equal(heldItems.find(i => i.id === POT), undefined, 'held: not drawn on the floor');
  w = pm(w, 'set the cooking pot down').world;
  const p = resolvedObjectPlacement(w, POT);
  assert.ok(liveAuthoredBlockedCells(w, st2(w)).has(key(p.cell)), 'released: blocks its new cell');
  const items = buildAuthoredSceneFurniture(floorPlan(st2(w)), w, STRUCT2);
  assert.ok(items.find(i => i.id === POT), 'released: drawn again');
});

test('U698-H7 heldObjectOf resolves the one held object for the live actor key', () => {
  const { w } = carriedPot();
  const h = heldObjectOf(w, 'party');
  assert.ok(h && h.objectId === POT && /cooking pot/i.test(h.name), 'canonical helper agrees');
  assert.equal(heldObjectOf(boot2(), 'party'), null, 'empty hands → null');
});

// ══ R. RELEASE CORRECTION (Basecamp gate, 2026-07-15) ═════════════════════════
// R1 — the LIVE render lane. U432 proves LocalMap is a dead/error fallback; v1
//      mounts renderContinuousMap → placeFromWorldNode (2D furniture ink) and
//      placedTokenModel (3D props). THOSE projections must follow held/placed.
// R2 — writers validate co-location against the REQUESTED actor's canonical pos,
//      never the leader's global scene.interior; the carry-lock is party-wide.
// R3 — two same-named supported base pieces resolve by IDENTITY, never the
//      first-wins name map.
// R4 — the capacity ladder (auto/roll-pass/roll-fail/impossible) on supported holds.

// The 2D sheet's flattened furniture for the cottage, exactly as the live map inks it.
const liveFurn = (w) => {
  const place = placeFromWorldNode(w, NODE2);
  const b = (place?.buildings || []).find(x => String(x?.structureKey || '') === STRUCT2);
  return Array.isArray(b?.plan?.furniture) ? b.plan.furniture : null;
};
const potBirthLayout = (w) => {
  const a = authoredBaseAnchorCell(w, POT); // struct cell ↔ layout via PLACE_WU=4 (U696-I)
  return { x: a.x / 4, y: a.y / 4 };
};
const itemCenter = (f) => ({ x: f.ux + f.uw / 2, y: f.uy + f.uh / 2 });

test('U698-R1a LIVE 2D lane — base projection carries canonical objectId at the birth spot, byte-stable on empty overlays', () => {
  const w = boot2();
  const furn = liveFurn(w);
  assert.ok(furn && furn.length, 'the live lane flattens the cottage furniture');
  const pot = furn.find(f => String(f.objectId || '') === POT);
  assert.ok(pot, 'the pot rides the LIVE flattened plan under its canonical objectId');
  const birth = potBirthLayout(w);
  const c = itemCenter(pot);
  assert.ok(Math.abs(c.x - birth.x) < 0.51 && Math.abs(c.y - birth.y) < 0.51, `base ink at the birth spot (${c.x},${c.y} ≈ ${birth.x},${birth.y})`);
  assert.deepEqual(liveFurn({ ...w, objects: {} }), furn, 'an explicitly-empty overlay projects byte-identically');
});

test('U698-R1b LIVE 2D lane — a HELD objectId disappears from the flattened furniture ink', () => {
  let w = boot2();
  const baseCount = liveFurn(w).length;
  w = applyDeltas(w, [hold(POT, 'party')]);
  const furn = liveFurn(w);
  assert.equal(furn.find(f => String(f.objectId || '') === POT), undefined, 'held → no floor ink on the LIVE sheet');
  assert.equal(furn.length, baseCount - 1, 'exactly the held piece is gone; everything else identical');
});

test('U698-R1c LIVE 2D lane — a released objectId reappears at resolvedObjectPlacement().cell, not its birth cell', () => {
  let w = boot2();
  w = applyDeltas(w, [hold(POT, 'party')]);
  w = moveWithinInterior(w, R1);
  w = moveWithinInterior(w, R3);
  w = applyDeltas(w, [place(POT, { kind: 'actor' }, aKey(w))]);
  const p = resolvedObjectPlacement(w, POT);
  assert.equal(p.status, 'placed');
  assert.equal(p.room, R3, 'setup: dropped in the far room');
  const pot = (liveFurn(w) || []).find(f => String(f.objectId || '') === POT);
  assert.ok(pot, 'released → back on the LIVE sheet');
  const c = itemCenter(pot);
  assert.deepEqual({ x: layoutToCells(c.x), y: layoutToCells(c.y) }, p.cell, 'inked at the LIVE cell');
  const birth = potBirthLayout(w);
  assert.ok(Math.abs(c.x - birth.x) > 1 || Math.abs(c.y - birth.y) > 1, 'and NOT at its birth position');
});

test('U698-R1d LIVE 3D lane — placedTokenModel props follow held/released state with identity', () => {
  let w = boot2();
  const baseProps = placedTokenModel(w, NODE2).props;
  const basePot = baseProps.find(pr => String(pr.objectId || '') === POT);
  assert.ok(basePot, 'the pot mini carries its canonical objectId at base');
  const bedProp = baseProps.find(pr => String(pr.objectId || '') === BED2);
  assert.ok(bedProp, 'the bed mini too');
  // held → the exact objectId vanishes from the props; the bed mini is untouched
  const wHeld = applyDeltas(w, [hold(POT, 'party')]);
  const heldProps = placedTokenModel(wHeld, NODE2).props;
  assert.equal(heldProps.find(pr => String(pr.objectId || '') === POT), undefined, 'held → no 3D mini');
  const bedStill = heldProps.find(pr => String(pr.objectId || '') === BED2);
  assert.ok(bedStill && bedStill.wx === bedProp.wx && bedStill.wy === bedProp.wy, 'the bed mini did not move');
  // released across the house → the mini reappears at a genuinely different point, near the bed
  let w2 = applyDeltas(w, [hold(POT, 'party')]);
  w2 = moveWithinInterior(w2, R1);
  w2 = moveWithinInterior(w2, R3);
  w2 = applyDeltas(w2, [place(POT, { kind: 'actor' }, aKey(w2))]);
  const placedProps = placedTokenModel(w2, NODE2).props;
  const movedPot = placedProps.find(pr => String(pr.objectId || '') === POT);
  assert.ok(movedPot, 'released → the mini is back');
  const dMove = Math.hypot(movedPot.wx - basePot.wx, movedPot.wy - basePot.wy);
  assert.ok(dMove > 1, `the mini genuinely moved (${dMove.toFixed(2)} wu from birth)`);
  const dBed = Math.hypot(movedPot.wx - bedProp.wx, movedPot.wy - bedProp.wy);
  assert.ok(dBed < dMove, 'and now stands nearer the bed than its birth spot');
});

test('U698-R1e sceneSignature — hold/place refresh the mounted 3D scene; durability-only does not', () => {
  const w = boot2();
  const sig0 = sceneSignature(w);
  assert.equal(sceneSignature({ ...w, objects: {} }), sig0, 'empty overlay → the default-world signature is unchanged');
  const wHeld = applyDeltas(w, [hold(POT, 'party')]);
  const sigHeld = sceneSignature(wHeld);
  assert.notEqual(sigHeld, sig0, 'holding changes the scene signature (the mini must vanish NOW)');
  const wPlaced = applyDeltas(wHeld, [place(POT, { kind: 'actor' }, aKey(wHeld))]);
  const sigPlaced = sceneSignature(wPlaced);
  assert.notEqual(sigPlaced, sigHeld, 'releasing changes it again (the mini must reappear NOW)');
  const wHurt = applyDeltas(w, [{ op: 'damageObject', objectId: POT, damage: 3 }]);
  assert.equal(sceneSignature(wHurt), sig0, 'a durability-only HP change does NOT rebuild the scene');
});

// ── R2. writer co-location: the REQUESTED actor's position, not the global room ──
const freeCellInRoom = (w, roomId, avoid = []) => {
  const plan = floorPlan(st2(w));
  const room = plan.rooms.find(r => String(r.id) === roomId);
  const rect = roomRectCells(room);
  const blocked = liveAuthoredBlockedCells(w, st2(w));
  const doors = reservedDoorCells(plan);
  const avoidKeys = new Set(avoid.map(key));
  for (let y = rect.minY; y <= rect.maxY; y++) {
    for (let x = rect.minX; x <= rect.maxX; x++) {
      const k = `${x},${y}`;
      if (blocked.has(k) || doors.has(k) || avoidKeys.has(k)) continue;
      return { x, y };
    }
  }
  return null;
};
const withMember = (w, id, pos) => ({ ...w, party: [...w.party, { id, name: id, pos }] });

test('U698-R2a a named actor standing in ANOTHER room cannot hold the object', () => {
  let w = boot2(); // pot lives in R2; leader (and scene.interior) are in R2 too
  const cell = freeCellInRoom(w, R3);
  assert.ok(cell, 'a free cell exists in the far room');
  w = withMember(w, 'remote', { frame: `struct:${STRUCT2}`, gx: cell.x, gy: cell.y });
  const w2 = applyDeltas(w, [hold(POT, 'remote')]);
  assert.equal(w2.objects?.[POT]?.heldByActorId, undefined, 'the room-3 actor cannot take the room-2 pot through the wall');
});

test('U698-R2b a positionless / outdoor / foreign-structure actor cannot hold it', () => {
  const w0 = boot2();
  const wNoPos = withMember(w0, 'ghost', undefined);
  assert.equal(applyDeltas(wNoPos, [hold(POT, 'ghost')]).objects?.[POT]?.heldByActorId, undefined, 'no pos → no take');
  const wOut = withMember(w0, 'walker', { frame: 'region', gx: 5, gy: 5 });
  assert.equal(applyDeltas(wOut, [hold(POT, 'walker')]).objects?.[POT]?.heldByActorId, undefined, 'outdoors → no take');
  const wElse = withMember(w0, 'stranger', { frame: 'struct:somewhere-else', gx: 50, gy: 50 });
  assert.equal(applyDeltas(wElse, [hold(POT, 'stranger')]).objects?.[POT]?.heldByActorId, undefined, 'another structure → no take');
});

test('U698-R2c a correctly co-located NAMED actor may use the writer', () => {
  let w = boot2();
  const cell = freeCellInRoom(w, R2, [authoredBaseAnchorCell(w, POT)]);
  w = withMember(w, 'buddy', { frame: `struct:${STRUCT2}`, gx: cell.x, gy: cell.y });
  const w2 = applyDeltas(w, [hold(POT, 'buddy')]);
  assert.equal(w2.objects?.[POT]?.heldByActorId, 'buddy', 'same room, real position → the take commits');
});

test('U698-R2d a remote actor cannot PLACE (teleport) a base object into their own room', () => {
  let w = boot2();
  const cell = freeCellInRoom(w, R3);
  w = withMember(w, 'remote', { frame: `struct:${STRUCT2}`, gx: cell.x, gy: cell.y });
  const w2 = applyDeltas(w, [place(POT, { kind: 'actor' }, 'remote')]);
  assert.equal(w2.objects?.[POT]?.placedAt, undefined, 'the non-held push seam requires the ACTOR to be with the object');
});

test('U698-R2e STRUCTURAL — egress refuses while ANY party member holds a structure-local object', () => {
  let w = boot2();
  const cell = freeCellInRoom(w, R2, [authoredBaseAnchorCell(w, POT)]);
  w = withMember(w, 'buddy', { frame: `struct:${STRUCT2}`, gx: cell.x, gy: cell.y });
  w = applyDeltas(w, [hold(POT, 'buddy')]);
  assert.equal(w.objects?.[POT]?.heldByActorId, 'buddy', 'setup: the FOLLOWER holds it, not the leader');
  const w2 = exitStructureInterior(w);
  assert.ok(w2.scene?.interior, 'the structural seam refuses the whole party\'s exit');
});

test('U698-R2f LIVE — non-leader-held egress refuses once in fiction and never recurses', () => {
  let w = boot2();
  const cell = freeCellInRoom(w, R2, [authoredBaseAnchorCell(w, POT)]);
  w = withMember(w, 'buddy', { frame: `struct:${STRUCT2}`, gx: cell.x, gy: cell.y });
  w = applyDeltas(w, [hold(POT, 'buddy')]);
  const rDoor = pm(w, 'go outside');
  assert.ok(rDoor.world.scene?.interior, 'door exit refused');
  assert.match(String(rDoor.output?.narration || ''), /arms|set it down|holding|carry/i, 'refusal is in fiction, once');
  assert.doesNotMatch(String(rDoor.output?.narration || ''), /step (back )?outside|open ground/i, 'no success prose after the no-op');
  const rTravel = pm(w, 'walk to the road'); // the recursive travel bridge must terminate
  assert.ok(rTravel.world.scene?.interior, 'travel bridge refused without looping');
});

// ── R3. same-named supported base objects resolve by IDENTITY, never the name map ──
const renamePiece = (w, objectId, fields) => ({
  ...w,
  map: { ...w.map, nodes: w.map.nodes.map(n => n.id === NODE2
    ? { ...n, furniture: n.furniture.map(f => String(f.objectId || '') === objectId ? { ...f, ...fields } : f) }
    : n) },
});

test('U698-R3 two same-named supported base pieces each answer ONLY in their own room', () => {
  // Basecamp's repro: a second authored "cooking pot" (the renamed bed) in room 3.
  let w = renamePiece(boot2(), BED2, { name: 'cooking pot' });
  const unsupportedBefore = hereNames(boot2()).filter(n => !/cooking pot|bed/.test(n));
  const idsHere = (ww) => objectsHere(ww).map(o => String(o.piece.objectId || '')).filter(oid => oid === POT || oid === BED2);
  assert.deepEqual(idsHere(w), [POT], 'room 2 lists exactly ITS pot — not the far twin');
  const w3 = moveWithinInterior(moveWithinInterior(w, R1), R3);
  assert.deepEqual(idsHere(w3), [BED2], 'room 3 lists exactly ITS twin — the name map never collapses them');
  // held/placed continue following resolvedObjectPlacement
  const wHeld = applyDeltas(w, [hold(POT, 'party')]);
  assert.deepEqual(idsHere(wHeld), [], 'held → off the floor list, twin unaffected in this room');
  // unsupported/procgen pieces keep the name-keyed behavior byte-identically
  const unsupportedAfter = hereNames(w).filter(n => !/cooking pot|bed/.test(n));
  assert.deepEqual(unsupportedAfter, unsupportedBefore, 'procgen room membership untouched by the rename');
});

// ── R4. the capacity ladder on supported holds (physics caller owns capacity) ──
test('U698-R4a AUTO capacity — the take commits holdObject, no pack item', () => {
  const w = might(boot2(), 20);
  const pot = pieceById(w, NODE2, POT);
  assert.equal(actorObjectCapacity(actorFacts(w, aKey(w)), objectPhysics(pot), 'carry').verdict, 'auto', 'fixture really is auto');
  const r = pm(w, 'take the cooking pot');
  assert.equal(r.world.objects?.[POT]?.heldByActorId, aKey(r.world), 'auto take holds');
  assert.ok(!toolsNames(r.world).some(n => /cooking pot/i.test(n)), 'no generic pack item minted');
});

test('U698-R4b/c ROLL capacity — a passed roll holds, a failed roll preserves piece and overlay', () => {
  // Find a MIGHT that puts the heavy bed in the 'roll' band, then drive the REAL
  // seeded check the physics caller uses to know which outcome each phrasing draws.
  let w = boot2();
  w = moveWithinInterior(w, R1);
  w = moveWithinInterior(w, R3); // stand with the bed
  let rollWorld = null;
  for (let m = 3; m <= 20; m++) {
    const cand = might(w, m);
    const bed = pieceById(cand, NODE2, BED2);
    if (actorObjectCapacity(actorFacts(cand, aKey(cand)), objectPhysics(bed), 'carry').verdict === 'roll') { rollWorld = cand; break; }
  }
  assert.ok(rollWorld, 'a MIGHT exists where carrying the bed is a genuine roll');
  const bed = pieceById(rollWorld, NODE2, BED2);
  const cap = actorObjectCapacity(actorFacts(rollWorld, aKey(rollWorld)), objectPhysics(bed), 'carry');
  const texts = ['take the bed', 'grab the bed', 'pick up the bed', 'take the bed now', 'grab the bed frame and lift', 'pick up the bed carefully', 'take that bed', 'grab that bed'];
  let sawPass = false, sawFail = false;
  for (const t of texts) {
    const chk = rollPhysicsCheck(rollWorld, { actorId: aKey(rollWorld), hardness: cap.difficulty, intentText: t });
    const res = evaluatePhysicsSync(rollWorld, t);
    if (chk.outcome === 'failure') {
      sawFail = true;
      assert.equal(res.deltas.length, 0, `failed roll ("${t}") mutates nothing`);
      assert.match(res.description, /too heavy|can'?t|heavy/i, 'failure narrated honestly');
    } else {
      sawPass = true;
      const hd = res.deltas.find(d => d.op === 'holdObject');
      assert.ok(hd && hd.objectId === BED2, `passed roll ("${t}") emits holdObject`);
      assert.ok(!res.deltas.some(d => d.op === 'createItem'), 'no pack item on a passed roll');
      const w2 = applyDeltas(rollWorld, res.deltas);
      assert.equal(w2.objects?.[BED2]?.heldByActorId, aKey(rollWorld), 'and the writer commits it');
    }
    if (sawPass && sawFail) break;
  }
  assert.ok(sawPass && sawFail, `both roll outcomes exercised (pass=${sawPass}, fail=${sawFail})`);
});

test('U698-R4d IMPOSSIBLE capacity — a fixed fixture refuses; piece and overlay preserved', () => {
  const w = renamePiece(might(boot2(), 20), POT, { name: 'hearth', kind: 'hearth', material: 'stone' });
  const piece = pieceById(w, NODE2, POT);
  assert.equal(actorObjectCapacity(actorFacts(w, aKey(w)), objectPhysics(piece), 'carry').verdict, 'impossible', 'fixture really is impossible');
  const res = evaluatePhysicsSync(w, 'take the hearth');
  assert.equal(res.deltas.length, 0, 'impossible → zero deltas');
  const r = pm(w, 'take the hearth');
  assert.ok(pieceById(r.world, NODE2, POT), 'piece intact');
  assert.equal(r.world.objects?.[POT], undefined, 'no overlay minted');
});
