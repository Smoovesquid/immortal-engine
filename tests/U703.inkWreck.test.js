// U703 — INK-WRECK-1: a DESTROYED authored piece stops drawing as an intact glyph.
//
// THE LIE THIS CLOSES (reproduced through the real turn path, FUNC-MINIS-1 b144's
// known gap): smash the authored barrel and the engine agrees it is gone — the twin
// leaves node.furniture, destroyedAuthoredPieceIds registers it, cover releases
// (coverFeatures.js) and its cell unblocks (tacticalPos.js liveAuthoredBlockedCells).
// The local 2D ink went on drawing an intact barrel at its birth spot anyway, so the
// player map claimed a barrel that no part of the world still believed in.
//
// THE ONE AUTHORITY. Suppression here reads destroyedAuthoredPieceIds — the SAME
// Set cover and blocking read — keyed by plan pieceId. No parallel destruction flag,
// no name/type guess, no renderer-owned state.
//
// SCOPE LIMIT, stated honestly (see U703-D). The queued row imagined two treatments
// (ABSENT ⇒ debris/nothing · WRECKED ⇒ greyed glyph). The live authority cannot tell
// those apart: destroyedAuthoredPieceIds returns ONE Set that unions "twin absent"
// with "twin present but terminal". Every other consumer in the engine — cover and
// blocking both — treats the two identically. So the renderer treats them identically
// too. Drawing them differently would be a distinction the engine does not make, i.e.
// exactly the renderer-owned state this packet forbids.
//
// PROCGEN is untouched by construction: buildAuthoredSceneFurniture only ever emits
// f.authored === 1 pieces, and a procgen structure never reaches that branch at all
// (drawInteriorV2 gates on isFinalizedAuthored / the stored authoredPlan). U703-E pins it.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { coverForRoom } from '../engine/structures/coverFeatures.js';
import { normalizeTopology } from '../engine/structures/topology.js';
import { destroyedAuthoredPieceIds, isFurnitureDestroyed } from '../engine/structures/authoredFurniture.js';
import { authoredObjectId } from '../engine/objects/identity.js';
import { buildAuthoredSceneFurniture, isFinalizedAuthored } from '../public/map/LocalMap.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));
const SEED = 'loaderDemo';           // the U661 barrel exemplar hut
const MAX_SMASHES = 24;

const boot = () => beginAdventure(newWorld({ seed: SEED, fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const st = (w) => w.structures.byId[`authored:${String(w.map.currentNodeId)}`];
const stId = (w) => String(st(w).id);
const nodeOf = (w) => (w.map.nodes || []).find(n => n && String(n.id) === String(w.map.currentNodeId));
const barrelTwin = (w) => (nodeOf(w)?.furniture || []).find(f => f && f.authored === true && String(f.name) === 'barrel') || null;
const hutRoom = (w) => normalizeTopology(st(w).topology).rooms[0];

// THE render projection under test — the exact call drawInteriorV2 makes.
const ink = (w) => buildAuthoredSceneFurniture(floorPlan(st(w)), w, stId(w));
const inkIds = (w) => ink(w).map(g => String(g.id));

// THE LIVE PLAYER SHEET — a SECOND, independent authored-furniture projection
// (placeFromNode.js flattenRoomFurniture), and the one the player actually sees:
// v1.js renderWalkPlace draws placeFromWorldNode → createPlaceMap, and its own
// comment (v1.js:159) records that renderLocalMap "survives ONLY as an error
// fallback". The queued row named LocalMap alone; fixing only that would have left
// the real map still lying, so both projections join the authority. Same lane U698-R1
// and U699-O1 already pin.
const liveSheet = (w) => {
  const place = placeFromWorldNode(w, String(w.map.currentNodeId));
  const b = (place?.buildings || []).find(x => String(x?.structureKey || '') === stId(w));
  return Array.isArray(b?.plan?.furniture) ? b.plan.furniture : [];
};
const liveSheetIds = (w) => liveSheet(w).filter(f => f.objectId).map(f => String(f.objectId));

// The plan pieceIds, resolved from the plan itself rather than hardcoded.
const planPieceIds = (w) => {
  const out = [];
  for (const r of floorPlan(st(w)).rooms || []) {
    for (const f of (r.furniture || [])) if (f && f.authored === 1) out.push(String(f.id));
  }
  return out;
};
const barrelPieceId = (w) => planPieceIds(w).find(id => {
  for (const r of floorPlan(st(w)).rooms || []) {
    const f = (r.furniture || []).find(x => String(x?.id) === id);
    if (f && /barrel/i.test(String(f.kind || ''))) return true;
  }
  return false;
});
const bedPieceId = (w) => planPieceIds(w).find(id => {
  for (const r of floorPlan(st(w)).rooms || []) {
    const f = (r.furniture || []).find(x => String(x?.id) === id);
    if (f && /bed/i.test(String(f.kind || ''))) return true;
  }
  return false;
});

// Smash until the barrel is destroyed, through the REAL player path. Deterministic
// by seed. (U661's technique — the salvage lane removes the twin outright.)
function smashToWreck(world) {
  let w = world;
  for (let i = 0; i < MAX_SMASHES; i++) {
    const p = barrelTwin(w);
    if (!p || isFurnitureDestroyed(p)) break;
    w = playerMove(w, PACKS, 'I smash the barrel.').world;
  }
  return w;
}

test('U703-A BEFORE — an intact authored barrel really does draw its glyph on the local 2D ink', () => {
  const w = boot();
  assert.equal(isFinalizedAuthored(st(w)), true, 'setup: the hut takes the engine-furniture render branch');
  assert.ok(barrelTwin(w), 'setup: the barrel twin is live node furniture');
  assert.equal(destroyedAuthoredPieceIds(w, st(w)).size, 0, 'setup: nothing is destroyed yet');

  const bId = authoredObjectId(stId(w), barrelPieceId(w));
  assert.ok(inkIds(w).includes(bId), 'the intact barrel IS inked — the honest state this packet must not break');
  // and it draws with real geometry, not a degenerate point
  const g = ink(w).find(x => String(x.id) === bId);
  assert.ok(g.uw > 0 && g.uh > 0, 'with real dimensions');
  assert.ok(Number.isFinite(g.ux) && Number.isFinite(g.uy), 'at a real position');
});

test('U703-B AFTER — the DESTROYED barrel no longer draws as intact, while the untouched bed still does', () => {
  const w0 = boot();
  const bId = authoredObjectId(stId(w0), barrelPieceId(w0));
  const bedId = authoredObjectId(stId(w0), bedPieceId(w0));
  assert.ok(inkIds(w0).includes(bId) && inkIds(w0).includes(bedId), 'setup: both start inked');

  const w = smashToWreck(w0);

  // ENGINE TRUTH first — the world already agrees the barrel is gone.
  const dead = destroyedAuthoredPieceIds(w, st(w));
  assert.equal(dead.size, 1, 'exactly the barrel is registered destroyed');
  assert.ok(dead.has(barrelPieceId(w)), 'and it is the barrel by pieceId');
  assert.ok(!coverForRoom(hutRoom(w), { world: w, structureId: stId(w) }).some(c => c.kind === 'barrel'),
    'cover already released it — the ink was the last liar');

  // THE FIX (evolved by OBJ-RUBBLE-1/U704) — the ink stops claiming an intact
  // barrel: the entry survives, RE-TYPED to rubble at the same spot.
  const gDead = ink(w).find(x => String(x.id) === bId);
  assert.ok(gDead, 'the destroyed barrel still has an entry — rubble, not a hole');
  assert.equal(gDead.type, 'rubble', 'inked as rubble, never as an intact barrel');
  const ids = inkIds(w);
  // …and the honest neighbour is untouched: suppression is per-piece, not a blanket.
  assert.ok(ids.includes(bedId), 'the intact bed still draws normally');
  const bedBefore = ink(w0).find(g => String(g.id) === bedId);
  const bedAfter = ink(w).find(g => String(g.id) === bedId);
  assert.deepEqual(bedAfter, bedBefore, 'the bed glyph is byte-identical — nothing else moved or changed');
});

test('U703-B2 THE PLAYER MAP — the LIVE sheet (placeFromNode) also stops inking the destroyed barrel', () => {
  // The map-fidelity law: a map fix is not DONE until it registers on the map the
  // player actually looks at. That map is placeFromWorldNode's flattened plan, NOT
  // LocalMap's drawInteriorV2 (an error fallback). This is the assertion that proves
  // the packet, and it fails even with LocalMap fully fixed.
  const w0 = boot();
  const bId = authoredObjectId(stId(w0), barrelPieceId(w0));
  const bedId = authoredObjectId(stId(w0), bedPieceId(w0));
  assert.ok(liveSheetIds(w0).includes(bId), 'setup: the intact barrel IS on the live player sheet');

  const w = smashToWreck(w0);
  assert.ok(destroyedAuthoredPieceIds(w, st(w)).has(barrelPieceId(w)), 'engine truth: destroyed');

  const ids = liveSheetIds(w);
  const sheetDead = liveSheet(w).find(f => String(f.objectId) === bId);
  assert.ok(sheetDead, 'the destroyed barrel keeps a live-sheet entry — rubble, not a hole (OBJ-RUBBLE-1/U704)');
  assert.equal(sheetDead.type, 'rubble', 'typed rubble on the sheet the player actually sees');
  assert.ok(ids.includes(bedId), 'the intact bed still inks on the live sheet');
  const bedBefore = liveSheet(w0).find(f => String(f.objectId) === bedId);
  const bedAfter = liveSheet(w).find(f => String(f.objectId) === bedId);
  assert.deepEqual(bedAfter, bedBefore, 'the bed ink is byte-identical on the live sheet');
});

test('U703-B3 the live sheet keeps NON-authored plan ink byte-identical through a destruction', () => {
  // flattenRoomFurniture inks authored AND role-fallback/procedural pieces. The
  // suppression sits strictly inside the authored branch, so everything else must be
  // untouched — before and after.
  const w0 = boot();
  const w = smashToWreck(w0);
  const nonAuthored = (ww) => liveSheet(ww).filter(f => !f.objectId);
  assert.deepEqual(nonAuthored(w), nonAuthored(w0),
    'every non-authored glyph on the live sheet is byte-identical after the smash');
});

test('U703-C the suppression is keyed to the ENGINE authority, not a name or type guess', () => {
  // A piece the authority does NOT call destroyed keeps its ink, even though it shares
  // the barrel's kind/name space. Proven by construction: with an empty destroyed set
  // the projection is byte-identical to the intact one.
  const w = boot();
  assert.equal(destroyedAuthoredPieceIds(w, st(w)).size, 0, 'nothing destroyed');
  assert.deepEqual(ink(w), ink(boot()), 'an empty destroyed set ⇒ the projection is unchanged, byte for byte');

  // And the re-typed ids are exactly the authority's Set, joined by pieceId → objectId
  // (OBJ-RUBBLE-1/U704 evolved suppression into re-typing; the key stays the authority).
  const wDead = smashToWreck(boot());
  const dead = [...destroyedAuthoredPieceIds(wDead, st(wDead))];
  const retyped = ink(wDead).filter(g => g.type === 'rubble').map(g => String(g.id));
  assert.deepEqual(retyped.sort(), dead.map(pid => authoredObjectId(stId(wDead), pid)).sort(),
    'the set of glyphs re-typed to rubble IS the authority\'s destroyed set — no more, no less');
});

test('U703-D SCOPE — absent and wrecked are ONE state at this boundary, exactly as the engine treats them', () => {
  // The live player path (salvage lane) produces ABSENT: the twin leaves node.furniture.
  const w = smashToWreck(boot());
  assert.equal(barrelTwin(w), null, 'the real smash REMOVES the twin — this is the reachable destroyed state');
  assert.ok(destroyedAuthoredPieceIds(w, st(w)).has(barrelPieceId(w)), 'and the authority registers it destroyed');

  // destroyedAuthoredPieceIds unions "twin absent" with "twin present but terminal"
  // and returns no discriminator. This test PINS that limit so a future packet that
  // wants the two-tier visual (debris vs greyed glyph) must widen the authority first,
  // deliberately, rather than have the renderer invent the distinction.
  const dead = destroyedAuthoredPieceIds(w, st(w));
  assert.ok(dead instanceof Set, 'the authority is a flat Set of pieceIds');
  for (const id of dead) assert.equal(typeof id, 'string', 'carrying no absent-vs-wrecked discriminator');
});

// EVOLVED 2026-07-16 (FURN-PARITY-1, DEATH-TRUTH-1 finish): the second half of
// this test used to pin the OLD suppression (a procgen structure's plan
// furniture yielded an EMPTY scene set — "procgen keeps its hand-drawn catalog
// art"). The parity packet retired that: procgen loadout pieces are engine truth
// now and DO emit scene glyphs. What this test still owns: (1) the AUTHORED
// structure's ink stays authored-only, and (2) a destruction in the authored
// building leaves the procgen structure's scene set byte-identical (no
// cross-structure bleed).
test('U703-E authored ink stays authored; destruction never bleeds across structures', () => {
  const w = boot();
  // Every emitted glyph of the AUTHORED hut corresponds to a plan piece marked authored === 1.
  const authoredIds = new Set(planPieceIds(w).map(pid => authoredObjectId(stId(w), pid)));
  for (const id of inkIds(w)) assert.ok(authoredIds.has(id), `${id} is an authored piece — no procgen leaks in`);

  const proc = Object.values(w.structures.byId).find(s => s && !isFinalizedAuthored(s));
  if (proc) {
    assert.equal(isFinalizedAuthored(proc), false, 'a procgen structure is still not Builder-authored');
    const before = buildAuthoredSceneFurniture(floorPlan(proc), w, String(proc.id));
    // …and destroying the authored barrel changes nothing about the NEIGHBOUR.
    const wDead = smashToWreck(boot());
    const procAfter = Object.values(wDead.structures.byId).find(s => s && String(s.id) === String(proc.id));
    assert.deepEqual(buildAuthoredSceneFurniture(floorPlan(procAfter), wDead, String(procAfter.id)), before,
      'the procgen structure\'s scene set is byte-identical after a destruction elsewhere');
  }
});
