// U442–U445 — TAC-2: the tactical move verb (docs/POSITION_AS_CANON.md §3).
//
// TAC-1 gave the engine a canonical tactical position `pos` (cells-in-canon, 5 ft
// per cell), DARK. TAC-2 wires the MOVE VERB onto it: a typed cardinal walk ("go
// east", "walk north", "step west 10 ft") resolves as a walk of `pos` of UP TO 6
// cells (30 ft) per turn within the current frame, committed as an { op:'pos' } delta
// through effectsCore.applyDeltas() — THE MOVEMENT LAW (Tim, locked): self-powered
// movement is ONLY ≤6 squares/turn and a tactical walk NEVER changes map.currentNodeId
// (journeys/fast-travel are the separate, landed JR-1 path).
//
// U442 — a walk east moves pos exactly the asked cells (≤6) and never touches the node
//         (region frame, clean headroom); the same gesture works live through playerMove.
// U443 — a >30 ft ask CLAMPS to the 6-cell budget, and the narration carries the READ
//         (never a number / cell coordinate — THE LAW).
// U444 — an interior cross-room walk passes through a doorway (the adjacent room) and
//         updates scene.interior.roomId consistently with the pos invariant (roomOf(pos)
//         agrees), while the node stays put.
// U445 — determinism: the same walk twice → identical world hash; a fresh replay of the
//         move sequence hashes identically (pos is in the hash).
//
// Pure, LLM-off (deterministic). Behaviour is driven through the REAL player gesture
// (playerMove) from the live slice boot; the exact-cell math uses the pure resolver.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newWorld, ensureWorld, WORLD_VERSION } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldHash } from '../engine/worldHash.js';
import { buildPreRolledCharacter } from '../engine/chargen/preRolled.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import {
  resolveTacticalWalk, MAX_WALK_CELLS,
  roomOfStructCell, nearestNodeToRegionCell
} from '../engine/map/spatial/tacticalPos.js';
import { floorPlan } from '../engine/structures/floorPlan.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadPacks() {
  const packsDir = path.join(ROOT, 'packs');
  const manifest = normalizeManifest(JSON.parse(fs.readFileSync(path.join(packsDir, 'manifest.json'), 'utf-8')));
  const out = {};
  for (const p of manifest.packs) out[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(ROOT, p.path), 'utf-8')));
  return out;
}
const PACKS = loadPacks();

// The exact live boot: pre-rolled hero into the Aldermere slice. Drops the player
// INSIDE the wake room (scene.interior set), with settlement NPCs at the node.
function bootIndoors() {
  const pc = buildPreRolledCharacter({ id: 'bryn' });
  const w0 = newWorld({ seed: SLICE_SEED, fate: 0.2, campaignId: `campaign-${SLICE_SEED}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const w1 = ensureWorld({ ...w0, party: [pc] });
  return beginAdventure(w1, PACKS).world;
}

// A minimal single-node OUTDOOR world with clean region-frame headroom around the
// node centre, so a cardinal walk has room to move the full budget without a wall or
// a node-projection edge in the way. The player starts placed near the node centre.
function bootOutdoorHeadroom() {
  return ensureWorld({
    meta: { seed: 'u442-region', version: WORLD_VERSION, fate: 0.2 },
    map: {
      currentNodeId: 'n0',
      nodes: [{ id: 'n0', name: 'Field', x: 0, y: 0, nodeType: 'settlement' }],
      edges: [],
      pos: { x: 0, y: 0 }
    },
    party: [{ id: 'party', name: 'Hero' }],
    scene: { interior: null }
  });
}

// ── U442 — a cardinal walk moves pos exactly, never the node ───────────────────

test('U442-01: WORLD_VERSION is 33 (TAC-2 added no schema; MR-2a doors → 31; SP-2 faction ethos → 32; OBJ-STATE-1 objects → 33)', () => {
  assert.equal(WORLD_VERSION, 33);
});

test('U442-02: resolveTacticalWalk moves pos EXACTLY the asked cells (≤6) with clean headroom', () => {
  const w = bootOutdoorHeadroom();
  const p0 = w.party[0].pos;
  assert.equal(p0.frame, 'region', 'player is outdoors → region frame');
  // Ask for 3 cells east — clean headroom, so exactly 3 cells advance on +x.
  const walk = resolveTacticalWalk(w, { actorId: 'party', dir: 'east', cells: 3 });
  assert.ok(walk, 'the walk resolves');
  assert.equal(walk.movedCells, 3, 'moved exactly 3 cells');
  assert.equal(walk.pos.gx, p0.gx + 3, 'gx advanced by 3');
  assert.equal(walk.pos.gy, p0.gy, 'gy unchanged (east is +x only)');
  assert.equal(walk.pos.frame, p0.frame, 'frame unchanged by a walk');
});

test('U442-03: an { op:\'pos\' } delta is the sole mutation path and survives ensureWorld', () => {
  const w = bootOutdoorHeadroom();
  const before = w.party[0].pos;
  const walk = resolveTacticalWalk(w, { actorId: 'party', dir: 'north', cells: 4 });
  const w1 = applyDeltas(w, [{ op: 'pos', id: 'party', to: walk.pos }]);
  // The commit landed on the canonical pos, and it's a consistent state (survives the
  // backfill instead of being healed away — the region cell still projects to n0).
  assert.equal(w1.party[0].pos.gy, before.gy - 4, 'north is −y: gy dropped by 4');
  assert.equal(nearestNodeToRegionCell(w1.map, w1.party[0].pos.gx, w1.party[0].pos.gy), 'n0', 'still projects to the current node');
  assert.doesNotThrow(() => assertWorldInvariants(w1), 'the committed pos is invariant-clean');
});

test('U442-04: a live "walk north" walks pos and NEVER changes the node (THE MOVEMENT LAW)', () => {
  const w = bootIndoors();
  const nodeBefore = String(w.map.currentNodeId);
  const posBefore = w.party[0].pos;
  const r = playerMove(w, PACKS, 'walk north');
  // Node is structurally unchanged by a self-powered move.
  assert.equal(String(r.world.map.currentNodeId), nodeBefore, 'node unchanged by a tactical walk');
  // pos actually moved (the wake room has north headroom on the slice) and stays in
  // the same struct frame — a real committed move, not a bounce.
  const posAfter = r.world.party[0].pos;
  assert.equal(posAfter.frame, posBefore.frame, 'still the same struct frame');
  assert.ok(posAfter.gy < posBefore.gy || posAfter.gx !== posBefore.gx, 'pos advanced');
  // Invariant-clean, and the narration is a read, not the machine leaking.
  assert.doesNotThrow(() => assertWorldInvariants(r.world), 'invariant-clean after the walk');
  assert.doesNotMatch(r.output.narration, /doesn't give it to you|roll:|DC:/i, `no nonsense roll leak: ${r.output.narration}`);
});

// ── U443 — clamp to the 6-cell budget, narrate the read ────────────────────────

test('U443-01: a >30 ft ask CLAMPS to the 6-cell budget', () => {
  const w = bootOutdoorHeadroom();
  const p0 = w.party[0].pos;
  const walk = resolveTacticalWalk(w, { actorId: 'party', dir: 'east', cells: 20 });
  assert.equal(walk.movedCells, MAX_WALK_CELLS, `clamped to the ${MAX_WALK_CELLS}-cell budget`);
  assert.equal(walk.pos.gx, p0.gx + MAX_WALK_CELLS, 'advanced exactly the budget');
  assert.equal(walk.clampedToBudget, true, 'flagged as clamped');
});

test('U443-02: the budget is 6 cells = 30 ft (THE MOVEMENT LAW)', () => {
  assert.equal(MAX_WALK_CELLS, 6, 'six 5-ft squares = 30 ft per turn');
});

test('U443-03: the clamp narration carries the READ, never a number or a cell coordinate', () => {
  // A room-scale over-ask indoors ("go 100 feet east") clamps; the DM narrates the
  // read. THE LAW: no "6 squares", no "30 ft", no "gx,gy". (The wake room's east side
  // may be a wall or a doorway on the slice — either honest resolution still obeys the
  // no-number rule; that is what this asserts.)
  const w = bootIndoors();
  const r = playerMove(w, PACKS, 'go 100 feet north');
  assert.doesNotMatch(r.output.narration, /\bsquares?\b|\bcells?\b|\d+\s*ft|\d+\s*feet|gx|gy|\bcoordinate/i,
    `narration must be a read, not a number: ${r.output.narration}`);
  assert.equal(String(r.world.map.currentNodeId), String(w.map.currentNodeId), 'still no node change on the clamped walk');
});

// ── U444 — cross-room walk through a doorway, roomId consistent ────────────────

test('U444-01: a cardinal walk into an adjacent room passes through the doorway and updates roomId', () => {
  const w = bootIndoors();
  const roomBefore = String(w.scene.interior.roomId);
  const nodeBefore = String(w.map.currentNodeId);
  // On the slice wake room, "go east" leads to the adjacent Hearth Room (a real
  // doorway). It must land there — a room change, not a same-room wall walk.
  const r = playerMove(w, PACKS, 'go east');
  const roomAfter = String(r.world.scene?.interior?.roomId || '');
  assert.notEqual(roomAfter, roomBefore, 'the room actually changed (crossed a doorway)');
  assert.match(r.output.narration, /step through into|move east into|move on into/i, `narrates the room move: ${r.output.narration}`);
  // Node stays put — a room move is never node travel.
  assert.equal(String(r.world.map.currentNodeId), nodeBefore, 'node unchanged');
  // The pos invariant holds: the committed pos cell lands in EXACTLY the room
  // scene.interior now names (roomOf(pos) agrees) — the contract's consistency rule.
  const posAfter = r.world.party[0].pos;
  const st = r.world.structures.byId[String(r.world.scene.interior.structureKey)];
  const roomOfPos = roomOfStructCell(floorPlan(st), posAfter.gx, posAfter.gy);
  assert.equal(roomOfPos, roomAfter, 'roomOf(pos) agrees with scene.interior.roomId after the cross-room walk');
  assert.doesNotThrow(() => assertWorldInvariants(r.world), 'invariant-clean after the doorway crossing');
});

test('U444-02: a same-room walk (no adjacent room that way) does NOT cross a doorway', () => {
  const w = bootIndoors();
  const roomBefore = String(w.scene.interior.roomId);
  // "walk north" from the wake room has no adjacent room north on the slice — so it is
  // a WITHIN-room pos walk: same room, pos advanced, honest read.
  const r = playerMove(w, PACKS, 'walk north');
  assert.equal(String(r.world.scene?.interior?.roomId || ''), roomBefore, 'stayed in the same room (walked the floor, not through a door)');
  const st = r.world.structures.byId[String(r.world.scene.interior.structureKey)];
  const roomOfPos = roomOfStructCell(floorPlan(st), r.world.party[0].pos.gx, r.world.party[0].pos.gy);
  assert.equal(roomOfPos, roomBefore, 'the walked pos is still inside the current room');
});

// ── U445 — determinism ─────────────────────────────────────────────────────────

test('U445-01: the same tactical walk twice → identical world hash', () => {
  const w = bootIndoors();
  const a = playerMove(w, PACKS, 'walk north').world;
  const b = playerMove(w, PACKS, 'walk north').world;
  assert.equal(worldHash(a), worldHash(b), 'a deterministic walk hashes identically across two runs');
  assert.equal(JSON.stringify(a.party[0].pos), JSON.stringify(b.party[0].pos), 'pos identical');
});

test('U445-02: a two-move sequence replays to the same hash (pos is in the hash)', () => {
  const w = bootIndoors();
  const run = (start) => {
    let s = playerMove(start, PACKS, 'walk north').world; // within-room pos walk
    s = playerMove(s, PACKS, 'go east').world;            // cross-room doorway
    return s;
  };
  const h1 = worldHash(run(w));
  const h2 = worldHash(run(bootIndoors())); // a fresh, independent boot of the same seed
  assert.equal(h1, h2, 'the same move sequence from the same seed replays to the same hash');
});

test('U445-03: committing the SAME pos is a no-op on the hash (idempotent write)', () => {
  const w = bootIndoors();
  const same = w.party[0].pos;
  const w1 = applyDeltas(w, [{ op: 'pos', id: 'party', to: same }]);
  assert.equal(worldHash(ensureWorld(w1)), worldHash(w), 'writing the current pos back changes nothing');
});
