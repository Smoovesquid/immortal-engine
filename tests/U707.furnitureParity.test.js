// U707 — FURN-PARITY-1: procgen furniture is ONE object across every surface.
//
// THE LIE THIS CLOSES (DEATH-TRUTH-1 finish, evidence 2026-07-16): a procgen
// structure carried TWO unrelated furniture realities — Model A (node.furniture,
// 2–4 generateNodeFurniture templates: what you could smash) and Model B (the
// roomDetail role loadout: what the map DREW, what granted cover, what blocked
// walking). Salvaging Model A's 'straw pallet' left the sheet drawing all 16
// loadout pieces intact, zero rubble, cover and blocking untouched (repro
// 2026-07-16: destroyedObjectIdsAtNode had the id; the sheet showed nothing).
//
// THE FIX: the roomDetail loadout pieces of a procgen structure are seeded into
// node.furniture as REAL Model A pieces (seedProcgenNodeFurniture, mirroring
// seedAuthoredNodeFurniture) with provenance { planSourced, structureId, roomId,
// pieceId } and identity objectId = au:<structureId>:<planPieceId> — so the piece
// you smash IS the piece the map draws, the cover you lose IS the piece that
// stood there, by IDENTITY, never by name or affinity guess. Authored structures
// (st.authoredPlan) are byte-identical: their role-fallback loadout rooms stay
// narration-only (FUNC-MINIS ruling: an empty authored room stays visibly empty).
//
// Supported-domain verbs (hold/drag/throw) stay authored-only — this packet is
// destruction truth, not verb parity (the legacy take/smash/salvage/burn paths
// pick the new pieces up by name exactly as they picked up templates).

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { PACKS } from '../scripts/convergence/fixtures.mjs';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { normalizeTopology } from '../engine/structures/topology.js';
import { coverForRoom } from '../engine/structures/coverFeatures.js';
import { liveAuthoredBlockedCells, layoutToCells } from '../engine/map/spatial/tacticalPos.js';
import { destroyedObjectIdsAtNode } from '../engine/objects/query.js';
import { FURN } from '../engine/structures/roomDetail.js';
import { AUTHORED_KIND_MATERIALS, procgenPlanPieceStatus } from '../engine/structures/authoredFurniture.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld, importWorld } from '../engine/save.js';

const SEED = 'reprofp1'; // evidence seed: boot node holds ONE procgen structure (3 rooms, 16 loadout pieces)
const boot = () => beginAdventure(newWorld({ seed: SEED, fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const say = (w, t) => playerMove(w, PACKS, t).world;
const nodeOf = (w) => (w.map.nodes || []).find(n => n && n.id === w.map.currentNodeId);
const procgenStructAt = (w, nid) => Object.values(w.structures?.byId || {})
  .find(s => s && !s.authoredPlan && String(s.nodeId) === String(nid) && floorPlan(s).rooms.length);

const loadoutItems = (st) => floorPlan(st).rooms.flatMap(r =>
  (r.furniture || []).filter(f => f && f.authored !== 1).map(f => ({ ...f, roomId: String(r.id) })));

const sheetFurnitureFor = (w, nid, stId) => {
  const sheet = placeFromWorldNode(w, nid);
  const bld = (sheet?.buildings || []).find(b => String(b.structureKey || '') === String(stId));
  return bld?.plan?.furniture || [];
};

// The player boots INSIDE the procgen structure; interaction candidates are
// room-scoped (that scoping is itself the parity working — a piece in the
// cellar is not smashable from the hearth room), so destruction targets must
// come from the CURRENT room.
const inCurrentRoom = (w, pred) => {
  const roomId = String(w.scene?.interior?.roomId || '');
  return (nodeOf(w).furniture || []).find(p =>
    p && p.planSourced === true && String(p.roomId) === roomId && pred(p));
};

// ── A. every FURN kind carries real physics (fail-closed, like U695) ─────────
test('U707-A every roomDetail FURN kind has an explicit Model A physics row', () => {
  const covered = new Set(AUTHORED_KIND_MATERIALS.map(k => k.kind));
  for (const kind of Object.keys(FURN)) {
    assert.ok(covered.has(kind), `FURN kind '${kind}' has no KIND_PHYSICS row — a seeded piece would get silent defaults`);
  }
});

// ── B. the loadout IS the furniture: every Model B item has a Model A twin ───
test('U707-B every procgen loadout item is seeded as a real node.furniture piece, by identity', () => {
  const w = boot();
  const node = nodeOf(w);
  const st = procgenStructAt(w, node.id);
  assert.ok(st, 'boot node has a procgen structure');
  const items = loadoutItems(st);
  assert.ok(items.length >= 8, `structure has a real loadout (${items.length} items)`);
  const byObjectId = new Map((node.furniture || []).map(p => [String(p.objectId), p]));
  for (const it of items) {
    const oid = `au:${st.id}:${it.id}`;
    const twin = byObjectId.get(oid);
    assert.ok(twin, `loadout item ${it.id} (${it.kind}) has a Model A twin ${oid}`);
    assert.equal(twin.planSourced, true, 'twin carries planSourced provenance');
    assert.equal(String(twin.roomId), it.roomId, 'twin knows its real room — no affinity guess');
    assert.equal(String(twin.kind), String(it.kind), 'twin carries the plan kind');
    assert.notEqual(twin.authored, true, 'a plan-sourced piece is NOT builder-authored (verb domain unchanged)');
  }
  // seeding is once-per-structure: marker recorded
  assert.ok((node.furnitureSeeded || []).map(String).includes(String(st.id)), 'furnitureSeeded marker recorded');
});

// ── C. destruction registers on EVERY surface, by identity ───────────────────
test('U707-C salvage a loadout wardrobe: rubble on the sheet at its own spot; same-kind neighbours intact; cover and blocking release', () => {
  let w = boot();
  const node = nodeOf(w);
  const st = procgenStructAt(w, node.id);
  const barrel = inCurrentRoom(w, p => p.kind === 'wardrobe' && p.name === 'wardrobe');
  assert.ok(barrel, 'a plan-sourced wardrobe stands in the boot room');

  const before = sheetFurnitureFor(w, node.id, st.id);
  const beforeEntry = before.find(f => String(f.objectId || '') === String(barrel.objectId));
  assert.ok(beforeEntry, 'the sheet draws exactly this wardrobe (identity carried onto the ink)');
  assert.equal(beforeEntry.type, 'wardrobe', 'intact before');
  const blockedBefore = liveAuthoredBlockedCells(w, st);

  w = say(w, 'I smash the wardrobe to pieces.');
  const dead = destroyedObjectIdsAtNode(w, node.id);
  assert.ok(dead.has(String(barrel.objectId)), `destruction memory has the identity (${[...dead]})`);

  const after = sheetFurnitureFor(w, node.id, st.id);
  const afterEntry = after.find(f => String(f.objectId || '') === String(barrel.objectId));
  assert.ok(afterEntry, 'the entry survives — re-typed, never erased');
  assert.equal(afterEntry.type, 'rubble', 'destroyed piece draws rubble, never its intact glyph');
  assert.ok(Math.abs(afterEntry.ux - beforeEntry.ux) < 1e-9 && Math.abs(afterEntry.uy - beforeEntry.uy) < 1e-9,
    'rubble sits exactly where the piece stood');
  // identity, not name: every OTHER barrel-kind entry stays intact
  for (const f of after) {
    if (String(f.objectId || '') === String(barrel.objectId)) continue;
    assert.notEqual(f.type, 'rubble', `neighbour ${f.objectId || f.type} untouched`);
  }

  // cover releases — the room's coverForRoom no longer offers this piece
  const topo = normalizeTopology(st.topology);
  const room = topo.rooms.find(r => String(r.id) === String(barrel.roomId));
  const cover = coverForRoom(room, { world: w, structureId: String(st.id) });
  assert.ok(!cover.some(c => String(c.id) === String(barrel.pieceId)), 'smashed wardrobe grants no cover');

  // blocking releases — PER IDENTITY: the smashed piece stops contributing its
  // anchor cell. At PLACE_WU resolution several pieces can anchor the SAME cell
  // (this room's bed + lantern share the wardrobe's), so the cell itself frees
  // only when no intact sharer remains — assert exactly that contract.
  const fp = floorPlan(st);
  const fpRoom = fp.rooms.find(r => String(r.id) === String(barrel.roomId));
  const item = (fpRoom.furniture || []).find(f => String(f.id) === String(barrel.pieceId));
  const anchorOf = (rm, it) => `${layoutToCells(rm.cx + (it.fx - 0.5) * rm.w)},${layoutToCells(rm.cy + (it.fy - 0.5) * rm.h)}`;
  const anchor = anchorOf(fpRoom, item);
  assert.ok(blockedBefore.has(anchor), 'the wardrobe blocked its anchor cell while intact');
  const live = procgenPlanPieceStatus(w, st);
  const intactSharers = fp.rooms.flatMap(rm => (rm.furniture || []).filter(f2 =>
    f2 && !f2.flat && String(f2.id) !== String(barrel.pieceId)
    && anchorOf(rm, f2) === anchor
    && (!live.seeded || (live.present.has(String(f2.id)) && !live.destroyed.has(String(f2.id))))));
  const blockedAfter = liveAuthoredBlockedCells(w, st);
  if (intactSharers.length === 0) {
    assert.ok(!blockedAfter.has(anchor), 'no intact sharer remains — the cell frees');
  } else {
    assert.ok(blockedAfter.has(anchor), 'an intact sharer still anchors the cell — it honestly stays blocked');
  }

  // and once EVERY intact sharer is destroyed too, the cell frees outright
  // (fixture fact on this seed: bed + lantern share the wardrobe's anchor).
  for (const sharer of intactSharers) {
    const twin = (nodeOf(w).furniture || []).find(p => p.planSourced === true && String(p.pieceId) === String(sharer.id));
    assert.ok(twin, `sharer ${sharer.kind} has a live twin to smash`);
    w = say(w, `I smash the ${twin.name} to pieces.`);
  }
  assert.ok(!liveAuthoredBlockedCells(w, st).has(anchor),
    'with the wardrobe and every sharer destroyed, the cell finally frees');
});

// ── D. taken ≠ destroyed: a carried-off piece leaves NOTHING, never rubble ───
test('U707-D taking a loadout piece removes its ink without minting rubble', () => {
  let w = boot();
  const node = nodeOf(w);
  const st = procgenStructAt(w, node.id);
  const small = inCurrentRoom(w, p => (Number(p.bulk) || 9) <= 2 && p.name === p.kind);
  assert.ok(small, `a takeable plan-sourced piece stands in the boot room (${(node.furniture || []).filter(p => p.planSourced).map(p => `${p.kind}:${p.bulk}@${p.roomId}`).join(',')})`);
  w = say(w, `I take the ${small.name}.`);
  const gone = !(nodeOf(w).furniture || []).some(p => String(p.objectId) === String(small.objectId));
  assert.ok(gone, 'the take actually removed the piece (legacy path)');
  const after = sheetFurnitureFor(w, node.id, st.id);
  assert.ok(!after.some(f => String(f.objectId || '') === String(small.objectId)), 'taken piece draws nothing');
  assert.ok(!destroyedObjectIdsAtNode(w, node.id).has(String(small.objectId)), 'and never joins destruction memory');
});

// ── E. presence tells the truth after the removal — and over a wreck ─────────
test('U707-E a salvaged loadout piece stops answering as present', () => {
  let w = boot();
  const table = inCurrentRoom(w, p => p.kind === 'wardrobe' && p.name === 'wardrobe');
  w = say(w, 'I smash the wardrobe to pieces.');
  const stillListed = (nodeOf(w).furniture || []).some(p => String(p.objectId) === String(table.objectId));
  assert.equal(stillListed, false, 'the salvaged piece left node.furniture — presence has nothing intact to claim');
});

test('U707-E2 a wrecked-in-place piece answers as wreckage, never as the intact thing', () => {
  let w = boot();
  // Wreck "the chest" through the production declared-attack lane, letting the
  // route pick its own target (name resolution owns which chest-named piece the
  // swing lands on) — the claim is LANE-level: once ANY chest-named piece lies
  // wrecked, a presence question must answer the wreckage, not the intact thing.
  const wreckedChest = (x) => (x.map.nodes.find(n => n.id === x.map.currentNodeId).furniture || [])
    .find(p => /chest/i.test(String(p.name)) && String(p.state) === 'wrecked');
  for (let i = 0; i < 24 && !wreckedChest(w); i++) {
    w = playerMove(w, PACKS, 'I attack the chest with my hammer.').world;
  }
  assert.ok(wreckedChest(w), 'the strikes wrecked a chest in place (fixture: deterministic on this seed)');
  const q = playerMove(w, PACKS, 'Is there a chest here?');
  const line = String(q.output?.narration || '');
  assert.match(line, /wreckage/i, `the answer names the wreckage: ${line}`);
  assert.doesNotMatch(line, /Yes — there's/, 'never the intact claim');
});

// ── F. save/load and revisit keep the aftermath ──────────────────────────────
test('U707-F rubble survives an export/import round-trip', () => {
  let w = boot();
  const node = nodeOf(w);
  const st = procgenStructAt(w, node.id);
  const table = inCurrentRoom(w, p => p.kind === 'wardrobe' && p.name === 'wardrobe');
  w = say(w, 'I smash the wardrobe to pieces.');
  const w2 = importWorld(exportWorld(w));
  const after = sheetFurnitureFor(w2, node.id, st.id);
  const entry = after.find(f => String(f.objectId || '') === String(table.objectId));
  assert.ok(entry && entry.type === 'rubble', 'rubble persists across save/load');
});

// ── G. determinism: seeding is replay-stable ─────────────────────────────────
test('U707-G two fresh boots produce identical worlds (hash equality)', () => {
  assert.equal(worldHash(boot()), worldHash(boot()));
});
