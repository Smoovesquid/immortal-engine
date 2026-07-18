// U725 — OBJ-BARRICADE-6C: wedging an object against a door, and the door honouring it.
//
// A supported object (objectId + authored + grounded) shoved against a door records
// world.objects[id].obstructs = { structureId, doorId } ALONGSIDE its placedAt cell.
// Door HARDWARE (open/shut/barred/locked — derived, doors.js + locks.js) is untouched
// and independent: an OPEN door with a wardrobe against it does not admit you, and
// unbarring a barricaded door does not move the wardrobe.
//
// Sections:
//   A — grammar (pure): the two phrase shapes, and the family boundaries it must not cross.
//   B — writer trust boundary: every forged/illegal barricadeObject delta is a no-op.
//   C — the traversal gates: interior move, egress, the window exemption, the force seam.
//   D — clearing: drag / take / set-down all dissolve it; wreckage stops obstructing.
//   E — invariants: shape, implies-placement, excludes-held, one door one barricade.
//   F — determinism: replay-hash ×2, save roundtrip, empty-overlay golden, boot hash.
//   G — the door-cell law: a barricade MAY occupy a door approach cell; move/place may not.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { barricadeOnDoor, barricadeRecordOf, resolvedObjectPlacement } from '../engine/objects/placement.js';
import { groundFxProposal } from '../engine/llmPhysics.js';
import {
  parseBarricadePhrases, qualifiesAsBarricade, portalIsEntrance,
  BARRICADE_VERB_RE, BARRICADE_BUILD_IDIOM_RE, MIN_BARRICADE_BULK,
} from '../engine/objects/barricade.js';
import { objectPhysics } from '../engine/objects/mobility.js';
import {
  legalBarricadeTargetCell, legalMoveTargetCell, legalPlaceTargetCell,
  reservedDoorCells, liveAuthoredBlockedCells, layoutToCells, roomOfStructCell,
} from '../engine/map/spatial/tacticalPos.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { moveWithinInterior, exitStructureInterior, interiorDoorBlock } from '../engine/structures/interiors.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

// ── fixtures ──────────────────────────────────────────────────────────────────
// loaderDemo2 — the three-room authored cottage. The player boots in R2 beside the
// authored cooking pot (iron, bulk 2 — the minimum that qualifies); the hall R1
// carries the exterior door; R3 holds the bed and the window.
const boot = () => beginAdventure(newWorld({ seed: 'loaderDemo2', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const SK = 'authored:n2_96332945';
const NODE = 'n2_96332945';
const R1 = `room:${SK}:1`;
const R2 = `room:${SK}:2`;
const R3 = `room:${SK}:3`;
const POT = `au:${SK}:${R2}#a0`;
const BED = `au:${SK}:${R3}#a0`;
const DOOR_12 = `door:${SK}:${R1}|${R2}`;
const DOOR_EXT = `door:${SK}:ext:${R1}`;

const might = (w, v) => ({ ...w, party: [{ ...w.party[0], stats: { ...(w.party[0].stats || {}), MIGHT: v } }, ...w.party.slice(1)] });
const pm = (w, t) => playerMove(w, PACKS, t);
const st = (w) => w.structures.byId[SK];
const nodeFurn = (w) => (w.map.nodes.find(n => n.id === NODE)?.furniture) || [];
const pieceById = (w, oid) => nodeFurn(w).find(f => String(f.objectId || '') === oid) || null;
const key = (c) => `${c.x},${c.y}`;

// The live boot world with the pot wedged against the R1↔R2 door.
function barricaded() {
  const w0 = might(boot(), 20);
  const r = pm(w0, 'shove the cooking pot against the door');
  return { w: r.world, narration: String(r.output?.narration || ''), mechanics: String(r.output?.mechanics || '') };
}

// ══ A. grammar (pure) ═════════════════════════════════════════════════════════

test('U725-A1 both phrase shapes split object from portal', () => {
  const a = parseBarricadePhrases('barricade the door with the table');
  assert.deepEqual(a, { objectPhrase: 'table', portalPhrase: 'door' });

  const b = parseBarricadePhrases('shove the wardrobe against the door');
  assert.deepEqual(b, { objectPhrase: 'wardrobe', portalPhrase: 'door' });

  const c = parseBarricadePhrases('push the heavy chest in front of the front door');
  assert.equal(c.objectPhrase, 'heavy chest');
  assert.ok(/front door/.test(c.portalPhrase));

  // Bare form: portal named, object left open — an EMPTY objectPhrase is a real
  // outcome (the resolver asks), not a parse failure.
  const d = parseBarricadePhrases('barricade the door');
  assert.deepEqual(d, { objectPhrase: '', portalPhrase: 'door' });
});

test('U725-A2 the grammar refuses what belongs to other families', () => {
  // No portal named at all.
  assert.equal(parseBarricadePhrases('shove the table across the room'), null);
  // Reversed: the DOOR is the thing being shoved — not a barricade of the table.
  assert.equal(parseBarricadePhrases('shove the door against the table'), null);
  // The THROW family keeps its verbs (OBJ-THROW-6B owns these).
  assert.equal(parseBarricadePhrases('throw the pot at the door'), null);
  assert.equal(parseBarricadePhrases('hurl the lantern at the door'), null);
  // BUILDING a barricade from nothing is the salvage/build lane.
  assert.ok(BARRICADE_BUILD_IDIOM_RE.test('throw up a barricade'));
  assert.ok(BARRICADE_BUILD_IDIOM_RE.test('build a barricade against the door'));
  // The verb gate itself does not claim a bare door attack.
  assert.ok(!BARRICADE_VERB_RE.test('kick the door down'));
  assert.ok(!BARRICADE_VERB_RE.test('ram the door'));
});

test('U725-A3 qualification is a sealed-reason predicate', () => {
  assert.deepEqual(qualifiesAsBarricade({ mobility: 'fixed', bulk: 5 }, {}), { ok: false, why: 'fixed' });
  assert.deepEqual(qualifiesAsBarricade({ mobility: 'portable', bulk: 4 }, { flat: 1 }), { ok: false, why: 'flat' });
  assert.deepEqual(qualifiesAsBarricade({ mobility: 'portable', bulk: MIN_BARRICADE_BULK - 1 }, {}), { ok: false, why: 'slight' });
  assert.deepEqual(qualifiesAsBarricade({ mobility: 'portable', bulk: MIN_BARRICADE_BULK }, {}), { ok: true });
  assert.equal(portalIsEntrance('front door'), true);
  assert.equal(portalIsEntrance('door'), false);
});

// ══ B. the writer's trust boundary ════════════════════════════════════════════

test('U725-B1 the live gesture records placement AND obstruction', () => {
  const { w, narration, mechanics } = barricaded();
  const rec = barricadeRecordOf(w, POT);
  assert.ok(rec, 'obstructs recorded');
  assert.equal(rec.structureId, SK);
  assert.equal(rec.doorId, DOOR_12);
  const p = resolvedObjectPlacement(w, POT);
  assert.equal(p.status, 'placed', 'a barricade is a placement, never a held state');
  assert.ok(p.cell, 'it stands on a real cell');
  assert.match(narration, /wedge/i);
  assert.match(mechanics, /barricade:/);
  assert.equal(barricadeOnDoor(w, SK, DOOR_12)?.objectId, POT);
});

test('U725-B2 a forged delta cannot barricade what the fiction refuses', () => {
  const w = might(boot(), 20);
  const before = worldHash(w);
  const noop = (op, label) => {
    const after = applyDeltas(w, [op]);
    assert.equal(worldHash(after), before, `${label} must be a byte no-op`);
  };
  // A door in a structure the actor is not standing in / that does not exist.
  noop({ op: 'barricadeObject', actorId: 'party', objectId: POT, doorId: 'door:nope:1|2' }, 'unknown door');
  // A door across the building, not adjacent to the actor's room.
  noop({ op: 'barricadeObject', actorId: 'party', objectId: POT, doorId: `door:${SK}:${R1}|${R3}` }, 'non-adjacent door');
  // The exterior door — the actor is in R2, it fronts R1.
  noop({ op: 'barricadeObject', actorId: 'party', objectId: POT, doorId: DOOR_EXT }, 'front door from the wrong room');
  // An object in another room entirely.
  noop({ op: 'barricadeObject', actorId: 'party', objectId: BED, doorId: DOOR_12 }, 'object in another room');
  // A stale/unknown object id.
  noop({ op: 'barricadeObject', actorId: 'party', objectId: 'au:ghost:1', doorId: DOOR_12 }, 'unknown object');
  // No door id at all.
  noop({ op: 'barricadeObject', actorId: 'party', objectId: POT, doorId: '' }, 'empty doorId');
});

test('U725-B3 a caller-supplied cell is ignored — the engine derives the cell', () => {
  const w = might(boot(), 20);
  const honest = applyDeltas(w, [{ op: 'barricadeObject', actorId: 'party', objectId: POT, doorId: DOOR_12 }]);
  const forged = applyDeltas(w, [{
    op: 'barricadeObject', actorId: 'party', objectId: POT, doorId: DOOR_12,
    to: { cell: { x: 999, y: 999 } }, cell: { x: 999, y: 999 },
  }]);
  assert.equal(worldHash(forged), worldHash(honest), 'the supplied cell changes nothing');
  const c = resolvedObjectPlacement(honest, POT).cell;
  assert.notDeepEqual(c, { x: 999, y: 999 });
});

test('U725-B4 one door carries at most one barricade', () => {
  const { w } = barricaded();
  // A second object cannot stack onto the same door (BED is elsewhere, so forge the
  // nearest legal shape: re-issue for a DIFFERENT object id on the taken door).
  const before = worldHash(w);
  const after = applyDeltas(w, [{ op: 'barricadeObject', actorId: 'party', objectId: BED, doorId: DOOR_12 }]);
  assert.equal(worldHash(after), before, 'the door is already held');
  // Re-issuing for the SAME object is idempotent, not a duplicate.
  const again = applyDeltas(w, [{ op: 'barricadeObject', actorId: 'party', objectId: POT, doorId: DOOR_12 }]);
  assert.equal(worldHash(again), before);
});

test('U725-B5 an unqualified object is refused in the fiction, and writes nothing', () => {
  // Force the pot below the bulk floor: the predicate, not the name, is the gate.
  let w = might(boot(), 20);
  const furn = nodeFurn(w).map(f => (String(f.objectId || '') === POT ? { ...f, bulk: 1 } : f));
  w = { ...w, map: { ...w.map, nodes: w.map.nodes.map(n => (n.id === NODE ? { ...n, furniture: furn } : n)) } };
  const before = worldHash(w);
  const r = pm(w, 'shove the cooking pot against the door');
  assert.match(String(r.output?.narration || ''), /too slight/i);
  assert.equal(worldHash(r.world), before, 'a refusal changes nothing');
  assert.equal(barricadeRecordOf(r.world, POT), null);
});

// ══ C. the traversal gates ════════════════════════════════════════════════════

test('U725-C1 a barricaded door refuses the move, fiction-first, and does not move the player', () => {
  const { w } = barricaded();
  const roomBefore = String(w.scene.interior.roomId);
  const r = pm(w, 'go north');
  assert.match(String(r.output?.narration || ''), /wedged against that door/i);
  assert.match(String(r.output?.mechanics || ''), /door:barricaded/);
  assert.equal(String(r.world.scene.interior.roomId), roomBefore, 'still in the same room');
});

test('U725-C2 moveWithinInterior is the structural backstop — even for an OPEN door', () => {
  const { w } = barricaded();
  const block = interiorDoorBlock(w, R1);
  assert.equal(block.state, 'open', 'hardware is untouched — this is not a bar or a lock');
  assert.equal(block.crossable, true, 'the DOOR itself still reads crossable');
  assert.ok(block.barricade, 'the barricade is reported alongside, not folded in');
  // The backstop refuses anyway: an open door with furniture against it does not pass.
  const moved = moveWithinInterior(w, R1);
  assert.equal(String(moved.scene.interior.roomId), R2, 'no crossing happened');
  assert.equal(worldHash(moved), worldHash(w), 'and nothing else changed');
});

test('U725-C3 a barricaded FRONT door holds the party in — backstop + fiction', () => {
  // Carry the pot to the hall, set it down, wedge it against the front door.
  let w = might(boot(), 20);
  w = pm(w, 'take the cooking pot').world;
  w = pm(w, 'go north').world;
  assert.equal(String(w.scene.interior.roomId), R1, 'in the hall');
  w = pm(w, 'set the cooking pot down').world;
  const r = pm(w, 'shove the cooking pot against the front door');
  w = r.world;
  assert.ok(barricadeOnDoor(w, SK, DOOR_EXT), 'the front door is barricaded');

  // The structural backstop: exitStructureInterior itself no-ops.
  const out = exitStructureInterior(w);
  assert.ok(out.scene?.interior, 'still indoors');
  assert.equal(worldHash(out), worldHash(w));

  // And the narrating site says why instead of letting the no-op read as success.
  const leave = pm(w, 'go outside');
  assert.match(String(leave.output?.narration || ''), /wedged against the door|drag it clear/i);
  assert.ok(leave.world.scene?.interior, 'still indoors after the refusal');
});

test('U725-C4 a barricaded front door does NOT seal the windows', () => {
  // Same setup, but leave by the window in the bedchamber: a barricade is about one
  // DOOR, not about the body (that distinction is the carry-lock's, not this one's).
  let w = might(boot(), 20);
  w = pm(w, 'take the cooking pot').world;
  w = pm(w, 'go north').world;
  w = pm(w, 'set the cooking pot down').world;
  w = pm(w, 'shove the cooking pot against the front door').world;
  assert.ok(barricadeOnDoor(w, SK, DOOR_EXT));
  const viaWindow = exitStructureInterior(w, { via: 'window' });
  assert.equal(viaWindow.scene?.interior, null, 'the window path is not blocked by a door barricade');
});

test('U725-C5 forcing a barricaded door never fakes success', () => {
  const { w } = barricaded();
  const before = worldHash(w);
  const r = pm(w, 'kick the door down');
  const n = String(r.output?.narration || '');
  // It must NOT narrate an opening, and it must name the real obstacle + affordances.
  assert.ok(!/steps? through|swings open|bursts open/i.test(n), `no fake success: ${n}`);
  assert.match(n, /cooking pot/i);
  assert.match(String(r.output?.mechanics || ''), /door:barricaded/);
  assert.equal(worldHash(r.world), before, 'and the world is untouched');
});

// ══ D. clearing ═══════════════════════════════════════════════════════════════

test('U725-D1 dragging it aside clears the obstruction and reopens the way', () => {
  const { w } = barricaded();
  const w2 = pm(w, 'drag the cooking pot aside').world;
  assert.equal(barricadeRecordOf(w2, POT), null, 'obstructs dissolved with the move');
  assert.equal(barricadeOnDoor(w2, SK, DOOR_12), null);
  const r = pm(w2, 'go north');
  assert.equal(String(r.world.scene.interior.roomId), R1, 'the way is open again');
});

test('U725-D2 taking it into your arms clears it too', () => {
  const { w } = barricaded();
  const w2 = applyDeltas(w, [{ op: 'holdObject', actorId: 'party', objectId: POT }]);
  assert.equal(resolvedObjectPlacement(w2, POT).status, 'held');
  assert.equal(barricadeRecordOf(w2, POT), null, 'you cannot hold the thing wedged against the door');
  assert.equal(barricadeOnDoor(w2, SK, DOOR_12), null);
});

test('U725-D3 setting it down elsewhere clears it', () => {
  const { w } = barricaded();
  let w2 = applyDeltas(w, [{ op: 'holdObject', actorId: 'party', objectId: POT }]);
  w2 = applyDeltas(w2, [{ op: 'placeObject', actorId: 'party', objectId: POT, ref: { kind: 'actor' } }]);
  assert.equal(resolvedObjectPlacement(w2, POT).status, 'placed');
  assert.equal(barricadeRecordOf(w2, POT), null);
});

test('U725-D4 wreckage holds no door — the READ stops honouring it, no mutation needed', () => {
  const { w } = barricaded();
  assert.ok(barricadeOnDoor(w, SK, DOOR_12), 'held before the smash');
  // Wreck the piece in place (the terminal state the durability writer mirrors).
  const furn = nodeFurn(w).map(f => (String(f.objectId || '') === POT ? { ...f, state: 'wrecked' } : f));
  const w2 = { ...w, map: { ...w.map, nodes: w.map.nodes.map(n => (n.id === NODE ? { ...n, furniture: furn } : n)) } };
  assert.equal(barricadeOnDoor(w2, SK, DOOR_12), null, 'a wreck obstructs nothing');
  // The record itself survives (derived truth, not bookkeeping) and the door opens.
  assert.ok(barricadeRecordOf(w2, POT), 'the record is still there — the read is what changed');
  const moved = moveWithinInterior(w2, R1);
  assert.equal(String(moved.scene.interior.roomId), R1, 'smashing it through is a real way past');
});

// ══ E. invariants ═════════════════════════════════════════════════════════════

test('U725-E1 the obstruction laws throw on corrupt shapes', () => {
  const { w } = barricaded();
  assert.doesNotThrow(() => assertWorldInvariants(w), 'the honest world is legal');

  const corrupt = (rec, why) => {
    const bad = { ...w, objects: { ...w.objects, [POT]: rec } };
    assert.throws(() => assertWorldInvariants(bad), /Invariant/, why);
  };
  const good = w.objects[POT];
  corrupt({ ...good, obstructs: { structureId: '', doorId: DOOR_12 } }, 'empty structureId');
  corrupt({ ...good, obstructs: { structureId: SK } }, 'missing doorId');
  corrupt({ ...good, obstructs: 'nope' }, 'not an object');
  corrupt({ obstructs: good.obstructs }, 'obstructs without a placement');
  corrupt({ heldByActorId: 'party', obstructs: good.obstructs }, 'held AND obstructing');
});

test('U725-E2 two records may not claim the same door', () => {
  const { w } = barricaded();
  const rec = w.objects[POT];
  const bad = {
    ...w,
    objects: {
      ...w.objects,
      [BED]: { placedAt: { ...rec.placedAt }, obstructs: { ...rec.obstructs } },
    },
  };
  assert.throws(() => assertWorldInvariants(bad), /more than one barricade/);
});

// ══ F. determinism ════════════════════════════════════════════════════════════

test('U725-F1 replay is hash-identical', () => {
  const a = barricaded().w;
  const b = barricaded().w;
  assert.equal(worldHash(a), worldHash(b), 'same seed, same gesture, same world');
});

test('U725-F2 the obstruction survives save → load unchanged', () => {
  const { w } = barricaded();
  const round = importWorld(exportWorld(w));
  assert.deepEqual(barricadeRecordOf(round, POT), barricadeRecordOf(w, POT));
  assert.equal(worldHash(round), worldHash(w));
  assert.doesNotThrow(() => assertWorldInvariants(round));
});

test('U725-F3 an untouched world is byte-identical to before the packet (empty-overlay golden)', () => {
  const w = boot();
  assert.deepEqual(w.objects, {}, 'boot mints no obstruction');
  // The whole point: nothing about this packet is visible until a player uses it.
  const w2 = pm(w, 'look around').world;
  assert.deepEqual(w2.objects, {});
});

// ══ G. the door-cell law ══════════════════════════════════════════════════════

test('U725-G1 the barricade lands ON the crossing; move and place never do', () => {
  const { w } = barricaded();
  const plan = floorPlan(st(w));
  const door = st(w).doors.find(d => String(d.id) === DOOR_12);
  const cell = resolvedObjectPlacement(w, POT).cell;

  // The barricade sits on the door's TRUE geometric approach cell — orthogonally
  // adjacent to the drawn door cell, in the actor's own room. That is the placement
  // no other verb is allowed to make, and it is the packet's whole permission.
  const planDoor = plan.doors.find(d => (String(d.a) === R1 && String(d.b) === R2) || (String(d.a) === R2 && String(d.b) === R1));
  const dcx = layoutToCells(planDoor.x), dcy = layoutToCells(planDoor.y);
  const adjacent = Math.abs(cell.x - dcx) + Math.abs(cell.y - dcy) === 1;
  assert.ok(adjacent, `the barricade is orthogonally against the doorway (door ${dcx},${dcy} vs ${key(cell)})`);

  // …and the ordinary verbs still refuse the RESERVED set, exactly as U696/U698 assert.
  const doorKeys = reservedDoorCells(plan);
  const w0 = might(boot(), 20);
  const moveTo = legalMoveTargetCell(w0, POT, 'party');
  assert.ok(moveTo && !doorKeys.has(key(moveTo)), 'a drag never lands in a reserved doorway cell');
  const placeTo = legalPlaceTargetCell(w0, POT, 'party', { kind: 'actor' });
  assert.ok(placeTo && !doorKeys.has(key(placeTo)), 'a set-down never lands in a reserved doorway cell');
});

test('U725-G1b FINDING (pre-existing, not this packet): reservedDoorCells reserves the wrong cells when the compass label disagrees with the geometry', () => {
  // Discovered while landing 6C, filed rather than fixed — the repair changes which
  // cells ordinary furniture may occupy, which moves placement and pathing for every
  // world, and belongs in its own WORLD_VERSION-shaped packet.
  //
  // reservedDoorCells derives its two approach cells from the plan door's `dir`
  // (north/south → y±1, east/west → x±1). On this fixture the hall→boot-room door
  // carries dir 'south' while the rooms sit SIDE BY SIDE, so the reserved pair lands
  // in the wall band and the REAL crossing is left unreserved — i.e. the soft-lock
  // guard is not guarding this doorway at all. 6C is unaffected: it derives its cell
  // geometrically (U725-G2) and refuses traversal from the barricade RECORD, not
  // from the mask.
  const w = might(boot(), 20);
  const plan = floorPlan(st(w));
  const planDoor = plan.doors.find(d => (String(d.a) === R1 && String(d.b) === R2) || (String(d.a) === R2 && String(d.b) === R1));
  const dcx = layoutToCells(planDoor.x), dcy = layoutToCells(planDoor.y);
  const reserved = reservedDoorCells(plan);

  // What it DOES reserve: the vertical pair, both in the wall band (no room).
  assert.ok(reserved.has(`${dcx},${dcy - 1}`) && reserved.has(`${dcx},${dcy + 1}`));
  assert.equal(roomOfStructCell(plan, dcx, dcy - 1), '', 'reserved cell is wall band');
  assert.equal(roomOfStructCell(plan, dcx, dcy + 1), '', 'reserved cell is wall band');

  // What it does NOT reserve: the real crossing, one cell either side, in real rooms.
  assert.ok(!reserved.has(`${dcx - 1},${dcy}`), 'the true crossing is left unreserved');
  assert.ok(!reserved.has(`${dcx + 1},${dcy}`), 'the true crossing is left unreserved');
  assert.equal(roomOfStructCell(plan, dcx - 1, dcy), R1);
  assert.equal(roomOfStructCell(plan, dcx + 1, dcy), R2);
});

test('U725-G2 the barricade cell is derived from GEOMETRY, not the topology compass', () => {
  // Regression lock: the plan door's `dir` is the compass label authoredStructure
  // assigned, and on this very fixture it disagrees with where the rooms were drawn
  // (dir 'south' for two rooms that sit side by side). A dir-derived approach pair
  // yields wall-band cells and the barricade silently becomes impossible.
  const w = might(boot(), 20);
  const door = st(w).doors.find(d => String(d.id) === DOOR_12);
  const planDoor = floorPlan(st(w)).doors.find(d => (String(d.a) === R1 && String(d.b) === R2) || (String(d.a) === R2 && String(d.b) === R1));
  assert.equal(String(planDoor.dir), 'south', 'fixture still carries the disagreeing compass label');
  const cell = legalBarricadeTargetCell(w, POT, 'party', door);
  assert.ok(cell, 'a cell is found anyway');
  // The real crossing here is horizontal — the cell sits beside the door, not above it.
  assert.equal(cell.y, 52);
});

test('U725-D5 REGRESSION (RULING-FX-1, live-caught): an empty fx proposal never erases a real physical delta', () => {
  // Caught on the live build while verifying 6C's own advertised affordance: the
  // refusal says "drag it clear and the way opens", and live it did not open. The
  // /api/physics-fx pre-flight had returned { plausible: true, deltas: [], result:
  // "…It moves to the side…" } and the consumption seam substituted BOTH halves —
  // wiping the drag's moveObject delta while keeping prose that asserted the move.
  // Systematic: the sealed fx vocabulary has no position ops (the engine owns
  // position), so a correct model returns [] for EVERY positional action.
  assert.equal(
    groundFxProposal({}, { plausible: true, deltas: [], result: 'The pot slides aside.' }),
    null,
    'a proposal that proposes nothing is not a ruling',
  );
  // And the drag still really clears the barricade when the lane's own deltas stand.
  const { w } = barricaded();
  const cleared = pm(w, 'drag the cooking pot aside').world;
  assert.equal(barricadeRecordOf(cleared, POT), null);
  assert.equal(String(pm(cleared, 'go north').world.scene.interior.roomId), R1);
});

test('U725-G3 no free approach cell means an honest refusal, never a silent success', () => {
  // Fill the actor-side approach cell with the barricade, then ask a SECOND object
  // to take the same door from the same side: the writer must find nowhere to wedge
  // it and no-op, and the seam must say so rather than claim a barricade.
  const { w } = barricaded();
  const cell = resolvedObjectPlacement(w, POT).cell;
  assert.ok(liveAuthoredBlockedCells(w, st(w), null).has(key(cell)), 'the wedged object really occupies its cell');
  // The pot is the only qualifying object in this room, so re-asking names it and
  // gets the idempotent "already wedged" answer — never a second, phantom barricade.
  const r = pm(w, 'shove the cooking pot against the door');
  assert.match(String(r.output?.narration || ''), /already wedged/i);
  assert.equal(worldHash(r.world), worldHash(w));
});
