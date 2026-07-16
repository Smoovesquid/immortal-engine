// U699 — OBJ-THROW-6B: throwing a supported object (approved brief rev 5).
//
// A supported furniture object (authored + objectId + grounded) can be thrown at
// another supported object, at a named wall, or untargeted across the room. Range is
// engine-owned (MAX_THROW_CELLS = 4 → 20 ft at CELL_FT 5). Impact reuses the engine's
// existing IMPROVISED-WEAPON contract (d4 + MIGHT, no proficiency, no equipped weapon
// — escapeCombat.js improvisedStrikeProfile / ruleset materials '1d4'). The wall's
// impact surface comes from the ONE canonical structure-material authority
// (structureMaterial().family), never a parallel shell classifier.
//
// Sections:
//   A — domain gate + canaries. The DOMAIN MATRIX, each proved against the real
//       source it names and each pinning the concrete PRE-PACKET owner:
//         procgen  (A3)  — node furniture, authored!==true          → generic floor
//         generic  (A3b) — roomDetail ink, no node piece, no id     → generic floor
//         pack     (A4)  — inventory items                          → unclaimed
//         exterior (A6)  — a REGION-frame actor + an indoor pot     → generic floor
//       A5 pins the writer's own refusal on an unsupported piece.
//   B — hands, capacity ladder (auto / roll / impossible), fixed fixture.
//   C — range: 4 succeeds, 5 refuses, for room / wall / object; caller range ignored.
//   D — refs: bare room/wall still fail-closed; throw-mode accepted; 6A release intact.
//   E — RNG: draw order + counts, nat1/nat20, preflight consumes nothing, replay ×2.
//   F — weapon independence: same MIGHT + different weapons ⇒ identical results.
//   G — impact: two-sided threshold filter, soft ⇒ no self-damage, no wall HP.
//   H — wall material: timber→wood (LIVE), stone→stone (synthetic), else fail-closed.
//   I — landing: engine-derived, deterministic tie-breaks, landing-first ordering.
//   J — room truth after landing; K — ordinals; L — parser canaries; M — canon;
//   N — persistence; O — projection; P — carry law.
//
// FIXTURE TRUTHS (probe-verified against the live boot, not assumed):
//   boot2 = loaderDemo2, 3-room authored cottage 'authored:n2_96332945'
//     R2 (boot room) rect x65..83 y41..63; actor boots at (83,52); POT anchor (74,52)
//     POT  = authored cooking pot, IRON  (ac19 hp30 thr8), portable, weight3 bulk2
//     BED2 = authored bed in R3,   WOOD  (ac15 hp15 thr3), heavy
//     R3 rect x17..39 y41..63; BED2 anchor (24,52)
//   Capacity for POT at action 'throw' (load 4): MIGHT 20 → auto · 10 → roll(diff 3)
//     · 6 → impossible (but carry = roll — you can carry it and never throw it)
//   structureMaterial(authored) is ALWAYS family 'timber' (buildingType is hardcoded
//     'cottage' at authoredStructure.js:772) — the stone and fail-closed arms are
//     reachable ONLY via a declared synthetic buildingType. Recorded in the brief.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove, detectObjectThrowIntent } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { heldObjectOf } from '../engine/llmPhysics.js';
import { resolvedObjectPlacement } from '../engine/objects/placement.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { objectsHere } from '../engine/structures/roomObjects.js';
import { moveWithinInterior } from '../engine/structures/interiors.js';
import { structureMaterial } from '../engine/structures/structureMaterial.js';
import { roomDetail } from '../engine/structures/roomDetail.js';
import { normalizeTopology } from '../engine/structures/topology.js';
import { authoredBaseAnchorCell, legalPlaceTargetCell, legalMoveTargetCell, liveAuthoredBlockedCells, layoutToCells } from '../engine/map/spatial/tacticalPos.js';
import { actorObjectCapacity } from '../engine/objects/capacity.js';
import { objectPhysics } from '../engine/objects/mobility.js';
import { actorFacts } from '../engine/objects/physicsActor.js';
import { initialDurability } from '../engine/objects/durability.js';
import { makeRng, seedFromString } from '../engine/rng.js';
import { statMod } from '../engine/ruleset/core/stats.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';
import { sceneSignature } from '../public/map/continuousMap.js';
import {
  MAX_THROW_CELLS, THROW_NOISE, isHardSurface, wallPhysicalMaterial, filterImpact,
  drawThrowOutcome, hasExplicitOrdinal, isThrowIdiom,
} from '../engine/objects/throwing.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

// ── fixtures ──────────────────────────────────────────────────────────────────
const boot2 = () => beginAdventure(newWorld({ seed: 'loaderDemo2', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const boot1 = () => beginAdventure(newWorld({ seed: 'loaderDemo', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

const S2 = 'authored:n2_96332945';
const NODE2 = 'n2_96332945';
const R1 = `room:${S2}:1`, R2 = `room:${S2}:2`, R3 = `room:${S2}:3`;
const POT = `au:${S2}:${R2}#a0`;
const BED2 = `au:${S2}:${R3}#a0`;
const NODE1 = 'n8_2046891609';

// ── helpers ───────────────────────────────────────────────────────────────────
const might = (w, v) => ({ ...w, party: [{ ...w.party[0], stats: { ...(w.party[0].stats || {}), MIGHT: v } }, ...w.party.slice(1)] });
const at = (w, gx, gy) => ({ ...w, party: [{ ...w.party[0], pos: { frame: `struct:${S2}`, gx, gy } }, ...w.party.slice(1)] });
const aKey = (w) => String(w.party?.[0]?.id || 'party');
const pm = (w, t) => playerMove(w, PACKS, t);
const nar = (r) => String(r.output?.narration || '');
const mech = (r) => String(r.output?.mechanics || '');
const nodeFurn = (w, nid) => (w.map.nodes.find(n => n.id === nid)?.furniture) || [];
const pieceById = (w, nid, oid) => nodeFurn(w, nid).find(f => String(f.objectId || '') === oid) || null;
const toolsNames = (w) => ((w.party[0].inventory || {}).tools || []).map(i => String(i.name));
const hereNames = (w) => objectsHere(w).map(o => String(o.piece.name));
const cellOf = (w, oid) => resolvedObjectPlacement(w, oid)?.cell || null;
const key = (c) => (c ? `${c.x},${c.y}` : null);
const mightMod = (w) => statMod(Number(w.party[0].stats?.MIGHT) || 10);
const durOf = (w, oid) => w.objects?.[oid]?.durability;
const structOf = (w) => w.structures.byId[S2];
const rulingCount = (w) => (w.canonLog?.events || []).filter(e => e.type === 'dm.ruling').length;

// rename an authored piece (U698's synthetic technique) — for same-name twins + fixed
const renamePiece = (w, objectId, fields) => ({
  ...w,
  map: { ...w.map, nodes: w.map.nodes.map(n => n.id === NODE2
    ? { ...n, furniture: n.furniture.map(f => String(f.objectId || '') === objectId ? { ...f, ...fields } : f) }
    : n) },
});
// declared synthetic buildingType — the ONLY way to reach non-timber families,
// because authoredStructure.js:772 hardcodes 'cottage'. Stated in the brief.
const setBuildingType = (w, t) => ({
  ...w,
  structures: { ...w.structures, byId: { ...w.structures.byId, [S2]: { ...w.structures.byId[S2], buildingType: t } } },
});
// strip/replace the party's weapons — proves the equipped weapon has no say
const withWeapons = (w, weapons) => ({
  ...w,
  party: [{ ...w.party[0], inventory: { ...(w.party[0].inventory || {}), weapons } }, ...w.party.slice(1)],
});

// The pot, held, in the boot room (R2), MIGHT 20 (auto capacity).
const heldInR2 = (m = 20) => pm(might(boot2(), m), 'take the cooking pot').world;
// The pot, held, carried to R3, actor placed at an exact cell.
const heldInR3 = (gx, gy, m = 20) => {
  let w = heldInR2(m);
  w = moveWithinInterior(moveWithinInterior(w, R1), R3);
  return at(w, gx, gy);
};

// Independently reconstruct the throw stream — proves production's reported numbers
// ARE this seeded stream's draws, in this order, with nothing consumed before them.
function throwStream(w, actorId, projId, text) {
  const seed = seedFromString(`${w.meta.seed}|objthrow|${(w.timeline || []).length}|${actorId}|${projId}|${String(text || '')}`);
  return makeRng(seed);
}

// A counting RNG: proves the exact NUMBER of draws the production helper takes.
// `script` supplies forced values (for nat-1/nat-20 laws); anything unscripted
// falls back to the low end, which is irrelevant to a draw-COUNT assertion.
function countingRng(script = []) {
  const draws = [];
  let i = 0;
  return {
    draws,
    int(lo, hi) {
      const v = i < script.length ? script[i] : lo;
      draws.push({ lo, hi, v });
      i += 1;
      return v;
    },
  };
}

// ── DETERMINISTIC PRODUCTION FIXTURES ────────────────────────────────────────
// Verified by exhaustive probe against the live seeded streams: these exact
// (fixture, phrase) pairs always produce the stated outcome, so every assertion
// below is unconditional. A test that would pass under either a hit or a miss
// proves nothing, so none of these branch.
const HIT_PHRASE = 'hurl the cooking pot at the bed';    // atk 25 vs AC 15 → hit, impact 9
const MISS_PHRASE = 'throw the cooking pot at the bed';  // atk 14 vs AC 15 → miss
const CAP_FAIL = 'fling the cooking pot across the room';  // MIGHT 10 → capacity roll 4  → failure
const CAP_MIXED = 'toss the cooking pot across the room';  // MIGHT 10 → capacity roll 13 → mixed
const CAP_OK = 'throw the cooking pot across the room';    // MIGHT 10 → capacity roll 16 → success
const capOf = (r) => (mech(r).match(/\[roll:(-?\d+) vs DC:(\d+) → (\w+)/) || []).slice(1);
const atkOf = (r) => { const m = mech(r).match(/atk:(-?\d+) vs AC:(\d+) → (hit|miss)/); return m ? { atk: +m[1], ac: +m[2], out: m[3] } : null; };
const impOf = (r) => { const m = mech(r).match(/impact:(\d+)/); return m ? +m[1] : null; };
const lastEv = (w) => (w.timeline || []).slice(-1)[0]?.data || {};

// ══ A. domain gate + canaries ═════════════════════════════════════════════════

test('U699-A1 a held supported object is THROWN — it leaves your arms and lands', () => {
  const w = heldInR2();
  assert.equal(heldObjectOf(w, aKey(w))?.objectId, POT, 'setup: pot held');
  const r = pm(w, 'throw the cooking pot at the wall');
  assert.equal(heldObjectOf(r.world, aKey(r.world)), null, 'arms are clear');
  assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'placed', 'it landed');
  assert.match(mech(r), /object-throw/, 'the throw seam owns it');
  assert.ok(!/stat:WITS/.test(mech(r)), 'NOT the generic WITS skill floor any more');
});

test('U699-A2 COMPOSITE lift-and-throw with free hands resolves in one turn', () => {
  const w = might(boot2(), 20);
  assert.equal(heldObjectOf(w, aKey(w)), null, 'setup: hands empty');
  const r = pm(w, 'take the cooking pot and throw it at the wall');
  assert.equal(heldObjectOf(r.world, aKey(r.world)), null, 'not left in your arms');
  assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'placed', 'the composite THREW it');
  assert.match(mech(r), /object-throw/, 'the throw seam owns the composite');
});

test('U699-A3 CANARY — a PROCGEN projectile is declined and gains NO overlay', () => {
  // DOMAIN: procgen NODE furniture — a real engine piece with a 'pg:' objectId whose
  // authored flag is not true. isSupportedThrowable's authored gate is what declines it.
  const w = might(boot1(), 20);
  const rackId = 'pg:n8_2046891609:0';
  const rack = nodeFurn(w, NODE1).find(f => String(f.objectId || '') === rackId);
  assert.ok(rack, 'setup: the tool rack really is node furniture');
  assert.notEqual(rack.authored, true, 'setup: and it is genuinely PROCGEN, not authored');
  const r = pm(w, 'throw the tool rack at the wall');
  assert.ok(!/object-throw/.test(mech(r)), 'the throw gate declines an unsupported piece');
  // it falls to the pre-existing generic floor — pinned concretely, not by a hash
  assert.match(mech(r), /\[roll:-?\d+ vs DC:\d+/, 'today\'s owner (the generic skill floor) still answers');
  // and the affected-state projection is untouched: no overlay of any kind
  assert.equal(r.world.objects?.[rackId], undefined, 'no overlay record minted at all');
  assert.equal(hereNames(r.world).filter(n => /tool rack/i.test(n)).length, 1, 'still exactly one tool rack on the floor');
});

test('U699-A3b CANARY — a GENERIC room-detail object is never a throw candidate', () => {
  // DOMAIN: generic ROOM-DETAIL — a genuinely different source from A3's procgen node
  // furniture. roomDetail() draws hearth/table/rug into the floor plan as INK: they are
  // not in node.furniture, they carry no objectId, and no delta can address them.
  const w = might(moveWithinInterior(boot2(), R1), 20);
  assert.equal(w.scene?.interior?.roomId, R1, 'setup: standing in the room the detail loadout draws');
  const st = w.structures.byId[S2];
  const room = normalizeTopology(st.topology).rooms.find(r => String(r.id) === R1);
  const kinds = new Set(roomDetail(room, st.buildingType || null).furniture.map(f => String(f.kind)));
  const names = nodeFurn(w, NODE2).map(f => String(f.name).toLowerCase());
  for (const k of ['rug', 'hearth', 'table']) {
    assert.ok(kinds.has(k), `setup: the plan really draws a ${k} in this room`);
    assert.ok(!names.includes(k), `setup: and the ${k} is drawn ink — NOT engine node furniture`);
  }
  for (const k of ['rug', 'hearth', 'table']) {
    const t = `throw the ${k} at the wall`;
    // the reachable PRODUCTION detector boundary…
    assert.equal(detectObjectThrowIntent(w, t, aKey(w)), null, `"${t}" is not claimed by the throw detector`);
    // …and the real player gesture through playerMove
    const r = pm(w, t);
    assert.ok(!/object-throw/.test(mech(r)), `"${t}" is not claimed through playerMove either`);
    assert.match(mech(r), /\[roll:-?\d+ vs DC:\d+ → \w+ \| margin:/, 'the generic skill floor owns it — pinned concretely');
    assert.equal(r.world.objects?.[POT], undefined, 'and the supported pot nearby is never touched by proxy');
  }
  // HONEST LIMIT, stated rather than papered over: a room-detail object has NO
  // objectId, so no overlay could be keyed to it even in principle and there is no
  // "did it mutate?" to ask. Non-ownership is therefore proved at the two reachable
  // production surfaces (the detector and playerMove) — no live path is fabricated.
});

test('U699-A6 CANARY — an OUTDOOR (region-frame) actor never routes the indoor pot through object-throw', () => {
  // THE REGRESSION. Exit through the REAL production egress, then name the pot that is
  // physically inside the cottage. objectsHere's legacy exterior branch still lists it
  // (that exposure is older seams' business and is deliberately unchanged), so without
  // the frame gate the throw seam claimed the utterance and answered with a capacity
  // refusal about a pot in another building. Exterior throwing is a DEFERRED packet:
  // this utterance must keep its pre-packet owner.
  const outside = pm(might(boot2(), 20), 'go outside').world;
  assert.equal(outside.scene?.interior, null, 'setup: really outdoors — no interior frame');
  assert.equal(outside.party[0].pos?.frame, 'region', 'setup: in the REGION frame, not the structure frame');
  assert.ok(hereNames(outside).some(n => /cooking pot/i.test(n)),
    'setup: the legacy exterior branch still exposes the indoor pot — the exposure that made this reachable');
  const before = resolvedObjectPlacement(outside, POT);
  assert.equal(before.room, R2, 'setup: the pot is in its own room, inside');
  const noiseBefore = outside.env?.noise ?? 0;
  const rulingsBefore = (outside.canonLog?.events || []).filter(e => e.type === 'dm.ruling').length;

  const r = pm(outside, 'throw the cooking pot at the wall');
  // 1. OBJ-THROW does not claim it…
  assert.ok(!/object-throw/.test(mech(r)), 'the throw gate must not claim an outdoor throw');
  // 2. …and the CONCRETE pre-existing owner answers — the generic skill floor, the
  //    same owner A3/A3b pin. "not object-throw" alone would prove nothing.
  assert.match(mech(r), /\[roll:-?\d+ vs DC:\d+ → \w+ \| margin:-?\d+ \| approach:/,
    'the pre-packet owner (the generic skill floor) still answers');
  assert.equal(lastEv(r.world).updateKind, undefined, 'no object-throw resolution event was recorded');
  // 3. the indoor pot is untouched — same room, same placement state, byte-for-byte
  assert.deepEqual(resolvedObjectPlacement(r.world, POT), before, 'the pot never moved and never changed state');
  assert.equal(resolvedObjectPlacement(r.world, POT).room, R2, 'still in its own room, inside the cottage');
  // 4. no overlay / durability / placement / damage / noise / dm.ruling mutation
  assert.equal(r.world.objects?.[POT], undefined, 'no overlay record minted at all');
  assert.equal(r.world.env?.noise ?? 0, noiseBefore, 'no environmental noise was raised');
  assert.equal((r.world.canonLog?.events || []).filter(e => e.type === 'dm.ruling').length, rulingsBefore,
    'no dm.ruling was appended');
  // 5. no throw-stream OR capacity-stream draw was consumed by OBJ-THROW — the bug's
  //    signature was exactly a capacity refusal, so this is the assertion that bites
  assert.ok(!/capacity/.test(mech(r)), 'no capacity refusal — OBJ-THROW never reached its capacity preflight');
  assert.equal(lastEv(r.world).capacityCheck, undefined, 'no capacity check recorded');
  assert.ok(!/impact:|atk:/.test(mech(r)), 'no throw-stream draw was consumed');
});

test('U699-A4 CANARY — a PACK item throw is not claimed, and the pack is unchanged', () => {
  const w = might(boot1(), 20);
  const before = (w.party[0].inventory.weapons || []).map(i => i.name);
  const r = pm(w, 'throw the Hatchet at the wall');
  assert.ok(!/object-throw/.test(mech(r)), 'pack items keep today\'s routing');
  assert.deepEqual((r.world.party[0].inventory.weapons || []).map(i => i.name), before, 'the Hatchet is still in the pack');
});

test('U699-A5 a forged throw-mode placeObject on an unsupported piece mints NO placement and NO overlay, and does not move worldHash', () => {
  const w = might(boot1(), 20);
  const rackId = 'pg:n8_2046891609:0';
  const w2 = applyDeltas(w, [{ op: 'placeObject', actorId: aKey(w), objectId: rackId, ref: { kind: 'room', mode: 'throw' } }]);
  assert.equal(w2.objects?.[rackId]?.placedAt, undefined, 'unsupported → no placement');
  // The COMPLETE relevant comparison — the old title said "byte-no-op" while checking
  // only placedAt, which is a strictly narrower claim than the words promised.
  assert.deepEqual(w2.objects, w.objects, 'no overlay record of ANY kind is minted');
  assert.deepEqual(nodeFurn(w2, NODE1), nodeFurn(w, NODE1), 'the node furniture is untouched');
  assert.equal(worldHash(w2), worldHash(w), 'and the determinism fingerprint does not move');
  // HONEST LIMIT — and the reason the title says what it says: this is NOT a
  // byte-identical WORLD. applyDeltas unconditionally clears scene.lastMotif and
  // scene.lastToneWord (narration texture) on every call, deltas or none. Everything
  // else in the scene is unchanged, and that is asserted rather than assumed.
  const scrub = (s) => ({ ...s, lastMotif: undefined, lastToneWord: undefined });
  assert.deepEqual(scrub(w2.scene), scrub(w.scene), 'nothing else in the scene moved');
});

// ══ B. hands + capacity ═══════════════════════════════════════════════════════

test('U699-B1 hands full: a composite throw of a second object is refused', () => {
  // in R3, holding the pot, with the BED on this room's floor as the second object
  const w = heldInR3(28, 50);
  const r = pm(w, 'take the bed and throw it at the wall');
  assert.equal(heldObjectOf(r.world, aKey(r.world))?.objectId, POT, 'still holding the pot');
  assert.equal(resolvedObjectPlacement(r.world, BED2)?.status, 'base', 'the bed never moved');
  assert.match(mech(r), /hands full/, 'refused for the honest reason');
});

test('U699-B2 AUTO capacity (MIGHT 20) throws with no |physics| capacity roll', () => {
  const w = heldInR2(20);
  const cap = actorObjectCapacity(actorFacts(w, aKey(w)), objectPhysics(pieceById(w, NODE2, POT)), 'throw');
  assert.equal(cap.verdict, 'auto', 'fixture really is auto');
  const r = pm(w, 'throw the cooking pot across the room');
  assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'placed', 'it landed');
});

test('U699-B3 IMPOSSIBLE capacity (MIGHT 6) refuses with ZERO PHYSICAL mutation — and records the resolution event', () => {
  const w = heldInR2(6);
  const cap = actorObjectCapacity(actorFacts(w, aKey(w)), objectPhysics(pieceById(w, NODE2, POT)), 'throw');
  assert.equal(cap.verdict, 'impossible', 'fixture really is impossible to throw');
  assert.equal(actorObjectCapacity(actorFacts(w, aKey(w)), objectPhysics(pieceById(w, NODE2, POT)), 'carry').verdict, 'roll',
    'but it is still CARRYABLE — you can hold it and never throw it');
  const r = pm(w, 'throw the cooking pot at the wall');
  assert.equal(heldObjectOf(r.world, aKey(r.world))?.objectId, POT, 'still in your arms');
  assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'held', 'no landing');
  assert.equal(r.world.objects?.[POT]?.durability, undefined, 'no damage record minted');
  assert.equal(r.world.env?.noise ?? 0, 0, 'and no noise — nothing PHYSICAL happened');
  // …but the turn is still deterministically recorded. A refusal appends a resolution
  // event, so "zero mutation" would be the wrong words: it is zero PHYSICAL mutation.
  assert.equal(lastEv(r.world).updateKind, 'object-throw', 'the refusal IS recorded as a resolution event');
  assert.equal(lastEv(r.world).deltaCount, 0, 'with zero deltas');
});

test('U699-B4 BORDERLINE capacity (MIGHT 10) is a real roll tier', () => {
  const w = heldInR2(10);
  const cap = actorObjectCapacity(actorFacts(w, aKey(w)), objectPhysics(pieceById(w, NODE2, POT)), 'throw');
  assert.equal(cap.verdict, 'roll', 'fixture really is borderline');
  assert.equal(cap.difficulty, 3, 'difficulty 3, fed to rollPhysicsCheck');
});

test('U699-B4a capacity FAILURE — real roll on the line, no landing, no damage, no noise', () => {
  const w = heldInR2(10);
  const r = pm(w, CAP_FAIL);
  const [roll, dc, outcome] = capOf(r);
  assert.equal(outcome, 'failure', 'the fixture deterministically FAILS the heave');
  assert.equal(+roll, 4, 'the exact capacity roll');
  assert.equal(+dc, 14, 'DC 8 + hardness 3 × 2');
  assert.match(mech(r), /capacity roll failed/, 'named honestly');
  assert.ok(!/\| no roll\b/.test(mech(r)), 'NEVER "no roll" — a d20 was really thrown');
  // resolution data carries the capacity truth, separate from accuracy semantics
  const ev = lastEv(r.world);
  assert.equal(ev.capacityCheck?.outcome, 'failure');
  assert.equal(ev.capacityCheck?.roll, 4);
  assert.equal(ev.capacityCheck?.dc, 14);
  assert.equal(ev.roll, null, 'accuracy roll stays null — the two never merge');
  // and nothing happened
  assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'held', 'still in your arms');
  assert.equal(r.world.objects?.[POT]?.durability, undefined, 'no damage');
  assert.equal(r.world.env?.noise, 0, 'a failed heave is silent');
  assert.equal(ev.deltaCount, 0, 'no deltas at all');
});

test('U699-B4b capacity MIXED — throw proceeds, roll on the line, narration shows the effort', () => {
  const w = heldInR2(10);
  const r = pm(w, CAP_MIXED);
  const [roll, , outcome] = capOf(r);
  assert.equal(outcome, 'mixed', 'the fixture deterministically lands MIXED');
  assert.equal(+roll, 13, 'the exact capacity roll');
  assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'placed', 'mixed still throws — success with effort');
  assert.match(nar(r), /everything you have/i, 'the fiction acknowledges the strain');
  assert.equal(lastEv(r.world).capacityCheck?.outcome, 'mixed');
});

test('U699-B4c capacity SUCCESS — throw proceeds, roll on the line, no strain prose', () => {
  const w = heldInR2(10);
  const r = pm(w, CAP_OK);
  const [roll, , outcome] = capOf(r);
  assert.equal(outcome, 'success', 'the fixture deterministically SUCCEEDS');
  assert.equal(+roll, 16, 'the exact capacity roll');
  assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'placed', 'it flew');
  assert.ok(!/everything you have/i.test(nar(r)), 'a clean heave reads clean');
  assert.equal(lastEv(r.world).capacityCheck?.outcome, 'success');
});

test('U699-B4d an AUTO tier throws NO capacity d20 at all', () => {
  const r = pm(heldInR2(20), CAP_OK);
  assert.equal(capOf(r).length, 0, 'no capacity roll line');
  assert.equal(lastEv(r.world).capacityCheck, undefined, 'and no capacityCheck record');
  assert.match(mech(r), /no accuracy roll/, 'a room throw invents no ACCURACY roll either');
});

test('U699-B4e the throw stream opens only AFTER a non-failing capacity check', () => {
  // a failed capacity heave must consume no throw-stream draw: the stream's first
  // value is still unspent, provable because a SUCCEEDING throw from the same
  // fixture reports exactly that stream's first draws.
  const w = heldInR2(10);
  const rFail = pm(w, CAP_FAIL);
  assert.equal(rFail.world.objects?.[POT]?.durability, undefined, 'failure drew no impact');
  assert.ok(!/impact:/.test(mech(rFail)), 'failure reports no magnitude');
  const rOk = pm(w, CAP_OK);
  assert.match(mech(rOk), /room \| no accuracy roll/, 'a room throw takes zero throw-stream draws even when capacity rolled');
});

test('U699-B5 a FIXED supported fixture is never thrown — the REAL command is refused (declared synthetic hearth)', () => {
  // DECLARED SYNTHETIC: no live supported+fixed piece exists (the stone basin is
  // procgen), so U698-C3's rename technique makes one. The setup leaves it HELD.
  const w = renamePiece(heldInR2(), POT, { name: 'hearth', kind: 'hearth', material: 'stone' });
  const cap = actorObjectCapacity(actorFacts(w, aKey(w)), objectPhysics(pieceById(w, NODE2, POT)), 'throw');
  assert.equal(cap.verdict, 'impossible', 'setup: fixed → impossible for anyone');
  assert.equal(cap.reason, 'fixed', 'setup: impossible for the FIXED reason, not for weight');
  const noiseBefore = w.env?.noise ?? 0;
  const rulingsBefore = (w.canonLog?.events || []).filter(e => e.type === 'dm.ruling').length;

  // …and now drive the actual player gesture, which is what B5 previously never did
  const r = pm(w, 'throw the hearth at the wall');
  assert.match(mech(r), /capacity:fixed/, 'the FIXED-specific refusal, named in the mechanics');
  assert.match(nar(r), /part of the place/i, 'and the fiction gives the fixed reason');
  assert.ok(!/off the ground/i.test(nar(r)), 'NOT the generic too-heavy line — the two refusals stay distinct');
  // zero PHYSICAL mutation (the deterministic resolution event below is not mutation)
  assert.equal(r.world.objects?.[POT]?.placedAt, undefined, 'no placement');
  assert.equal(r.world.objects?.[POT]?.durability, undefined, 'no damage');
  assert.equal(r.world.env?.noise ?? 0, noiseBefore, 'no noise');
  assert.equal((r.world.canonLog?.events || []).filter(e => e.type === 'dm.ruling').length, rulingsBefore, 'no dm.ruling');
  // an impossible heave costs NO draws of either kind
  assert.equal(lastEv(r.world).capacityCheck, undefined, 'no capacity roll');
  assert.equal(lastEv(r.world).roll, null, 'no accuracy roll');
  assert.equal(lastEv(r.world).deltaCount, 0, 'zero deltas');
  // it stays exactly where the declared synthetic setup left it: in the actor's arms
  assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'held', 'remains held, untouched');
});

// ══ C. range — MAX_THROW_CELLS = 4 (20 ft) ════════════════════════════════════

test('U699-C1 the range constant is the documented 20-ft product decision', () => {
  assert.equal(MAX_THROW_CELLS, 4, '4 cells × CELL_FT 5 = 20 ft');
});

test('U699-C2 ROOM landing is the farthest legal cell at EXACTLY 4 cells', () => {
  const w = heldInR2();
  const cell = legalPlaceTargetCell(w, POT, aKey(w), { kind: 'room', mode: 'throw' });
  assert.deepEqual(cell, { x: 79, y: 48 }, 'farthest-in-range, first-in-scan tie-break');
  const ap = w.party[0].pos;
  assert.equal(Math.max(Math.abs(cell.x - ap.gx), Math.abs(cell.y - ap.gy)), 4, 'exactly 4 — the cap');
});

test('U699-C3 a 5-cell room candidate is EXCLUDED (the cap is real)', () => {
  const w = heldInR2();
  const cell = legalPlaceTargetCell(w, POT, aKey(w), { kind: 'room', mode: 'throw' });
  const ap = w.party[0].pos;
  assert.ok(Math.max(Math.abs(cell.x - ap.gx), Math.abs(cell.y - ap.gy)) <= MAX_THROW_CELLS, 'never beyond 4');
  // (78,47) is legal + free + FARTHER (d=5) — the unbounded rule would have chosen it
  const blocked = liveAuthoredBlockedCells(w, w.structures.byId[S2], null);
  assert.ok(!blocked.has('78,47'), 'the 5-cell cell really is free — it is excluded by RANGE, not occupancy');
});

test('U699-C4 OBJECT target at exactly 4 cells succeeds', () => {
  const w = heldInR3(28, 50); // bed (24,52) → d=4
  const bed = authoredBaseAnchorCell(w, BED2);
  assert.deepEqual(bed, { x: 24, y: 52 }, 'fixture geometry');
  const cell = legalPlaceTargetCell(w, POT, aKey(w), { kind: 'object', mode: 'throw', objectId: BED2 });
  assert.deepEqual(cell, { x: 24, y: 51 }, 'lands adjacent to the bed');
});

test('U699-C5 OBJECT target at 5 cells REFUSES — the range gates the TARGET, not just the landing', () => {
  const w = heldInR3(29, 50); // bed (24,52) → d=5
  const cell = legalPlaceTargetCell(w, POT, aKey(w), { kind: 'object', mode: 'throw', objectId: BED2 });
  assert.equal(cell, null, 'out-of-range target → no landing at all');
  const r = pm(w, 'throw the cooking pot at the bed');
  assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'held', 'zero mutation — still in your arms');
  assert.equal(r.world.objects?.[BED2]?.durability, undefined, 'the bed took nothing');
});

test('U699-C6 WALL boundary within 4 succeeds; a side out of range refuses', () => {
  const w = heldInR2(); // actor (83,52) — only the EAST wall (x=83) is within 4
  assert.deepEqual(legalPlaceTargetCell(w, POT, aKey(w), { kind: 'wall', mode: 'throw', side: 'east' }), { x: 83, y: 48 },
    'east wall reachable, farthest-in-range');
  for (const side of ['north', 'south', 'west']) {
    assert.equal(legalPlaceTargetCell(w, POT, aKey(w), { kind: 'wall', mode: 'throw', side }), null,
      `${side} wall is >4 cells away → honest refusal`);
  }
});

test('U699-C7 a named side really filters (north wall reachable from R3)', () => {
  const w = heldInR3(36, 42); // R3 rect y41..63 → north edge y=41 is 1 away
  assert.deepEqual(legalPlaceTargetCell(w, POT, aKey(w), { kind: 'wall', mode: 'throw', side: 'north' }), { x: 32, y: 41 },
    'north = y === rect.minY (DIR_VEC: north is −y)');
});

test('U699-C8 a caller-supplied cell / range is IGNORED outright', () => {
  const w = heldInR2();
  const w2 = applyDeltas(w, [{
    op: 'placeObject', actorId: aKey(w), objectId: POT,
    ref: { kind: 'room', mode: 'throw' },
    to: { cell: { x: 66, y: 42 } },      // a legal far cell the caller WANTS
    range: 99, maxCells: 99,             // and a range it wants
  }]);
  assert.deepEqual(cellOf(w2, POT), { x: 79, y: 48 }, 'the engine-derived in-range cell wins; the caller is ignored');
});

test('U699-C9 an invalid wall side is fail-closed', () => {
  const w = heldInR2();
  assert.equal(legalPlaceTargetCell(w, POT, aKey(w), { kind: 'wall', mode: 'throw', side: 'up' }), null, 'unknown side → null');
});

// ══ D. refs — throw mode vs 6A release ════════════════════════════════════════

test('U699-D1 BARE room/wall refs remain fail-closed (U698-C6\'s law is untouched)', () => {
  const w = heldInR2();
  for (const kind of ['room', 'wall', 'door', 'nonsense']) {
    const w2 = applyDeltas(w, [{ op: 'placeObject', actorId: aKey(w), objectId: POT, ref: { kind } }]);
    assert.equal(w2.objects?.[POT]?.heldByActorId, aKey(w), `bare ${kind}: still held`);
    assert.equal(w2.objects?.[POT]?.placedAt, undefined, `bare ${kind}: no placement`);
  }
});

test('U699-D2 throw-mode refs are accepted for room/wall/object only', () => {
  const w = heldInR2();
  const wRoom = applyDeltas(w, [{ op: 'placeObject', actorId: aKey(w), objectId: POT, ref: { kind: 'room', mode: 'throw' } }]);
  assert.ok(wRoom.objects?.[POT]?.placedAt, 'room+throw lands');
  for (const kind of ['door', 'actor', 'nonsense']) {
    const w2 = applyDeltas(w, [{ op: 'placeObject', actorId: aKey(w), objectId: POT, ref: { kind, mode: 'throw' } }]);
    assert.equal(w2.objects?.[POT]?.placedAt, undefined, `${kind}+throw: rejected`);
  }
});

test('U699-D3 an unknown mode is fail-closed', () => {
  const w = heldInR2();
  const w2 = applyDeltas(w, [{ op: 'placeObject', actorId: aKey(w), objectId: POT, ref: { kind: 'actor', mode: 'teleport' } }]);
  assert.equal(w2.objects?.[POT]?.placedAt, undefined, 'unknown mode → no placement');
});

test('U699-D4 the 6A release path is byte-identical (no mode ⇒ nearest-cell)', () => {
  const w = heldInR2();
  const w2 = applyDeltas(w, [{ op: 'placeObject', actorId: aKey(w), objectId: POT, ref: { kind: 'actor' } }]);
  assert.deepEqual(cellOf(w2, POT), { x: 82, y: 51 }, '6A nearest-free-cell release unchanged');
});

test('U699-D5 mode is EPHEMERAL — never persisted into placedAt', () => {
  const w = heldInR2();
  const w2 = applyDeltas(w, [{ op: 'placeObject', actorId: aKey(w), objectId: POT, ref: { kind: 'room', mode: 'throw' } }]);
  const pa = w2.objects?.[POT]?.placedAt;
  assert.ok(pa, 'landed');
  assert.deepEqual(Object.keys(pa).sort(), ['cell', 'node', 'room', 'rot', 'structureId'], 'no mode/ref leaked into state');
});

// ══ E. RNG — draw order, counts, nat 1/20, preflight, replay ══════════════════

test('U699-E1 ROOM throw: no accuracy roll, no impact, NO damage', () => {
  const w = heldInR2();
  const r = pm(w, 'throw the cooking pot across the room');
  assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'placed', 'it landed');
  assert.match(mech(r), /no accuracy roll/, 'no accuracy roll is invented');
  assert.ok(!/impact:/.test(mech(r)), 'no impact magnitude drawn');
  assert.equal(r.world.objects?.[POT]?.durability, undefined, 'a landing is not an impact — zero damage');
});

test('U699-E2 WALL throw: no accuracy roll, exactly ONE d4 impact draw', () => {
  const w = heldInR2();
  const text = 'throw the cooking pot at the east wall';
  const rng = throwStream(w, aKey(w), POT, text);
  const expectImpact = Math.max(1, rng.int(1, 4) + mightMod(w)); // the FIRST draw is the d4
  const r = pm(w, text);
  assert.match(mech(r), /no accuracy roll/, 'walls invent no accuracy roll');
  assert.match(mech(r), new RegExp(`impact:${expectImpact}\\b`), 'the FIRST stream draw is the d4 — no hidden accuracy draw');
});

// ── The PRODUCTION throw-stream helper, driven by a counting RNG. These prove the
//    draw COUNT and ORDER of the real function playloop calls — not a copy of it.

test('U699-E2a DRAW COUNT — a room throw takes ZERO throw-stream draws', () => {
  const rng = countingRng();
  const out = drawThrowOutcome(rng, { targetClass: 'room', mightMod: 4 });
  assert.equal(rng.draws.length, 0, 'a landing is not an impact — nothing is drawn');
  assert.deepEqual(out, { rawDie: null, accuracyTotal: null, hit: null, rawImpact: 0 });
});

test('U699-E2b DRAW COUNT — a wall throw takes EXACTLY ONE d4 and no d20', () => {
  const rng = countingRng([3]);
  const out = drawThrowOutcome(rng, { targetClass: 'wall', mightMod: 4 });
  assert.equal(rng.draws.length, 1, 'exactly one draw');
  assert.deepEqual(rng.draws[0], { lo: 1, hi: 4, v: 3 }, 'and it is a d4 — no accuracy roll is invented');
  assert.equal(out.rawImpact, 7, 'd4 + MIGHT mod');
  assert.equal(out.hit, null, 'walls have no accuracy concept');
});

test('U699-E3 DRAW COUNT — an object HIT takes d20 THEN exactly one d4, in that order', () => {
  const rng = countingRng([18, 2]);
  const out = drawThrowOutcome(rng, { targetClass: 'object', mightMod: 4, targetAc: 15 });
  assert.equal(rng.draws.length, 2, 'exactly two draws');
  assert.deepEqual(rng.draws.map(d => [d.lo, d.hi]), [[1, 20], [1, 4]], 'd20 FIRST, then d4');
  assert.equal(out.hit, true);
  assert.equal(out.accuracyTotal, 22);
  assert.equal(out.rawImpact, 6, 'd4 + MIGHT mod');
});

test('U699-E4 DRAW COUNT — an object MISS takes exactly ONE d20 and NO d4', () => {
  const rng = countingRng([5]);
  const out = drawThrowOutcome(rng, { targetClass: 'object', mightMod: 4, targetAc: 15 });
  assert.equal(rng.draws.length, 1, 'exactly one draw');
  assert.deepEqual(rng.draws.map(d => [d.lo, d.hi]), [[1, 20]], 'the d20 only — a miss never draws magnitude');
  assert.equal(out.hit, false);
  assert.equal(out.rawImpact, 0);
});

test('U699-E5a PRODUCTION nat 1 misses even when the ordinary total would hit', () => {
  // raw 1 + mod 20 = 21, far past AC 5 — the ordinary total hits easily
  const rng = countingRng([1]);
  const out = drawThrowOutcome(rng, { targetClass: 'object', mightMod: 20, targetAc: 5 });
  assert.equal(out.hit, false, 'natural 1 misses regardless of bonus');
  assert.equal(rng.draws.length, 1, 'and draws no magnitude');
});

test('U699-E5b PRODUCTION nat 20 hits even when the ordinary total would miss', () => {
  // raw 20 + mod -5 = 15, well under AC 30 — the ordinary total misses
  const rng = countingRng([20, 4]);
  const out = drawThrowOutcome(rng, { targetClass: 'object', mightMod: -5, targetAc: 30 });
  assert.equal(out.hit, true, 'natural 20 hits regardless of AC');
});

test('U699-E5c a nat 20 does NOT double the impact (no crit rule, mirroring resolveObjectStrike)', () => {
  const nat20 = drawThrowOutcome(countingRng([20, 3]), { targetClass: 'object', mightMod: 4, targetAc: 10 });
  const plain = drawThrowOutcome(countingRng([15, 3]), { targetClass: 'object', mightMod: 4, targetAc: 10 });
  assert.equal(nat20.hit, true); assert.equal(plain.hit, true);
  assert.equal(nat20.rawImpact, plain.rawImpact, 'same d4 ⇒ same impact; a crit adds nothing');
  assert.equal(nat20.rawImpact, 7);
});

test('U699-E3p PRODUCTION agrees with the stream: reported atk/impact ARE its first draws', () => {
  const w = heldInR3(28, 50);
  const rng = throwStream(w, aKey(w), POT, HIT_PHRASE);
  const d20 = rng.int(1, 20), d4 = rng.int(1, 4);
  const mod = mightMod(w);
  const r = pm(w, HIT_PHRASE);
  assert.equal(atkOf(r).out, 'hit', 'the fixture deterministically HITS');
  assert.equal(atkOf(r).atk, d20 + mod, 'accuracy is the stream\'s FIRST draw + MIGHT');
  assert.equal(impOf(r), Math.max(1, d4 + mod), 'impact is the stream\'s SECOND draw + MIGHT');
});

test('U699-E4p PRODUCTION miss: one draw, no magnitude, in-range room landing, no damage', () => {
  const w = heldInR3(28, 50);
  const r = pm(w, MISS_PHRASE);
  assert.equal(atkOf(r).out, 'miss', 'the fixture deterministically MISSES');
  assert.equal(impOf(r), null, 'no magnitude drawn');
  assert.equal(r.world.objects?.[BED2]?.durability, undefined, 'a miss damages the target not at all');
  assert.equal(r.world.objects?.[POT]?.durability, undefined, 'and the projectile not at all');
  const cell = cellOf(r.world, POT);
  const ap = w.party[0].pos;
  assert.equal(Math.max(Math.abs(cell.x - ap.gx), Math.abs(cell.y - ap.gy)), 4, 'it lands by the ROOM rule, in range');
  assert.equal(r.world.env?.noise, THROW_NOISE.landing, 'landing noise, not impact noise');
});

test('U699-E6 PREFLIGHT consumes nothing: an out-of-range throw mutates NOTHING', () => {
  const w = heldInR3(29, 50); // bed at Chebyshev 5 — out of range
  const r = pm(w, 'throw the cooking pot at the bed');
  assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'held', 'refused');
  assert.deepEqual(r.world.objects?.[POT], w.objects?.[POT], 'the projectile overlay is untouched');
  assert.equal(r.world.objects?.[BED2]?.durability, undefined, 'the target took nothing');
  assert.equal(r.world.env?.noise, 0, 'and it was silent');
  assert.equal(lastEv(r.world).deltaCount, 0, 'zero deltas');
  assert.equal(lastEv(r.world).capacityCheck, undefined, 'MIGHT 20 is auto — no capacity d20 either');
});

test('U699-E7 replay ×2 — the same script yields an identical worldHash', () => {
  const script = ['take the cooking pot', 'throw the cooking pot at the east wall'];
  const run = () => { let w = might(boot2(), 20); for (const s of script) w = pm(w, s).world; return worldHash(w); };
  assert.equal(run(), run(), 'deterministic replay');
});

// ══ F. weapon independence (Basecamp ruling 3 canary) ═════════════════════════

test('U699-F1 same MIGHT + radically different weapons ⇒ IDENTICAL throw', () => {
  const base = heldInR3(28, 50);
  const text = 'throw the cooking pot at the bed';
  const blade = withWeapons(base, [{ name: 'Worn Blade', tags: ['blade'] }]);
  const hatchet = withWeapons(base, [{ name: 'Hatchet', tags: ['axe'] }]);
  const bare = withWeapons(base, []);
  const rB = pm(blade, text), rH = pm(hatchet, text), rN = pm(bare, text);
  const atkOf = (r) => (mech(r).match(/atk:(-?\d+)/) || [])[1];
  const impOf = (r) => (mech(r).match(/impact:(\d+)/) || [])[1];
  assert.equal(atkOf(rB), atkOf(rH), 'Worn Blade vs Hatchet: identical accuracy');
  assert.equal(atkOf(rB), atkOf(rN), 'weapon vs NO weapon: identical accuracy');
  assert.equal(impOf(rB), impOf(rH), 'identical impact');
  assert.equal(impOf(rB), impOf(rN), 'identical impact with empty hands');
  assert.ok(!/Worn Blade|Hatchet/.test(mech(rB)), 'the equipped weapon is never named in an environmental throw');
});

test('U699-F2 MIGHT moves accuracy by exactly its stat mod — same seed, same die', () => {
  // an OBJECT target, so accuracy is real. The seed does not include MIGHT, so the
  // d20 is identical across these worlds and the ONLY mover is the stat mod.
  const a = heldInR3(28, 50, 12), b = heldInR3(28, 50, 20);
  const ra = pm(a, MISS_PHRASE), rb = pm(b, MISS_PHRASE);
  const modA = mightMod(a), modB = mightMod(b);
  assert.equal(modA, 1); assert.equal(modB, 5);
  assert.equal(atkOf(ra).atk, 10, 'MIGHT 12 → d20 9 + 1');
  assert.equal(atkOf(rb).atk, 14, 'MIGHT 20 → the SAME d20 9 + 5');
  assert.equal(atkOf(rb).atk - atkOf(ra).atk, modB - modA, 'accuracy moves by exactly the stat-mod delta');
});

test('U699-F2b MIGHT flips the OUTCOME against a real target, and moves impact', () => {
  // a cloth bed is AC 11: d20 9 + MIGHT 12's +1 = 10 misses; + MIGHT 20's +5 = 14 hits.
  const soft = (m) => renamePiece(heldInR3(28, 50, m), BED2, { material: 'cloth' });
  const rLow = pm(soft(12), MISS_PHRASE);
  const rHigh = pm(soft(20), MISS_PHRASE);
  assert.deepEqual(atkOf(rLow), { atk: 10, ac: 11, out: 'miss' }, 'weak arm misses');
  assert.deepEqual(atkOf(rHigh), { atk: 14, ac: 11, out: 'hit' }, 'strong arm hits');
  assert.equal(impOf(rLow), null, 'the miss draws no magnitude');
  assert.equal(impOf(rHigh), 7, 'and the hit\'s impact carries the MIGHT mod (d4 2 + 5)');
});

// ══ G. impact — the two-sided threshold filter ════════════════════════════════

test('U699-G1 filterImpact is 5e ABSORB semantics, not subtract', () => {
  assert.equal(filterImpact(5, 8), 0, 'below threshold → absorbed to 0 (NOT 5-8)');
  assert.equal(filterImpact(8, 8), 8, 'at threshold → FULL damage (not 0)');
  assert.equal(filterImpact(9, 3), 9, 'above threshold → full, never reduced');
});

test('U699-G2 ONE magnitude, filtered independently per side — equal raw ≠ equal damage', () => {
  const raw = 5;
  const iron = initialDurability('cookpot', 'iron');   // thr 8
  const wood = initialDurability('bed', 'wood');       // thr 3
  assert.equal(iron.threshold, 8, 'live iron threshold');
  assert.equal(wood.threshold, 3, 'live wood threshold');
  assert.equal(filterImpact(raw, wood.threshold), 5, 'the wooden bed takes it');
  assert.equal(filterImpact(raw, iron.threshold), 0, 'the iron pot shrugs the SAME raw impact off');
});

test('U699-G3 the hard/soft surface law', () => {
  for (const m of ['wood', 'iron', 'stone', 'glass', 'bone']) assert.equal(isHardSurface(m), true, `${m} is hard`);
  for (const m of ['cloth', 'web', 'wax']) assert.equal(isHardSurface(m), false, `${m} is soft`);
  assert.equal(isHardSurface('unknown'), false, 'the durability FALLBACK material fails closed');
});

test('U699-G4 a SOFT target IS hurt, and gives the projectile nothing back', () => {
  // cloth bed (ac 11, maxHp 6, thr 0). MIGHT 14 deterministically hits it for 4 —
  // chosen so the target SURVIVES, making the exact decrement observable rather
  // than clamped at 0.
  const w = renamePiece(heldInR3(28, 50, 14), BED2, { material: 'cloth' });
  const cloth = initialDurability('bed', 'cloth');
  assert.equal(cloth.maxHp, 6);
  assert.equal(isHardSurface('cloth'), false, 'cloth really is soft');
  const r = pm(w, MISS_PHRASE);
  assert.deepEqual(atkOf(r), { atk: 11, ac: 11, out: 'hit' }, 'the fixture deterministically HITS');
  const imp = impOf(r);
  assert.equal(imp, 4, 'exact magnitude');
  const after = r.world.objects?.[BED2]?.durability;
  assert.equal(after.hp, cloth.maxHp - imp, 'the target lost EXACTLY the filtered damage (6 − 4)');
  assert.equal(after.hp, 2);
  assert.equal(after.material, 'cloth');
  assert.equal(r.world.objects?.[POT]?.durability, undefined, 'soft surface ⇒ the pot takes NO self-impact at all');
  assert.match(mech(r), /self dmg:none \(cloth surface\)/, 'and says so honestly');
});

test('U699-G5 live durability is the authority — a damaged target decrements, never resets', () => {
  let w = heldInR3(28, 50);
  w = applyDeltas(w, [{ op: 'damageObject', objectId: BED2, damage: 4 }]);
  const before = w.objects?.[BED2]?.durability;
  assert.equal(before.hp, 11, 'setup: the wooden bed is at 11/15');
  const r = pm(w, HIT_PHRASE);
  assert.equal(atkOf(r).out, 'hit', 'the fixture deterministically HITS');
  const imp = impOf(r);
  assert.equal(imp, 9, 'exact magnitude');
  const after = r.world.objects?.[BED2]?.durability;
  assert.equal(after.hp, before.hp - imp, 'EXACT decrement from the LIVE hp — not from maxHp');
  assert.equal(after.hp, 2);
  assert.equal(after.maxHp, before.maxHp, 'maxHp preserved');
  assert.equal(after.ac, before.ac, 'AC preserved');
  assert.equal(after.threshold, before.threshold, 'threshold preserved');
  assert.equal(after.material, 'wood');
});

// ══ H. wall material — the ONE canonical authority ════════════════════════════

test('U699-H1 LIVE: an authored building reads timber → wood', () => {
  const w = heldInR2();
  assert.equal(structureMaterial(w, S2).family, 'timber', 'the whole live authored domain is timber');
  assert.equal(wallPhysicalMaterial('timber'), 'wood', 'timber → wood');
  assert.equal(isHardSurface('wood'), true, 'and wood is a hard surface');
});

test('U699-H2 SYNTHETIC: a stone family reads stone (authored exports cannot reach this today)', () => {
  const w = setBuildingType(heldInR2(), 'chapel');
  assert.equal(structureMaterial(w, S2).family, 'stone', 'declared synthetic buildingType');
  assert.equal(wallPhysicalMaterial('stone'), 'stone', 'stone → stone');
});

test('U699-H3 an unexpected family FAILS CLOSED — never the durability fallback', () => {
  assert.equal(wallPhysicalMaterial('open'), null, 'market/open → fail closed');
  assert.equal(wallPhysicalMaterial('chitin'), null, 'hive/chitin → fail closed');
  assert.equal(wallPhysicalMaterial(null), null, 'absent → fail closed');
});

test('U699-H4 a fail-closed wall gives the projectile NO self-damage', () => {
  const w = setBuildingType(heldInR2(), 'hive');
  const r = pm(w, 'throw the cooking pot at the east wall');
  assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'placed', 'it still lands');
  assert.equal(r.world.objects?.[POT]?.durability, undefined, 'unknown family ⇒ no self-impact');
});

test('U699-H5 NO WALL HP — the wall is only the impact surface', () => {
  const w = heldInR2();
  const r = pm(w, 'throw the cooking pot at the east wall');
  const objs = r.world.objects || {};
  for (const oid of Object.keys(objs)) {
    assert.ok(!/wall/i.test(oid), `no wall pseudo-object was minted (${oid})`);
  }
});

// ══ I. landing ═══════════════════════════════════════════════════════════════

test('U699-I1 no legal in-range cell ⇒ no mutation, still held', () => {
  // box the actor in: fill every in-range free cell of R2 with blockers is impractical;
  // instead prove the writer's contract directly with an unreachable side
  const w = heldInR2();
  const w2 = applyDeltas(w, [{ op: 'placeObject', actorId: aKey(w), objectId: POT, ref: { kind: 'wall', mode: 'throw', side: 'west' } }]);
  assert.equal(w2.objects?.[POT]?.heldByActorId, aKey(w), 'no cell → it stays in your arms');
  assert.equal(w2.objects?.[POT]?.placedAt, undefined, 'no placement written');
});

test('U699-I2 LANDING-FIRST: the throw WRECKS the target and the projectile still lands', () => {
  let w = heldInR3(28, 50);
  w = applyDeltas(w, [{ op: 'damageObject', objectId: BED2, damage: 14 }]);
  assert.equal(w.objects?.[BED2]?.durability?.hp, 1, 'setup: bed at 1 HP');
  const r = pm(w, HIT_PHRASE);
  assert.equal(atkOf(r).out, 'hit', 'the fixture deterministically HITS');
  // the target really is wrecked — not merely "damaged somewhat"
  assert.equal(r.world.objects?.[BED2]?.durability?.hp, 0, 'target driven to 0 HP');
  assert.equal(pieceById(r.world, NODE2, BED2)?.state, 'wrecked', 'and mirrored to the terminal wrecked state');
  // …and the projectile is NOT stranded: this is the whole reason landing goes first
  assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'placed', 'the projectile LANDED');
  assert.equal(heldObjectOf(r.world, aKey(r.world)), null, 'arms clear');
  // the wrecked target frees its cell; the landed projectile keeps its own
  const blocked = liveAuthoredBlockedCells(r.world, r.world.structures.byId[S2], null);
  assert.ok(!blocked.has('24,52'), 'wreckage blocks nothing');
  assert.ok(blocked.has(key(cellOf(r.world, POT))), 'the landed projectile does');
});

test('U699-I3 a landed-then-wrecked projectile blocks nothing', () => {
  let w = heldInR2();
  const r = pm(w, 'throw the cooking pot at the east wall');
  const cell = cellOf(r.world, POT);
  assert.ok(cell, 'it landed');
  let w2 = applyDeltas(r.world, [{ op: 'damageObject', objectId: POT, damage: 99 }]);
  assert.equal(pieceById(w2, NODE2, POT)?.state, 'wrecked', 'wrecked');
  const blocked = liveAuthoredBlockedCells(w2, w2.structures.byId[S2], null);
  assert.ok(!blocked.has(key(cell)), 'wreckage frees its landing cell');
});

// ══ J. room truth after landing ══════════════════════════════════════════════

test('U699-J1 identity + room truth survive the landing; it is immediately live', () => {
  const w = heldInR2();
  const r = pm(w, 'throw the cooking pot across the room');
  const p = resolvedObjectPlacement(r.world, POT);
  assert.equal(p.status, 'placed');
  assert.equal(p.room, R2, 'it is in the room it landed in');
  assert.ok(hereNames(r.world).some(n => /cooking pot/i.test(n)), 'on the floor list of its live room');
});

test('U699-J1a RETAKE at the landing cell resolves the same objectId', () => {
  const landed = pm(heldInR2(), 'throw the cooking pot across the room').world;
  const r = pm(landed, 'take the cooking pot');
  assert.equal(r.world.objects?.[POT]?.heldByActorId, aKey(landed), 'immediately retakeable');
  assert.ok(!toolsNames(r.world).some(n => /cooking pot/i.test(n)), 'never minted as a pack item');
});

test('U699-J1b INSPECT at the landing cell resolves the same objectId', () => {
  const landed = pm(heldInR2(), 'throw the cooking pot across the room').world;
  const r = pm(landed, 'examine the cooking pot');
  assert.match(nar(r), /cooking pot/i, 'the DM can see it where it landed');
  assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'placed', 'inspecting moves nothing');
});

test('U699-J1c ATTACK at the landing cell resolves against the same objectId', () => {
  const landed = pm(heldInR2(), 'throw the cooking pot across the room').world;
  const r = pm(landed, 'attack the cooking pot with my hatchet');
  assert.match(mech(r), new RegExp(`object-strike:${POT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    'the existing strike seam resolves THIS objectId at its landing cell');
});

test('U699-J1d DRAG at the landing cell drives the LIVE physics/move seam — the same object moves again', () => {
  // The old J1d only called legalMoveTargetCell directly, so it could not prove
  // routing, capacity, moveObject, narration or mutation. Drive the real command.
  const landed = pm(heldInR2(), 'throw the cooking pot across the room').world;
  const from = cellOf(landed, POT);
  assert.ok(from, 'setup: the throw landed');
  assert.equal(resolvedObjectPlacement(landed, POT).room, R2, 'setup: landed in the live room');
  const durBefore = durOf(landed, POT);
  const furnBefore = nodeFurn(landed, NODE2).length;
  // derive the expected drag target BEFORE dragging — the engine's own move rule
  const expected = legalMoveTargetCell(landed, POT, aKey(landed));
  assert.ok(expected, 'a drag target resolves from the LIVE placement');
  assert.notDeepEqual(expected, from, 'and it is a genuinely different cell');
  assert.ok(liveAuthoredBlockedCells(landed, structOf(landed)).has(key(from)),
    'setup: while intact, the pot blocks the cell it landed in');

  const r = pm(landed, 'drag the cooking pot aside');
  // the EXISTING physics/move seam owns it — positively pinned, not "not object-throw"
  assert.match(mech(r), /\[physics:cooking pot \| deltas:\d+/, 'the pre-existing physics/move seam owns the drag');
  assert.ok(!/object-throw/.test(mech(r)), 'the throw seam does not claim a drag');
  assert.match(nar(r), /drag the cooking pot/i, 'and it narrates the drag');
  // the SAME canonical objectId moved from the throw cell to the exact derived cell
  const after = resolvedObjectPlacement(r.world, POT);
  assert.equal(after.status, 'placed', 'still placed');
  assert.deepEqual(after.cell, expected, 'the same objectId moved to the exact derived drag cell');
  assert.notDeepEqual(after.cell, from, 'it really left the throw cell');
  // the old cell frees, the new cell blocks while the object is intact
  const blocked = liveAuthoredBlockedCells(r.world, structOf(r.world));
  assert.ok(!blocked.has(key(from)), 'the old cell is free again');
  assert.ok(blocked.has(key(expected)), 'the new cell blocks while intact');
  // identity + durability survive; nothing is duplicated or re-minted as a pack item
  assert.deepEqual(durOf(r.world, POT), durBefore, 'durability survives the drag untouched');
  assert.equal(nodeFurn(r.world, NODE2).length, furnBefore, 'no duplicate furniture was created');
  assert.equal(nodeFurn(r.world, NODE2).filter(f => String(f.objectId || '') === POT).length, 1, 'still exactly ONE pot piece');
  assert.ok(!toolsNames(r.world).some(n => /cooking pot/i.test(n)), 'never minted as a generic inventory item');
  assert.equal(after.room, R2, 'and it is still in the correct live room');
});

test('U699-J2 durability + objectId are the SAME object after the throw', () => {
  let w = heldInR2();
  w = applyDeltas(w, [{ op: 'damageObject', objectId: POT, damage: 9 }]);
  const hpBefore = w.objects?.[POT]?.durability?.hp;
  const r = pm(w, 'throw the cooking pot across the room');
  assert.equal(r.world.objects?.[POT]?.durability?.hp, hpBefore, 'a room landing is not an impact — HP unchanged');
  assert.ok(pieceById(r.world, NODE2, POT), 'same canonical piece, same objectId');
  assert.ok(!toolsNames(r.world).some(n => /cooking pot/i.test(n)), 'never minted as a pack item');
});

// ══ K. ordinals ══════════════════════════════════════════════════════════════

test('U699-K1 two same-named supported pieces in ONE room, built by live play', () => {
  // rename the bed to a second "cooking pot", carry the real pot to R3 and drop it
  let w = renamePiece(might(boot2(), 20), BED2, { name: 'cooking pot' });
  w = pm(w, 'take the cooking pot').world;
  w = moveWithinInterior(moveWithinInterior(w, R1), R3);
  w = pm(w, 'set the cooking pot down').world;
  const pots = objectsHere(w).filter(o => /cooking pot/i.test(String(o.piece.name)));
  assert.equal(pots.length, 2, 'two same-named supported pieces share this room');
});

test('U699-K2 an INVALID ordinal fails honestly and never clamps — zero PHYSICAL mutation', () => {
  const w = heldInR3(28, 50);
  const r = pm(w, 'throw the cooking pot at the ninth bed');
  assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'held', 'no target → no throw, no physical change');
  assert.equal(r.world.objects?.[BED2]?.durability, undefined, 'it never clamped onto the only bed');
  assert.equal(r.world.env?.noise, 0, 'and it was silent');
});

// ── Ordinal law (Basecamp correction 2B) ─────────────────────────────────────
// The candidate order is: floor pieces in canonical node order, THEN the held
// object. A bare name keeps the held-first convenience; an explicit ordinal must
// index the full list instead of being shortcut past it.

// held pot (R2) + a same-named floor pot (the renamed R3 bed), standing in R3
const heldPlusFloorTwin = () => {
  let w = renamePiece(might(boot2(), 20), BED2, { name: 'cooking pot' });
  w = pm(w, 'take the cooking pot').world;                       // takes the R2 pot
  return at(moveWithinInterior(moveWithinInterior(w, R1), R3), 28, 50);
};

test('U699-K3 held + same-named floor twin: a BARE name keeps the held-first convenience', () => {
  const w = heldPlusFloorTwin();
  assert.equal(heldObjectOf(w, aKey(w))?.objectId, POT, 'setup: the R2 pot is held');
  const r = pm(w, 'throw the cooking pot at the wall');
  // the held one is the projectile — it is the one that moves
  assert.equal(mech(r).includes(POT), true, 'the HELD pot is the projectile for a bare name');
});

test('U699-K4 an EXPLICIT ordinal indexes the full list — "first" is the FLOOR twin, not the held one', () => {
  const w = heldPlusFloorTwin();
  const r = pm(w, 'throw the first cooking pot at the wall');
  assert.ok(mech(r).includes(BED2), 'the ordinal resolved the FLOOR object (candidate 0)');
  assert.ok(!mech(r).includes(POT), 'the held-object shortcut did NOT replace it');
  // and because hands are full, it refuses honestly rather than throwing the held one
  assert.match(mech(r), /hands full/, 'honest refusal, not a silent swap');
  assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'held', 'the held pot never moved');
  assert.equal(resolvedObjectPlacement(r.world, BED2)?.status, 'base', 'the floor twin never moved');
  assert.equal(r.world.env?.noise, 0, 'zero noise');
});

test('U699-K5 "second" resolves the OTHER candidate — the two ordinals are distinct', () => {
  const w = heldPlusFloorTwin();
  const rFirst = pm(w, 'throw the first cooking pot at the wall');
  const rSecond = pm(w, 'throw the second cooking pot at the wall');
  const idOf = (r) => (mech(r).match(/object-throw:([^\s|→]+)/) || [])[1];
  assert.equal(idOf(rFirst), BED2, 'first → the floor twin');
  assert.equal(idOf(rSecond), POT, 'second → the held pot');
  assert.notEqual(idOf(rFirst), idOf(rSecond), 'first and second are NOT the same object');
});

// two same-named pots on the floor, hands EMPTY — a valid second projectile
const twoFloorTwins = () => {
  let w = renamePiece(might(boot2(), 20), BED2, { name: 'cooking pot' });
  w = pm(w, 'take the cooking pot').world;                       // R2 pot into arms
  w = moveWithinInterior(moveWithinInterior(w, R1), R3);
  w = at(w, 30, 52);
  return pm(w, 'set the cooking pot down').world;                // both now on R3's floor
};

test('U699-K6 all-floor twins: an explicit SECOND projectile really throws the second one', () => {
  const w = at(twoFloorTwins(), 27, 52);
  const pots = objectsHere(w).filter(o => /cooking pot/i.test(String(o.piece.name)));
  assert.equal(pots.length, 2, 'setup: two same-named supported pots share this room');
  const ids = pots.map(o => String(o.piece.objectId));
  const r = pm(w, 'throw the second cooking pot across the room');
  const thrown = (mech(r).match(/object-throw:([^\s|→]+)/) || [])[1];
  assert.equal(thrown, ids[1], 'the SECOND candidate in canonical order is the projectile');
  assert.equal(resolvedObjectPlacement(r.world, ids[1])?.status, 'placed', 'and it actually moved');
  assert.equal(resolvedObjectPlacement(r.world, ids[0])?.status, 'base', 'the FIRST one never moved — exact mutation isolation');
});

test('U699-K7 default (no ordinal) is the FIRST candidate, symmetric with "first"', () => {
  const w = at(twoFloorTwins(), 27, 52);
  const ids = objectsHere(w).filter(o => /cooking pot/i.test(String(o.piece.name))).map(o => String(o.piece.objectId));
  const idOf = (r) => (mech(r).match(/object-throw:([^\s|→]+)/) || [])[1];
  assert.equal(idOf(pm(w, 'throw the cooking pot across the room')), ids[0], 'bare name → first');
  assert.equal(idOf(pm(w, 'throw the first cooking pot across the room')), ids[0], '"first" agrees');
});

// ── The independent-ordinal fixture (DECLARED SYNTHETIC) ─────────────────────
// The live authored cottage carries exactly TWO supported objects (the R2 pot and
// the R3 bed — probe-verified), so a real isolation proof is impossible on the boot
// fixture: with only two objects, naming one as projectile and one as target leaves
// no NON-selected twin to hold still. So this fixture declares two extra plan pieces.
//
// It extends the structure's OWN authoredPlan (floorPlan returns structure.authoredPlan
// verbatim, floorPlan.js:120) with real, distinct pieceIds, and adds the matching node
// furniture. Every synthetic piece therefore has a distinct pieceId, a distinct
// objectId, and a distinct base anchor — no shared identity, no stacked cells. The R2
// pot is renamed 'kettle' so that the only 'cooking pot' candidates are the twins.
//
// Result (probe-verified anchors): R3 holds
//   bed  #a0 @24,52   cooking pot #a1 @21,47   cooking pot #a2 @24,47   bed #a3 @28,47
const K_POT_A = `au:${S2}:${R3}#a1`, K_POT_B = `au:${S2}:${R3}#a2`, K_BED_B = `au:${S2}:${R3}#a3`;

const addPlanPiece = (w, { suffix, protoId, kind, label, name, material, fx, fy, shape, uw, uh, r }) => {
  const pieceId = `${R3}#${suffix}`;
  const st = structOf(w);
  const rooms = st.authoredPlan.rooms.map(rm => String(rm.id) === R3
    ? { ...rm, furniture: [...rm.furniture, { id: pieceId, kind, label, shape, material, light: 0, cover: null, loot: 0, flat: 0, fx, fy, w: uw, h: uh, r, authored: 1 }] }
    : rm);
  const proto = nodeFurn(w, NODE2).find(f => String(f.objectId || '') === protoId);
  const piece = { ...proto, name, kind, material, objectId: `au:${S2}:${pieceId}`, pieceId, roomId: R3, structureId: S2, authored: true };
  return {
    ...w,
    structures: { ...w.structures, byId: { ...w.structures.byId, [S2]: { ...st, authoredPlan: { ...st.authoredPlan, rooms } } } },
    map: { ...w.map, nodes: w.map.nodes.map(n => n.id === NODE2 ? { ...n, furniture: [...n.furniture, piece] } : n) },
  };
};

const ordinalTwins = () => {
  let w = renamePiece(might(boot2(), 20), POT, { name: 'kettle' });
  w = addPlanPiece(w, { suffix: 'a1', protoId: POT, kind: 'cookpot', label: 'cooking pot', name: 'cooking pot', material: 'iron', fx: 0.20, fy: 0.30, shape: 'circle', uw: 0, uh: 0, r: 0.05 });
  w = addPlanPiece(w, { suffix: 'a2', protoId: POT, kind: 'cookpot', label: 'cooking pot', name: 'cooking pot', material: 'iron', fx: 0.35, fy: 0.30, shape: 'circle', uw: 0, uh: 0, r: 0.05 });
  w = addPlanPiece(w, { suffix: 'a3', protoId: BED2, kind: 'bed', label: 'bed', name: 'bed', material: 'wood', fx: 0.50, fy: 0.30, shape: 'bed', uw: 0.2, uh: 0.2, r: 0 });
  return at(moveWithinInterior(moveWithinInterior(w, R1), R3), 26, 48);
};

test('U699-K8 INDEPENDENT ORDINALS — a real HIT moves the named projectile, wounds only the named target, and leaves both twins byte-unchanged', () => {
  const w = ordinalTwins();
  // setup: two same-named PROJECTILE candidates and two same-named TARGET candidates
  const potIds = objectsHere(w).filter(o => /^cooking pot$/i.test(String(o.piece.name))).map(o => String(o.piece.objectId));
  const bedIds = objectsHere(w).filter(o => /^bed$/i.test(String(o.piece.name))).map(o => String(o.piece.objectId));
  assert.deepEqual(potIds, [K_POT_A, K_POT_B], 'setup: exactly two same-named cooking pots, in canonical order');
  assert.deepEqual(bedIds, [BED2, K_BED_B], 'setup: exactly two same-named beds, in canonical order');
  const potABefore = resolvedObjectPlacement(w, K_POT_A);
  const bed2Before = resolvedObjectPlacement(w, BED2);

  // a NON-DEFAULT projectile ordinal and a SEPARATELY chosen target ordinal, through
  // a phrase probe-verified to HIT deterministically (atk 24 vs AC 15)
  const r = pm(w, 'hurl the second cooking pot at the second bed');
  assert.match(mech(r), /atk:24 vs AC:15 → hit/, 'the fixture deterministically HITS — no branchless "hit or miss" assertion');

  // IDENTITY — asserted on the resolution EVENT, not merely scraped from the string
  const ev = lastEv(r.world);
  assert.equal(ev.objectId, K_POT_B, 'the resolution event names the SECOND pot as projectile');
  assert.equal(ev.targetObjectId, K_BED_B, 'and the SECOND bed as target — a separately chosen ordinal');
  assert.notEqual(ev.objectId, ev.targetObjectId, 'the two ordinals resolved independently');

  // the SELECTED projectile really moved, to the exact landing the mechanics reported
  assert.deepEqual(cellOf(r.world, K_POT_B), { x: 27, y: 46 }, 'the selected projectile moved to its exact landing cell');
  assert.equal(resolvedObjectPlacement(r.world, K_POT_B).status, 'placed', 'and it is placed');
  assert.match(mech(r), /landing:27,46/, 'the reported landing IS the state');

  // only the SELECTED target took the exact threshold-filtered damage (wood thr 3)
  assert.deepEqual(durOf(r.world, K_BED_B), { material: 'wood', ac: 15, maxHp: 15, hp: 6, threshold: 3 },
    'the selected bed took exactly 9 filtered through threshold 3 → 15-9 = 6');
  // reciprocal self-damage, because wood IS a hard surface (iron pot, threshold 8)
  assert.deepEqual(durOf(r.world, K_POT_B), { material: 'iron', ac: 19, maxHp: 30, hp: 21, threshold: 8 },
    'the projectile took the expected reciprocal 9 off a HARD surface → 30-9 = 21');
  assert.match(mech(r), /self dmg:9 vs thr:8/, 'and the reciprocal damage rides the mechanics line');

  // MUTATION ISOLATION — every non-selected twin is byte-unchanged
  assert.deepEqual(resolvedObjectPlacement(r.world, K_POT_A), potABefore, 'the UNselected pot twin never moved');
  assert.equal(durOf(r.world, K_POT_A), undefined, 'and took no damage — no durability record was even minted');
  assert.deepEqual(resolvedObjectPlacement(r.world, BED2), bed2Before, 'the UNselected bed twin never moved');
  assert.equal(durOf(r.world, BED2), undefined, 'and took no damage');
});

test('U699-K8a INDEPENDENT ORDINALS — the identity/placement case on a deterministic MISS', () => {
  // kept as a separate case (the acceptance proof above is the HIT): a miss must still
  // resolve the two ordinals independently and land by the room rule.
  const w = ordinalTwins();
  const r = pm(w, 'throw the second cooking pot at the second bed');
  assert.match(mech(r), /atk:9 vs AC:15 → miss/, 'the fixture deterministically MISSES');
  const ev = lastEv(r.world);
  assert.equal(ev.objectId, K_POT_B, 'projectile ordinal → the SECOND pot');
  assert.equal(ev.targetObjectId, K_BED_B, 'target ordinal → the SECOND bed');
  assert.equal(resolvedObjectPlacement(r.world, K_POT_B).status, 'placed', 'a miss still lands by the room rule');
  assert.equal(durOf(r.world, K_BED_B), undefined, 'a miss damages NOTHING');
  assert.equal(durOf(r.world, K_POT_A), undefined, 'and the twins are untouched');
  assert.equal(durOf(r.world, BED2), undefined, 'both of them');
});

test('U699-K9 hasExplicitOrdinal is the discriminator the law turns on', () => {
  assert.equal(hasExplicitOrdinal('throw the cooking pot'), false, 'a bare name');
  assert.equal(hasExplicitOrdinal('throw it at the bed'), false, 'a pronoun');
  assert.equal(hasExplicitOrdinal('throw the second cooking pot'), true, 'an ordinal word');
  assert.equal(hasExplicitOrdinal('throw the 2nd cooking pot'), true, 'a numeric ordinal');
});

// ══ L. parser canaries ═══════════════════════════════════════════════════════

test('U699-L1 "throw it at the bed" resolves the ONE object in your arms', () => {
  const w = heldInR3(28, 50);
  const r = pm(w, 'throw it at the bed');
  assert.match(mech(r), /object-throw/, 'the pronoun resolves to the held pot');
  assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'placed', 'it flew');
});

test('U699-L2 an object whose NAME contains "wall" resolves as an OBJECT first', () => {
  const w = renamePiece(heldInR3(28, 50), BED2, { name: 'wall shelf' });
  const r = pm(w, 'throw the cooking pot at the wall shelf');
  assert.match(mech(r), /object-throw/, 'claimed by the throw seam');
  assert.ok(mech(r).includes(BED2), 'the OBJECT is the target');
  assert.ok(!/\| wall \|/.test(mech(r)), 'classified as an OBJECT target, not the generic wall');
});

test('U699-L2a REGRESSION — "wall shelf" thrown at ITSELF refuses; it never becomes a wall throw', () => {
  // the object-before-wall rule must fire even when the only object candidate IS
  // the projectile: otherwise "at the wall shelf" silently degrades to the generic
  // wall and the engine hurls the held object at a wall the player never named.
  const w = pm(might(renamePiece(boot2(), POT, { name: 'wall shelf' }), 20), 'take the wall shelf').world;
  assert.equal(heldObjectOf(w, aKey(w))?.objectId, POT, 'setup: the wall shelf is held');
  const r = pm(w, 'throw the wall shelf at the wall shelf');
  assert.match(mech(r), /self-target/, 'refused as a self-target');
  assert.ok(!/\| wall \|/.test(mech(r)), 'NOT reinterpreted as a generic wall throw');
  assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'held', 'still in your arms');
  assert.equal(r.world.objects?.[POT]?.durability, undefined, 'zero damage');
  assert.equal(r.world.env?.noise, 0, 'zero noise');
  assert.equal(lastEv(r.world).deltaCount, 0, 'zero deltas');
  assert.equal(lastEv(r.world).capacityCheck, undefined, 'no capacity roll');
  assert.equal(lastEv(r.world).roll, null, 'no accuracy roll');
});

test('U699-L3a NON-PROPULSIVE handling idioms are declined — the object stays held', () => {
  // The APPROVED handling idioms, and the complete list of them: a throw verb used for
  // a way of HOLDING something. Nothing leaves the actor.
  const w = heldInR2();
  for (const t of ['sling the cooking pot over my shoulder', 'toss the cooking pot from hand to hand']) {
    const r = pm(w, t);
    assert.ok(!/object-throw/.test(mech(r)), `"${t}" must not be claimed by the throw gate`);
    assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'held', `"${t}" leaves it in your arms`);
    assert.equal(heldObjectOf(r.world, aKey(r.world))?.objectId, POT, `"${t}" — still literally in hand`);
    // no PHYSICAL throw mutation of any kind
    assert.equal(durOf(r.world, POT), undefined, `"${t}" damages nothing`);
    assert.equal(r.world.objects?.[POT]?.placedAt, undefined, `"${t}" places nothing`);
    // the overlay already exists (the take put it there) — the point is that this
    // command leaves it byte-identical
    assert.deepEqual(r.world.objects?.[POT], w.objects?.[POT], `"${t}" leaves the object overlay byte-identical`);
    assert.equal(lastEv(r.world).updateKind, undefined, `"${t}" records no object-throw resolution`);
    // NOTE (measured, not assumed): env.noise DOES move here — the generic skill floor
    // that owns these utterances raises it. That is the other seam's business, not a
    // throw mutation, so asserting silence would be asserting someone else's contract.
  }
});

test('U699-L3c REGRESSION — a genuine over-shoulder THROW is PROPULSION, not handling', () => {
  // The first cut of CARRY_OVER_SHOULDER_RE also swallowed throw/toss/hoist/heave
  // "over my shoulder". Those are real throws — you are letting go of the thing behind
  // you. The guard declined them, and they leaked to the generic WITS floor, which
  // narrated an unrelated shoulder/door struggle ("You throw your weight against the
  // shoulder…") while the pot stayed in the actor's arms. Only the SLING family is the
  // handling idiom. This test fails on every verb below under the old guard.
  const w = heldInR2();
  const roomLanding = cellOf(pm(w, 'throw the cooking pot across the room').world, POT);
  for (const t of ['throw the cooking pot over my shoulder', 'toss the cooking pot over my shoulder', 'hurl the cooking pot over my shoulder']) {
    assert.equal(isThrowIdiom(t), false, `"${t}" is propulsion, not a handling idiom`);
    const r = pm(w, t);
    assert.match(mech(r), /object-throw/, `"${t}" is owned by the throw seam`);
    assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'placed', `"${t}" really leaves the hands`);
    assert.equal(heldObjectOf(r.world, aKey(r.world)), null, `"${t}" — the hands are empty afterwards`);
    // it lands through the NORMAL room rule — the same landing an untargeted heave takes
    assert.match(mech(r), /\| room \| no accuracy roll/, `"${t}" resolves as an untargeted room throw`);
    assert.deepEqual(cellOf(r.world, POT), roomLanding, `"${t}" lands by the ordinary room rule, unchanged`);
  }
  // …and the shoulder idiom that IS someone else's stays someone else's: there the
  // shoulder is the projectile, not the destination (THROW_WEIGHT_RE).
  assert.equal(isThrowIdiom('throw my weight against the door'), true, 'the weight idiom still bails');
  assert.equal(isThrowIdiom('throw my shoulder against the door'), true, 'shoulder-as-projectile still bails');
});

test('U699-L3b …but a REAL sling/toss throw still works (the guard stays narrow)', () => {
  const w = heldInR2();
  for (const t of ['sling the cooking pot across the room', 'toss the cooking pot at the east wall']) {
    assert.equal(isThrowIdiom(t), false, `"${t}" is not an idiom`);
    const r = pm(w, t);
    assert.match(mech(r), /object-throw/, `"${t}" is a genuine throw`);
    assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'placed', `"${t}" really throws it`);
  }
});

test('U699-L3 IDIOM canaries — throw open / throw my weight / throw up are NOT throws', () => {
  const w = heldInR2();
  for (const t of ['throw open the shutters', 'throw my weight against the door', 'throw up a barricade']) {
    const r = pm(w, t);
    assert.ok(!/object-throw/.test(mech(r)), `"${t}" must not be claimed by the throw gate`);
    assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'held', `"${t}" never throws the pot`);
  }
});

test('U699-L4 OWNERSHIP canaries — window / body / NPC stay with their seams, each pinned POSITIVELY', () => {
  const w = heldInR2();

  // 1. WINDOW — the window seam owns every projectile phrased through a window
  const rWin = pm(w, 'throw the cooking pot out the window');
  assert.match(mech(rWin), /\[window:shoot\|no-target\]/, 'the window seam still owns it — pinned exactly');
  assert.equal(lastEv(rWin.world).updateKind, 'physics', 'and records ITS updateKind, not ours');
  assert.ok(!/object-throw/.test(mech(rWin)), 'the throw gate does not steal it');

  // 2. BODY — "throw myself out the window" is a FALL, owned by the hazard path (U159)
  const rBody = pm(w, 'throw myself out the window');
  assert.match(mech(rBody), /\[hazard:fall \| \d+\]/, 'the HAZARD/fall seam owns it — pinned exactly');
  assert.equal(lastEv(rBody.world).updateKind, 'hazard', 'and records the hazard updateKind');
  assert.ok(rBody.world.meta.escapeHp < w.meta.escapeHp,
    'and the fall really costs the actor HP (meta.escapeHp) — the resulting STATE, not just the label');
  assert.ok(!/object-throw/.test(mech(rBody)), 'the throw gate does not steal it');
  assert.equal(resolvedObjectPlacement(rBody.world, POT)?.status, 'held', 'the pot is irrelevant to a fall — still held');

  // 3. NPC — a throw at a present NPC belongs to combat
  const rNpc = pm(w, 'throw the cooking pot at the bandit');
  assert.match(mech(rNpc), /\[strike:[^\]]*atk:\d+ vs AC:\d+/, 'COMBAT owns a throw at a present NPC — pinned exactly');
  assert.equal(lastEv(rNpc.world).updateKind, 'combat', 'and records the combat updateKind');
  assert.ok(rNpc.world.combat?.active, 'and the resulting state is a live combat');
  assert.ok(!/object-throw/.test(mech(rNpc)), 'the throw gate does not steal it');
  // KNOWN, SEPARATELY DEFERRED DEFECT (not this packet's to fix, and deliberately not
  // asserted as correct): combat substitutes the actor's WORN BLADE for the named pot,
  // so the player who said "throw the cooking pot" swings a sword. Ownership is what
  // L4 pins here; the substitution is queued on its own.
});

test('U699-L5 "throw a coin to Corwin" is not an environmental object throw', () => {
  const w = heldInR2();
  const r = pm(w, 'throw a coin to Corwin');
  assert.ok(!/object-throw/.test(mech(r)), 'not a supported projectile, not an aggression preposition');
});

test('U699-L6 SELF-TARGET is rejected in preflight with zero mutation', () => {
  const w = heldInR3(28, 50);
  const cell = legalPlaceTargetCell(w, POT, aKey(w), { kind: 'object', mode: 'throw', objectId: POT });
  assert.equal(cell, null, 'the writer refuses a self-reference');
  const r = pm(w, 'throw the cooking pot at the cooking pot');
  assert.equal(resolvedObjectPlacement(r.world, POT)?.status, 'held', 'zero mutation');
  assert.equal(r.world.objects?.[POT]?.durability, undefined, 'zero damage, zero draws');
});

// ══ M. canon ═════════════════════════════════════════════════════════════════

test('U699-M1 a routed throw ALWAYS emits a resolution event — including a refusal', () => {
  const w = heldInR2(6); // impossible capacity → refusal
  const r = pm(w, 'throw the cooking pot at the wall');
  const last = (r.world.timeline || []).slice(-1)[0];
  assert.equal(last?.data?.updateKind, 'object-throw', 'the refusal is still recorded deterministically');
});

test('U699-M2 a refusal does NOT append a dm.ruling (nothing physical happened)', () => {
  const w = heldInR2(6);
  const before = (w.canonLog?.events || []).length;
  const r = pm(w, 'throw the cooking pot at the wall');
  assert.equal((r.world.canonLog?.events || []).length, before, 'no ruling for a throw that never left your hands');
});

test('U699-M3 a landing appends a dm.ruling whose targetId is the PROJECTILE\'s real id', () => {
  const w = heldInR2();
  const r = pm(w, 'throw the cooking pot across the room');
  const rulings = (r.world.canonLog?.events || []).filter(e => e.type === 'dm.ruling');
  const mine = rulings.filter(e => e.targetId === POT);
  assert.equal(mine.length, 1, 'exactly one ruling, targeting a real canonical objectId');
});

test('U699-M4 the object-target id rides in resolution DATA when present', () => {
  const w = heldInR3(28, 50);
  const r = pm(w, 'throw the cooking pot at the bed');
  const last = (r.world.timeline || []).slice(-1)[0];
  assert.equal(last?.data?.objectId, POT, 'the projectile is the event subject');
  assert.equal(last?.data?.targetObjectId, BED2, 'the target rides in resolution data');
});

// ══ N. persistence ═══════════════════════════════════════════════════════════

test('U699-N1 save/import WHILE HELD → an identical throw from both worlds', () => {
  const w = heldInR2();
  const round = importWorld(exportWorld(w));
  const a = pm(w, 'throw the cooking pot at the east wall').world;
  const b = pm(round, 'throw the cooking pot at the east wall').world;
  assert.equal(worldHash(a), worldHash(b), 'a round-tripped held world throws identically');
});

test('U699-N2 save/import AFTER the landing preserves it, invariants clean', () => {
  const w = heldInR2();
  const r = pm(w, 'throw the cooking pot across the room');
  const round = importWorld(exportWorld(r.world));
  assert.deepEqual(cellOf(round, POT), cellOf(r.world, POT), 'the landing survives the round trip');
  assert.doesNotThrow(() => assertWorldInvariants(ensureWorld(round)), 'invariants clean');
});

test('U699-N3 an untouched world keeps today\'s truth byte-identically', () => {
  const w = boot2();
  assert.equal(worldHash(w), worldHash(boot2()), 'no overlay ⇒ no drift');
});

// ══ O. projection ════════════════════════════════════════════════════════════

test('U699-O1 the LIVE 2D lane follows the landing — inked at EXACTLY resolvedObjectPlacement().cell', () => {
  // The same live lane U698-R1 pins: renderContinuousMap → placeFromWorldNode, and the
  // SAME EXACT CONTRACT as U698-R1c. The first cut compared the projected centre against
  // landing/4 with a ±0.51 layout-unit tolerance — that is ±2 tactical cells, about ten
  // feet of permitted error, which would have passed on a genuinely wrong placement.
  // Round-trip the centre through the engine's own layoutToCells instead and deep-equal
  // the CELL. No tolerance, no test-side arithmetic mirror of the renderer.
  const liveFurn = (ww) => {
    const place = placeFromWorldNode(ww, NODE2);
    const b = (place?.buildings || []).find(x => String(x?.structureKey || '') === S2);
    return Array.isArray(b?.plan?.furniture) ? b.plan.furniture : [];
  };
  const itemCenter = (f) => ({ x: f.ux + f.uw / 2, y: f.uy + f.uh / 2 });
  const w = heldInR2();
  assert.equal(liveFurn(w).find(f => String(f.objectId || '') === POT), undefined, 'held → no floor ink');

  const r = pm(w, 'throw the cooking pot across the room');
  const p = resolvedObjectPlacement(r.world, POT);
  assert.equal(p.status, 'placed', 'it landed');
  const inked = liveFurn(r.world).find(f => String(f.objectId || '') === POT);
  assert.ok(inked, 'the landed pot is re-inked on the LIVE 2D sheet under its canonical objectId');
  const c = itemCenter(inked);
  assert.deepEqual({ x: layoutToCells(c.x), y: layoutToCells(c.y) }, p.cell,
    'the projected centre converts to EXACTLY the landing cell');
  // …and it is genuinely not still drawn at its birth spot
  const birth = authoredBaseAnchorCell(w, POT);
  assert.notDeepEqual({ x: layoutToCells(c.x), y: layoutToCells(c.y) }, birth,
    'the objectId is no longer projected at its birth location');
});

test('U699-O2 sceneSignature CHANGES on the landing — remount invalidation only, NOT 3D visibility', () => {
  const w = heldInR2();
  const before = sceneSignature(w);
  const r = pm(w, 'throw the cooking pot across the room');
  assert.notEqual(sceneSignature(r.world), before, 'a placedAt change invalidates the mounted scene ⇒ it must refresh');
  // SCOPE, stated so the title cannot be read as more: this proves the mounted 3D scene
  // is INVALIDATED and will remount. It does NOT prove the landed pot is visually
  // correct — or visible at all — in 3D. That acceptance is blocked on
  // INK-AUTHORED-FURNITURE-1 and will be tested from the same camera in that packet.
});

// ══ P. carry law ═════════════════════════════════════════════════════════════

test('U699-P1 a landing can never leave the structure (carry law by construction)', () => {
  const w = heldInR2();
  const r = pm(w, 'throw the cooking pot across the room');
  const p = resolvedObjectPlacement(r.world, POT);
  assert.equal(p.structureId, S2, 'it landed inside the same structure');
  assert.equal(p.node, NODE2, 'same node');
});

test('U699-P2 the carry-lock is unchanged — egress still refuses while holding', () => {
  const w = heldInR2();
  const r = pm(w, 'go outside');
  assert.equal(heldObjectOf(r.world, aKey(r.world))?.objectId, POT, 'still held, still refused');
});

test('U699-P3 THROW_NOISE is the declared product tuning', () => {
  assert.equal(THROW_NOISE.landing, 1, 'room landing / miss landing');
  assert.equal(THROW_NOISE.impact, 2, 'object or wall impact');
  assert.equal(THROW_NOISE.refused, 0, 'refusals are silent');
});
